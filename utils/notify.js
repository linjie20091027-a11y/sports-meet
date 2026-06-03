/** 站內通知工具 */
function createNotification(db, userId, {
  type = 'info',
  title,
  content = '',
  target_url = '',
  sender_name = '系统通知',
  sender_role = 'system',
  attachments = [],
  action_label = ''
}) {
  if (!userId || !title) return;
  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 6) : [];
  db.prepare(
    `INSERT INTO notifications (
      user_id, type, title, content, target_url, sender_name, sender_role, attachments, action_label, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','+08:00'))`
  ).run(userId, type, title, content, target_url, sender_name, sender_role, JSON.stringify(safeAttachments), action_label);
}

function notifyAdmins(db, payload = {}) {
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active'").all();
  admins.forEach((a) => createNotification(db, a.id, payload));
}

module.exports = { createNotification, notifyAdmins };
