const express = require('express');
const multer = require('multer');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/userImage'); // 上传的文件存储的目录
  },
  filename: function (req, file, cb) {
    const userId = req.userId; // 获取用户ID
    const uniqueSuffix = userId + '-' + Date.now(); // 用户ID + 时间戳作为唯一标识
    const filename = uniqueSuffix + '.' + file.mimetype.split('/')[1];
    const filepath = 'public/images/userImage/' + filename;
    cb(null, filename);

    // 替换路径中的反斜杠为正斜杠
    const avatarPath = filepath.replace(/\\/g, '/');
    
    // 更新数据库中的头像路径
    const sql = 'UPDATE usersInfo SET avatar = ? WHERE userId = ?';
    req.db.query(sql, [avatarPath, req.userId], (err, results, fields) => {
      if (err) {
        console.error('Error updating avatar:', err);
      }
    });
  }
});

const upload = multer({ storage: storage });

router.post('/user/uploadAvatar', verifyToken, upload.single('avatar'), function (req, res, next) {
  // 处理上传完成后的逻辑
  const avatarPath = req.file.path.replace(/\\/g, '/')
  
  res.send({ state: 1, msg: '头像上传成功', data: { avatarPath: req.serverBaseUrl + '/' + avatarPath } });
});

module.exports = router;