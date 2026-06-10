import getDb from './db.js';
import { URL } from 'url';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

const DOMAIN_CATEGORIES = {
  'github.com': { tags: ['开发', '代码', 'Git'], weight: 1.5 },
  'stackoverflow.com': { tags: ['开发', '问答', '编程'], weight: 1.5 },
  'developer.mozilla.org': { tags: ['开发', '文档', 'Web'], weight: 1.5 },
  'npmjs.com': { tags: ['开发', 'Node.js', '包管理'], weight: 1.4 },
  'npmjs.com': { tags: ['开发', 'Node.js', '包管理'], weight: 1.4 },
  'youtube.com': { tags: ['视频', '娱乐', 'YouTube'], weight: 1.4 },
  'bilibili.com': { tags: ['视频', '娱乐', 'B站'], weight: 1.4 },
  'twitter.com': { tags: ['社交', 'Twitter'], weight: 1.3 },
  'x.com': { tags: ['社交', 'Twitter'], weight: 1.3 },
  'weibo.com': { tags: ['社交', '微博'], weight: 1.3 },
  'zhihu.com': { tags: ['问答', '知识', '知乎'], weight: 1.4 },
  'baidu.com': { tags: ['搜索', '百度'], weight: 1.3 },
  'google.com': { tags: ['搜索', 'Google'], weight: 1.3 },
  'taobao.com': { tags: ['购物', '淘宝'], weight: 1.4 },
  'tmall.com': { tags: ['购物', '天猫'], weight: 1.4 },
  'jd.com': { tags: ['购物', '京东'], weight: 1.4 },
  'amazon.com': { tags: ['购物', '亚马逊'], weight: 1.4 },
  'news': { tags: ['新闻'], weight: 1.2 },
  'blog': { tags: ['博客'], weight: 1.1 },
  'doc': { tags: ['文档'], weight: 1.1 },
  'admin': { tags: ['管理后台'], weight: 1.3 },
  'dashboard': { tags: ['仪表盘'], weight: 1.2 },
  'api': { tags: ['API', '开发'], weight: 1.3 },
  'dev': { tags: ['开发'], weight: 1.1 },
  'test': { tags: ['测试'], weight: 1.1 },
  'prod': { tags: ['生产'], weight: 1.1 }
};

const TIME_PATTERNS = [
  { range: [0, 6], tags: ['凌晨'], weight: 0.8 },
  { range: [6, 9], tags: ['早晨'], weight: 0.7 },
  { range: [9, 12], tags: ['上午'], weight: 0.7 },
  { range: [12, 14], tags: ['中午'], weight: 0.7 },
  { range: [14, 18], tags: ['下午'], weight: 0.7 },
  { range: [18, 22], tags: ['晚上'], weight: 0.7 },
  { range: [22, 24], tags: ['深夜'], weight: 0.8 }
];

const WEEKDAY_PATTERNS = {
  0: { tags: ['周日'], weight: 0.6 },
  6: { tags: ['周六'], weight: 0.6 }
};

const KEYWORD_CATEGORIES = [
  { keywords: ['登录', 'login', 'signin', '注册', 'register', 'signup'], tags: ['账户'], weight: 1.2 },
  { keywords: ['错误', 'error', '404', '500', '异常', 'exception'], tags: ['错误页'], weight: 1.5 },
  { keywords: ['付款', '支付', 'payment', 'checkout', '订单', 'order'], tags: ['支付'], weight: 1.4 },
  { keywords: ['用户', 'user', '个人中心', 'profile'], tags: ['用户中心'], weight: 1.2 },
  { keywords: ['搜索', 'search', '查找'], tags: ['搜索页'], weight: 1.1 },
  { keywords: ['列表', 'list', '目录', 'catalog'], tags: ['列表页'], weight: 1.0 },
  { keywords: ['详情', 'detail', '产品', 'product', '商品'], tags: ['详情页'], weight: 1.1 },
  { keywords: ['配置', 'config', '设置', 'setting', 'preference'], tags: ['配置页'], weight: 1.2 },
  { keywords: ['报表', 'report', '统计', 'statistics', '分析', 'analytics'], tags: ['报表'], weight: 1.3 },
  { keywords: ['图表', 'chart', 'graph', '可视化', 'visualization'], tags: ['图表'], weight: 1.3 },
  { keywords: ['下载', 'download', '导出', 'export'], tags: ['下载'], weight: 1.1 },
  { keywords: ['上传', 'upload', '导入', 'import'], tags: ['上传'], weight: 1.1 },
  { keywords: ['确认', 'confirm', '提交', 'submit'], tags: ['操作确认'], weight: 1.0 },
  { keywords: ['教程', '教程', 'guide', 'tutorial', '学习', 'learn'], tags: ['教程'], weight: 1.2 },
  { keywords: ['帮助', 'help', 'faq', '支持', 'support'], tags: ['帮助'], weight: 1.1 }
];

