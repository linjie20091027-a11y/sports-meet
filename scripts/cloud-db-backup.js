const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { ensureBackupDir, buildBackupFileName, rotateBackupFiles } = require('../database/backupManager');
const { assertCloudDbConfig, buildPgClientConfig } = require('../config/cloudDatabase');

async function backupCloudDatabase() {
  const cloudConfig = assertCloudDbConfig();
  const backupDir = ensureBackupDir(cloudConfig.backupDir);
  const client = new Client(buildPgClientConfig());
  await client.connect();
  try {
    const tablesRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [cloudConfig.schema]
    );
    const payload = {
      created_at: new Date().toISOString(),
      database: cloudConfig.maskedUrl,
      schema: cloudConfig.schema,
      tables: {}
    };
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const dataRes = await client.query(`SELECT * FROM "${cloudConfig.schema}"."${tableName}"`);
      payload.tables[tableName] = dataRes.rows;
    }
    const backupPath = path.join(backupDir, buildBackupFileName('cloud-db-backup', 'json'));
    fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');
    rotateBackupFiles(backupDir, 'cloud-db-backup', Number(process.env.CLOUD_DB_BACKUP_RETENTION || 10));
    return {
      backupPath,
      tableCount: Object.keys(payload.tables).length
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const result = await backupCloudDatabase();
  console.log('云端数据库备份完成');
  console.log('备份文件:', result.backupPath);
  console.log('表数量:', result.tableCount);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('云端数据库备份失败:', error.message);
    process.exit(1);
  });
}

module.exports = {
  backupCloudDatabase
};
