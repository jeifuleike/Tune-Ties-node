
const { getUserIdFromToken } = require('../middleware/socketMiddle')
const db = require('../middleware/connectSQL');
// 获取用户头像以及用户名
async function getUserInfoById(userId, socket) {
  const getUsersInfoQuery = 'SELECT userId, userName, avatar FROM usersInfo WHERE userId = ?';
  return new Promise((resolve, reject) => {
    db.query(getUsersInfoQuery, [userId], (err, results) => {
      if (err) {
        console.error('获取用户信息时出错：', err);
        reject(err);
      } else {
        if (results.length > 0) {
          const serverBaseUrl = socket.request.headers.origin
          const user = results[0];
          user.avatar = user.avatar
            ? `${serverBaseUrl}/${user.avatar}`
            : `${serverBaseUrl}/public/images/userImage/defaultUser.png`;
          resolve(user);
        } else {
          reject(new Error('未找到用户信息'));
        }
      }
    });
  });
}


module.exports = function(io) {
  // 匹配池
  const roomMap = {}
  // 连接进来的用户
  const connectedUsers = new Map();

  // 辅助函数：获取房间内的已连接用户
  function connectedUsersInRoom(roomName) {
    const room = matchChatIo.adapter.rooms.get(roomName);
    const userIds = room ? Array.from(room) : [];
    return userIds.map(id => {
      return matchChatIo.adapter.nsp.sockets.get(id)
    })
  }
  
  // 加入匹配
  function joinMatching(roomId, userId, socket) {
    let matchingRoom = roomMap[roomId];

    // 检查用户是否已经在房间内
    if (matchingRoom && matchingRoom.has(userId)) {
      console.log(`User ${userId} is already in the room`);
      return;
    }

    if (!matchingRoom) {
      matchingRoom = new Set();
      roomMap[roomId] = matchingRoom;
    }
    matchingRoom.add(userId);
    if (matchingRoom.size === 2) {
      // 如果匹配房间已满，触发匹配逻辑
      const userIdArr = Array.from(matchingRoom);

      const roomName = `chatRoom-${roomId}-${userIdArr[0]}-${userIdArr[1]}`
      
      // 将匹配到的两个用户加入同一个聊天房间
      const roomUser = userIdArr.map(id => connectedUsers.get(id))
      userIdArr.forEach(id => {
        chatInRoom(roomName, connectedUsers.get(id), roomUser)
        connectedUsers.get(id).join(roomName);
      });

      // 离开匹配房间
      leaveMatching(roomId, userIdArr);
    }
  }

  // 匹配成功后在房间内聊天逻辑
  function chatInRoom(roomName, socket, roomUser) {
    const otherUser = roomUser.find(item => item.userId !== socket.userId)
    // 分别发送对方id
    socket.emit('message',
    {
      state: 1,
      text: '匹配成功!',
      data: {
        userId: otherUser.userId,
        avatar: otherUser.avatar,
        userName: otherUser.userName
      }
    });
      // 检查用户是否已经在房间内
    if (socket.rooms.has(roomName)) {
      console.log(`User ${socket.userId} is already in the room`);
      return;
    }

    socket.join(roomName);
    socket.on('pushTxt', (data) => {
      console.log('接收到了信息')
      // 在这里处理聊天消息，比如将消息存储到数据库，然后广播给房间内的其他用户
      matchChatIo.to(roomName).emit('getTxt', {
        state: 1,
        text: '新消息',
        data: {
          id: Date.now() + '-' + socket.id + otherUser.id,
          userId: socket.userId,
          avatar: socket.avatar,
          userName: socket.userName,
          txt: data,
          time: Date.now()
        }
      });
    })

    // 当房间内只剩下一个人自动断开连接
    socket.on('disconnect', () => {
      if (connectedUsersInRoom(roomName).length === 1) {
        const otherUser = connectedUsersInRoom(roomName)[0];
        console.log(otherUser, 'otherUserotherUser')
        if (otherUser) {
          otherUser.emit('otherOut')
          console.log(`Disconnected other user ${otherUser}`);
        }
      }
      console.log(`Client ${socket.id} disconnected`);
    });
  }

  // 离开匹配
  function leaveMatching(roomId, userId) {
    const matchingRoom = roomMap[roomId];
    if (matchingRoom) {
      userId.forEach(id => {
        matchingRoom.delete(id);
        if (matchingRoom.size === 0) {
          delete roomMap[roomId];
        }
      })
    }
  }

  // 匹配在线聊天
  const matchChatIo = io.of("/matchChats");

  matchChatIo.on("connection", async (socket) => {
    const handshake = socket.handshake;
    // 从 token 中获取用户 ID 和房间 ID
    const userId = getUserIdFromToken(handshake.query.token);
    // const userId = handshake.query.token
    const roomId = handshake.query.payload;

    if (!userId) {
      console.error('Invalid token');
      socket.disconnect(true);
      return;
    }
    try {
      // 使用用户ID查询用户信息
      const user = await getUserInfoById(userId, socket);
      // 将用户信息存储在socket对象中，以便稍后使用
      socket.userId = userId;
      socket.userName = user.userName;
      socket.avatar = user.avatar;

      connectedUsers.set(userId, socket);
      joinMatching(roomId, userId, socket);

      // 断开连接时离开匹配房间
      socket.on('disconnect', () => {
        leaveMatching(roomId, [userId]);
        connectedUsers.delete(socket.userId);
        console.log(`Client ${socket.id} disconnected`);
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      socket.disconnect(true);
    }
  });
};