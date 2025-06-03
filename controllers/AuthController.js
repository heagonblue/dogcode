const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AdminLoginLog = require('../models/AdminLoginLog');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class AuthController {
  // 管理员登录
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || '';

      // 验证输入
      if (!username || !password) {
        // 记录失败的登录尝试
        await AdminLoginLog.create({
          admin_id: 0, // 未知用户ID
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'failed',
          failure_reason: '用户名或密码为空'
        });

        return res.status(400).json({
          success: false,
          message: '用户名和密码不能为空'
        });
      }

      // 查找管理员
      const admin = await Admin.findOne({
        where: { username }
      });

      if (!admin) {
        // 记录失败的登录尝试
        await AdminLoginLog.create({
          admin_id: 0, // 用户不存在
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'failed',
          failure_reason: '用户名不存在'
        });

        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 检查账号状态
      if (admin.status !== 1) {
        // 记录失败的登录尝试
        await AdminLoginLog.create({
          admin_id: admin.id,
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'failed',
          failure_reason: '账号已被禁用'
        });

        return res.status(401).json({
          success: false,
          message: '账号已被禁用，请联系管理员'
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      
      if (!isPasswordValid) {
        // 记录失败的登录尝试
        await AdminLoginLog.create({
          admin_id: admin.id,
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'failed',
          failure_reason: '密码错误'
        });

        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 更新登录信息
      await admin.update({
        last_login_at: admin.current_login_at,
        last_login_ip: admin.current_login_ip,
        current_login_at: new Date(),
        current_login_ip: clientIP,
        login_count: admin.login_count + 1,
        is_online: 1
      });

      // 记录成功的登录
      const loginLog = await AdminLoginLog.create({
        admin_id: admin.id,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'success'
      });

      // 生成 JWT token
      const token = jwt.sign(
        { 
          adminId: admin.id,
          username: admin.username,
          roleLevel: admin.role_level,
          loginLogId: loginLog.id // 可用于登出时更新记录
        },
        process.env.JWT_SECRET || 'default-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // 返回登录成功信息（不包含密码）
      const adminInfo = {
        id: admin.id,
        username: admin.username,
        real_name: admin.real_name,
        phone: admin.phone,
        email: admin.email,
        employee_id: admin.employee_id,
        role_level: admin.role_level,
        department: admin.department,
        avatar: admin.avatar,
        last_login_at: admin.last_login_at,
        last_login_ip: admin.last_login_ip
      };

      res.json({
        success: true,
        message: '登录成功',
        data: {
          token,
          admin: adminInfo,
          expires_in: process.env.JWT_EXPIRES_IN || '7d'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: '登录失败，服务器内部错误'
      });
    }
  }

  // 获取当前用户信息
  static async getCurrentUser(req, res) {
    try {
      const admin = req.admin;
      
      res.json({
        success: true,
        message: '获取用户信息成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name,
          phone: admin.phone,
          email: admin.email,
          employee_id: admin.employee_id,
          role_level: admin.role_level,
          department: admin.department,
          avatar: admin.avatar,
          is_online: admin.is_online,
          last_login_at: admin.last_login_at,
          last_login_ip: admin.last_login_ip
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: '获取用户信息失败'
      });
    }
  }

  // 管理员登出
  static async logout(req, res) {
    try {
      const admin = req.admin;
      
      // 更新在线状态
      await Admin.update(
        { is_online: 0 },
        { where: { id: admin.id } }
      );

      // 如果 token 中有 loginLogId，更新登出时间
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
          if (decoded.loginLogId) {
            await AdminLoginLog.update(
              { logout_time: new Date() },
              { where: { id: decoded.loginLogId } }
            );
          }
        } catch (err) {
          // Token 解析失败不影响登出
        }
      }

      res.json({
        success: true,
        message: '登出成功'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: '登出失败'
      });
    }
  }

  // 获取登录记录
  static async getLoginLogs(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        admin_id,
        status,
        start_date,
        end_date
      } = req.query;

      const currentAdmin = req.admin;
      const offset = (page - 1) * limit;

      // 构建查询条件
      let whereCondition = {};

      // 权限控制：主管只能看自己和下属的登录记录
      if (currentAdmin.role_level === 2) {
        const subordinateIds = await Admin.findAll({
          where: { created_by: currentAdmin.id },
          attributes: ['id']
        });
        const allowedIds = [currentAdmin.id, ...subordinateIds.map(s => s.id)];
        whereCondition.admin_id = { [Op.in]: allowedIds };
      }

      // 员工只能看自己的登录记录
      if (currentAdmin.role_level === 3) {
        whereCondition.admin_id = currentAdmin.id;
      }

      // 筛选条件
      if (admin_id) {
        whereCondition.admin_id = admin_id;
      }

      if (status) {
        whereCondition.status = status;
      }

      // 时间范围
      if (start_date || end_date) {
        whereCondition.login_time = {};
        if (start_date) {
          whereCondition.login_time[Op.gte] = new Date(start_date);
        }
        if (end_date) {
          whereCondition.login_time[Op.lte] = new Date(end_date);
        }
      }

      // 查询登录记录
      const { count, rows } = await AdminLoginLog.findAndCountAll({
        where: whereCondition,
        order: [['login_time', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });

      // 手动获取用户信息
      const logsWithUser = await Promise.all(rows.map(async (log) => {
        const admin = await Admin.findByPk(log.admin_id, {
          attributes: ['id', 'username', 'real_name', 'role_level']
        });
        return {
          ...log.toJSON(),
          admin
        };
      }));

      res.json({
        success: true,
        message: '获取登录记录成功',
        data: {
          list: logsWithUser,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get login logs error:', error);
      res.status(500).json({
        success: false,
        message: '获取登录记录失败'
      });
    }
  }

  // 修改个人密码
  static async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      const currentAdmin = req.admin;

      // 验证输入
      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: '当前密码和新密码不能为空'
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码长度不能少于6位'
        });
      }

      // 验证当前密码
      const admin = await Admin.findByPk(currentAdmin.id);
      const isCurrentPasswordValid = await bcrypt.compare(current_password, admin.password);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: '当前密码错误'
        });
      }

      // 检查新密码是否与当前密码相同
      const isSamePassword = await bcrypt.compare(new_password, admin.password);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: '新密码不能与当前密码相同'
        });
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(new_password, 10);

      // 更新密码
      await admin.update({ 
        password: hashedNewPassword,
        password_changed_at: new Date()
      });

      res.json({
        success: true,
        message: '密码修改成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name,
          password_changed_at: new Date()
        }
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: '密码修改失败，服务器内部错误'
      });
    }
  }

  // 更新个人信息
  static async updateProfile(req, res) {
    try {
      const {
        real_name,
        phone,
        email,
        department,
        notes
      } = req.body;

      const currentAdmin = req.admin;

      // 验证必填字段
      if (!real_name) {
        return res.status(400).json({
          success: false,
          message: '真实姓名不能为空'
        });
      }

      // 准备更新数据
      const updateData = {};
      
      if (real_name !== undefined) updateData.real_name = real_name;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (department !== undefined) updateData.department = department;
      if (notes !== undefined) updateData.notes = notes;

      // 更新个人信息
      const admin = await Admin.findByPk(currentAdmin.id);
      await admin.update(updateData);

      // 返回更新后的信息（不包含密码）
      const updatedAdmin = await Admin.findByPk(currentAdmin.id, {
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: '个人信息更新成功',
        data: updatedAdmin
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: '个人信息更新失败，服务器内部错误'
      });
    }
  }

  // 获取个人登录记录
  static async getMyLoginLogs(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status,
        start_date,
        end_date
      } = req.query;

      const currentAdmin = req.admin;
      const offset = (page - 1) * limit;

      // 构建查询条件 - 只查看自己的记录
      let whereCondition = {
        admin_id: currentAdmin.id
      };

      // 筛选条件
      if (status) {
        whereCondition.status = status;
      }

      // 时间范围
      if (start_date || end_date) {
        whereCondition.login_time = {};
        if (start_date) {
          whereCondition.login_time[Op.gte] = new Date(start_date);
        }
        if (end_date) {
          whereCondition.login_time[Op.lte] = new Date(end_date);
        }
      }

      // 查询登录记录
      const { count, rows } = await AdminLoginLog.findAndCountAll({
        where: whereCondition,
        order: [['login_time', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        message: '获取个人登录记录成功',
        data: {
          list: rows,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get my login logs error:', error);
      res.status(500).json({
        success: false,
        message: '获取个人登录记录失败'
      });
    }
  }

  // 上传个人头像
  static async uploadMyAvatar(req, res) {
    try {
      const currentAdmin = req.admin;

      // 查找当前用户
      const admin = await Admin.findByPk(currentAdmin.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 删除旧头像文件
      if (admin.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', admin.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
          } catch (error) {
            console.log('删除旧头像失败:', error.message);
          }
        }
      }

      // 构建新的头像URL路径
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // 更新数据库中的头像字段
      await admin.update({ avatar: avatarUrl });

      res.json({
        success: true,
        message: '头像上传成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name,
          avatar: avatarUrl,
          avatar_full_url: `${req.protocol}://${req.get('host')}${avatarUrl}`
        }
      });

    } catch (error) {
      console.error('Upload my avatar error:', error);
      
      // 如果出错，删除已上传的文件
      if (req.file) {
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (deleteError) {
            console.log('删除上传文件失败:', deleteError.message);
          }
        }
      }

      res.status(500).json({
        success: false,
        message: '头像上传失败，服务器内部错误'
      });
    }
  }

  // 删除个人头像
  static async deleteMyAvatar(req, res) {
    try {
      const currentAdmin = req.admin;

      const admin = await Admin.findByPk(currentAdmin.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      if (!admin.avatar) {
        return res.status(400).json({
          success: false,
          message: '暂无头像'
        });
      }

      // 删除头像文件
      const avatarPath = path.join(__dirname, '..', admin.avatar);
      if (fs.existsSync(avatarPath)) {
        try {
          fs.unlinkSync(avatarPath);
        } catch (error) {
          console.log('删除头像文件失败:', error.message);
        }
      }

      // 清空数据库中的头像字段
      await admin.update({ avatar: null });

      res.json({
        success: true,
        message: '头像删除成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name,
          avatar: null
        }
      });

    } catch (error) {
      console.error('Delete my avatar error:', error);
      res.status(500).json({
        success: false,
        message: '头像删除失败，服务器内部错误'
      });
    }
  }
}

module.exports = AuthController;