const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'database', 'sports_meet.db');

async function main() {
  const sql = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new sql.Database(buf);

  console.log('=== captchas 最近5条 ===');
  const c = db.exec('SELECT * FROM captchas ORDER BY id DESC LIMIT 5');
  if (c.length) {
    c[0].values.forEach(row => {
      console.log(`  id=${row[0]} token=${(row[1]||'').slice(0,16)}... code=${row[2]} used=${row[3]}`);
    });
  } else {
    console.log('  (无记录)');
  }

  console.log('\n=== events 表列结构 ===');
  const ec = db.exec('PRAGMA table_info(events)');
  if (ec.length) {
    ec[0].values.forEach(row => {
      console.log(`  ${row[1]} (${row[2]})`);
    });
  }

  console.log('\n=== 管理员用户 ===');
  const u = db.exec("SELECT id, username, email, role, name FROM users WHERE role='admin'");
  if (u.length) {
    u[0].values.forEach(row => {
      console.log(`  id=${row[0]} ${row[1]} <${row[2]}> ${row[3]} ${row[4]}`);
    });
  }

  console.log('\n=== meet_info ===');
  const m = db.exec('SELECT * FROM meet_info LIMIT 1');
  console.log(JSON.stringify(m, null, 2));

  db.close();
}
main().catch(e => console.error(e));
