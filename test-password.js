const bcrypt = require('bcryptjs');

// 数据库中的哈希值
const hashFromDB = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

// 测试密码
const testPassword = '123456';

// 验证密码
const isValid = bcrypt.compareSync(testPassword, hashFromDB);

console.log('密码验证结果:', isValid);
console.log('测试密码:', testPassword);
console.log('数据库哈希:', hashFromDB);

// 生成新的哈希值进行对比
const newHash = bcrypt.hashSync(testPassword, 10);
console.log('新生成的哈希:', newHash);