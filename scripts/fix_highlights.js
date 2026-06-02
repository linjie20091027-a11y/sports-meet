const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'database', 'sports_meet.db');
const IMG_DIR = path.resolve(__dirname, '..', 'public', 'images');

(async () => {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);
  
  console.log('=== 修复 highlights 表 ===');
  
  // Step 1: 检查并添加 status 列
  let cols = db.exec("PRAGMA table_info(highlights)");
  const colNames = cols.length ? cols[0].values.map(r => r[1]) : [];
  console.log('现有列:', colNames.join(', '));
  
  if (!colNames.includes('status')) {
    console.log('添加 status 列...');
    db.run("ALTER TABLE highlights ADD COLUMN status TEXT DEFAULT 'approved'");
  }
  
  // Step 2: 导出并充值状态
  try {
    db.run("UPDATE highlights SET status = 'approved' WHERE status IS NULL OR status = ''");
  } catch(e) { console.log('UPDATE status 跳过:', e.message.substring(0,60)); }
  
  // Step 3: 获取已有文件名
  const existingFiles = new Set();
  try {
    const records = db.exec('SELECT filename FROM highlights');
    if (records.length > 0) {
      records[0].values.forEach(r => existingFiles.add(r[0]));
    }
  } catch(e) { console.log('查询已有记录失败:', e.message.substring(0,60)); }
  
  console.log(`DB 中已有 ${existingFiles.size} 条记录`);
  
  const imgFiles = fs.readdirSync(IMG_DIR)
    .filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
  
  const notImported = imgFiles.filter(f => f !== '.gitkeep' && !existingFiles.has(f));
  console.log(`需导入: ${notImported.length} 张 (总共 ${imgFiles.length} 张图片文件)`);
  
  if (notImported.length > 0) {
    notImported.forEach((f, i) => {
      try {
        db.run("INSERT INTO highlights (filename, original_name, status, uploaded_by) VALUES (?, ?, 'approved', NULL)", [f, f]);
        if (i % 10 === 0) console.log(`  已导入 ${i+1}/${notImported.length}: ${f.substring(0,30)}`);
      } catch(e) {
        console.error(`  导入失败 ${f}: ${e.message.substring(0,80)}`);
      }
    });
    console.log(`导入完成`);
  }
  
  // Step 4: 保存
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  
  // Step 5: 验证
  const SQL2 = await initSqlJs();
  const db2 = new SQL2.Database(fs.readFileSync(DB_PATH));
  const count = db2.exec('SELECT COUNT(*) as cnt FROM highlights');
  const verifyCount = count.length > 0 ? count[0].values[0][0] : 0;
  
  let pending = 0, approved = 0;
  try {
    const p = db2.exec("SELECT COUNT(*) as cnt FROM highlights WHERE status='pending'");
    const a = db2.exec("SELECT COUNT(*) as cnt FROM highlights WHERE status='approved'");
    pending = p.length ? p[0].values[0][0] : 0;
    approved = a.length ? a[0].values[0][0] : 0;
  } catch(e) {}
  
  console.log('\n=== 修复完成 ===');
  console.log(`总记录数: ${verifyCount}`);
  console.log(`已通过: ${approved}`);
  console.log(`待审核: ${pending}`);
  
  db.close();
  db2.close();
})();
