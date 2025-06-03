const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdminLoginLog = sequelize.define('AdminLoginLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '管理员ID'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: false,
    comment: '登录IP'
  },
  user_agent: {
    type: DataTypes.TEXT,
    comment: '浏览器信息'
  },
  login_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '登录时间'
  },
  logout_time: {
    type: DataTypes.DATE,
    comment: '退出时间'
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: false,
    comment: '登录状态'
  },
  failure_reason: {
    type: DataTypes.STRING(100),
    comment: '失败原因'
  }
}, {
  tableName: 'admin_login_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  comment: '管理员登录记录表'
});

module.exports = AdminLoginLog;