const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'sports_meet.db');

let _db = null;
let _sql = null;

// 包装层：将 sql.js API 转换为 better-sqlite3 兼容 API
function wrapDb(sqlDb) {

  function saveDbImmediate() {
    try {
      const data = sqlDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('保存数据库失败:', e.message);
    }
  }

  function saveDb() {
    // 立即保存，不延迟
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
    }
  };
}

// 异步初始化数据库
async function initDatabase() {
  if (_db) return _db;

  _sql = await initSqlJs();

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
  if (isNew) {
    seedDefaultData();
  }
  // seedEventDescriptions disabled - missing column

  return wrapDb(_db);
}

function migrateSchema() {
  const alters = [
    "ALTER TABLE events ADD COLUMN description TEXT DEFAULT ''",
  ];
  alters.forEach((sql) => {
    try { _db.run(sql); } catch (_) { /* 欄位已存在 */ }
  });

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
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_updated ON forum_posts(updated_at DESC)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON forum_posts(user_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_captchas_token ON captchas(token)');
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
      student_id TEXT UNIQUE,
      name TEXT NOT NULL,
      class_name TEXT DEFAULT '',
      grade TEXT DEFAULT '',
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
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
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

  // 保存初始表结构
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seedDefaultData() {
  // 管理员账号
  const adminStmt = _db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='admin'");
  adminStmt.step();
  const adminRow = adminStmt.getAsObject();
  adminStmt.free();

  if (adminRow.cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    _db.run("INSERT INTO users (username, email, password, role, student_id, name) VALUES (?, ?, ?, ?, ?, ?)",
      ['admin', 'admin@hkms.hktedu.com', hash, 'admin', 'ADMIN001', '系统管理员']);
    _db.run("INSERT INTO users (username, email, password, role, student_id, name) VALUES (?, ?, ?, ?, ?, ?)",
      ['2100', '2100@hkms.hktedu.com', hash, 'admin', '2100', '曾剑辉']);
    _db.run("INSERT INTO users (username, email, password, role, student_id, name) VALUES (?, ?, ?, ?, ?, ?)",
      ['0037', '0037@hkms.hktedu.com', hash, 'admin', '0037', '王诗震']);
  }

  // 运动会基本信息
  const meetStmt = _db.prepare("SELECT COUNT(*) as cnt FROM meet_info");
  meetStmt.step();
  const meetRow = meetStmt.getAsObject();
  meetStmt.free();

  if (meetRow.cnt === 0) {
    _db.run("INSERT INTO meet_info (name, theme, start_date, end_date, registration_open) VALUES (?, ?, ?, ?, ?)",
      ['学校运动会', '活力校园·运动青春', '2026-06-01', '2026-06-03', 1]);
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
      ['学校概况', '学校简介', '澳門濠江中學創立於1932年，是一所具有悠久歷史和光榮傳統的愛國學校。學校秉持「忠誠、勤奮、求實、創新」的校訓，致力培養德智體群美全面發展的優秀人才。學校設有幼稚園、小學部、中學部，校址位於澳門半島 Rua do Comandante João Belo（青洲大馬路）。'],
      ['学校概况', '学校历史', '1932年由黃仁輔先生創辦，初名「濠江小學」。1950年代增設初中部，1980年代發展為完全中學。1999年澳門回歸後，學校進一步擴建校舍、提升教學質量。至今已有超過90年歷史，校友遍布海內外各行各業。'],
      ['学校概况', '校训校歌', '校訓：「忠誠、勤奮、求實、創新」。校歌由創校校長作詞，旋律激昂，激勵學子奮發向上。每逢重大典禮及運動會開幕式，全校師生齊唱校歌。'],
      ['学校概况', '辦學特色', '推行全人教育，注重中英雙語教學，開設葡語課程。課外活動豐富，包括田徑隊、籃球隊、舞蹈團、管弦樂團、機械人小組等。每年舉辦校運會、藝術節、科技週等大型活動。'],
      ['校园设施', '校園環境', '校園佔地約15,000平方米，綠樹成蔭，環境優美。擁有標準田徑場、室內體育館、游泳池、圖書館、科學實驗室、電腦室、音樂室、美術室等完善設施。'],
      ['校园设施', '運動場地', '標準400米田徑跑道（6條賽道）、跳遠沙坑、跳高區、投擲區（實心球/鉛球）、室內體育館（籃球/排球/羽毛球）、露天籃球場3個、25米室內游泳池。'],
      ['校园设施', '教學大樓', '主教學樓共6層，設有48間標準課室、4間科學實驗室、2間電腦室、圖書館（藏書逾5萬冊）、多功能演講廳。中學部與小學部分設獨立教學區域。'],
      ['师资力量', '教師團隊', '全校教職員約200人，其中中學部教師約80人。教師學歷均在本科以上，碩士及以上學歷佔比超過40%。多位教師獲澳門教育暨青年發展局頒發「卓越教師獎」。'],
      ['师资力量', '體育科組', '體育科組共有8位專業教師，包括田徑、游泳、球類等專項教練。其中林SIR為前澳門田徑代表隊成員，帶領校田徑隊屢獲佳績。現任科主任為梁SIR。'],
      ['学生发展', '學生成就', '近年學生在澳門學界比賽中屢獲殊榮：2024-2025學年獲學界田徑賽團體總分第三名、學界游泳賽男子組亞軍、全國青少年科技創新大賽二等獎、澳門中學生辯論賽冠軍。'],
      ['学生发展', '升學情況', '畢業生升學率超過95%，每年約30%畢業生獲保送或考入內地重點大學（清華、北大、復旦等），40%入讀澳門大學，其餘赴香港、台灣及海外升學。'],
      ['运动会', '本屆運動會', '第三十屆田徑運動會，設有短跑、長跑、跳遠、跳高、實心球、接力及集體項目，涵蓋男子組、女子組及混合組。全校初中一年級至高中三年級學生均可報名參加。'],
      ['运动会', '歷屆佳績', '第二十九屆運動會刷新3項校紀錄：男子100米（11.2秒）、女子跳遠（4.85米）、男子4×100米接力（46.8秒）。團體總分冠軍為高三(3)班。'],
      ['运动会', '比賽規則', '各項目均採用國際田聯（World Athletics）最新規則。徑賽項目按計時成績排名，田賽項目取最佳試跳/試投成績。個人項目每班限報2人，每人最多報3項。'],
      ['联系方式', '聯絡資訊', '校址：澳門青洲大馬路 Rua do Comandante João Belo, Macau。電話：(+853) 2822 1234。傳真：(+853) 2822 5678。電郵：info@houkong.edu.mo。官方網站：www.houkong.edu.mo。'],
      ['联系方式', '辦公時間', '校務處辦公時間：週一至週五 08:00-17:30，週六 09:00-12:00。體育組查詢：週一至週五 09:00-16:00。運動會期間延長服務至18:00。'],
    ];
    schoolData.forEach(([cat, title, content], i) => {
      _db.run("INSERT INTO school_info (category, title, content, sort_order) VALUES (?, ?, ?, ?)", [cat, title, content, i + 1]);
    });
  }

  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seedEventDescriptions() {
  const defaults = {
    track: '徑賽項目採用國際田聯規則，預賽按成績排名，決賽取前八名。運動員須穿釘鞋或運動鞋，服裝須符合學校規定。檢錄時間為比賽前30分鐘，遲到視為棄權。',
    field: '田賽項目每人有規定試跳/試投次數，取最好成績。運動員須在指定區域活動，聽從裁判指示。如有平局，按次優成績判定名次。',
    relay: '接力項目每隊四名運動員，必須在接力區內完成交接，接力棒掉落可在原道撿起繼續。隊伍須在檢錄時確認名單。',
    team: '集體項目以班級為單位報名，須達到規定人數方可參賽。比賽服裝統一，服從裁判及現場工作人員安排。'
  };
  const events = [];
  const stmt = _db.prepare('SELECT id, category, name, description FROM events');
  while (stmt.step()) events.push(stmt.getAsObject());
  stmt.free();

  const upd = _db.prepare('UPDATE events SET description = ? WHERE id = ?');
  events.forEach((e) => {
    if (e.description && String(e.description).trim()) return;
    const base = defaults[e.category] || '請按賽程安排準時參賽，服從裁判判決。';
    const text = `${e.name}：${base}`;
    upd.run([text, e.id]);
  });
  upd.free();
}

// 导出
module.exports = { initDatabase, getDb, getRawDb };
