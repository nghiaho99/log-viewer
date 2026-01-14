// module.exports = {
//     db: {
//         host: 'localhost',
//         user: 'root',
//         password: 'VinaCA@123',
//         database: 'tmsv2basic'
//     },
//     logDir: '/opt/jboss/server/default/log',
//     port: 3000,
    
//     // --- CÔNG TẮC BẬT/TẮT TRA CỨU LOG DB ---
//     // true  = Có tra cứu bảng log_ms
//     // false = Tắt (chỉ quét file log server.log)
//     enableLogHistory: false 
// };

module.exports = {
    db: {
        host: '10.0.0.15',
        user: 'vinaca',
        password: 'VinaCA@123',
        database: 'tmsv2basic'
    },
    logDir: '/',
    port: 3000,
    
    // --- CÔNG TẮC BẬT/TẮT TRA CỨU LOG DB ---
    // true  = Có tra cứu bảng log_ms
    // false = Tắt (chỉ quét file log server.log)
    enableLogHistory: false 
};