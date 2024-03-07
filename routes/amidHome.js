const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/adminToken');
const fs = require('fs');

// 首页获取当前注册用户数
router.get('/userCount', verifyToken, function(req, res, next) {
  const countUsersQuery = 'SELECT * FROM users';

  req.db.query(countUsersQuery, (err, results) => {
    const amidList = results.filter(item => item.permissions === 'amid')
    if (err) {
      console.error('查询用户数量时出错：', err);
      res.status(500).send({ state: 0, msg: '服务器内部错误' });
    } else {
      res.send({ state: 1, msg: '获取用户数量成功', data: { 
        allUserCount: results.length,
        amidUserCount: amidList.length,
        userCount: results.length - amidList.length
    } });
    }
  });
});

// 获取聊天记录总数和聊天好友数
router.get('/chatStats', verifyToken, function(req, res, next) {

  // 查询聊天记录总数
  const countMessagesQuery = 'SELECT COUNT(*) AS messageCount FROM chatmessages';
  req.db.query(countMessagesQuery, (err, results) => {
    if (err) {
      console.error('查询聊天记录总数时出错：', err);
      res.status(500).send({ state: 0, msg: '服务器内部错误' });
    } else {
      const messageCount = results[0].messageCount;
      // 查询聊天好友数
      const chatStatsQuery = `
      SELECT COUNT(*) AS friendCount
      FROM (
        SELECT SenderUserID, ReceiverUserID
        FROM chatmessages
        GROUP BY SenderUserID, ReceiverUserID
        HAVING COUNT(*)
      ) AS chatRooms;
    `;

      req.db.query(chatStatsQuery, (err, results) => {
        if (err) {
          console.error('查询聊天好友数时出错：', err);
          res.status(500).send({ state: 0, msg: '服务器内部错误' });
        } else {
          const friendCount = results[0].friendCount;

          res.send({
            state: 1,
            msg: '获取聊天统计成功',
            data: {
              messageCount: messageCount,
              friendCount: friendCount
            }
          });
        }
      });
    }
  });
});

// 获取首页排版
router.get('/homeTypeset', function(req, res, next) {
  const filePath = './public/Profile/homeTypeset.txt';
  
  // 读取文件内容
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('读取文件时出错:', err);
      return;
    }
  
    // 处理文件内容
    const lines = data.split('\n');

    lines.forEach(line => {
      console.log(line.trim()); // 输出每一行，去除前后空格
      const data = line.trim()
      res.send({
        state: 1,
        msg: '获取首页信息成功！',
        data: data.split(',').map(item => item.trim())
      })
    });
  });
});

// 编辑首页排版
router.put('/changeHomeTypeset', function(req, res, next) {
  console.log(req.body, 'req.body')
  const dataMap = [
    'search',
    'HOMEPAGE_BANNER',
    'HOMEPAGE_BLOCK_PLAYLIST_RCMD',
    'HOMEPAGE_BLOCK_STYLE_RCMD',
    'HOMEPAGE_BLOCK_NEW_ALBUM_NEW_SONG'
  ]
  const homeType = req.body.map((item, index) => (item ? dataMap[index] : null)).filter(Boolean);

  console.log(homeType, 'homeType');

  const lastThreeItems = homeType.slice(-3);
  const hasAtLeastOneTrue = lastThreeItems.some(item => item === 'HOMEPAGE_BLOCK_PLAYLIST_RCMD' || item === 'HOMEPAGE_BLOCK_STYLE_RCMD' || item === 'HOMEPAGE_BLOCK_NEW_ALBUM_NEW_SONG');

  if (hasAtLeastOneTrue) {
    const filePath = './public/Profile/homeTypeset.txt';
    // 写入文件
    fs.writeFileSync(filePath, homeType.join(','), 'utf-8');

    res.send({ state: 1, msg: '成功' });
  } else {
    res.send({ state: 0, msg: '至少选择一项' });
  }
});

module.exports = router;
