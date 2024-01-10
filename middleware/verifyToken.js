// 处理登录token中间件
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  // 检查 req 是否存在以及是否有 headers 属性
  if (req && req.headers) {
    const token = req.headers.authorization.split(' ')[1];
    if (token) {
      // 进行解析
      jwt.verify(token, 'Tune-Ties', (err, decoded) => {
        if (err) {
          // token 验证失败
          console.error('Token verification failed:', err);
          // 处理验证失败的逻辑，例如返回未授权的响应
          res.status(401).json({ error: 'Unauthorized' });
        } else {
          console.log(decoded)
          // token 验证成功
          req.userId = decoded.userId;
          // 继续处理其他逻辑
          next();
        }
      });
    } else {
      res.status(401).json({ error: 'Unauthorized' });
      next();
    }
  } else {
    // req 或 req.headers 不存在时的处理逻辑
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = verifyToken;