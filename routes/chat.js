const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getUserInfo } = require('../middleware/userInfoSQL')


router.post('/addFriendReq', verifyToken, function(req, res, next) {
  const userId = req.userId;
  const friendId = parseInt(req.body.friendId, 10);

  const checkContactSql = 'SELECT * FROM chatsummary WHERE (User1ID = ? AND User2ID = ?) OR (User1ID = ? AND User2ID = ?)';
  req.db.query(checkContactSql, [userId, friendId, friendId, userId], (checkContactErr, checkContactResults) => {
    if (checkContactErr) {
      console.error('Error checking contacts:', checkContactErr);
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    if (checkContactResults.length > 0) {
      return res.status(200).json({ state: 0, msg: '已经是联系人！' });
    }

    const checkSenderSql = 'SELECT * FROM AddRequests WHERE UserID = ? AND TargetUserID = ? AND RequestStatus = ?';
    req.db.query(checkSenderSql, [userId, friendId, 'Pending'], (checkSenderErr, checkSenderResults) => {
      if (checkSenderErr) {
        console.error('Error checking sender friend request:', checkSenderErr);
        return res.status(500).json({ message: 'Internal Server Error' });
      }

      req.db.query(checkSenderSql, [friendId, userId, 'Pending'], (checkReceiverErr, checkReceiverResults) => {
        if (checkReceiverErr) {
          console.error('Error checking receiver friend request:', checkReceiverErr);
          return res.status(500).json({ message: 'Internal Server Error' });
        }

        if (checkSenderResults.length === 0 && checkReceiverResults.length === 0) {
          // 如果有相同两个用户的请求信息，先删除
          const deleteOldRequestsSql = 'DELETE FROM AddRequests WHERE (UserID = ? AND TargetUserID = ?) OR (UserID = ? AND TargetUserID = ?)';
          req.db.query(deleteOldRequestsSql, [userId, friendId, friendId, userId], (deleteErr) => {
            if (deleteErr) {
              console.error('Error deleting old friend requests:', deleteErr);
              return res.status(500).json({ message: 'Internal Server Error' });
            }

            // 添加新的好友请求
            const insertSql = 'INSERT INTO AddRequests(UserID, TargetUserID, RequestStatus) VALUES (?, ?, ?)';
            req.db.query(insertSql, [userId, friendId, 'Pending'], (insertErr) => {
              if (insertErr) {
                console.error('Error adding friend request:', insertErr);
                res.status(500).json({ message: 'Internal Server Error' });
              } else {
                res.status(200).json({ state: 1, msg: '发送请求成功' });
              }
            });
          });
        } else {
          res.status(200).json({ state: 1, msg: '正在请求中' });
        }
      });
    });
  });
});

// 新朋友信息
router.get('/newReqInfo', verifyToken, async function(req, res, next) {
  const userId = req.userId;
  const reqInfo = [];
  let pendingCount = 0;

  const sql = 'SELECT * FROM AddRequests WHERE UserID = ? OR TargetUserID = ? ORDER BY RequestTimestamp DESC';
  try {
    const results = await new Promise((resolve, reject) => {
      req.db.query(sql, [userId, userId], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });

    for (const item of results) {
      const data = {};
      const userInfo = await new Promise((resolve, reject) => {
        getUserInfo([item.UserID, item.TargetUserID], req, (err, userInfo) => {
          if (err) {
            reject(err);
          } else {
            resolve(userInfo);
          }
        });
      });

      data.userInfo = userInfo[0];
      data.TargetUserInfo = userInfo[1];
      data.requestStatus = item.RequestStatus;
      data.requestTimestamp = item.RequestTimestamp;
      reqInfo.push(data);

      // Count pending requests where userId is TargetUserID
      if (item.RequestStatus === 'Pending' && userId === item.TargetUserID) {
        pendingCount++;
      }
    }

    res.status(200).json({ state: 1, msg: '获取请求信息成功！', data: { reqInfo, pendingCount } });
  } catch (error) {
    console.error('Error querying AddRequests or fetching user info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 处理是否通过请求
router.post('/handleFriendRequest', verifyToken, async function(req, res, next) {
  try {
    const userId = req.userId;
    const friendId = req.body.friendId;
    const state = req.body.state

    const reqSql = 'UPDATE AddRequests SET RequestStatus = ? WHERE UserID = ? AND TargetUserID = ?';
    await req.db.query(reqSql, [state, friendId, userId]);

    if (state === 'Approved') {
      const ids = [userId, friendId].sort((a, b) => a - b);
      const contentSql = 'INSERT INTO chatsummary(User1ID, User2ID, UnreadCountUser1, UnreadCountUser2) VALUES (?, ?, ?, ?)';
      await req.db.query(contentSql, [...ids, 0, 0]);
    }

    res.status(200).json({ state: 1, msg: '处理成功' });
  } catch (error) {
    console.error('Error handling friend request:', error);
    res.status(500).json({ state: 0, msg: 'Internal Server Error' });
  }
});

// 获取联系人列表
router.get('/contents', verifyToken, async function(req, res, next) {
  const userId = req.userId;
  const sql = 'SELECT * FROM chatsummary WHERE (User1ID = ? OR User2ID = ?)';
  const reqInfo = []

  try {
    const results = await new Promise((resolve, reject) => {
      req.db.query(sql, [userId, userId], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });

    for (const item of results) {
      console.log(item, 'item')
      const data = {};
      const userInfo = await new Promise((resolve, reject) => {
        getUserInfo([item.User1ID, item.User2ID], req, (err, userInfo) => {
          if (err) {
            reject(err);
          } else {
            resolve(userInfo);
          }
        });
      });

      data.user1 = userInfo[0];
      data.user2 = userInfo[1];
      reqInfo.push(data);
    }

    res.status(200).json({ state: 1, msg: '获取联系人信息成功！', data: reqInfo });
  } catch (error) {
    console.error('Error querying AddRequests or fetching user info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
