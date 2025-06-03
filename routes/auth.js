const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');

const router = express.Router();

// 管理员登录
router.post('/login', AuthController.login);

// 获取当前用户信息（需要登录）
router.get('/me', authenticateToken, AuthController.getCurrentUser);

// 管理员登出（需要登录）
router.post('/logout', authenticateToken, AuthController.logout);

// 验证 token 是否有效
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token 有效',
    data: {
      admin_id: req.admin.id,
      username: req.admin.username,
      role_level: req.admin.role_level
    }
  });
});

// 获取登录记录
router.get('/login-logs', authenticateToken, AuthController.getLoginLogs);

// ========== 个人信息管理 ==========

// 修改个人密码
router.put('/change-password', authenticateToken, AuthController.changePassword);

// 更新个人信息
router.put('/profile', authenticateToken, AuthController.updateProfile);

// 获取个人登录记录
router.get('/my-login-logs', authenticateToken, AuthController.getMyLoginLogs);

// 上传个人头像
router.post('/avatar', authenticateToken, handleUpload, AuthController.uploadMyAvatar);

// 删除个人头像
router.delete('/avatar', authenticateToken, AuthController.deleteMyAvatar);

module.exports = router;