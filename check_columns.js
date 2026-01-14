const mysql = require('mysql');
const config = require('./config');

const con = mysql.createConnection(config.db);

con.connect(async (err) => {
    if (err) throw err;
    console.log("Đã kết nối DB!");

    const showColumns = (table) => {
        return new Promise((resolve) => {
            con.query(`SHOW COLUMNS FROM ${table}`, (err, result) => {
                if (err) {
                    console.log(`\n[LỖI] Bảng '${table}' không tồn tại hoặc sai tên.`);
                    resolve([]);
                } else {
                    console.log(`\n--- CÁC CỘT TRONG BẢNG '${table}' ---`);
                    const columns = result.map(r => r.Field);
                    console.log(columns.join(', '));
                    resolve(columns);
                }
            });
        });
    };

    await showColumns('token_ms');
    await showColumns('cert_ms');

    console.log("\n=> Hãy tìm xem 2 bảng trên có cột nào CHUNG tên (ví dụ token_id, token_sn, v.v...)");
    con.end();
});
