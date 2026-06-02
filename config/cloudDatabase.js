const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function maskDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return '';
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch (_) {
    return String(databaseUrl).replace(/:\/\/([^:/?#]+):([^@]+)@/, '://$1:***@');
  }
}

function buildCloudDbConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  const sslEnabled = toBoolean(env.CLOUD_DB_SSL, true);
  const schema = String(env.CLOUD_DB_SCHEMA || 'public').trim() || 'public';
  const connectTimeoutMs = toNumber(env.CLOUD_DB_CONNECT_TIMEOUT_MS, 10000);
  const localDbPath = path.resolve(ROOT_DIR, env.LOCAL_DB_PATH || path.join('database', 'sports_meet.db'));
  const backupDir = path.resolve(ROOT_DIR, env.CLOUD_DB_BACKUP_DIR || path.join('database', 'backups', 'cloud'));
  return {
    enabled: Boolean(databaseUrl),
    databaseUrl,
    maskedUrl: maskDatabaseUrl(databaseUrl),
    sslEnabled,
    schema,
    connectTimeoutMs,
    localDbPath,
    backupDir
  };
}

function assertCloudDbConfig(overrides = {}) {
  const config = buildCloudDbConfig(overrides);
  if (!config.databaseUrl) {
    throw new Error('缺少 DATABASE_URL，无法连接云端数据库');
  }
  return config;
}

function buildPgClientConfig(overrides = {}) {
  const config = assertCloudDbConfig(overrides);
  return {
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: config.connectTimeoutMs,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false
  };
}

module.exports = {
  toBoolean,
  toNumber,
  maskDatabaseUrl,
  buildCloudDbConfig,
  assertCloudDbConfig,
  buildPgClientConfig
};
