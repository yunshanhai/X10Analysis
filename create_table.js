const mysql = require('mysql');
const sqlite = require('sqlite');
const config = require('./config');
const util = require('./util');

let db_mysql = mysql.createPool(config.mysql);

async function main() {
    const db_sqlite = await sqlite.open(config.x10.db);
    let rows = await db_sqlite.all('select * from xc_product order by product_id');

    for(let i = 0; i < rows.length; i++){
        let row = rows[i];
        let sql = `insert into tbl_alb_dimension 
            (id,name,is_cross,width,height,bleed,description,enable,index) 
            values(?,?,?,?,?,?,?,?,?)`;
        let id = i + 1,
            name = row.product_name,
            is_cross = row.compose_type == 2 ? 1 : 2,
            width = Math.round(util.px2mm(row.width, 300)) - config.my.bleed * 2,
            height = Math.round(util.px2mm(row.height, 300)) - config.my.bleed * 2,
            bleed = config.my.bleed,
            description = row.description,
            enable = 1,
            index = id;
        let params = [id,name,is_cross,width,height,bleed,description,enable,index];
        let result = await mysql_query(sql, params);
    }
}

function mysql_query(sql, params){
    return new Promise((resolve, reject)=>{
        db_mysql.query(sql, params, (err, result)=>{
        if(err){
            reject(err);
        }
        resolve(result);
        });
    });
}

main();
console.log('执行完成');