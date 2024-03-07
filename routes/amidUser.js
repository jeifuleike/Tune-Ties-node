const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/adminToken');
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
      if (password === storedPassword && results[0].permissions === 'amid') {
        // 密码匹配，生成token
        const userId = results[0].id;
        const token = jwt.sign({ userId, userName, type: 'admin' }, 'Tune-Ties', { expiresIn: '7d' });
        res.send({ state: 1, msg: '登录成功', data: { token } });
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

// 注册
router.post('/register', function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;
  const aminKey = req.body.aminKey;
  if (userName.length < 3 || aminKey !== '505050') {
    console.log('执行到插入')
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
      const insertUserQuery = 'INSERT INTO users (userName, password, permissions) VALUES (?, ?, ?)';
      
      req.db.query(insertUserQuery, [userName, password, 'amid'], (err, insertResults) => {
        const userId = insertResults.insertId;
        // 创建 token
        const token = jwt.sign({ userId, userName, type: 'admin' }, 'Tune-Ties', { expiresIn: '7d' });
        // 发送token
        res.send({ state: 1, msg: '注册成功', data: { token } });
      });
    }
  });
});

// 根据token拿到用户信息
router.get('/userInfo', verifyToken, function(req, res, next) {
  const userId = req.userId;
  const checkUserQuery = 'SELECT * FROM users WHERE id = ?';
  req.db.query(checkUserQuery, [userId], (err, insertResults) => {
    res.send({
      state: 1,
      msg: '获取用户信息成功',
      data: { id: insertResults[0]?.id, name: insertResults[0]?.userName, roles: ["admin"] }
    });
  })
})

// 获取展示用户列表
router.get('/userList', verifyToken, function(req, res, next) {
  const { per, page } = req.query;
  const pageSize = parseInt(per) || 10; 
  const currentPage = parseInt(page) || 1; 

  const offset = (currentPage - 1) * pageSize;

  const checkUserQuery = "SELECT * FROM users";
  req.db.query(checkUserQuery, (err, insertResults) => {
    const userList = insertResults.filter(item => item.permissions !== 'amid')
    if (userList.length === 0) {
      res.send({
        state: 1,
        msg: '获取用户信息成功',
        data: { 
          users: [],
          total: 0
        }
      });
      return
    }
    const users = userList.slice(offset, pageSize)
    const total = users.length
    const ids = userList.map(item => item.id)
    getUserInfo(ids, req, (err, userInfo) => {
      if (userInfo) {
        const userInfoList = users.map(item => {
          let obj = { ...item }
          const user = userInfo.find(value => value.userId === item.id)
          delete obj.password
          obj.name = user.userName
          obj.sex = user.sex
          obj.avatar = user.avatar
          obj.region = user.region
          return obj
        })
        res.send({
          state: 1,
          msg: '获取用户信息成功',
          data: { 
            users: userInfoList,
            total
          }
        });
      } else {
        // 用户信息不存在
        res.status(500).send({ state: 0, msg: '服务器内部错误' });
      }
    });
  });
});

// 添加用户
router.post('/addUser', verifyToken, function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;
  if (userName.length < 3) {
    res.send({ state: 0, msg: '添加失败' });
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

        // 给新创建的用户加上默认用户信息
        const userInfo = {
          userId,
          userName: req.body.name?  req.body.name : userName,
          sex: req.body.sex,
          avatar: '',
          birthday: new Date('1990-01-01').getTime(),
          region: req.body.region,
          label: '',
          listLike: ''
        }
        addUserInfo(req, userInfo)

        // 发送token
        res.send({ state: 1, msg: '添加成功' });
      });
    }
  });
});

