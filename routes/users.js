const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

// 具体修改用户信息函数
function addUserInfo(req, data) {
  sql = 'INSERT INTO usersInfo (userId, userName, sex, avatar, birthday, region, label, listLike) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const value = Object.values(data)
  req.db.query(sql, value, (err, results, fields) => {
    if (err) {
      console.error('Error inserting data:', err);
    } 
  })
}

// 注册
router.post('/register', function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;

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
          avatar: `${req.protocol}://${req.get('host')}/public/images/defaultUser.png`,
          birthday: new Date('1990-01-01').getTime(),
          region: '',
          label: '',
          listLike: ''
        }
        addUserInfo(req, userInfo)
        // 发送token
        res.send({ state: 1, msg: '注册成功', data: { token } });
      });
    }
  });
});

// 修改用户信息

// 获取用户信息
router.get('/userInfo', verifyToken, function(req, res, next) {
  const userId = req.userId;
  console.log(userId)
  // 查询数据库以获取用户信息
  const getUserInfoQuery = 'SELECT * FROM usersInfo WHERE userId = ?';

  req.db.query(getUserInfoQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user info:', err);
      res.status(500).json({ state: 0, msg: 'Internal Server Error', data: null });
    } else {
      if (results.length > 0) {
        // 用户信息存在，返回用户信息
        const userInfo = results[0];
        userInfo.label = userInfo.label? userInfo.label.split(',') : []
        userInfo.listLike = userInfo.listLike? userInfo.listLike.split(',') : []
        res.status(200).json({ state: 1, msg: '获取用户信息成功！', data: userInfo });
      } else {
        // 用户信息不存在
        res.status(404).json({ state: 0, msg: '未找到该用户', data: null });
      }
    }
  });
});

module.exports = router;
