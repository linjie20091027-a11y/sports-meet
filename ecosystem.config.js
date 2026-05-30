// ==========================================
// 运动会管理系统 - PM2 进程管理配置
// 使用: npm run pm2:start
// ==========================================

module.exports = {
  apps: [{
    name: 'sports-meet',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 自动重启
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000,
    // 日志
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    // 内存限制
    max_memory_restart: '500M'
  }]
};