const URL_PATH_PATTERNS = [
  { pattern: /\/admin/, tags: ['管理后台'], weight: 1.3 },
  { pattern: /\/dashboard/, tags: ['仪表盘'], weight: 1.2 },
  { pattern: /\/api/, tags: ['API'], weight: 1.3 },
  { pattern: /\/blog/, tags: ['博客'], weight: 1.1 },
  { pattern: /\/news/, tags: ['新闻'], weight: 1.2 },
  { pattern: /\/product/, tags: ['产品'], weight: 1.1 },
  { pattern: /\/category/, tags: ['分类'], weight: 1.0 },
  { pattern: /\/tag/, tags: ['标签'], weight: 0.9 },
  { pattern: /\/search/, tags: ['搜索'], weight: 1.1 },
  { pattern: /\/login/, tags: ['登录'], weight: 1.3 },
  { pattern: /\/register/, tags: ['注册'], weight: 1.2 },
  { pattern: /\/checkout/, tags: ['支付'], weight: 1.4 },
  { pattern: /\/cart/, tags: ['购物车'], weight: 1.3 },
  { pattern: /\/user/, tags: ['用户'], weight: 1.0 },
  { pattern: /\/profile/, tags: ['个人中心'], weight: 1.2 }
];

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return '';
  }
}

function extractUrlFeatures(url) {
  const features = [];
  const domain = extractDomain(url);

  if (domain) {
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      features.push({ type: 'domain_exact', value: domain });
      const tld = domainParts.slice(-2).join('.');
      features.push({ type: 'domain_tld', value: tld });
      const sld = domainParts.slice(0, -1).join('.');
      features.push({ type: 'domain_keyword', value: sld });
      domainParts.forEach(part => {
        if (part && part !== 'www' && part !== 'com' && part !== 'net' && part !== 'org') {
          features.push({ type: 'domain_part', value: part });
        }
      });
    }
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    pathParts.forEach((part, idx) => {
      features.push({ type: 'path_segment', value: part.toLowerCase(), position: idx });
    });

    const searchParams = new URLSearchParams(urlObj.search);
    for (const [key] of searchParams) {
      features.push({ type: 'query_param', value: key.toLowerCase() });
    }
  } catch {}

  return features;
}

function extractTimeFeatures(timestamp) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const dayOfWeek = date.getDay();
  const features = [];

  features.push({ type: 'hour', value: hour });
  features.push({ type: 'day_of_week', value: dayOfWeek });

  const timePattern = TIME_PATTERNS.find(p => hour >= p.range[0] && hour < p.range[1]);
  if (timePattern) {
    timePattern.tags.forEach(tag => {
      features.push({ type: 'time_period', value: tag, weight: timePattern.weight });
    });
  }

  const weekdayPattern = WEEKDAY_PATTERNS[dayOfWeek];
  if (weekdayPattern) {
    weekdayPattern.tags.forEach(tag => {
      features.push({ type: 'weekday', value: tag, weight: weekdayPattern.weight });
    });
  }

  return features;
}

