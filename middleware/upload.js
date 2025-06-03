const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成文件名：admin_用户ID_时间戳.扩展名
    const adminId = req.admin?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `admin_${adminId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPEG、PNG、GIF 格式的图片'), false);
  }
};

// 配置 multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制文件大小 5MB
    files: 1 // 一次只能上传一个文件
  },
  fileFilter: fileFilter
});

// 单个头像上传中间件
const uploadAvatar = upload.single('avatar');

// 错误处理包装器
const handleUpload = (req, res, next) => {
  uploadAvatar(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '文件大小不能超过 5MB'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: '一次只能上传一个文件'
        });
      }
      return res.status(400).json({
        success: false,
        message: '文件上传错误: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的头像文件'
      });
    }
    
    next();
  });
};

module.exports = {
  handleUpload,
  uploadDir
};