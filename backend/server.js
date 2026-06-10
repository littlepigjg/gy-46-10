import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import getDb from './db.js';
import { startScheduler, triggerScreenshotNow } from './scheduler.js';
import {
  generateAutoTags,
  applyAutoTags,
  recordTaggingFeedback,
  autoTagAllScreenshots,
  getTagTrends,
  getTagHierarchy
} from './taggingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

app.get('/api/urls', async (req, res) => {
  const db = await getDb();
  const urls = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM screenshots s WHERE s.url_id = u.id) as screenshot_count
    FROM urls u
    ORDER BY u.created_at DESC
  `).all();
  res.json(urls);
});

app.post('/api/urls', async (req, res) => {
  const { url, name, frequency = 'daily' } = req.body;

  if (!url || !name) {
    return res.status(400).json({ error: 'URL和名称必填' });
  }

  const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly'];
  if (!validFrequencies.includes(frequency)) {
    return res.status(400).json({ error: '无效的频率' });
  }

  try {
    const db = await getDb();
    const stmt = db.prepare('INSERT INTO urls (url, name, frequency) VALUES (?, ?, ?)');
    const result = stmt.run(url, name, frequency);

    const newUrl = db.prepare('SELECT * FROM urls WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newUrl);
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('unique')) {
      res.status(400).json({ error: '该URL已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/urls/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const screenshots = db.prepare('SELECT file_path FROM screenshots WHERE url_id = ?').all(id);
  screenshots.forEach(s => {
    if (fs.existsSync(s.file_path)) {
      fs.unlinkSync(s.file_path);
      const dir = path.dirname(s.file_path);
      try {
        if (fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
        }
      } catch (e) {}
    }
  });

  db.prepare('DELETE FROM screenshots WHERE url_id = ?').run(id);
  const stmt = db.prepare('DELETE FROM urls WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

app.put('/api/urls/:id', async (req, res) => {
  const { id } = req.params;
  const { name, frequency, status } = req.body;
  const db = await getDb();

  const existing = db.prepare('SELECT * FROM urls WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'URL不存在' });
  }

  const finalName = name || existing.name;
  const finalFrequency = frequency || existing.frequency;
  const finalStatus = status || existing.status;

  const stmt = db.prepare('UPDATE urls SET name = ?, frequency = ?, status = ? WHERE id = ?');
  stmt.run(finalName, finalFrequency, finalStatus, id);

  const updated = db.prepare('SELECT * FROM urls WHERE id = ?').get(id);
  res.json(updated);
});

app.get('/api/urls/:id/screenshots', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  const screenshots = db.prepare(`
    SELECT * FROM screenshots
    WHERE url_id = ?
    ORDER BY created_at DESC
  `).all(id);
  res.json(screenshots);
});

app.get('/api/screenshots/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);
  if (!screenshot) {
    return res.status(404).json({ error: '截图不存在' });
  }
  res.json(screenshot);
});

app.delete('/api/screenshots/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);
  if (!screenshot) {
    return res.status(404).json({ error: '截图不存在' });
  }

  if (fs.existsSync(screenshot.file_path)) {
    fs.unlinkSync(screenshot.file_path);
  }

  db.prepare('DELETE FROM screenshots WHERE id = ?').run(id);
  res.json({ success: true });
});

app.post('/api/urls/:id/screenshot', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await triggerScreenshotNow(parseInt(id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/urls/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  const url = db.prepare('SELECT * FROM urls WHERE id = ?').get(id);
  if (!url) {
    return res.status(404).json({ error: 'URL不存在' });
  }
  res.json(url);
});

app.get('/api/tags', async (req, res) => {
  const db = await getDb();
  const { search, limit, sort } = req.query;

  let sql = `
    SELECT t.*,
      (SELECT COUNT(*) FROM screenshot_tags st WHERE st.tag_id = t.id) as screenshot_count
    FROM tags t
  `;

  const params = [];
  const conditions = [];

  if (search) {
    conditions.push('(t.name LIKE ? OR EXISTS (SELECT 1 FROM tag_synonyms ts WHERE ts.tag_id = t.id AND ts.synonym LIKE ?))');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const orderBy = sort === 'usage' ? 'usage_count DESC' : sort === 'name' ? 'name ASC' : 'usage_count DESC';
  sql += ` ORDER BY ${orderBy}`;

  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
  }

  const tags = db.prepare(sql).all(...params);

  for (const tag of tags) {
    tag.synonyms = db.prepare(`
      SELECT synonym FROM tag_synonyms WHERE tag_id = ?
    `).all(tag.id).map(s => s.synonym);
  }

  res.json(tags);
});

app.get('/api/tags/hierarchy', async (req, res) => {
  try {
    const hierarchy = await getTagHierarchy();
    res.json(hierarchy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const trends = await getTagTrends(days);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags/popular', async (req, res) => {
  const db = await getDb();
  const limit = parseInt(req.query.limit) || 20;

  const tags = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM screenshot_tags st WHERE st.tag_id = t.id) as screenshot_count
    FROM tags t
    ORDER BY usage_count DESC
    LIMIT ?
  `).all(limit);

  res.json(tags);
});

