
// 获取用户信息
function getUserInfo(ids, req, callback) {
  // 将输入的用户ID转换为数组，以便处理单个ID或多个ID的情况
  const userIds = Array.isArray(ids) ? ids : [ids];
  
  // 构建 SQL 查询语句
  const getUserInfoQuery = 'SELECT * FROM usersInfo WHERE userId IN (?)';

  req.db.query(getUserInfoQuery, [userIds], (err, results) => {
    if (err) {
      console.error('Error fetching user info:', err);
      callback(err, null);
    } else {
      // 处理查询结果
      const userInfos = results.map(userInfo => {
        if (userInfo) {
          userInfo.label = userInfo.label ? userInfo.label.split(',') : [];
          userInfo.listLike = userInfo.listLike ? userInfo.listLike.split(',') : [];
          
          // 图片信息是否为空，为空传入默认图片，不为空拼接服务器头部
          if (userInfo.avatar) {
            userInfo.avatar = `${req.serverBaseUrl}/${userInfo.avatar}`;
          } else {
            userInfo.avatar = `${req.serverBaseUrl}/public/images/userImage/defaultUser.png`;
          }

          return userInfo;
        }
        return null;
      });

      callback(null, userInfos);
    }
  });
}

module.exports = {
  getUserInfo
}