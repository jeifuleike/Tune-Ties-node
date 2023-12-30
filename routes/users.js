var express = require('express');
var router = express.Router();

router.post('/register', function(req, res, next) {
  console.log(req.body.name)
  res.send({ status: 0, msg: '登录成功', data: '21212121' });
});

router.get('/userInfo', function(req, res, next) {
  console.log(req.query.name)
  res.send('give userInfo')
})

module.exports = router;
