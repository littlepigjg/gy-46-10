import cron from 'node-cron';
import getDb from './db.js';
import { takeScreenshot } from './screenshot.js';
import { applyAutoTags } from './taggingEngine.js';

function shouldRunNow(frequency, lastRun) {
  if (!lastRun) return true;
  const now = new Date();
  const last = new Date(lastRun);
  const diff = now - last;

  switch (frequency) {
    case 'hourly':
      return diff >= 60 * 60 * 1000;
    case 'daily':
      return diff >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return diff >= 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return diff >= 30 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

async function runAllDueTasks() {
  console.log('[调度器] 检查待执行任务...');
  const db = await getDb();
  const urls = db.prepare('SELECT * FROM urls WHERE status = ?').all('active');

  for (const urlRecord of urls) {
    if (shouldRunNow(urlRecord.frequency, urlRecord.last_screenshot_at)) {
      console.log(`[调度器] 执行截图: ${urlRecord.url}`);
      try {
        const result = await takeScreenshot(urlRecord);
        console.log(`[调度器] 截图完成: ${urlRecord.url}`);

        const db = await getDb();
        const shot = db.prepare(`
          SELECT s.id, s.created_at, s.page_title, s.meta_description, s.meta_keywords, u.url
          FROM screenshots s
          JOIN urls u ON s.url_id = u.id
          WHERE s.id = ?
        `).get(result.id);

        if (shot) {
          await applyAutoTags(
            shot.id, shot.url, shot.created_at,
            shot.page_title, shot.meta_description, shot.meta_keywords
          );
          console.log(`[调度器] 自动标签完成: ${urlRecord.url}`);
        }
      } catch (err) {
        console.error(`[调度器] 截图失败 [${urlRecord.url}]:`, err.message);
      }
    }
  }
}

export function startScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    await runAllDueTasks();
  });

  console.log('[调度器] 定时任务已启动 (每5分钟检查一次)');

  setTimeout(() => {
    runAllDueTasks();
  }, 3000);
}

export async function triggerScreenshotNow(urlId) {
  const db = await getDb();
  const urlRecord = db.prepare('SELECT * FROM urls WHERE id = ?').get(urlId);
  if (!urlRecord) {
    throw new Error('URL不存在');
  }
  const result = await takeScreenshot(urlRecord);

  const shot = db.prepare(`
    SELECT s.id, s.created_at, s.page_title, s.meta_description, s.meta_keywords, u.url
    FROM screenshots s
    JOIN urls u ON s.url_id = u.id
    WHERE s.id = ?
  `).get(result.id);

  if (shot) {
    await applyAutoTags(
      shot.id, shot.url, shot.created_at,
      shot.page_title, shot.meta_description, shot.meta_keywords
    );
  }

  return result;
}
