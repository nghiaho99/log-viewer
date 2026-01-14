const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const config = require('./config');

// --- HÀM HỖ TRỢ DỊCH MÃ ACTION (REMARK) ---
function mapActionDescription(actionCode) {
    // Bạn có thể thêm các case khác vào đây nếu có
    switch (actionCode) {
        case 'UPDATE':
            return 'Token middleware is updated successfully.';
        case 'INSERT':
            return 'Token middleware inserted new record.'; // Ví dụ
        case 'DELETE':
            return 'Token middleware deleted record.'; // Ví dụ
        default:
            return actionCode; // Nếu không khớp thì giữ nguyên
    }
}

// --- HÀM HỖ TRỢ DỊCH USER ID ---
function mapUserDescription(userId) {
    if (userId === '0') return 'System (0)';
    if (userId === '1') return 'System (1)';
    // Nếu userId là số khác, ta tạm thời trả về nguyên gốc
    // (Vì scanner không tra DB được để lấy tên user thật)
    return userId;
}

function scanSingleFile(filePath, targetTokenCode) {
    return new Promise((resolve) => {
        const fileResults = [];
        const fileName = path.basename(filePath);
        const searchKeyword = `tokenCode=${targetTokenCode}`;

        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (err) return resolve([]); 

            try {
                let inputStream;
                if (filePath.endsWith('.gz')) {
                    inputStream = fs.createReadStream(filePath).pipe(zlib.createGunzip());
                } else {
                    inputStream = fs.createReadStream(filePath);
                }

                inputStream.on('error', () => resolve([]));

                const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

                rl.on('line', (line) => {
                    if (line.includes(searchKeyword)) {
                        // 1. Lấy Time và IP
                        const ipMatch = line.match(/IP:\[(.*?)\]/);
                        const timeMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
                        
                        // 2. Lấy Action (Raw)
                        const actionMatch = line.match(/actionCode=(.*?)(?:\s+|$)/);
                        let rawAction = actionMatch ? actionMatch[1].trim() : 'Unknown';
                        
                        // 3. Lấy User (Raw)
                        // Regex này tìm logCreatedBy=... hoặc userCode=...
                        const userMatch = line.match(/logCreatedBy=(.*?)(?:\s+|$)/) || line.match(/userCode=(.*?)(?:\s+|$)/);
                        let rawUser = userMatch ? userMatch[1].trim() : 'Unknown';

                        // --- XỬ LÝ ĐỒNG BỘ DỮ LIỆU ---
                        
                        // A. Dịch Action (UPDATE -> Text dài)
                        let displayRemark = mapActionDescription(rawAction);

                        // B. Dịch User (1 -> System (1))
                        let displayUser = mapUserDescription(rawUser);

                        fileResults.push({
                            file: fileName,
                            time: timeMatch ? timeMatch[1] : 'Unknown',
                            ip: ipMatch ? ipMatch[1] : 'No IP',
                            remark: displayRemark, // Sử dụng biến đã dịch
                            createdBy: displayUser // Sử dụng biến đã dịch
                        });
                    }
                });

                rl.on('close', () => resolve(fileResults));
                rl.on('error', () => resolve([]));
            } catch (e) {
                resolve([]);
            }
        });
    });
}

// Hàm quét toàn bộ (Giữ nguyên logic)
async function scanAllLogs(tokenCode, unusedParam, progressCallback) {
    const fsProm = require('util').promisify(fs.readdir);
    let finalResults = [];

    try {
        const files = await fsProm(config.logDir);
        // Lọc file server.log và sắp xếp
        const logFiles = files.filter(f => 
            f.startsWith('server.log') && !f.endsWith('lck')
        ).sort((a, b) => {
            if (a === 'server.log') return -1;
            if (b === 'server.log') return 1;
            return b.localeCompare(a);
        });

        let processedCount = 0;
        for (const file of logFiles) {
            processedCount++;
            if (progressCallback) progressCallback(processedCount, logFiles.length, file);
            const fullPath = path.join(config.logDir, file);
            const items = await scanSingleFile(fullPath, tokenCode);
            finalResults = finalResults.concat(items);
        }
    } catch (err) {
        console.error("Lỗi quét log:", err.message);
    }
    return finalResults;
}

module.exports = { scanAllLogs };