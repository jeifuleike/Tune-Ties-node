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

// 插入聊天记录
async function insertChatMessage(messageData) {
  const insertChatMessageQuery = 'INSERT INTO chatMessages SET ?';
  return new Promise((resolve, reject) => {
    db.query(insertChatMessageQuery, messageData, (err, results) => {
      if (err) {
        console.error('插入聊天记录时出错：', err);
        reject(err);
      } else {
        console.log('聊天记录插入成功:', results);
        resolve(results);
      }
    });
  });
}

/*获取用户聊天列表*/
async function getFriendList(userId, socket) {
  let listId = await getChatParticipants(socket.userId);
  let lastMessages = []
  
  // 获取所有用户的最后一条消息
  const msgIds = listId.map(item => item.LastChatMessageID);
  if (msgIds.length !== 0) {
    lastMessages = await getLastMessages(msgIds);
  }

  // 处理聊天列表
  const results = listId.map(item => {
    const friendId = item.User1ID === userId ? item.User2ID : item.User1ID;
    const lastMessage = lastMessages.find(value => value.MessageID === item.LastChatMessageID)

    return {
      userId: friendId,
      unreadCountUser: item.User1ID === userId ? item.UnreadCountUser2 : item.UnreadCountUser1,
      lastChatMessageID: item.LastChatMessageID,
      lastMessage: lastMessage ? lastMessage : ''
    };
  });

  // 使用数组的 sort 方法按照 SendTime 降序排序
  const sortedResults = results.sort((a, b) => (b.lastMessage.SendTime || 0) - (a.lastMessage.SendTime || 0));

  const userIds = listId.map(item => item.User1ID === userId ? item.User2ID : item.User1ID);
  const friendsInfo = await getUsersInfoByIds(userIds, socket);

  return sortedResults.map(item => {
    const userInfo = friendsInfo.find(key => key.userId === item.userId);
    return {
      userInfo,
      unreadCountUser: item.unreadCountUser,
      lastChatMessageID: item.lastChatMessageID,
      lastMessage: item.lastMessage
    };
  });
}

