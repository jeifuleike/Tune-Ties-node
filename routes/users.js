const jwt = require('jsonwebtoken');
var express = require('express');
var router = express.Router();

// 具体修改用户信息函数
function addUserInfo(req, data) {
  sql = 'INSERT INTO usersInfo (userId, userName, sex, avatar, birthday, region, label) VALUES (?, ?, ?, ?, ?, ?, ?)';
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
        const token = jwt.sign({ userId, userName }, 'your-secret-key', { expiresIn: '1h' });

        // 给新创建的用户加上默认用户信息
        const userInfo = {
          userId,
          userName,
          sex: 1,
          avatar: `${req.protocol}://${req.get('host')}/public/images/defaultUser.png`,
          birthday: new Date('1990-01-01').getTime(),
          region: '',
          label: ''
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
router.get('/userInfo', function(req, res, next) {
  console.log(req.query.name)
  res.send('give userInfo')
})

module.exports = router;
