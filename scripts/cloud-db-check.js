const { Client } = require('pg');
const { assertCloudDbConfig, buildPgClientConfig } = require('../config/cloudDatabase');

async function checkCloudDatabase() {
  const cloudConfig = assertCloudDbConfig();
  const client = new Client(buildPgClientConfig());
  await client.connect();
  try {
    const metaRes = await client.query(
      'SELECT current_database() AS database_name, current_user AS current_user, now() AS server_time'
    );
    const tablesRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [cloudConfig.schema]
    );
    return {
      cloudConfig,
      metadata: metaRes.rows[0],
      tables: tablesRes.rows.map((row) => row.table_name)
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const result = await checkCloudDatabase();
  console.log('云端数据库连接正常');
  console.log('目标连接:', result.cloudConfig.maskedUrl);
  console.log('数据库:', result.metadata.database_name);
  console.log('用户:', result.metadata.current_user);
  console.log('时间:', result.metadata.server_time);
  console.log('表数量:', result.tables.length);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('云端数据库检查失败:', error.message);
    process.exit(1);
  });
}

module.exports = {
  checkCloudDatabase
};