app.post('/api/tags', async (req, res) => {
  const { name, color, description, parent_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '标签名称必填' });
  }

  const db = await getDb();

  try {
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(400).json({ error: '标签已存在' });
    }

    const result = db.prepare(`
      INSERT INTO tags (name, color, description, parent_id, is_auto, usage_count)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(name.trim(), color || '#3B82F6', description || null, parent_id || null);

    const newTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    newTag.synonyms = [];
    newTag.screenshot_count = 0;

    res.status(201).json(newTag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tags/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color, description, parent_id } = req.body;

  const db = await getDb();
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ error: '标签不存在' });
  }

  if (parent_id && parseInt(parent_id) === parseInt(id)) {
    return res.status(400).json({ error: '父标签不能是自己' });
  }

  try {
    if (name && name.trim() !== existing.name) {
      const duplicate = db.prepare('SELECT * FROM tags WHERE name = ? AND id != ?').get(name.trim(), id);
      if (duplicate) {
        return res.status(400).json({ error: '标签名称已存在' });
      }
    }

    db.prepare(`
      UPDATE tags SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        description = COALESCE(?, description),
        parent_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      color || null,
      description || null,
      parent_id || null,
      id
    );

    const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    updated.synonyms = db.prepare(`
      SELECT synonym FROM tag_synonyms WHERE tag_id = ?
    `).all(id).map(s => s.synonym);
    updated.screenshot_count = db.prepare(`
      SELECT COUNT(*) as count FROM screenshot_tags WHERE tag_id = ?
    `).get(id).count;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tags/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '标签不存在' });
  }

  try {
    db.prepare('UPDATE tags SET parent_id = NULL WHERE parent_id = ?').run(id);
    db.prepare('DELETE FROM tag_synonyms WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM screenshot_tags WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tag_rules WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tagging_feedback WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tags/:id/synonyms', async (req, res) => {
  const { id } = req.params;
  const { synonym } = req.body;

  if (!synonym || !synonym.trim()) {
    return res.status(400).json({ error: '同义词必填' });
  }

  const db = await getDb();
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);

  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }

  try {
    const existing = db.prepare('SELECT * FROM tag_synonyms WHERE synonym = ?').get(synonym.trim());
    if (existing) {
      return res.status(400).json({ error: '同义词已存在' });
    }

    const result = db.prepare(`
      INSERT INTO tag_synonyms (tag_id, synonym)
      VALUES (?, ?)
    `).run(id, synonym.trim());

    res.status(201).json({ id: result.lastInsertRowid, synonym: synonym.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tags/:id/synonyms/:synonym', async (req, res) => {
  const { id, synonym } = req.params;
  const db = await getDb();

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }

  db.prepare('DELETE FROM tag_synonyms WHERE tag_id = ? AND synonym = ?').run(id, synonym);
  res.json({ success: true });
});

app.get('/api/screenshots/:id/tags', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const tags = db.prepare(`
    SELECT t.*, st.confidence, st.is_manual, st.created_at as tagged_at
    FROM screenshot_tags st
    JOIN tags t ON st.tag_id = t.id
    WHERE st.screenshot_id = ?
    ORDER BY st.is_manual DESC, st.confidence DESC
  `).all(id);

  res.json(tags);
});

