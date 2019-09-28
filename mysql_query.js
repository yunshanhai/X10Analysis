const mysql = require('mysql');
const config = require('./config');

let db_mysql = mysql.createPool(config.mysql);
module.exports = function mysql_query(sql, params){
    return new Promise((resolve, reject)=>{
        db_mysql.query(sql, params, (err, result)=>{
        if(err){
            reject(err);
        }
        resolve(result);
        });
    });
}