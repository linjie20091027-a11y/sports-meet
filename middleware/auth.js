const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'sports_meet_secret_key_2026';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role, name: user.name },
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
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，仅管理员可操作' });
  }
  next();
}

async function logOperation(userId, username, action, detail, ip) {
  try {
    await prisma.operationLog.create({
      data: { userId, username, action, detail, ipAddress: ip || '' }
    });
  } catch (e) {
    console.error('日志记录失败:', e.message);
  }
}

module.exports = { generateToken, verifyToken, authMiddleware, adminOnly, logOperation, JWT_SECRET };
