const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class AdminController {
  // 创建管理员（添加主管或员工）
  static async createAdmin(req, res) {
    try {
      const { 
        username, 
        password, 
        real_name, 
        phone, 
        email,
        employee_id,
        role_level, 
        department,
        notes 
      } = req.body;

      const creator = req.admin; // 当前登录的管理员

      // 验证必填字段
      if (!username || !password || !real_name || !role_level) {
        return res.status(400).json({
          success: false,
          message: '用户名、密码、真实姓名和角色等级为必填项'
        });
      }

      // 权限验证
      if (creator.role_level >= role_level) {
        return res.status(403).json({
          success: false,
          message: '无法创建同级或更高级别的管理员'
        });
      }

      // 超级管理员可以创建主管和员工，主管只能创建员工
      if (creator.role_level === 1 && ![2, 3].includes(role_level)) {
        return res.status(400).json({
          success: false,
          message: '超级管理员只能创建主管(2)或员工(3)'
        });
      }

      if (creator.role_level === 2 && role_level !== 3) {
        return res.status(400).json({
          success: false,
          message: '主管只能创建员工(3)'
        });
      }

      // 检查用户名是否已存在
      const existingAdmin = await Admin.findOne({
        where: { username }
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: '用户名已存在'
        });
      }

      // 检查员工工号是否已存在
      if (employee_id) {
        const existingEmployeeId = await Admin.findOne({
          where: { employee_id }
        });

        if (existingEmployeeId) {
          return res.status(400).json({
            success: false,
            message: '员工工号已存在'
          });
        }
      }

      // 检查手机号是否已存在
      if (phone) {
        const existingPhone = await Admin.findOne({
          where: { phone }
        });

        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: '手机号已存在'
          });
        }
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建管理员
      const newAdmin = await Admin.create({
        username,
        password: hashedPassword,
        real_name,
        phone,
        email,
        employee_id,
        role_level,
        status: 1, // 默认启用
        created_by: creator.id,
        manager_id: creator.id, // 直属上级为创建者
        department,
        notes
      });

      // 返回创建结果（不包含密码）
      const adminInfo = {
        id: newAdmin.id,
        username: newAdmin.username,
        real_name: newAdmin.real_name,
        phone: newAdmin.phone,
        email: newAdmin.email,
        employee_id: newAdmin.employee_id,
        role_level: newAdmin.role_level,
        department: newAdmin.department,
        status: newAdmin.status,
        created_by: newAdmin.created_by,
        manager_id: newAdmin.manager_id,
        created_at: newAdmin.created_at
      };

      res.status(201).json({
        success: true,
        message: '管理员创建成功',
        data: adminInfo
      });

    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({
        success: false,
        message: '创建管理员失败，服务器内部错误'
      });
    }
  }

  // 获取管理员列表
  static async getAdminList(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        role_level, 
        department, 
        status,
        search 
      } = req.query;

      const currentAdmin = req.admin;
      const offset = (page - 1) * limit;

      // 构建查询条件
      let whereCondition = {};

      // 权限控制：主管只能看到自己创建的员工
      if (currentAdmin.role_level === 2) {
        whereCondition.created_by = currentAdmin.id;
      }

      // 筛选条件
      if (role_level) {
        whereCondition.role_level = role_level;
      }

      if (department) {
        whereCondition.department = department;
      }

      if (status !== undefined) {
        whereCondition.status = status;
      }

      // 搜索条件
      if (search) {
        whereCondition[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { real_name: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { employee_id: { [Op.like]: `%${search}%` } }
        ];
      }

      // 查询管理员列表
      const { count, rows } = await Admin.findAndCountAll({
        where: whereCondition,
        attributes: { 
          exclude: ['password'] 
        },
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'username', 'real_name']
          },
          {
            model: Admin,
            as: 'manager',
            attributes: ['id', 'username', 'real_name']
          }
        ],
        order: [['created_at', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        message: '获取管理员列表成功',
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
      console.error('Get admin list error:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员列表失败'
      });
    }
  }

  // 获取管理员详情
  static async getAdminDetail(req, res) {
    try {
      const { id } = req.params;
      const currentAdmin = req.admin;

      // 权限检查：只能查看自己有权管理的用户
      const admin = await Admin.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'username', 'real_name']
          },
          {
            model: Admin,
            as: 'manager',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限验证
      if (currentAdmin.role_level === 2 && admin.created_by !== currentAdmin.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此管理员信息'
        });
      }

      res.json({
        success: true,
        message: '获取管理员详情成功',
        data: admin
      });

    } catch (error) {
      console.error('Get admin detail error:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员详情失败'
      });
    }
  }

  // 更新管理员信息
  static async updateAdmin(req, res) {
    try {
      const { id } = req.params;
      const {
        real_name,
        phone,
        email,
        employee_id,
        department,
        notes
      } = req.body;

      const currentAdmin = req.admin;

      // 查找要更新的管理员
      const admin = await Admin.findByPk(id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限验证：不能修改比自己级别高或同级的管理员
      if (currentAdmin.role_level >= admin.role_level && currentAdmin.id !== admin.id) {
        return res.status(403).json({
          success: false,
          message: '无权修改此管理员信息'
        });
      }

      // 主管只能修改自己创建的员工
      if (currentAdmin.role_level === 2 && admin.created_by !== currentAdmin.id && currentAdmin.id !== admin.id) {
        return res.status(403).json({
          success: false,
          message: '无权修改此管理员信息'
        });
      }

      // 检查员工工号是否已被其他人使用（如果要修改工号的话）
      if (employee_id && employee_id !== admin.employee_id) {
        const existingEmployeeId = await Admin.findOne({
          where: { 
            employee_id,
            id: { [Op.ne]: id }
          }
        });

        if (existingEmployeeId) {
          return res.status(400).json({
            success: false,
            message: '员工工号已被其他用户使用'
          });
        }
      }

      // 准备更新数据
      const updateData = {};
      
      if (real_name !== undefined) updateData.real_name = real_name;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (employee_id !== undefined) updateData.employee_id = employee_id;
      if (department !== undefined) updateData.department = department;
      if (notes !== undefined) updateData.notes = notes;

      // 执行更新
      await admin.update(updateData);

      // 重新获取更新后的数据
      const updatedAdmin = await Admin.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'username', 'real_name']
          },
          {
            model: Admin,
            as: 'manager',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      res.json({
        success: true,
        message: '管理员信息更新成功',
        data: updatedAdmin
      });

    } catch (error) {
      console.error('Update admin error:', error);
      res.status(500).json({
        success: false,
        message: '更新管理员信息失败，服务器内部错误'
      });
    }
  }

  // 重置管理员密码
  static async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { new_password } = req.body;
      const currentAdmin = req.admin;

      if (!new_password) {
        return res.status(400).json({
          success: false,
          message: '新密码不能为空'
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: '密码长度不能少于6位'
        });
      }

      const admin = await Admin.findByPk(id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限验证：不能重置比自己级别高或同级的管理员密码（除了自己）
      if (currentAdmin.role_level >= admin.role_level && currentAdmin.id !== admin.id) {
        return res.status(403).json({
          success: false,
          message: '无权重置此管理员密码'
        });
      }

      // 主管只能重置自己创建的员工密码
      if (currentAdmin.role_level === 2 && admin.created_by !== currentAdmin.id && currentAdmin.id !== admin.id) {
        return res.status(403).json({
          success: false,
          message: '无权重置此管理员密码'
        });
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(new_password, 10);

      // 更新密码
      await admin.update({ 
        password: hashedPassword,
        password_changed_at: new Date()
      });

      res.json({
        success: true,
        message: '密码重置成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name
        }
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: '重置密码失败，服务器内部错误'
      });
    }
  }

  // 删除管理员（软删除）
  static async deleteAdmin(req, res) {
    try {
      const { id } = req.params;
      const currentAdmin = req.admin;

      const admin = await Admin.findByPk(id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 不能删除自己
      if (admin.id === currentAdmin.id) {
        return res.status(400).json({
          success: false,
          message: '不能删除自己的账号'
        });
      }

      // 权限验证：不能删除比自己级别高或同级的管理员
      if (currentAdmin.role_level >= admin.role_level) {
        return res.status(403).json({
          success: false,
          message: '无权删除此管理员'
        });
      }

      // 主管只能删除自己创建的员工
      if (currentAdmin.role_level === 2 && admin.created_by !== currentAdmin.id) {
        return res.status(403).json({
          success: false,
          message: '无权删除此管理员'
        });
      }

      // 检查是否有下级管理员
      const subordinates = await Admin.count({
        where: { manager_id: id }
      });

      if (subordinates > 0) {
        return res.status(400).json({
          success: false,
          message: '该管理员还有下级，请先处理下级管理员'
        });
      }

      // 软删除：设置状态为禁用，并修改用户名避免冲突
      const timestamp = Date.now();
      await admin.update({
        status: 0,
        username: `${admin.username}_deleted_${timestamp}`,
        notes: `${admin.notes || ''} [已删除于 ${new Date().toLocaleString()}]`
      });

      res.json({
        success: true,
        message: '管理员删除成功',
        data: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name
        }
      });

    } catch (error) {
      console.error('Delete admin error:', error);
      res.status(500).json({
        success: false,
        message: '删除管理员失败，服务器内部错误'
      });
    }
  }

  // 上传头像
  static async uploadAvatar(req, res) {
    try {
      const { id } = req.params;
      const currentAdmin = req.admin;

      // 权限验证：只能修改自己的头像，或者上级修改下级的头像
      const targetAdmin = await Admin.findByPk(id);

      if (!targetAdmin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限检查
      const canModify = 
        targetAdmin.id === currentAdmin.id || // 修改自己的
        (currentAdmin.role_level === 1) || // 超级管理员可以修改任何人的
        (currentAdmin.role_level === 2 && targetAdmin.created_by === currentAdmin.id); // 主管可以修改自己创建的员工的

      if (!canModify) {
        return res.status(403).json({
          success: false,
          message: '无权修改此管理员的头像'
        });
      }

      // 删除旧头像文件
      if (targetAdmin.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', targetAdmin.avatar);
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
      await targetAdmin.update({ avatar: avatarUrl });

      // 获取更新后的用户信息
      const updatedAdmin = await Admin.findByPk(id, {
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: '头像上传成功',
        data: {
          id: updatedAdmin.id,
          username: updatedAdmin.username,
          real_name: updatedAdmin.real_name,
          avatar: updatedAdmin.avatar,
          avatar_full_url: `${req.protocol}://${req.get('host')}${avatarUrl}`
        }
      });

    } catch (error) {
      console.error('Upload avatar error:', error);
      
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

  // 删除头像
  static async deleteAvatar(req, res) {
    try {
      const { id } = req.params;
      const currentAdmin = req.admin;

      const targetAdmin = await Admin.findByPk(id);

      if (!targetAdmin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限检查
      const canModify = 
        targetAdmin.id === currentAdmin.id ||
        (currentAdmin.role_level === 1) ||
        (currentAdmin.role_level === 2 && targetAdmin.created_by === currentAdmin.id);

      if (!canModify) {
        return res.status(403).json({
          success: false,
          message: '无权删除此管理员的头像'
        });
      }

      if (!targetAdmin.avatar) {
        return res.status(400).json({
          success: false,
          message: '用户暂无头像'
        });
      }

      // 删除头像文件
      const avatarPath = path.join(__dirname, '..', targetAdmin.avatar);
      if (fs.existsSync(avatarPath)) {
        try {
          fs.unlinkSync(avatarPath);
        } catch (error) {
          console.log('删除头像文件失败:', error.message);
        }
      }

      // 清空数据库中的头像字段
      await targetAdmin.update({ avatar: null });

      res.json({
        success: true,
        message: '头像删除成功',
        data: {
          id: targetAdmin.id,
          username: targetAdmin.username,
          real_name: targetAdmin.real_name,
          avatar: null
        }
      });

    } catch (error) {
      console.error('Delete avatar error:', error);
      res.status(500).json({
        success: false,
        message: '头像删除失败，服务器内部错误'
      });
    }
  }

  // 更新管理员状态（启用/禁用）
  static async updateAdminStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const currentAdmin = req.admin;

      if (![0, 1].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '状态值无效，只能是0(禁用)或1(启用)'
        });
      }

      const admin = await Admin.findByPk(id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: '管理员不存在'
        });
      }

      // 权限验证：不能禁用自己
      if (admin.id === currentAdmin.id) {
        return res.status(400).json({
          success: false,
          message: '不能修改自己的状态'
        });
      }

      // 主管只能管理自己创建的员工
      if (currentAdmin.role_level === 2 && admin.created_by !== currentAdmin.id) {
        return res.status(403).json({
          success: false,
          message: '无权管理此管理员'
        });
      }

      await admin.update({ status });

      res.json({
        success: true,
        message: `管理员已${status === 1 ? '启用' : '禁用'}`,
        data: {
          id: admin.id,
          username: admin.username,
          status: admin.status
        }
      });

    } catch (error) {
      console.error('Update admin status error:', error);
      res.status(500).json({
        success: false,
        message: '更新管理员状态失败'
      });
    }
  }
}

module.exports = AdminController;