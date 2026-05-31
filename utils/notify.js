/** 站內通知工具 */
function createNotification(db, userId, { type = 'info', title, content = '', target_url = '' }) {
  if (!userId || !title) return;
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, content, target_url) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, type, title, content, target_url);
}

function notifyAdmins(db, { type = 'info', title, content = '', target_url = '' }) {
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active'").all();
  admins.forEach((a) => createNotification(db, a.id, { type, title, content, target_url }));
}

module.exports = { createNotification, notifyAdmins };
