/**
 * 資料庫清理：刪除異常項目、修正誤設為管理員的學生帳號
 */
const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, getRawDb } = require('../database/init');

initDatabase().then(() => {
  const db = getDb();

  const del = db.prepare("DELETE FROM events WHERE name = '500000米' OR name LIKE '%500000%'").run();
  console.log('已刪除異常賽事:', del.changes, '條');

  const fixed = db.prepare(`
    UPDATE users SET role = 'student'
    WHERE role = 'admin'
      AND id != 1
      AND (
        (student_id IS NOT NULL AND student_id != '')
        OR email GLOB '2025*@hkms.hktedu.com'
        OR email = '2100@hkms.hktedu.com'
      )
  `).run();
  console.log('已將誤設管理員的學生改回 student:', fixed.changes, '人');

  db.prepare(`
    UPDATE meet_info SET
      name = '第三十屆田徑運動會',
      theme = '忠誠 · 勤奮 · 求實 · 創新',
      registration_open = 1
    WHERE id = (SELECT id FROM meet_info LIMIT 1)
  `).run();
  console.log('已更新運動會基本資訊');

  const raw = getRawDb();
  if (raw) {
    const data = raw.export();
    fs.writeFileSync(path.join(__dirname, '../database/sports_meet.db'), Buffer.from(data));
  }

  const users = db.prepare('SELECT id, username, name, role, email FROM users WHERE name LIKE ?').all('%剑%');
  console.log('曾劍輝相關帳號:', users);
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