// 获取聊天列表
async function getChatParticipants(userId) {
  const getChatParticipantsQuery = `
    SELECT User1ID, User2ID, UnreadCountUser1, UnreadCountUser2, LastChatMessageID
    FROM chatsummary
    WHERE (User1ID = ? OR User2ID = ?);
  `;
  
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

// 获取最后一条聊天记录
async function getLastMessages(msgIds) {
  const getChatParticipantsQuery = `
    SELECT txt, MessageID, SendTime
    FROM chatmessages
    WHERE MessageID IN (?)
  `;

  return new Promise((resolve, reject) => {
    db.query(getChatParticipantsQuery, [msgIds], (err, results) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

// 修改联系人表中最后聊天记录索引
async function changeLastMessageId(userId, friendId, message) {
  const changeLastMessageQuery = `
    UPDATE chatsummary
    SET LastChatMessageID = ?
    WHERE User1ID = ? AND User2ID = ?
  `;

  let info = []
  if (userId < friendId ) {
    info = [ message, userId, Number(friendId) ]
  } else {
    info = [ message, Number(friendId), userId ]
  }

  return new Promise((resolve, reject) => {
    db.query(changeLastMessageQuery, info, (err, results) => {
      if (err) {
        console.error('修改最后聊天记录索引时出错：', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

// 根据 MessageID 获取单条消息
async function getMessageById(messageId) {
  const getMessageQuery = `
    SELECT txt, MessageID, SendTime, SenderUserID, PreviousMessageID
    FROM chatmessages
    WHERE MessageID = ?;
  `;

  return new Promise((resolve, reject) => {
    db.query(getMessageQuery, [messageId], (err, results) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
}

// 获取历史聊天记录
async function getHistoryChat(msgId, friendInfo, userInfo) {
  const historyChat = [];

  // 从最新消息开始，向后遍历链表
  let currentMessageId = msgId;

  while (currentMessageId) {
    // 获取消息详情
    const currentMessage = await getMessageById(currentMessageId);

    if (currentMessage) {
      let authorInfo
      if (currentMessage.SenderUserID === userInfo.userId) {
        authorInfo = userInfo
      } else {
        authorInfo = friendInfo
      }
      // 将消息添加到历史记录中
      historyChat.unshift({
        ... authorInfo,
        txt: currentMessage.txt,
        time: currentMessage.SendTime
      });

      // 移动到链表中的上一条消息
      currentMessageId = currentMessage.PreviousMessageID;
    } else {
      // 如果找不到消息，则中断循环
      break;
    }
  }

  return historyChat;
}

class ChatRoom {
  constructor() {
    this.rooms = new Map();
  }

  // 添加用户到房间或初始化房间
  addUser(roomID, userId, friendId) {
    const room = this.rooms.get(roomID);

    if (room) {
      // 房间已存在，添加用户到房间
      room.inRoomId.push(userId);
    } else {
      // 房间不存在，创建房间并添加用户
      this.rooms.set(roomID, {
        inRoomId: [userId],
        ids: [userId, friendId],
        lastMessageId: null
      });
    }
  }

  // 从房间内删除用户
  deleteUser(userId) {
    for (const [roomID, room] of this.rooms) {
      const userIndex = room.inRoomId.indexOf(userId);

      if (userIndex !== -1) {
        // 用户存在于房间中，删除用户
        room.inRoomId.splice(userIndex, 1);

        // 如果房间内没有用户了，删除整个房间并
        if (room.inRoomId.length === 0) {
          this.rooms.delete(roomID);
        }
        return;
      }
    }
  }

  // 获取房间内存储的最后聊天记录id
  getLastMessage(roomID) {
    return this.rooms.get(roomID)?.lastMessageId;
  }

  // 修改房间内存储的最后聊天记录id
  changeLastMessage(roomID, messageId) {
    if (this.rooms.has(roomID)) {
      this.rooms.get(roomID).lastMessageId = messageId;
    }
  }

  // 获取好友id
  getFriendId(userId) {
    for (const [, room] of this.rooms) {
      const userIndex = room.inRoomId.indexOf(userId);

      if (userIndex !== -1) {
        // 用户存在于房间中，返回好友id
        return room.ids.find(item => item !== userId);
      }
    }
  }

  // 获取用户所在的房间id
  getRoomId(userId) {
    for (const [roomID, room] of this.rooms) {
      const userIndex = room.inRoomId.indexOf(userId);

      if (userIndex !== -1) {
        // 用户存在于房间中，返回房间id
        return roomID;
      }
    }
  }
}

module.exports = function(io) {

  // 好友聊天
  const matchChatIo = io.of("/friendChats");

  const chatRoom = new ChatRoom()
  // 连接进来的用户
  const connectedUsers = new Map();
  // 房间内的聊天记录
  let historyChat = []

  matchChatIo.on("connection", async (socket) => {
    const handshake = socket.handshake;
    // 从 token 中获取用户 ID 和房间 ID
    const userId = getUserIdFromToken(handshake.query.token);
    if (!userId) {
      console.error('Invalid token');
      socket.disconnect(true);
      return;
    }
    connectedUsers.set(userId, socket);
    try {
      // 使用用户ID查询用户信息
      const user = await getUsersInfoByIds([userId], socket);
      // 将用户信息存储在socket对象中，以便稍后使用
      socket.userId = userId;
      socket.userName = user[0].userName;
      socket.avatar = user[0].avatar;
      socket.upFriendChatList = async function() {
        this.friendChatList = await getFriendList(userId, this);
      }
      await socket.upFriendChatList()
    } catch (error) {
      console.error('Error fetching user info:', error);
      socket.disconnect(true);
    }

    // 更新列表
    socket.on('getFriendChatList', () => {
      socket.emit('upFriendChatList', socket.friendChatList)
    })

    // 打开聊天窗口加入聊天房间
    socket.on('joinRoom', async (friendId) => {
      // 房间名
      let roomId = ''
      if (Number(friendId) < Number(userId)) {
        roomId = friendId + '-' + userId
      } else {
        roomId = userId + '-' + friendId
      }

      console.log(friendId, 'friendIdfriendIdfriendId')
      chatRoom.addUser(roomId, socket.userId, friendId)
      const friendsInfo = socket.friendChatList.find(item => item.userInfo.userId === Number(friendId))
      socket.join(roomId)

      if (friendsInfo) {
      // 根据数据查询到的最后聊天记录id更新房间对象内的最后聊天记录id
      chatRoom.changeLastMessage(roomId, friendsInfo.lastChatMessageID)
      // socket.emit('lastChatMessageID', lastChatMessageID)

      // 初始化聊天记录
      historyChat = await getHistoryChat(
        friendsInfo.lastChatMessageID,
        friendsInfo.userInfo, 
        {
          userId: socket.userId,
          userName: socket.userName,
          avatar: socket.avatar
        }
      )
      socket.emit('getTxt', {
        state: 1,
        data: historyChat
      })
      }
    })

    socket.on('pushTxt', async(data) => {
      const friendId = chatRoom.getFriendId(socket.userId)
      const roomID = chatRoom.getRoomId(userId)
      const lastChatMessageID = chatRoom.getLastMessage(roomID)
      // 给对象发送信息
      const nowMessageID = Date.now() + '-' + socket.userId + friendId
      historyChat.push({
        id: nowMessageID,
        userId: socket.userId,
        avatar: socket.avatar,
        userName: socket.userName,
        txt: data,
        time: Date.now()
      })
      matchChatIo.to(roomID).emit('getTxt', {
        state: 1,
        data: historyChat
      });
      // 存入数据库的数据
      const sqlData = {
        MessageID: nowMessageID,
        SenderUserID: socket.userId,
        ReceiverUserID: friendId,
        txt: data,
        SendTime: Date.now(),
        PreviousMessageID: lastChatMessageID
      }
      await insertChatMessage(sqlData)

      // 更新最后聊天记录函数和数据库数据
      chatRoom.changeLastMessage(roomID, nowMessageID)
      changeLastMessageId(socket.userId, friendId, nowMessageID)

      // 更新本人和朋友的聊天列表
      await socket.upFriendChatList()
      socket.emit('upFriendChatList', socket.friendChatList)
      if (connectedUsers.has(friendId)) {
        const friendSocket = connectedUsers.get(friendId)
        friendSocket.emit('upFriendChatList', socket.friendChatList)
        await friendSocket.upFriendChatList()
      }
    })

    socket.on('leverRoom',() => {
      chatRoom.deleteUser(socket.userId)
      historyChat = []
    })

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.userId);
      chatRoom.deleteUser(socket.userId)
    });
  })
}