// nodemon bin/www 启动项目
// 加载处理错误的中间件
const createError = require('http-errors');
const express = require('express');
const path = require('path');
// 处理cookie中间件
const cookieParser = require('cookie-parser');
// 处理访问日志中间件
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
const base_url = '/express/api'

// 使用处理日志中间件
app.use(logger('dev'));
//处理cookie
app.use(cookieParser());
//静态资源托管中间件   连接两个路径
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 使用路由
app.use(base_url + '/', indexRouter);
app.use(base_url + '/user', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
});

module.exports = app;
