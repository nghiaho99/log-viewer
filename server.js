const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const db = require('./database');
const scanner = require('./scanner');

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Route Trang chủ
app.get('/', (req, res) => res.render('index'));

// Route Tìm kiếm
app.post('/search', async (req, res) => {
    const inputTokenHid = req.body.tokenId.trim();
    
    // --- [QUAN TRỌNG] Khai báo biến ở đây để toàn bộ hàm đều nhìn thấy ---
    let finalResults = []; 
    let errorMsg = null;
    let foundInfo = null;

    console.log(`\n[START] Tìm kiếm HID: ${inputTokenHid}`);

    if (!inputTokenHid) {
        return res.render('index', { error: 'Vui lòng nhập Token HID', results: [] });
    }

    try {
        // 1. Tìm thông tin trong DB
        foundInfo = await db.findTokenInfo(inputTokenHid);

        if (!foundInfo) {
            console.log('[DB-FAIL] Không tìm thấy trong DB');
            errorMsg = `Token HID: ${inputTokenHid} không tồn tại trong hệ thống.`;
        } else {
            console.log(`[DB-OK] Code: ${foundInfo.code} | Tìm thấy ${foundInfo.allCerts.length} Serial Number.`);

            // 2. Chuẩn bị dữ liệu quét
            const infoForScanner = {
                mst: foundInfo.mainMst,
                company: foundInfo.mainCompany
            };

            // A. Quét File Log
            const scanPromise = scanner.scanAllLogs(foundInfo.code, infoForScanner, (current, total, file) => {
                // Hiển thị tiến trình
                if (current === 1 || current % 50 === 0) {
                    process.stdout.write(`\r[PROGRESS] Đang quét ${current}/${total}: ${file} ...`);
                }
            });

            // B. Truy vấn lịch sử bảng log_ms (CÓ KIỂM TRA CẤU HÌNH)
            let dbLogPromise;

            if (config.enableLogHistory) {
                // TRƯỜNG HỢP BẬT: Gọi DB như bình thường
                console.log('[CONFIG] Tra cứu DB History: ON');
                dbLogPromise = db.getLogMsHistory(foundInfo.code).then(rows => {
                    // Gán thêm thông tin MST/Cty vào kết quả từ DB log
                    return rows.map(item => ({
                        ...item,
                        token: foundInfo.code,
                        mst: foundInfo.mainMst,
                        company: foundInfo.mainCompany
                    }));
                });
            } else {
                // TRƯỜNG HỢP TẮT: Trả về mảng rỗng ngay lập tức
                console.log('[CONFIG] Tra cứu DB History: OFF (Đã bỏ qua)');
                dbLogPromise = Promise.resolve([]); 
            }

            // C. Chờ cả 2 xong và gộp lại
            // Nếu tắt config thì dbLogPromise sẽ trả về mảng rỗng [] rất nhanh
            const [fileLogs, dbLogs] = await Promise.all([scanPromise, dbLogPromise]);
            process.stdout.write('\n'); // Xuống dòng sau khi quét xong

            console.log(`-> Kết quả File: ${fileLogs.length} dòng.`);
            console.log(`-> Kết quả DB (log_ms): ${dbLogs.length} dòng.`);

            // Gộp và Sắp xếp: Mới nhất lên đầu
            finalResults = [...fileLogs, ...dbLogs].sort((a, b) => {
                return new Date(b.time) - new Date(a.time);
            });
        }

    } catch (err) {
        console.error(err);
        errorMsg = `Lỗi hệ thống: ${err.sqlMessage || err.message}`;
    }

    console.log(`[FINISH] Tổng kết quả hiển thị: ${finalResults.length} dòng.`);

    // Render ra view
    res.render('index', { 
        results: finalResults, 
        error: errorMsg,
        searchToken: inputTokenHid,
        foundInfo: foundInfo
    });
});

app.listen(config.port, () => {
    console.log(`Web App chạy tại: http://localhost:${config.port}`);
});