const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getUserInfo } = require('../middleware/userInfoSQL')

// 具体修改用户信息函数
function addUserInfo(req, data) {
  const sql = 'INSERT INTO usersInfo (userId, userName, sex, avatar, birthday, region, label, listLike) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const value = Object.values(data)
  req.db.query(sql, value, (err, results, fields) => {
    if (err) {
      console.error('Error inserting data:', err);
    }
  })
}

// 获取用户信息
router.get('/userInfo', verifyToken, function(req, res, next) {
  const userId = req.userId;
  // 查询数据库以获取用户信息
  getUserInfo(userId, req, (err, userInfo) => {
    if (userInfo) {
      res.status(200).json({ state: 1, msg: '获取用户信息成功！', data: userInfo[0] });
    } else {
      // 用户信息不存在
      res.status(404).json({ state: 0, msg: '未找到该用户', data: null });
    }
  });
});

// 注册
router.post('/register', function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;
  if (userName.length < 3) {
    res.send({ state: 1, msg: '注册失败' });
  }
  // 检查数据库中是否存在相同用户名的用户
  const checkUserQuery = 'SELECT * FROM users WHERE userName = ?';

  req.db.query(checkUserQuery, [userName], (err, results) => {

    // 如果存在相同用户名的用户
    if (results.length > 0) {
      res.send({ state: 0, msg: '用户已存在', data: null });
    } else {
      // 如果不存在相同用户名的用户，执行插入操作
      const insertUserQuery = 'INSERT INTO users (userName, password) VALUES (?, ?)';
      
      req.db.query(insertUserQuery, [userName, password], (err, insertResults) => {
        const userId = insertResults.insertId;
        // 创建 token
        const token = jwt.sign({ userId, userName }, 'Tune-Ties', { expiresIn: '7d' });

        // 给新创建的用户加上默认用户信息
        const userInfo = {
          userId,
          userName,
          sex: 1,
          avatar: '',
          birthday: new Date('1990-01-01').getTime(),
          region: '',
          label: '',
          listLike: ''
        }
        addUserInfo(req, userInfo)

        // 发送token
        res.send({ state: 1, msg: '注册成功', data: { token, userInfo } });
      });
    }
  });
});

// 登录
router.post('/login', function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;

  // 在用户列表中查找用户
  const checkUserQuery = 'SELECT * FROM users WHERE userName = ?';

  req.db.query(checkUserQuery, [userName], (err, results) => {
    if (results.length > 0) {
      // 用户存在，验证密码
      const storedPassword = results[0].password;
      if (password === storedPassword) {
        // 密码匹配，生成token
        const userId = results[0].id;
        const token = jwt.sign({ userId, userName }, 'Tune-Ties', { expiresIn: '7d' });
        getUserInfo(userId, req, (err, userInfo) => {
          res.send({ state: 1, msg: '登录成功', data: { token, userInfo: userInfo[0] } });
        });
      } else {
        // 密码错误
        res.status(404).json({ state: 0, msg: '密码错误！', data: null });
      }
    } else {
      // 用户不存在
      res.status(404).json({ state: 0, msg: '用户不存在！', data: null });
    }
  });
});

// 用户修改个人信息
router.post('/changeUserInfo', verifyToken, function(req, res, next) {
  const userInfo = req.body;
  const userId = req.userId;
  // 构造 SQL 更新语句
  let updateFields = '';
  const updateValues = [];

  // 遍历 userInfo 对象，构建 SET 子句
  for (const key in userInfo) {
    if (userInfo.hasOwnProperty(key)) {
      updateFields += `${key} = ?, `;
      updateValues.push(userInfo[key]);
    }
  }

  // 去掉最后多余的逗号和空格
  updateFields = updateFields.slice(0, -2);

  // 构建完整的 SQL 更新语句
  const sql = `UPDATE usersInfo SET ${updateFields} WHERE userId = ?`;
  updateValues.push(userId);

  // 执行 SQL 更新语句
  req.db.query(sql, updateValues, (err, results, fields) => {
    if (err) {
      console.error('Error updating user info:', err);
      res.status(500).json({ state: 0, msg: 'Internal Server Error', data: null });
    } else {
      res.status(200).json({ state: 1, msg: 'User info updated successfully', data: userInfo });
    }
  });
});

module.exports = router;
