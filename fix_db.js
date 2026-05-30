// 修复数据库：添加 events 表的 description 列
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'sports_meet.db');

async function main() {
  const sql = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new sql.Database(buf);

  try {
    // 添加 description 列（如果不存在）
    db.run("ALTER TABLE events ADD COLUMN description TEXT DEFAULT ''");
    console.log('✓ events.description 列已添加');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('(description 列已存在，跳过)');
    } else {
      console.log('✗ 已有 description 列或添加失败:', e.message);
    }
  }

  // 保存
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('✓ 数据库已保存');
  db.close();
}
main().catch(e => console.error('失败:', e));
