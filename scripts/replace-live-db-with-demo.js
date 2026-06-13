const fs = require('fs');
const path = require('path');

const databaseDir = path.join(__dirname, '..', 'database');
const liveDbPath = path.join(databaseDir, 'sports_meet.db');
const demoDbPath = path.join(databaseDir, 'sports_meet_full_demo.db');
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backupDbPath = path.join(databaseDir, `sports_meet.before_demo_replace_${timestamp}.db`);

if (!fs.existsSync(demoDbPath)) {
  throw new Error(`未找到演示数据库: ${demoDbPath}`);
}

if (!fs.existsSync(liveDbPath)) {
  throw new Error(`未找到当前运行数据库: ${liveDbPath}`);
}

fs.copyFileSync(liveDbPath, backupDbPath);
fs.copyFileSync(demoDbPath, liveDbPath);

console.log(JSON.stringify({
  success: true,
  backup: path.relative(path.join(__dirname, '..'), backupDbPath),
  replaced: path.relative(path.join(__dirname, '..'), liveDbPath),
  source: path.relative(path.join(__dirname, '..'), demoDbPath)
}, null, 2));