// 编辑用户信息
router.put('/changeUserInfo/:id', verifyToken, function(req, res, next) {
  const userInfo = req.body;
  const userId = req.params.id;
  console.log(userInfo, userId)
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

// 删除用户
router.delete('/deleteUser/:userId', verifyToken, function(req, res, next) {
  const userIdToDelete = req.params.userId;

  // 检查数据库中是否存在要删除的用户
  const checkUserQuery = 'SELECT * FROM users WHERE userId = ?';

  req.db.query(checkUserQuery, [userIdToDelete], (err, results) => {
    // 如果不存在要删除的用户
    if (results?.length === 0) {
      res.status(404).send({ state: 0, msg: '用户不存在', data: null });
    } else {
      // 如果存在要删除的用户，执行删除操作
      const deleteUserQuery = 'DELETE FROM users WHERE id = ?';

      req.db.query(deleteUserQuery, [userIdToDelete], (err, deleteResults) => {
        if (err) {
          res.status(500).send({ state: 0, msg: '删除用户失败', data: null });
        } else {
          // 在此处你可以添加其他的清理逻辑，例如删除与该用户关联的其他数据等

          res.send({ state: 1, msg: '删除用户成功' });
        }
      });
    }
  });
});

// 获取展示管理员列表
router.get('/amidList', verifyToken, function(req, res, next) {
  const { per, page } = req.query;
  const pageSize = parseInt(per) || 10; 
  const currentPage = parseInt(page) || 1; 

  const offset = (currentPage - 1) * pageSize;

  const checkUserQuery = "SELECT * FROM users";
  req.db.query(checkUserQuery, (err, insertResults) => {
    const userList = insertResults.filter(item => item.permissions === 'amid')
    if (userList.length === 0) {
      res.send({
        state: 1,
        msg: '获取用户信息成功',
        data: { 
          users: [],
          total: 0
        }
      });
      return
    }
    const users = userList.slice(offset, pageSize)
    const total = users.length
    const userInfoList = users.map(item => {
      return {
        id: item.id,
        userName: item.userName
      }
    })
    res.send({
      state: 1,
      msg: '获取用户信息成功',
      data: { 
        users: userInfoList,
        total
      }
    });
  });
});

// 添加管理员用户
router.post('/addAmid', verifyToken, function(req, res, next) {
  const userName = req.body.userName;
  const password = req.body.password;
  if (userName.length < 3) {
    res.send({ state: 0, msg: '添加失败' });
  }
  // 检查数据库中是否存在相同用户名的用户
  const checkUserQuery = 'SELECT * FROM users WHERE userName = ?';

  req.db.query(checkUserQuery, [userName], (err, results) => {

    // 如果存在相同用户名的用户
    if (results.length > 0) {
      res.send({ state: 0, msg: '用户已存在', data: null });
    } else {
      // 如果不存在相同用户名的用户，执行插入操作
      const insertUserQuery = 'INSERT INTO users (userName, password, permissions) VALUES (?, ?, ?)';
      req.db.query(insertUserQuery, [userName, password, 'amid'], (err, insertResults) => {
        res.send({ state: 1, msg: '添加成功' });
      });
    }
  });
});

// 编辑管理员
router.put('/changeAmidInfo/:userId', verifyToken, function(req, res, next) {
  const userId = req.params.userId;
  const userName = req.body.userName;
  const password = req.body.password;

  if (userName.length < 3) {
    res.send({ state: 0, msg: '编辑失败' });
  } else {
    const checkPermissionQuery = 'SELECT * FROM users WHERE id = ? AND permissions = ?';

    req.db.query(checkPermissionQuery, [userId, 'amid'], (err, permissionResults) => {
      if (err || permissionResults.length === 0) {
        res.send({ state: 0, msg: '无权限编辑用户', data: null });
      } else {
        const checkUserQuery = 'SELECT * FROM users WHERE userName = ? AND id != ?';
        req.db.query(checkUserQuery, [userName, userId], (err, userResults) => {
          if (userResults.length > 0) {
            res.send({ state: 0, msg: '用户已存在', data: null });
          } else {
            const updateUserQuery = 'UPDATE users SET userName = ?, password = ? WHERE id = ?';
            req.db.query(updateUserQuery, [userName, password, userId], (err, updateResults) => {
              if (err) {
                res.send({ state: 0, msg: '编辑失败' });
              } else {
                res.send({ state: 1, msg: '编辑成功' });
              }
            });
          }
        });
      }
    });
  }
});

// 删除管理员
router.delete('/deleteAmid/:userId', verifyToken, function(req, res, next) {
  const userId = req.params.userId;

  const checkPermissionQuery = 'SELECT * FROM users WHERE id = ? AND permissions = ?';

  req.db.query(checkPermissionQuery, [userId, 'amid'], (err, permissionResults) => {
    if (err || permissionResults.length === 0) {
      res.send({ state: 0, msg: '无权限删除用户', data: null });
    } else {
      const checkLastUserQuery = 'SELECT COUNT(*) AS userCount FROM users WHERE permissions = ?';

      req.db.query(checkLastUserQuery, ['amid'], (err, countResults) => {
        if (err || countResults[0].userCount <= 1) {
          res.send({ state: 0, msg: '无法删除最后一个管理员用户', data: null });
        } else {
          const deleteUserQuery = 'DELETE FROM users WHERE id = ?';

          req.db.query(deleteUserQuery, [userId], (err, deleteResults) => {
            if (err) {
              res.send({ state: 0, msg: '删除失败' });
            } else {
              res.send({ state: 1, msg: '删除成功' });
            }
          });
        }
      });
    }
  });
});

module.exports = router;