function extractContentFeatures(pageTitle, metaDescription, metaKeywords) {
  const features = [];
  const allText = [pageTitle, metaDescription, metaKeywords].filter(Boolean).join(' ').toLowerCase();

  if (!allText) return features;

  KEYWORD_CATEGORIES.forEach(category => {
    const found = category.keywords.some(kw => allText.includes(kw.toLowerCase()));
    if (found) {
      category.tags.forEach(tag => {
        features.push({ type: 'content_keyword', value: tag, weight: category.weight });
      });
    }
  });

  const words = allText.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
  const wordFreq = {};
  words.forEach(word => {
    if (word.length >= 2) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  Object.entries(wordFreq)
    .filter(([_, count]) => count >= 2)
    .forEach(([word, count]) => {
      features.push({ type: 'frequent_word', value: word, weight: Math.min(count * 0.2, 1.0) });
    });

  return features;
}

function calculateBaseConfidence(features) {
  const tagScores = {};

  features.forEach(feature => {
    const weight = feature.weight || 1.0;

    if (feature.type === 'domain_exact' && DOMAIN_CATEGORIES[feature.value]) {
      const cat = DOMAIN_CATEGORIES[feature.value];
      cat.tags.forEach(tag => {
        tagScores[tag] = (tagScores[tag] || 0) + weight * cat.weight;
      });
    }

    if (feature.type === 'domain_part') {
      const exactMatch = DOMAIN_CATEGORIES[feature.value];
      if (exactMatch) {
        exactMatch.tags.forEach(tag => {
          tagScores[tag] = (tagScores[tag] || 0) + weight * exactMatch.weight * 0.8;
        });
      }
    }

    if (feature.type === 'time_period' || feature.type === 'weekday') {
      tagScores[feature.value] = (tagScores[feature.value] || 0) + weight;
    }

    if (feature.type === 'content_keyword') {
      tagScores[feature.value] = (tagScores[feature.value] || 0) + weight;
    }

    if (feature.type === 'path_segment') {
      URL_PATH_PATTERNS.forEach(pattern => {
        if (pattern.pattern.test('/' + feature.value)) {
          pattern.tags.forEach(tag => {
            tagScores[tag] = (tagScores[tag] || 0) + weight * pattern.weight;
          });
        }
      });
    }
  });

  const maxScore = Math.max(...Object.values(tagScores), 1);
  const result = [];

  for (const [tag, score] of Object.entries(tagScores)) {
    const normalizedConfidence = Math.min(score / maxScore, 1.0);
    if (normalizedConfidence >= DEFAULT_CONFIDENCE_THRESHOLD) {
      result.push({ tag, confidence: normalizedConfidence });
    }
  }

  return result;
}

async function applyLearnedWeights(screenshotId, baseTags) {
  const db = await getDb();

  const feedbackData = db.prepare(`
    SELECT tag_id, action, features
    FROM tagging_feedback
    WHERE screenshot_id = ?
  `).all(screenshotId);

  const tagWeights = {};

  feedbackData.forEach(fb => {
    const adjustment = fb.action === 'add' ? 0.2 : fb.action === 'remove' ? -0.3 : 0;
    tagWeights[fb.tag_id] = (tagWeights[fb.tag_id] || 0) + adjustment;
  });

  const allFeedback = db.prepare(`
    SELECT t.name as tag_name, tf.action, COUNT(*) as count
    FROM tagging_feedback tf
    JOIN tags t ON tf.tag_id = t.id
    GROUP BY tf.tag_id, tf.action
  `).all();

  const globalWeights = {};
  allFeedback.forEach(fb => {
    if (!globalWeights[fb.tag_name]) globalWeights[fb.tag_name] = 0;
    const adjustment = fb.action === 'add' ? 0.05 * fb.count : fb.action === 'remove' ? -0.05 * fb.count : 0;
    globalWeights[fb.tag_name] += adjustment;
  });

  return baseTags.map(({ tag, confidence }) => {
    let adjusted = confidence;
    if (tagWeights[tag]) adjusted += tagWeights[tag];
    if (globalWeights[tag]) adjusted += globalWeights[tag];
    return { tag, confidence: Math.max(0, Math.min(1, adjusted)) };
  }).filter(t => t.confidence >= DEFAULT_CONFIDENCE_THRESHOLD * 0.8);
}

async function applyCustomRules(url, tags) {
  const db = await getDb();
  const rules = db.prepare(`
    SELECT t.name as tag_name, tr.rule_type, tr.rule_pattern, tr.weight
    FROM tag_rules tr
    JOIN tags t ON tr.tag_id = t.id
    WHERE tr.is_active = 1
  `).all();

  const urlLower = url.toLowerCase();

  rules.forEach(rule => {
    let match = false;
    try {
      switch (rule.rule_type) {
        case 'url_contains':
          match = urlLower.includes(rule.rule_pattern.toLowerCase());
          break;
        case 'url_regex':
          match = new RegExp(rule.rule_pattern, 'i').test(url);
          break;
        case 'domain_is':
          match = extractDomain(url) === rule.rule_pattern.toLowerCase();
          break;
        case 'path_contains':
          try {
            const urlObj = new URL(url);
            match = urlObj.pathname.toLowerCase().includes(rule.rule_pattern.toLowerCase());
          } catch {}
          break;
      }
    } catch {}

    if (match) {
      const existing = tags.find(t => t.tag === rule.tag_name);
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + rule.weight * 0.3);
      } else {
        tags.push({ tag: rule.tag_name, confidence: Math.min(1, rule.weight) });
      }
    }
  });

  return tags;
}

async function applySynonyms(tags) {
  const db = await getDb();
  const allSynonyms = db.prepare(`
    SELECT t.name as tag_name, ts.synonym
    FROM tag_synonyms ts
    JOIN tags t ON ts.tag_id = t.id
  `).all();

  const synonymMap = {};
  allSynonyms.forEach(s => {
    if (!synonymMap[s.synonym.toLowerCase()]) {
      synonymMap[s.synonym.toLowerCase()] = s.tag_name;
    }
  });

  const result = [];
  const seen = new Set();

  tags.forEach(({ tag, confidence }) => {
    const canonical = synonymMap[tag.toLowerCase()] || tag;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push({ tag: canonical, confidence });
    } else {
      const existing = result.find(t => t.tag === canonical);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, confidence);
      }
    }
  });

  return result;
}

