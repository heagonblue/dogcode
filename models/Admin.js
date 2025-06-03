const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '登录用户名'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '加密密码'
  },
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名'
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: '手机号'
  },
  email: {
    type: DataTypes.STRING(100),
    comment: '邮箱'
  },
  employee_id: {
    type: DataTypes.STRING(20),
    unique: true,
    comment: '员工工号'
  },
  role_level: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '1-超级管理员 2-主管 3-员工'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '1-正常 0-禁用'
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建者ID'
  },
  manager_id: {
    type: DataTypes.INTEGER,
    comment: '直属上级ID'
  },
  avatar: {
    type: DataTypes.STRING(255),
    comment: '头像URL'
  },
  department: {
    type: DataTypes.STRING(50),
    comment: '部门'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '备注信息'
  },
  last_login_at: {
    type: DataTypes.DATE,
    comment: '最后登录时间'
  },
  last_login_ip: {
    type: DataTypes.STRING(45),
    comment: '最后登录IP'
  },
  current_login_at: {
    type: DataTypes.DATE,
    comment: '本次登录时间'
  },
  current_login_ip: {
    type: DataTypes.STRING(45),
    comment: '本次登录IP'
  },
  login_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总登录次数'
  },
  is_online: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否在线'
  }
}, {
  tableName: 'admins',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '管理员表'
});

// 只保留 Admin 自己的关联
Admin.belongsTo(Admin, { as: 'creator', foreignKey: 'created_by' });
Admin.belongsTo(Admin, { as: 'manager', foreignKey: 'manager_id' });

module.exports = Admin;