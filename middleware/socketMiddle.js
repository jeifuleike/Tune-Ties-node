const jwt = require('jsonwebtoken');
// 解码token id
function getUserIdFromToken(token) {
  try {
    const decoded = jwt.verify(token, 'Tune-Ties');
    return decoded.userId;
  } catch (error) {
    // token 验证失败
    console.error('Token verification failed:', error);
    return null;
  }
}

module.exports = {
  getUserIdFromToken,
};