const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { backupFile } = require('./backupManager');

const DB_PATH = path.join(__dirname, 'sports_meet.db');
const DB_BACKUP_DIR = path.join(__dirname, 'backups');

let _db = null;
let _sql = null;

function persistRawDb(sqlDb) {
  try {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('持久化数据库失败:', e.message);
  }
}

// 包装层：将 sql.js API 转换为 better-sqlite3 兼容 API
function wrapDb(sqlDb) {
  let transactionDepth = 0;
  let pendingSave = false;

  function saveDbImmediate() {
    try {
      const data = sqlDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('保存数据库失败:', e.message);
    }
  }

  function saveDb() {
    if (transactionDepth > 0) {
      pendingSave = true;
      return;
    }
    saveDbImmediate();
  }

  function lastInsertId() {
    try {
      const r = sqlDb.exec('SELECT last_insert_rowid() AS id');
      if (r.length && r[0].values.length) return r[0].values[0][0];
    } catch (_) { /* ignore */ }
    return 0;
  }

  return {
    // sql.js 兼容：模拟 transaction
    transaction(fn) { return fn; },
    
    // exec 用于多语句或不需要返回结果的语句
    exec(sql) {
      sqlDb.run(sql);
      saveDb();
    },

    // prepare 返回一个 statement 对象
    prepare(sql) {
      let stmt = null;
      let params = [];

      const createStmt = (paramsArr) => {
        if (stmt) stmt.free();
        stmt = sqlDb.prepare(sql);
        if (paramsArr && paramsArr.length > 0) {
          stmt.bind(paramsArr);
        }
      };

      // 先尝试创建无参数statement
      try { createStmt([]); } catch (e) { /* 可能在run时再绑定 */ }

      return {
        run(...args) {
          createStmt(args);
          stmt.step();
          const changes = sqlDb.getRowsModified();
          const lastInsertRowid = lastInsertId();
          stmt.free();
          saveDb();
          return { changes, lastInsertRowid };
        },
        all(...args) {
          createStmt(args);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        },
        get(...args) {
          createStmt(args);
          let row = undefined;
          if (stmt.step()) {
            row = stmt.getAsObject();
          }
          stmt.free();
          return row;
        }
      };
    },

    // pragma 支持
    pragma(sql) {
      sqlDb.run('PRAGMA ' + sql);
    },

    transaction(fn) {
      return (...args) => {
        const isOuterTransaction = transactionDepth === 0;
        if (isOuterTransaction) {
          sqlDb.run('BEGIN');
        }
        transactionDepth++;
        try {
          const result = fn(...args);
          transactionDepth--;
          if (isOuterTransaction) {
            sqlDb.run('COMMIT');
            if (pendingSave) {
              pendingSave = false;
              saveDbImmediate();
            }
          }
          return result;
        } catch (e) {
          transactionDepth = Math.max(0, transactionDepth - 1);
          if (isOuterTransaction) {
            pendingSave = false;
            try {
              sqlDb.run('ROLLBACK');
            } catch (_) { /* ignore rollback errors */ }
          }
          throw e;
        }
      };
    }
  };
}

// 异步初始化数据库
async function initDatabase() {
  if (_db) return _db;

  _sql = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const backupPath = backupFile(DB_PATH, {
        backupDir: DB_BACKUP_DIR,
        prefix: 'sports_meet',
        extension: 'db',
        maxCount: Number(process.env.DB_BACKUP_RETENTION || 10)
      });
      if (backupPath) {
        console.log('数据库备份已创建:', backupPath);
      }
    } catch (e) {
      console.error('数据库备份失败:', e.message);
    }
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new _sql.Database(buffer);
  } else {
    _db = new _sql.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');

  // 只在首次创建数据库时初始化种子数据
  const isNew = !fs.existsSync(DB_PATH);
  initTables();
  migrateSchema();
  if (isNew) {
    seedDefaultData();
  }
  ensureTeacherAccounts();
  // seedEventDescriptions disabled - missing column
  migrateSchema();
  persistRawDb(_db);

  return wrapDb(_db);
}