app.post('/api/screenshots/:id/tags', async (req, res) => {
  const { id } = req.params;
  const { tag_id, tag_name, features } = req.body;

  const db = await getDb();

  const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);
  if (!screenshot) {
    return res.status(404).json({ error: '截图不存在' });
  }

  let finalTagId = tag_id;

  if (!finalTagId && tag_name) {
    let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(tag_name.trim());
    if (!tag) {
      const result = db.prepare(`
        INSERT INTO tags (name, is_auto, usage_count)
        VALUES (?, 0, 0)
      `).run(tag_name.trim());
      finalTagId = result.lastInsertRowid;
    } else {
      finalTagId = tag.id;
    }
  }

  if (!finalTagId) {
    return res.status(400).json({ error: '标签ID或名称必填' });
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO screenshot_tags (screenshot_id, tag_id, confidence, is_manual)
      VALUES (?, ?, 1.0, 1)
    `).run(id, finalTagId, 1.0, 1);

    await recordTaggingFeedback(id, finalTagId, 'add', features);

    const tags = db.prepare(`
      SELECT t.*, st.confidence, st.is_manual, st.created_at as tagged_at
      FROM screenshot_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
      ORDER BY st.is_manual DESC, st.confidence DESC
    `).all(id);

    res.status(201).json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/screenshots/:id/tags/:tagId', async (req, res) => {
  const { id, tagId } = req.params;
  const { features } = req.body;

  const db = await getDb();

  const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);
  if (!screenshot) {
    return res.status(404).json({ error: '截图不存在' });
  }

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }

  try {
    db.prepare('DELETE FROM screenshot_tags WHERE screenshot_id = ? AND tag_id = ?').run(id, tagId);
    await recordTaggingFeedback(id, tagId, 'remove', features);

    const tags = db.prepare(`
      SELECT t.*, st.confidence, st.is_manual, st.created_at as tagged_at
      FROM screenshot_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
      ORDER BY st.is_manual DESC, st.confidence DESC
    `).all(id);

    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/screenshots/:id/retag', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const shot = db.prepare(`
    SELECT s.id, s.created_at, s.page_title, s.meta_description, s.meta_keywords, u.url
    FROM screenshots s
    JOIN urls u ON s.url_id = u.id
    WHERE s.id = ?
  `).get(id);

  if (!shot) {
    return res.status(404).json({ error: '截图不存在' });
  }

  try {
    const result = await applyAutoTags(
      shot.id, shot.url, shot.created_at,
      shot.page_title, shot.meta_description, shot.meta_keywords
    );

    const tags = db.prepare(`
      SELECT t.*, st.confidence, st.is_manual, st.created_at as tagged_at
      FROM screenshot_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
      ORDER BY st.is_manual DESC, st.confidence DESC
    `).all(id);

    res.json({ tags, auto_tags: result.tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tags/auto-tag-all', async (req, res) => {
  try {
    const result = await autoTagAllScreenshots();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags/rules', async (req, res) => {
  const db = await getDb();
  const rules = db.prepare(`
    SELECT tr.*, t.name as tag_name
    FROM tag_rules tr
    JOIN tags t ON tr.tag_id = t.id
    ORDER BY tr.created_at DESC
  `).all();
  res.json(rules);
});

app.post('/api/tags/rules', async (req, res) => {
  const { tag_id, rule_type, rule_pattern, weight } = req.body;

  if (!tag_id || !rule_type || !rule_pattern) {
    return res.status(400).json({ error: '标签ID、规则类型和规则模式必填' });
  }

  const validTypes = ['url_contains', 'url_regex', 'domain_is', 'path_contains'];
  if (!validTypes.includes(rule_type)) {
    return res.status(400).json({ error: '无效的规则类型' });
  }

  const db = await getDb();

  try {
    const result = db.prepare(`
      INSERT INTO tag_rules (tag_id, rule_type, rule_pattern, weight)
      VALUES (?, ?, ?, ?)
    `).run(tag_id, rule_type, rule_pattern, weight || 1.0);

    const rule = db.prepare(`
      SELECT tr.*, t.name as tag_name
      FROM tag_rules tr
      JOIN tags t ON tr.tag_id = t.id
      WHERE tr.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tags/rules/:id', async (req, res) => {
  const { id } = req.params;
  const { rule_type, rule_pattern, weight, is_active } = req.body;

  const db = await getDb();
  const existing = db.prepare('SELECT * FROM tag_rules WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ error: '规则不存在' });
  }

  try {
    db.prepare(`
      UPDATE tag_rules SET
        rule_type = COALESCE(?, rule_type),
        rule_pattern = COALESCE(?, rule_pattern),
        weight = COALESCE(?, weight),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      rule_type || null,
      rule_pattern || null,
      weight || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    const rule = db.prepare(`
      SELECT tr.*, t.name as tag_name
      FROM tag_rules tr
      JOIN tags t ON tr.tag_id = t.id
      WHERE tr.id = ?
    `).get(id);

    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tags/rules/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const existing = db.prepare('SELECT * FROM tag_rules WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '规则不存在' });
  }

  db.prepare('DELETE FROM tag_rules WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get('/api/screenshots', async (req, res) => {
  const db = await getDb();
  const { tags, search, url_id, page = 1, limit = 20 } = req.query;

  let sql = `
    SELECT DISTINCT s.*, u.url, u.name as url_name
    FROM screenshots s
    JOIN urls u ON s.url_id = u.id
  `;

  const params = [];
  const conditions = [];

  if (tags) {
    const tagList = Array.isArray(tags) ? tags : tags.split(',');
    const placeholders = tagList.map(() => '?').join(',');

    sql += `
      JOIN screenshot_tags st ON s.id = st.screenshot_id
      JOIN tags t ON st.tag_id = t.id
    `;

    conditions.push(`t.name IN (${placeholders})`);
    params.push(...tagList);

    sql += `
      AND s.id IN (
        SELECT st2.screenshot_id
        FROM screenshot_tags st2
        JOIN tags t2 ON st2.tag_id = t2.id
        WHERE t2.name IN (${placeholders})
        GROUP BY st2.screenshot_id
        HAVING COUNT(DISTINCT t2.name) = ?
      )
    `;
    params.push(...tagList, tagList.length);
  }

  if (search) {
    conditions.push(`(u.name LIKE ? OR u.url LIKE ? OR s.page_title LIKE ? OR s.meta_description LIKE ?)`);
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (url_id) {
    conditions.push('s.url_id = ?');
    params.push(parseInt(url_id));
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const countSql = `SELECT COUNT(DISTINCT s.id) as total FROM (${sql})`;
  const total = db.prepare(countSql).all(...params)[0]?.total || 0;

  sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const screenshots = db.prepare(sql).all(...params);

  for (const shot of screenshots) {
    shot.tags = db.prepare(`
      SELECT t.*, st.confidence, st.is_manual
      FROM screenshot_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
      ORDER BY st.is_manual DESC, st.confidence DESC
    `).all(shot.id);
  }

  res.json({
    screenshots,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

app.get('/api/screenshots/:id/preview-tags', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const shot = db.prepare(`
    SELECT s.id, s.created_at, s.page_title, s.meta_description, s.meta_keywords, u.url
    FROM screenshots s
    JOIN urls u ON s.url_id = u.id
    WHERE s.id = ?
  `).get(id);

  if (!shot) {
    return res.status(404).json({ error: '截图不存在' });
  }

  try {
    const result = await generateAutoTags(
      shot.id, shot.url, shot.created_at,
      shot.page_title, shot.meta_description, shot.meta_keywords
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
  await getDb();
  startScheduler();
});
