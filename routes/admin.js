const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');

const router = express.Router();

// 所有管理员路由都需要登录
router.use(authenticateToken);

// 创建管理员（添加主管或员工）
// 超级管理员和主管可以使用
router.post('/create', requireRole(2), AdminController.createAdmin);

// 获取管理员列表
// 超级管理员和主管可以使用
router.get('/list', requireRole(2), AdminController.getAdminList);

// 获取管理员详情
router.get('/:id', AdminController.getAdminDetail);

// 更新管理员信息
router.put('/:id', AdminController.updateAdmin);

// 重置管理员密码
router.put('/:id/password', requireRole(2), AdminController.resetPassword);

// 上传头像 - 新添加
router.post('/:id/avatar', handleUpload, AdminController.uploadAvatar);

// 删除头像 - 新添加
router.delete('/:id/avatar', AdminController.deleteAvatar);

// 删除管理员
router.delete('/:id', requireRole(2), AdminController.deleteAdmin);

// 更新管理员状态（启用/禁用）
// 超级管理员和主管可以使用
router.put('/:id/status', requireRole(2), AdminController.updateAdminStatus);

module.exports = router;