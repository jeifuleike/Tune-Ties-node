const { getUserIdFromToken } = require('../middleware/socketMiddle')
const db = require('../middleware/connectSQL');
// 获取用户头像以及用户名
async function getUsersInfoByIds(userIds, socket) {
    // If the userIds array is empty, return an empty array
    if (!userIds || userIds.length === 0) return [];
    const getUsersInfoQuery = 'SELECT userId, userName, avatar FROM usersInfo WHERE userId IN (?)';
    return new Promise((resolve, reject) => {
      db.query(getUsersInfoQuery, [userIds], (err, results) => {
        if (err) {
          console.error('获取用户信息时出错：', err);
          reject(err);
        } else {
          const serverBaseUrl = socket.request.headers.origin;
  
          const users = results.map(user => {
            user.avatar = user.avatar
              ? `${serverBaseUrl}/${user.avatar}`
              : `${serverBaseUrl}/public/images/userImage/defaultUser.png`;
            return user;
          });
  
          resolve(users);
        }
      });
    });
  }

// 获取聊天列表
async function getChatParticipants(userId) {
  const getChatParticipantsQuery = `
    SELECT User1ID, User2ID, UnreadCountUser1, UnreadCountUser2, LastChatMessageID
    FROM chatsummary
    WHERE (User1ID = ? OR User2ID = ?);
  `;
//  AND LastChatMessageID IS NOT NULL
  return new Promise((resolve, reject) => {
    db.query(getChatParticipantsQuery, [userId, userId], (err, results) => {
      if (err) {
        console.error('获取聊天参与者信息时出错：', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}
module.exports = function(io) {
  // 匹配在线聊天
  const matchChatIo = io.of("/friendChats");

  /*获取用户聊天列表*/
  async function getFriendList(userId, socket) {
    let listId = await getChatParticipants(socket.userId)
    listId = listId.map(item => {
      if (item.User1ID === userId) {
        return {
          userId: item.User2ID,
          unreadCountUser: item.UnreadCountUser2,
          lastChatMessageID: item.LastChatMessageID
        }
      } else {
        return {
          userId: item.User1ID,
          unreadCountUser: item.UnreadCountUser1,
          lastChatMessageID: item.LastChatMessageID
        }
      }
    })
    const friendsInfo = await getUsersInfoByIds(listId.map(item => item.userId), socket)
    return listId.map(item => {
      const userInfo = friendsInfo.find(key => key.userId === item.userId)
      return {
        userInfo,
        unreadCountUser: item.unreadCountUser,
        lastChatMessageID: item.lastChatMessageID
      }
    })
  }

  matchChatIo.on("connection", async (socket) => {
    const handshake = socket.handshake;
    // 从 token 中获取用户 ID 和房间 ID
    const userId = getUserIdFromToken(handshake.query.token);
    if (!userId) {
      console.error('Invalid token');
      socket.disconnect(true);
      return;
    }
    try {
      // 使用用户ID查询用户信息
      const user = await getUsersInfoByIds([userId], socket);
      // 将用户信息存储在socket对象中，以便稍后使用
      socket.userId = userId;
      socket.userName = user.userName;
      socket.avatar = user.avatar;
  
    } catch (error) {
      console.error('Error fetching user info:', error);
      socket.disconnect(true);
    }
    const friendChatList = await getFriendList(userId, socket)
    // console.log(friendChatList, 'friendChatList')

    // 打开聊天窗口加入聊天房间
    socket.on('joinRoom', (id) => {
      console.log(id)
    })
  })
}