function migrateSchema() {
  // Ensure legacy forum tables exist before applying ALTERs and dependent indexes.
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      images TEXT DEFAULT '[]',
      image_status TEXT DEFAULT 'approved',
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);
  try { _db.run("ALTER TABLE forum_posts ADD COLUMN images TEXT DEFAULT '[]'"); } catch(e) {}
  try { _db.run("ALTER TABLE forum_posts ADD COLUMN image_status TEXT DEFAULT 'approved'"); } catch(e) {}
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);

  const alters = [
    "ALTER TABLE events ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN sport_group TEXT DEFAULT 'A'",
    "ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 16",
    "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN staff_type TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN permission_role TEXT DEFAULT 'student'",
    "ALTER TABLE users ADD COLUMN managed_grade TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN managed_class_name TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN assigned_event_ids TEXT DEFAULT '[]'",
    "ALTER TABLE results ADD COLUMN is_school_record INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN muted_until TEXT DEFAULT ''",
    "ALTER TABLE notifications ADD COLUMN sender_name TEXT DEFAULT ''",
    "ALTER TABLE notifications ADD COLUMN sender_role TEXT DEFAULT 'system'",
    "ALTER TABLE notifications ADD COLUMN attachments TEXT DEFAULT '[]'",
    "ALTER TABLE notifications ADD COLUMN action_label TEXT DEFAULT ''",
    "ALTER TABLE forum_posts ADD COLUMN summary TEXT DEFAULT ''",
    "ALTER TABLE forum_posts ADD COLUMN category TEXT DEFAULT 'general'",
    "ALTER TABLE forum_posts ADD COLUMN tags TEXT DEFAULT '[]'",
    "ALTER TABLE forum_posts ADD COLUMN attachments TEXT DEFAULT '[]'",
    "ALTER TABLE forum_posts ADD COLUMN like_count INTEGER DEFAULT 0",
    "ALTER TABLE forum_posts ADD COLUMN favorite_count INTEGER DEFAULT 0",
    "ALTER TABLE forum_posts ADD COLUMN report_count INTEGER DEFAULT 0",
    "ALTER TABLE forum_posts ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE forum_posts ADD COLUMN review_stage INTEGER DEFAULT 1",
    "ALTER TABLE forum_posts ADD COLUMN review_comment TEXT DEFAULT ''",
    "ALTER TABLE forum_posts ADD COLUMN reviewed_by INTEGER",
    "ALTER TABLE forum_posts ADD COLUMN reviewed_at TEXT",
    "ALTER TABLE forum_posts ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE forum_posts ADD COLUMN last_interaction_at TEXT DEFAULT ''",
    "ALTER TABLE forum_replies ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE friend_requests ADD COLUMN remark TEXT DEFAULT ''",
    "ALTER TABLE friend_requests ADD COLUMN friend_group TEXT DEFAULT '同学'",
    "ALTER TABLE friend_requests ADD COLUMN handled_at TEXT",
    "ALTER TABLE friend_requests ADD COLUMN updated_at TEXT DEFAULT ''",
    "ALTER TABLE friendships ADD COLUMN group_name TEXT DEFAULT '同学'",
    "ALTER TABLE friendships ADD COLUMN source_request_id INTEGER",
    "ALTER TABLE friendships ADD COLUMN created_at TEXT DEFAULT ''",
    "ALTER TABLE friendships ADD COLUMN updated_at TEXT DEFAULT ''",
  ];
  alters.forEach((sql) => {
    try { _db.run(sql); } catch (_) { /* 栏位已存在 */ }
  });
  try {
    _db.run(`
      UPDATE users
      SET permission_role = CASE
        WHEN role = 'student' THEN 'student'
        WHEN role = 'admin' AND COALESCE(staff_type, '') != '' THEN 'teacher'
        WHEN role = 'admin' THEN 'global_admin'
        WHEN COALESCE(permission_role, '') IN ('student', 'teacher', 'global_admin') THEN permission_role
        ELSE 'student'
      END
    `);
  } catch (_) {
    /* legacy users table may not exist yet */
  }
  try {
    _db.run(`
      UPDATE forum_posts
      SET last_interaction_at = COALESCE(NULLIF(last_interaction_at, ''), updated_at, created_at, datetime('now','localtime'))
      WHERE COALESCE(last_interaction_at, '') = ''
    `);
  } catch (_) {
    /* legacy forum_posts may not exist yet */
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_post_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('like','favorite')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id, action_type)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('post','reply')),
      target_id INTEGER NOT NULL,
      post_id INTEGER,
      reporter_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
      handled_by INTEGER,
      handled_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (handled_by) REFERENCES users(id)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT,
      uploaded_by INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);
  // status 列已在 CREATE TABLE 中定义 (DEFAULT 'pending')，无需 ALTER
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_moderation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      reply_id INTEGER,
      action TEXT NOT NULL,
      stage INTEGER DEFAULT 1,
      operator_id INTEGER,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      remark TEXT DEFAULT '',
      friend_group TEXT DEFAULT '同学',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
      handled_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      group_name TEXT DEFAULT '同学',
      source_request_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (source_request_id) REFERENCES friend_requests(id) ON DELETE SET NULL,
      UNIQUE(user_id, friend_id)
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_updated ON forum_posts(updated_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON forum_posts(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_status ON forum_posts(status, is_pinned DESC, is_featured DESC, last_interaction_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_actions_post ON forum_post_actions(post_id, action_type)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_actions_user ON forum_post_actions(user_id, action_type)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status, created_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_reports_target ON forum_reports(target_type, target_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_logs_post ON forum_moderation_logs(post_id, created_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status, created_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id, status, created_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, created_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_captchas_token ON captchas(token)');

  try {
    _db.run("BEGIN TRANSACTION");
    _db.run("ALTER TABLE registrations RENAME TO registrations_old");
    _db.run(`CREATE TABLE registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelling')),
      reject_reason TEXT DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      UNIQUE(user_id, event_id)
    )`);
    _db.run("INSERT INTO registrations SELECT * FROM registrations_old");
    _db.run("DROP TABLE registrations_old");
    _db.run("CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id)");
    _db.run("CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id)");
    _db.run("COMMIT");
  } catch (_) { try { _db.run("ROLLBACK"); } catch(__) {} }
}

function getDb() {
  if (!_db) throw new Error('数据库尚未初始化，请先调用 initDatabase()');
  return wrapDb(_db);
}

function getRawDb() {
  return _db;
}

function initTables() {
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin','student')),
      staff_type TEXT DEFAULT '' CHECK(staff_type IN ('','homeroom_teacher','event_teacher')),
      permission_role TEXT DEFAULT 'student' CHECK(permission_role IN ('student','teacher','global_admin')),
      student_id TEXT UNIQUE,
      name TEXT NOT NULL,
      class_name TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      managed_grade TEXT DEFAULT '',
      managed_class_name TEXT DEFAULT '',
      assigned_event_ids TEXT DEFAULT '[]',
      gender TEXT DEFAULT '',
      age INTEGER DEFAULT 16,
      avatar TEXT DEFAULT '',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','disabled')),
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');

  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS meet_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '学校运动会',
      theme TEXT DEFAULT '',
      start_date TEXT,
      end_date TEXT,
      registration_open INTEGER DEFAULT 0,
      site_maintenance INTEGER DEFAULT 0,
      logo_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
      UNIQUE(grade_id, name)
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('track','field','relay','team')) DEFAULT 'track',
      event_type TEXT NOT NULL CHECK(event_type IN ('individual','team')) DEFAULT 'individual',
      gender_group TEXT NOT NULL CHECK(gender_group IN ('male','female','mixed')) DEFAULT 'mixed',
      max_participants INTEGER DEFAULT 0,
      rules TEXT DEFAULT '',
      venue TEXT DEFAULT '',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS registration_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT NOT NULL UNIQUE,
      rule_value TEXT NOT NULL,
      description TEXT DEFAULT ''
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelling')),
      reject_reason TEXT DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      UNIQUE(user_id, event_id)
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id)');

  _db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      round_name TEXT DEFAULT '预赛',
      start_time TEXT,
      end_time TEXT,
      venue TEXT DEFAULT '',
      max_heats INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_schedules_event ON schedules(event_id)');

  _db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      performance TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      score DECIMAL(10,2) DEFAULT 0,
      award TEXT DEFAULT '' CHECK(award IN ('','一等','二等','三等','优秀','团体')),
      is_published INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      is_school_record INTEGER DEFAULT 0,
      recorded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_results_schedule ON results(schedule_id)');

  _db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general' CHECK(category IN ('event','registration','result','urgent','general')),
      is_pinned INTEGER DEFAULT 0,
      published_by INTEGER NOT NULL,
      publish_time TEXT,
      expire_time TEXT,
      view_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (published_by) REFERENCES users(id)
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(announcement_id, user_id)
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at)');

  _db.run(`
    CREATE TABLE IF NOT EXISTS captchas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      used INTEGER DEFAULT 0
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT DEFAULT 'info' CHECK(type IN ('info','success','warning','danger')),
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      target_url TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  _db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read)');

  // 濠江中学信息表
  _db.run(`
    CREATE TABLE IF NOT EXISTS school_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // 论坛表
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      images TEXT DEFAULT '[]',
      image_status TEXT DEFAULT 'approved',
      is_pinned INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  try { _db.run("ALTER TABLE forum_posts ADD COLUMN images TEXT DEFAULT '[]'"); } catch(e) {}
  try { _db.run("ALTER TABLE forum_posts ADD COLUMN image_status TEXT DEFAULT 'approved'"); } catch(e) {}
  _db.run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT,
      uploaded_by INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);
  // status 列已在 CREATE TABLE 中定义 (DEFAULT 'pending')，无需 ALTER

  _db.run(`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelling')),
      approved_by INTEGER,
      approved_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `);

  // 保存初始表结构
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seedDefaultData() {
  // 管理员账号
  const adminHash = bcrypt.hashSync('admin123', 10);
  const adminStmt = _db.prepare("SELECT COUNT(*) as cnt FROM users WHERE permission_role='global_admin' OR (permission_role = '' AND role='admin' AND COALESCE(staff_type, '') = '')");
  adminStmt.step();
  const adminRow = adminStmt.getAsObject();
  adminStmt.free();

  if (adminRow.cnt === 0) {
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['admin', 'admin@hkms.hktedu.com', adminHash, 'admin', 'global_admin', 'ADMIN001', '系统管理员']);
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['2100', '2100@hkms.hktedu.com', adminHash, 'admin', 'global_admin', '2100', '曾剑辉']);
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['0037', '0037@hkms.hktedu.com', adminHash, 'admin', 'global_admin', '0037', '王诗震']);
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['20250041', '20250041@hkms.hktedu.com', adminHash, 'admin', 'global_admin', '20250041', '李靖汐']);
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['20250037', '20250037@hkms.hktedu.com', adminHash, 'admin', 'global_admin', '20250037', '徐振华']);
  }

  // 冯梓雯（始终确保存在）
  var fzwRow = _db.prepare("SELECT COUNT(*) as cnt FROM users WHERE email = '20250030@hkms.hktedu.com'");
  fzwRow.step();
  var fzwCnt = fzwRow.getAsObject().cnt;
  fzwRow.free();
  if (fzwCnt === 0) {
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['20250030', '20250030@hkms.hktedu.com', adminHash, 'admin', 'global_admin', '20250030', '冯梓雯']);
  } else {
    _db.run("UPDATE users SET role = 'admin', permission_role = 'global_admin' WHERE email = '20250030@hkms.hktedu.com'");
  }

  // 超级管理员（始终确保存在）
  var superAdminRow = _db.prepare("SELECT COUNT(*) as cnt FROM users WHERE email = '20091027@hkms.hktedu.com'");
  superAdminRow.step();
  var superCnt = superAdminRow.getAsObject().cnt;
  superAdminRow.free();
  if (superCnt === 0) {
    var superHash = bcrypt.hashSync('lin20091027', 10);
    _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['LINKIT', '20091027@hkms.hktedu.com', superHash, 'admin', 'global_admin', 'SUPER001', '超级管理员-LINKIT']);
  } else {
    _db.run("UPDATE users SET role = 'admin', permission_role = 'global_admin' WHERE email = '20091027@hkms.hktedu.com'");
  }

  // 运动会基本信息
  const meetStmt = _db.prepare("SELECT COUNT(*) as cnt FROM meet_info");
  meetStmt.step();
  const meetRow = meetStmt.getAsObject();
  meetStmt.free();

  if (meetRow.cnt === 0) {
    _db.run("INSERT INTO meet_info (name, theme, start_date, end_date, registration_open) VALUES (?, ?, ?, ?, ?)",
      ['学校运动会', '活力校园·运动青春', '2026-10-22', '2026-10-24', 1]);
  }

  // 种子学生数据（仅在首次创建时）
  const stuStmt = _db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='student'");
  stuStmt.step();
  const stuRow = stuStmt.getAsObject();
  stuStmt.free();

  if (stuRow.cnt === 0) {
    const stuHash = bcrypt.hashSync('123456', 10);
    const original = ['甘子轩','朱嘉诚','何政熙','何衍禧','吴子琪','吴灿','宋子谦','李力','李靖汐','周佳妮','林杰','林俊淘','徐振华','张秦坤','梁倩','陈天泽','陈宇轩','陈妙燃','麦君权','冯梓雯','冯淽健','黄子鹏','黄广晋','董兆威','廖浚良','刘嘉裕','郑咏心','陈威羽'];
    let sid = 20250001;
    original.forEach(n => {
      const s = String(sid++);
      _db.run("INSERT INTO users (username, email, password, role, permission_role, student_id, name, class_name, grade, gender, age) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [s, s+'@hkms.hktedu.com', stuHash, 'student', 'student', s, n, '高一(11)班', '高一', Math.random()>0.5?'male':'female', 15+Math.floor(Math.random()*3)]);
    });
  }

  // 种子公告
  const annStmt = _db.prepare("SELECT COUNT(*) as cnt FROM announcements");
  annStmt.step();
  const annRow = annStmt.getAsObject();
  annStmt.free();

  if (annRow.cnt === 0) {
    const adminId = _db.prepare("SELECT id FROM users WHERE permission_role = 'global_admin' OR (role='admin' AND COALESCE(staff_type, '') = '') LIMIT 1").get()?.id || 1;
    const announcements = [
      ['欢迎参加第三十届田径运动会！', '各位同学，第三十届田径运动会即将开幕！请抓紧时间报名参赛，报名截止日期为5月28日。每人最多可报3个项目，请大家根据自身特长合理选择。', 'event', 1],
      ['报名须知', '1. 每人最多报名3个项目；2. 集体项目以班级为单位；3. 报名后需管理员审核通过方可参赛；4. 比赛前30分钟请到检录处检录。', 'registration', 0],
      ['运动会日程安排', '本次运动会定于2026年6月1日至6月3日举行。开幕式于6月1日上午8:00在田径场举行，请全体师生准时参加。', 'event', 1],
    ];
    announcements.forEach(a => {
      _db.run("INSERT INTO announcements (title, content, category, is_pinned, published_by, publish_time, status) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), 'published')",
        a.concat([adminId]));
    });
  }

  // 系统设置
  const setStmt = _db.prepare("SELECT COUNT(*) as cnt FROM settings");
  setStmt.step();
  const setRow = setStmt.getAsObject();
  setStmt.free();

  if (setRow.cnt === 0) {
    const defaults = [
      ['site_name', '学校运动会管理系统'],
      ['password_min_length', '6'],
      ['session_hours', '24'],
      ['max_events_per_student', '3'],
      ['timezone', 'Asia/Shanghai']
    ];
    defaults.forEach(([k, v]) => {
      _db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    });
  }

  // AI 配置（豆包）
  const aiRows = [
    ['ai_provider', 'doubao'],
    ['ai_api_key', '11d46d11-ac59-4369-842e-f0b929320344'],
    ['ai_model', 'doubao-seed-2.0-pro']
  ];
  aiRows.forEach(([k, v]) => {
    _db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, v]);
  });

  // 年级
  const gradeStmt = _db.prepare("SELECT COUNT(*) as cnt FROM grades");
  gradeStmt.step();
  const gradeRow = gradeStmt.getAsObject();
  gradeStmt.free();

  if (gradeRow.cnt === 0) {
    ['初一', '初二', '初三', '高一', '高二', '高三'].forEach((g, i) => {
      _db.run("INSERT INTO grades (name, sort_order) VALUES (?, ?)", [g, i + 1]);
    });
  }

  // 班级
  const classStmt = _db.prepare("SELECT COUNT(*) as cnt FROM classes");
  classStmt.step();
  const classRow = classStmt.getAsObject();
  classStmt.free();

  if (classRow.cnt === 0) {
    const gradeStmt2 = _db.prepare("SELECT id, name FROM grades");
    const grades = [];
    while (gradeStmt2.step()) { grades.push(gradeStmt2.getAsObject()); }
    gradeStmt2.free();

    grades.forEach(g => {
      for (let i = 1; i <= 5; i++) {
        _db.run("INSERT INTO classes (grade_id, name, sort_order) VALUES (?, ?, ?)", [g.id, g.name + '(' + i + ')班', i]);
      }
    });
  }

  // 比赛项目
  const evtStmt = _db.prepare("SELECT COUNT(*) as cnt FROM events");
  evtStmt.step();
  const evtRow = evtStmt.getAsObject();
  evtStmt.free();

  if (evtRow.cnt === 0) {
    const events = [
      ['100米', 'track', 'individual', 'male', 8, '采用国际田联规则', '田径场100米赛道'],
      ['100米', 'track', 'individual', 'female', 8, '采用国际田联规则', '田径场100米赛道'],
      ['200米', 'track', 'individual', 'male', 8, '采用国际田联规则', '田径场200米赛道'],
      ['200米', 'track', 'individual', 'female', 8, '采用国际田联规则', '田径场200米赛道'],
      ['400米', 'track', 'individual', 'male', 8, '采用国际田联规则', '田径场400米赛道'],
      ['400米', 'track', 'individual', 'female', 8, '采用国际田联规则', '田径场400米赛道'],
      ['800米', 'track', 'individual', 'male', 8, '采用国际田联规则', '田径场800米赛道'],
      ['800米', 'track', 'individual', 'female', 8, '采用国际田联规则', '田径场800米赛道'],
      ['1500米', 'track', 'individual', 'male', 12, '采用国际田联规则', '田径场1500米起点'],
      ['1500米', 'track', 'individual', 'female', 12, '采用国际田联规则', '田径场1500米起点'],
      ['跳远', 'field', 'individual', 'male', 12, '每人3次试跳，取最好成绩', '沙坑区'],
      ['跳远', 'field', 'individual', 'female', 12, '每人3次试跳，取最好成绩', '沙坑区'],
      ['跳高', 'field', 'individual', 'male', 12, '采用背越式或跨越式', '跳高区'],
      ['跳高', 'field', 'individual', 'female', 12, '采用背越式或跨越式', '跳高区'],
      ['实心球', 'field', 'individual', 'male', 12, '每人3次投掷', '投掷区'],
      ['实心球', 'field', 'individual', 'female', 12, '每人3次投掷', '投掷区'],
      ['4×100米接力', 'relay', 'team', 'male', 8, '每队4人', '田径场接力区'],
      ['4×100米接力', 'relay', 'team', 'female', 8, '每队4人', '田径场接力区'],
      ['拔河比赛', 'team', 'team', 'mixed', 16, '每班15人（男8女7）', '篮球场'],
      ['广播体操', 'team', 'team', 'mixed', 50, '全班参与', '操场']
    ];
    events.forEach((e, i) => {
      _db.run("INSERT INTO events (name, category, event_type, gender_group, max_participants, rules, venue, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [...e, i + 1]);
    });
  }

  // 报名规则
  const ruleStmt = _db.prepare("SELECT COUNT(*) as cnt FROM registration_rules");
  ruleStmt.step();
  const ruleRow = ruleStmt.getAsObject();
  ruleStmt.free();

  if (ruleRow.cnt === 0) {
    const rules = [
      ['max_events_per_student', '3', '每位学生最多报名项目数'],
      ['team_min_members', '4', '集体项目最少人数'],
      ['allow_cross_grade', '0', '是否允许跨年级报名(0否1是)']
    ];
    rules.forEach(r => {
      _db.run("INSERT INTO registration_rules (rule_key, rule_value, description) VALUES (?, ?, ?)", r);
    });
  }

  // 濠江中学信息数据
  const infoStmt = _db.prepare("SELECT COUNT(*) as cnt FROM school_info");
  infoStmt.step();
  const infoRow = infoStmt.getAsObject();
  infoStmt.free();

  if (infoRow.cnt === 0) {
    const schoolData = [
      ['学校概况', '学校简介', '澳门濠江中学创立於1932年，是一所具有悠久歷史和光榮传统的愛國学校。学校秉持「忠誠、勤奮、求實、创新」的校訓，致力培養德智体群美全面发展的优秀人才。学校设有幼稚園、小学部、中学部，校址位於澳门半島 Rua do Comandante João Belo（青洲大马路）。'],
      ['学校概况', '学校历史', '1932年由黃仁輔先生创辦，初名「濠江小学」。1950年代增设初中部，1980年代发展為完全中学。1999年澳门回歸後，学校进一步扩建校舍、提升教学質量。至今已有超過90年歷史，校友遍布海内外各行各業。'],
      ['学校概况', '校训校歌', '校訓：「忠誠、勤奮、求實、创新」。校歌由创校校長作詞，旋律激昂，激勵学子奮发向上。每逢重大典禮及运动会开幕式，全校師生齊唱校歌。'],
      ['学校概况', '辦学特色', '推行全人教育，注重中英雙語教学，开设葡語課程。課外活动豐富，包括田徑队、籃球队、舞蹈团、管弦乐团、機械人小组等。每年舉辦校运会、藝術节、科技週等大型活动。'],
      ['校园设施', '校園環境', '校園佔地約15,000平方米，綠樹成蔭，環境优美。擁有标準田徑场、室内体育館、游泳池、图书館、科学實验室、電腦室、音乐室、美術室等完善设施。'],
      ['校园设施', '运动场地', '标準400米田徑跑道（6条赛道）、跳遠沙坑、跳高區、投擲區（實心球/鉛球）、室内体育館（籃球/排球/羽毛球）、露天籃球场3個、25米室内游泳池。'],
      ['校园设施', '教学大樓', '主教学樓共6層，设有48间标準課室、4间科学實验室、2间電腦室、图书館（藏书逾5萬冊）、多功能演講廳。中学部與小学部分设獨立教学區域。'],
      ['师资力量', '教師团队', '全校教職员約200人，其中中学部教師約80人。教師学歷均在本科以上，碩士及以上学歷佔比超過40%。多位教師获澳门教育暨青年发展局頒发「卓越教師奖」。'],
      ['师资力量', '体育科组', '体育科组共有8位專業教師，包括田徑、游泳、球类等專项教练。其中林SIR為前澳门田徑代表队成员，帶領校田徑队屢获佳績。现任科主任為梁SIR。'],
      ['学生发展', '学生成就', '近年学生在澳门学界比赛中屢获殊榮：2024-2025学年获学界田徑赛团体總分第三名、学界游泳赛男子组亞軍、全國青少年科技创新大赛二等奖、澳门中学生辯論赛冠軍。'],
      ['学生发展', '升学情況', '畢業生升学率超過95%，每年約30%畢業生获保送或考入内地重点大学（清華、北大、复旦等），40%入讀澳门大学，其餘赴香港、台灣及海外升学。'],
      ['运动会', '本屆运动会', '第三十屆田徑运动会，设有短跑、長跑、跳遠、跳高、實心球、接力及集体项目，涵蓋男子组、女子组及混合组。全校初中一年級至高中三年級学生均可报名參加。'],
      ['运动会', '歷屆佳績', '第二十九屆运动会刷新3项校紀录：男子100米（11.2秒）、女子跳遠（4.85米）、男子4×100米接力（46.8秒）。团体總分冠軍為高三(3)班。'],
      ['运动会', '比赛规则', '各项目均採用國際田聯（World Athletics）最新规则。徑赛项目按计时成绩排名，田赛项目取最佳试跳/试投成绩。个人项目每班限报2人，每人最多报3项。'],
      ['联系方式', '聯络资訊', '校址：澳门青洲大马路 Rua do Comandante João Belo, Macau。電话：(+853) 2822 1234。传真：(+853) 2822 5678。電郵：info@houkong.edu.mo。官方网站：www.houkong.edu.mo。'],
      ['联系方式', '辦公时间', '校务处辦公时间：週一至週五 08:00-17:30，週六 09:00-12:00。体育组查询：週一至週五 09:00-16:00。运动会期间延長服务至18:00。'],
    ];
    schoolData.forEach(([cat, title, content], i) => {
      _db.run("INSERT INTO school_info (category, title, content, sort_order) VALUES (?, ?, ?, ?)", [cat, title, content, i + 1]);
    });
  }

  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function ensureTeacherAccounts() {
  const teacherHash = bcrypt.hashSync('teacher123', 10);
  const defaults = [
    {
      username: 'teacher_homeroom',
      email: 'teacher_homeroom@hkms.hktedu.com',
      student_id: 'TEACHER001',
      name: '默认班主任',
      staff_type: 'homeroom_teacher',
      managed_grade: '高一',
      managed_class_name: '高一(11)班',
      assigned_event_ids: '[]'
    },
    {
      username: 'teacher_event',
      email: 'teacher_event@hkms.hktedu.com',
      student_id: 'TEACHER002',
      name: '默认任课教师',
      staff_type: 'event_teacher',
      managed_grade: '',
      managed_class_name: '',
      assigned_event_ids: '[1,2]'
    }
  ];

  defaults.forEach((teacher) => {
    const stmt = _db.prepare('SELECT id FROM users WHERE email = ?');
    stmt.bind([teacher.email]);
    const exists = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    if (exists && exists.id) {
      _db.run(`
        UPDATE users
        SET role = 'admin',
            permission_role = 'teacher',
            staff_type = ?,
            managed_grade = ?,
            managed_class_name = ?,
            assigned_event_ids = ?,
            updated_at = datetime('now','localtime')
        WHERE id = ?
      `, [
        teacher.staff_type,
        teacher.managed_grade,
        teacher.managed_class_name,
        teacher.assigned_event_ids,
        exists.id
      ]);
      return;
    }

    _db.run(`
      INSERT INTO users (
        username, email, password, role, permission_role, staff_type, student_id, name,
        class_name, grade, managed_grade, managed_class_name, assigned_event_ids
      ) VALUES (?, ?, ?, 'admin', 'teacher', ?, ?, ?, '', '', ?, ?, ?)
    `, [
      teacher.username,
      teacher.email,
      teacherHash,
      teacher.staff_type,
      teacher.student_id,
      teacher.name,
      teacher.managed_grade,
      teacher.managed_class_name,
      teacher.assigned_event_ids
    ]);
  });
}

function seedEventDescriptions() {
  const defaults = {
    track: '徑赛项目採用國際田聯规则，預赛按成绩排名，決赛取前八名。运动员須穿釘鞋或运动鞋，服裝須符合学校規定。检录时间為比赛前30分鐘，遲到视為棄权。',
    field: '田赛项目每人有規定试跳/试投次数，取最好成绩。运动员須在指定區域活动，听從裁判指示。如有平局，按次优成绩判定名次。',
    relay: '接力项目每队四名运动员，必須在接力區内完成交接，接力棒掉落可在原道撿起繼續。队伍須在检录时确认名單。',
    team: '集体项目以班級為單位报名，須達到規定人数方可參赛。比赛服裝统一，服從裁判及现场工作人员安排。'
  };
  const events = [];
  const stmt = _db.prepare('SELECT id, category, name, description FROM events');
  while (stmt.step()) events.push(stmt.getAsObject());
  stmt.free();

  const upd = _db.prepare('UPDATE events SET description = ? WHERE id = ?');
  events.forEach((e) => {
    if (e.description && String(e.description).trim()) return;
    const base = defaults[e.category] || '请按赛程安排準时參赛，服從裁判判決。';
    const text = `${e.name}：${base}`;
    upd.run([text, e.id]);
  });
  upd.free();
}

// 导出
module.exports = { initDatabase, getDb, getRawDb };
