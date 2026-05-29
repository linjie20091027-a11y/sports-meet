const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const students = [
  { no: 1, name: '甘子軒' },
  { no: 2, name: '朱嘉誠' },
  { no: 3, name: '何政熙' },
  { no: 4, name: '何衍禧' },
  { no: 5, name: '吳子琪' },
  { no: 6, name: '吳燦' },
  { no: 7, name: '宋子謙' },
  { no: 8, name: '李力' },
  { no: 9, name: '李靖汐' },
  { no: 10, name: '周佳妮' },
  { no: 11, name: '林杰' },
  { no: 12, name: '林俊淘' },
  { no: 13, name: '徐振華' },
  { no: 14, name: '張秦坤' },
  { no: 15, name: '梁倩' },
  { no: 16, name: '陳天澤' },
  { no: 17, name: '陳宇軒' },
  { no: 18, name: '陳妙燃' },
  { no: 19, name: '麥君權' },
  { no: 20, name: '馮梓雯' },
  { no: 21, name: '馮淽健' },
  { no: 22, name: '黃子鵬' },
  { no: 23, name: '黃廣晉' },
  { no: 24, name: '董兆威' },
  { no: 25, name: '廖浚良' },
  { no: 26, name: '劉嘉裕' },
  { no: 27, name: '鄭詠心' },
  { no: 28, name: '陳威羽' },
];

initSqlJs().then(S => {
  const db = new S.Database(fs.readFileSync('database/sports_meet.db'));
  const hash = bcrypt.hashSync('123456', 10);
  let added = 0;

  students.forEach(s => {
    const sid = '2025' + String(s.no).padStart(4, '0');
    const email = sid + '@hkms.hktedu.com';
    try {
      db.run("INSERT OR IGNORE INTO users (username, email, password, role, name, student_id) VALUES (?,?,?,?,?,?)",
        [sid, email, hash, 'student', s.name, sid]);
      added++;
    } catch(e) {
      console.log('跳过:', sid, e.message);
    }
  });

  fs.writeFileSync('database/sports_meet.db', Buffer.from(db.export()));
  console.log(`已添加 ${added} 个学生账号`);

  const count = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='student'");
  count.step();
  console.log('学生总数:', count.getAsObject().cnt);
  count.free();
});
