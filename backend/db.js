import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data.db');

let dbInstance = null;

function wrapStatement(stmt, db) {
  return {
    run(...params) {
      stmt.bind(params);
      while (stmt.step()) {}
      const lastId = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0];
      const changes = db.exec('SELECT changes() AS c')[0]?.values[0][0];
      stmt.reset();
      stmt.free();
      return { lastInsertRowid: lastId, changes: changes };
    },
    get(...params) {
      stmt.bind(params);
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.reset();
      stmt.free();
      return result;
    },
    all(...params) {
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.reset();
      stmt.free();
      return results;
    }
  };
}

async function initDb() {
  const SQL = await initSqlJs({
    locateFile: (file) => {
      const modUrl = new URL(import.meta.resolve('sql.js'));
      const modPath = path.dirname(decodeURIComponent(modUrl.pathname.replace(/^\/([A-Z]:)/, '$1')));
      return path.join(modPath, file);
    }
  });

  let db;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_screenshot_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      page_title TEXT,
      meta_description TEXT,
      meta_keywords TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_screenshots_url_id ON screenshots(url_id);
    CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3B82F6',
      description TEXT,
      parent_id INTEGER,
      usage_count INTEGER DEFAULT 0,
      is_auto INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

    CREATE TABLE IF NOT EXISTS tag_synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL,
      synonym TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tag_synonyms_tag_id ON tag_synonyms(tag_id);

    CREATE TABLE IF NOT EXISTS screenshot_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      confidence REAL DEFAULT 1.0,
      is_manual INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(screenshot_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_screenshot_tags_screenshot_id ON screenshot_tags(screenshot_id);
    CREATE INDEX IF NOT EXISTS idx_screenshot_tags_tag_id ON screenshot_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_screenshot_tags_is_manual ON screenshot_tags(is_manual);

    CREATE TABLE IF NOT EXISTS tagging_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      features TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tagging_feedback_tag_id ON tagging_feedback(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tagging_feedback_action ON tagging_feedback(action);

    CREATE TABLE IF NOT EXISTS tag_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL,
      rule_type TEXT NOT NULL,
      rule_pattern TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tag_rules_tag_id ON tag_rules(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tag_rules_type ON tag_rules(rule_type);
  `);

  const wrappedDb = {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return wrapStatement(stmt, db);
    },
    exec(sql) {
      db.exec(sql);
    },
    pragma() {},
    save() {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  };

  const origPrepare = wrappedDb.prepare;
  wrappedDb.prepare = function(sql) {
    const wrapped = origPrepare.call(this, sql);
    const origRun = wrapped.run;
    wrapped.run = function(...args) {
      const ret = origRun.call(this, ...args);
      wrappedDb.save();
      return ret;
    };
    return wrapped;
  };

  return wrappedDb;
}

export default async function getDb() {
  if (!dbInstance) {
    dbInstance = await initDb();
  }
  return dbInstance;
}
