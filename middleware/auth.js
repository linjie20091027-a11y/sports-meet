const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const { buildPermissionPayload, resolveAccessProfile } = require('../utils/accessControl');

const JWT_SECRET = process.env.JWT_SECRET || 'sports_meet_secret_key_2026';

function generateToken(user) {
  const permissionPayload = buildPermissionPayload(user);
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      ...permissionPayload,
      managed_grade: user.managed_grade || '',
      managed_class_name: user.managed_class_name || ''
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  req.user = decoded;
  next();
}

function adminOnly(req, res, next) {
  const access = resolveAccessProfile(req.user);
  if (!access.isGlobalAdmin) {
    return res.status(403).json({ error: '权限不足，仅平台管理员可操作' });
  }
  next();
}

function teacherOnly(req, res, next) {
  const access = resolveAccessProfile(req.user);
  if (!access.isTeacher) {
    return res.status(403).json({ error: '权限不足，仅教师可操作' });
  }
  next();
}

function studentOnly(req, res, next) {
  const access = resolveAccessProfile(req.user);
  if (!access.isStudent) {
    return res.status(403).json({ error: '权限不足，仅学生可操作' });
  }
  next();
}

function homeroomTeacherOnly(req, res, next) {
  const access = resolveAccessProfile(req.user);
  if (!access.isHomeroomTeacher) {
    return res.status(403).json({ error: '权限不足，仅班主任可操作' });
  }
  next();
}

function eventTeacherOnly(req, res, next) {
  const access = resolveAccessProfile(req.user);
  if (!access.isEventTeacher) {
    return res.status(403).json({ error: '权限不足，仅任课教师可操作' });
  }
  next();
}

function logOperation(userId, username, action, detail, ip) {
  try {
    const db = getDb();
    db.prepare(`INSERT INTO operation_logs (user_id, username, action, detail, ip_address)
      VALUES (?, ?, ?, ?, ?)`).run(userId, username, action, detail, ip || '');
  } catch (e) {
    console.error('日志记录失败:', e.message);
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  adminOnly,
  studentOnly,
  teacherOnly,
  homeroomTeacherOnly,
  eventTeacherOnly,
  logOperation,
  JWT_SECRET
};
