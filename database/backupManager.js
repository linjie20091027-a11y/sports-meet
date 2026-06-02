const fs = require('fs');
const path = require('path');

function ensureBackupDir(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function formatBackupTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function buildBackupFileName(prefix, extension = 'db', date = new Date()) {
  return `${prefix}-${formatBackupTimestamp(date)}.${extension}`;
}

function pruneBackupList(entries, maxCount) {
  const normalizedMaxCount = Number(maxCount) > 0 ? Number(maxCount) : 0;
  if (!Array.isArray(entries) || entries.length <= normalizedMaxCount) return [];
  return [...entries]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, entries.length - normalizedMaxCount);
}

function rotateBackupFiles(backupDir, prefix, maxCount) {
  const candidates = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
        .filter((name) => name.startsWith(prefix + '-') && /\.([a-z0-9]+)$/i.test(name))
        .map((name) => ({ name, fullPath: path.join(backupDir, name) }))
    : [];
  const obsolete = pruneBackupList(candidates, maxCount);
  obsolete.forEach((entry) => {
    try {
      fs.unlinkSync(entry.fullPath);
    } catch (_) {
      /* ignore cleanup errors */
    }
  });
  return obsolete.map((entry) => entry.fullPath);
}

function backupFile(sourceFile, options = {}) {
  if (!fs.existsSync(sourceFile)) return null;
  const backupDir = ensureBackupDir(options.backupDir || path.join(path.dirname(sourceFile), 'backups'));
  const prefix = String(options.prefix || path.basename(sourceFile, path.extname(sourceFile)) || 'backup');
  const extension = String(options.extension || path.extname(sourceFile).replace(/^\./, '') || 'db');
  const maxCount = Number(options.maxCount) > 0 ? Number(options.maxCount) : 7;
  const backupFileName = buildBackupFileName(prefix, extension);
  const backupPath = path.join(backupDir, backupFileName);
  fs.copyFileSync(sourceFile, backupPath);
  rotateBackupFiles(backupDir, prefix, maxCount);
  return backupPath;
}

module.exports = {
  ensureBackupDir,
  formatBackupTimestamp,
  buildBackupFileName,
  pruneBackupList,
  rotateBackupFiles,
  backupFile
};
