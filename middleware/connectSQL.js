const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost', 
  user: 'root',
  password: '123',
  database: 'tune_ties_sql',
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to the database');
  }
});

module.exports = db;