export async function generateAutoTags(screenshotId, url, createdAt, pageTitle, metaDescription, metaKeywords) {
  const urlFeatures = extractUrlFeatures(url);
  const timeFeatures = extractTimeFeatures(createdAt);
  const contentFeatures = extractContentFeatures(pageTitle, metaDescription, metaKeywords);

  const allFeatures = [...urlFeatures, ...timeFeatures, ...contentFeatures];

  let tags = calculateBaseConfidence(allFeatures);

  tags = await applyCustomRules(url, tags);

  tags = await applyLearnedWeights(screenshotId, tags);

  tags = await applySynonyms(tags);

  tags.sort((a, b) => b.confidence - a.confidence);

  return {
    tags,
    features: JSON.stringify(allFeatures)
  };
}

export async function applyAutoTags(screenshotId, url, createdAt, pageTitle, metaDescription, metaKeywords) {
  const db = await getDb();

  const existingAutoTags = db.prepare(`
    SELECT tag_id FROM screenshot_tags
    WHERE screenshot_id = ? AND is_manual = 0
  `).all(screenshotId).map(r => r.tag_id);

  if (existingAutoTags.length > 0) {
    db.prepare(`
      DELETE FROM screenshot_tags
      WHERE screenshot_id = ? AND is_manual = 0
    `).run(screenshotId);
  }

  const { tags, features } = await generateAutoTags(
    screenshotId, url, createdAt, pageTitle, metaDescription, metaKeywords
  );

  for (const { tag, confidence } of tags) {
    let tagRecord = db.prepare('SELECT * FROM tags WHERE name = ?').get(tag);

    if (!tagRecord) {
      const result = db.prepare(`
        INSERT INTO tags (name, is_auto, usage_count)
        VALUES (?, 1, 0)
      `).run(tag);
      tagRecord = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    }

    try {
      db.prepare(`
        INSERT OR IGNORE INTO screenshot_tags (screenshot_id, tag_id, confidence, is_manual)
        VALUES (?, ?, ?, 0)
      `).run(screenshotId, tagRecord.id, confidence);

      db.prepare(`
        UPDATE tags SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tagRecord.id);
    } catch (e) {
      console.error('应用标签失败:', e.message);
    }
  }

  return { tags, features };
}

export async function recordTaggingFeedback(screenshotId, tagId, action, features) {
  const db = await getDb();

  db.prepare(`
    INSERT INTO tagging_feedback (screenshot_id, tag_id, action, features)
    VALUES (?, ?, ?, ?)
  `).run(screenshotId, tagId, action, features || null);

  const tagRecord = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
  if (tagRecord) {
    if (action === 'add') {
      db.prepare(`
        UPDATE tags SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tagId);
    } else if (action === 'remove') {
      db.prepare(`
        UPDATE tags SET usage_count = MAX(0, usage_count - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tagId);
    }
  }
}

export async function autoTagAllScreenshots() {
  const db = await getDb();

  const screenshots = db.prepare(`
    SELECT s.id, s.created_at, s.page_title, s.meta_description, s.meta_keywords, u.url
    FROM screenshots s
    JOIN urls u ON s.url_id = u.id
    ORDER BY s.created_at DESC
  `).all();

  let processed = 0;
  for (const shot of screenshots) {
    await applyAutoTags(
      shot.id,
      shot.url,
      shot.created_at,
      shot.page_title,
      shot.meta_description,
      shot.meta_keywords
    );
    processed++;
  }

  return { processed, total: screenshots.length };
}

export async function getTagTrends(days = 30) {
  const db = await getDb();

  const trends = db.prepare(`
    SELECT
      t.id,
      t.name,
      t.color,
      DATE(st.created_at) as date,
      COUNT(*) as count
    FROM screenshot_tags st
    JOIN tags t ON st.tag_id = t.id
    WHERE st.created_at >= DATE('now', '-' || ? || ' days')
    GROUP BY t.id, DATE(st.created_at)
    ORDER BY date ASC, count DESC
  `).all(days);

  return trends;
}

export async function getTagHierarchy() {
  const db = await getDb();

  const tags = db.prepare(`
    SELECT * FROM tags ORDER BY parent_id IS NULL DESC, usage_count DESC
  `).all();

  const tagMap = new Map();
  const roots = [];

  tags.forEach(tag => {
    tag.children = [];
    tagMap.set(tag.id, tag);
  });

  tags.forEach(tag => {
    if (tag.parent_id && tagMap.has(tag.parent_id)) {
      tagMap.get(tag.parent_id).children.push(tag);
    } else if (!tag.parent_id) {
      roots.push(tag);
    }
  });

  return roots;
}

export default {
  generateAutoTags,
  applyAutoTags,
  recordTaggingFeedback,
  autoTagAllScreenshots,
  getTagTrends,
  getTagHierarchy
};
