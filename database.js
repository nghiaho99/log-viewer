const mysql = require('mysql');
const config = require('./config');

const pool = mysql.createPool(config.db);

const query = (sql, args) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, args, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

function parseCertDN(dnString) {
    let mst = "Không có MST";
    let company = "Không có tên";
    if (!dnString) return { mst, company };
    const mstMatch = dnString.match(/MST:(\d+)/) || dnString.match(/UID=(\d+)/);
    if (mstMatch) mst = mstMatch[1];
    const cnMatch = dnString.match(/CN=([^,]+)/);
    if (cnMatch) company = cnMatch[1];
    return { mst, company };
}

// --- HÀM 1: Lấy thông tin Token ---
async function findTokenInfo(tokenHid) {
    const sql = `
        SELECT t.token_code, c.cert_sub_dn, c.cert_sn 
        FROM token_ms t 
        LEFT JOIN cert_ms c ON t.token_code = c.cert_token_code 
        WHERE t.token_hid = ?
        ORDER BY c.cert_sn DESC 
    `;

    try {
        const rows = await query(sql, [tokenHid]);
        if (rows.length === 0) return null;

        const primaryTokenCode = rows[0].token_code;
        const certList = rows.map(row => {
            const info = parseCertDN(row.cert_sub_dn);
            return {
                sn: row.cert_sn || "N/A",
                mst: info.mst,
                company: info.company
            };
        });

        return {
            code: primaryTokenCode,
            mainMst: certList[0].mst,
            mainCompany: certList[0].company,
            allCerts: certList 
        };
    } catch (err) { throw err; }
}

// --- HÀM 2: Lấy lịch sử từ log_ms (ĐÃ SỬA LOGIC JOIN USER) ---
async function getLogMsHistory(tokenCode) {
    // JOIN bảng user_ms để lấy username
    const sql = `
        SELECT 
            l.log_created_date, 
            l.log_remark, 
            l.log_created_by,
            u.user_username
        FROM log_ms l
        LEFT JOIN user_ms u ON l.log_created_by = u.user_code
        WHERE l.log_token_code = ? 
        ORDER BY l.log_created_date DESC
    `;
    
    try {
        const rows = await query(sql, [tokenCode]);
        
        return rows.map(row => {
            const dateStr = row.log_created_date.toISOString().replace('T', ' ').substring(0, 19);
            
            // Logic xử lý người tạo:
            // Nếu join được username thì lấy username
            // Nếu không (ví dụ giá trị 0, 1) thì lấy giá trị gốc
            let createdByDisplay = row.user_username;
            if (!createdByDisplay) {
                if (row.log_created_by == '0') createdByDisplay = 'System (0)';
                else if (row.log_created_by == '1') createdByDisplay = 'System (1)';
                else createdByDisplay = row.log_created_by; // Các giá trị lạ khác
            }

            return {
                time: dateStr,
                ip: "No IP",
                file: "Bảng log_ms",
                
                // Hai trường mới bạn yêu cầu:
                remark: row.log_remark || "",
                createdBy: createdByDisplay,
                
                isDb: true
            };
        });
    } catch (err) {
        console.error("Lỗi query log_ms:", err.message);
        return []; 
    }
}

module.exports = { findTokenInfo, getLogMsHistory };