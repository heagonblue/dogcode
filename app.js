const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// 导入数据库配置和路由
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

// 基础中间件
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供头像访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 获取客户端真实 IP
app.use((req, res, next) => {
  req.ip = req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
  next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 测试路由
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '酒店预订API服务正常运行',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 基础路由
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用酒店预订API',
    endpoints: {
      health: '/api/health',
      login: '/api/auth/login',
      getCurrentUser: '/api/auth/me',
      logout: '/api/auth/logout',
      verifyToken: '/api/auth/verify',
      createAdmin: '/api/admin/create',
      adminList: '/api/admin/list'
    }
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.originalUrl
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

const PORT = process.env.PORT || 3000;

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    await testConnection();
    
    app.listen(PORT, () => {
      console.log(`🚀 酒店预订API服务已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`🔐 登录接口: http://localhost:${PORT}/api/auth/login`);
      console.log(`📚 API文档: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;