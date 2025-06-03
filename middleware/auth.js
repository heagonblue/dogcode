const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// JWT 验证中间件
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '访问令牌缺失'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    
    // 查找用户
    const admin = await Admin.findByPk(decoded.adminId, {
      attributes: { exclude: ['password'] }
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (admin.status !== 1) {
      return res.status(401).json({
        success: false,
        message: '账号已被禁用'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({
      success: false,
      message: '访问令牌无效'
    });
  }
};

// 权限验证中间件
const requireRole = (minRoleLevel) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }

    if (req.admin.role_level > minRoleLevel) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};