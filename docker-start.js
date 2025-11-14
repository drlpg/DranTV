/**
 * Docker 环境专用启动脚本
 * 使用 Next.js standalone 模式 + 独立 WebSocket 服务器
 */
process.env.NODE_ENV = 'production';

const path = require('path');
const http = require('http');

console.log('Starting DranTV in Docker environment...');
console.log('Current directory:', __dirname);
console.log('Node version:', process.version);

// 1. 生成 manifest.json
function generateManifest() {
  console.log('Generating manifest.json...');
  try {
    const generateManifestScript = path.join(
      __dirname,
      'scripts',
      'generate-manifest.js'
    );
    require(generateManifestScript);
    console.log('✅ Manifest generated successfully');
  } catch (error) {
    console.error('❌ Error generating manifest:', error);
    // 不要因为 manifest 失败而停止启动
  }
}

generateManifest();

// 2. 启动独立的 WebSocket 服务器
console.log('Starting WebSocket server...');
const {
  createStandaloneWebSocketServer,
  getOnlineUsers,
  sendMessageToUsers,
} = require('./standalone-websocket');
const wsPort = process.env.WS_PORT || 3001;
const wss = createStandaloneWebSocketServer(wsPort);

// 将 WebSocket 函数存储到全局对象
global.getOnlineUsers = getOnlineUsers;
global.sendMessageToUsers = sendMessageToUsers;

console.log(`✅ WebSocket server started on port ${wsPort}`);

// 3. 启动 Next.js standalone 服务器
console.log('Starting Next.js standalone server...');

// standalone 模式下，server.js 在根目录
const serverPath = path.join(__dirname, 'server.js');
console.log('Server path:', serverPath);

// 直接 require server.js，它会自动启动服务器
require(serverPath);

// 4. 设置定时任务
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.PORT || 3000;

// 等待服务器启动
setTimeout(() => {
  console.log('====================================');
  console.log(`✅ Next.js server: http://${hostname}:${port}`);
  console.log(`✅ WebSocket server: ws://${hostname}:${wsPort}`);
  console.log('====================================');

  // 执行首次 cron 任务
  setTimeout(() => {
    executeCronJob();
  }, 5000);

  // 设置每小时执行一次
  setInterval(() => {
    executeCronJob();
  }, 60 * 60 * 1000);
}, 3000);

// 执行 cron 任务
function executeCronJob() {
  const cronUrl = `http://${hostname}:${port}/api/cron`;
  console.log(`Executing cron job: ${cronUrl}`);

  const req = http.get(cronUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('✅ Cron job executed successfully');
      } else {
        console.error('❌ Cron job failed:', res.statusCode);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Cron job error:', err.message);
  });

  req.setTimeout(30000, () => {
    console.error('❌ Cron job timeout');
    req.destroy();
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
