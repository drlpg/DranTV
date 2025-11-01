/**
 * 最终的生产环境启动文件
 * 分离Next.js和WebSocket服务器，避免任何冲突
 */
process.env.NODE_ENV = 'production';

const path = require('path');
const http = require('http');

// 调用 generate-manifest.js 生成 manifest.json
function generateManifest() {
  console.log('Generating manifest.json for Docker deployment...');

  try {
    const generateManifestScript = path.join(
      __dirname,
      'scripts',
      'generate-manifest.js'
    );
    require(generateManifestScript);
  } catch (error) {
    console.error('❌ Error calling generate-manifest.js:', error);
    throw error;
  }
}

// 生成manifest
generateManifest();

// 启动独立的WebSocket服务器
const {
  createStandaloneWebSocketServer,
  getOnlineUsers,
  sendMessageToUsers,
} = require('./standalone-websocket');
const wsPort = process.env.WS_PORT || 3001;
const wss = createStandaloneWebSocketServer(wsPort);

// 将WebSocket函数存储到全局对象，供API路由使用
global.getOnlineUsers = getOnlineUsers;
global.sendMessageToUsers = sendMessageToUsers;

// 启动Next.js standalone服务器
console.log('Starting Next.js production server...');
const nextServerPath = path.join(__dirname, 'server.js');

// 检查是否存在standalone server.js（Docker构建生成）
const fs = require('fs');
if (fs.existsSync(nextServerPath)) {
  // Docker环境，使用standalone server
  console.log('Using standalone server from Docker build');
  require(nextServerPath);
  // 延迟启动任务，等待服务器完全启动
  setTimeout(() => {
    setupServerTasks();
  }, 5000);
} else {
  // 非Docker环境，使用标准Next.js启动
  console.log('Using standard Next.js server');
  const { createServer } = require('http');
  const { parse } = require('url');
  const next = require('next');

  const hostname = process.env.HOSTNAME || '0.0.0.0';
  const port = process.env.PORT || 3000;

  const app = next({
    dev: false,
    hostname,
    port,
  });

  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('处理请求时出错:', req.url, err);
        res.statusCode = 500;
        res.end('内部服务器错误');
      }
    });

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Next.js服务已启动: http://${hostname}:${port}`);
      setupServerTasks();
    });
  });
}

// 设置服务器启动后的任务
function setupServerTasks() {
  const httpPort = process.env.PORT || 3000;
  const hostname = process.env.HOSTNAME || 'localhost';

  // 每1秒轮询一次，直到请求成功
  const TARGET_URL = `http://${hostname}:${httpPort}/login`;

  const intervalId = setInterval(() => {
    console.log(`Fetching ${TARGET_URL} ...`);

    const req = http.get(TARGET_URL, (res) => {
      // 当返回2xx状态码时认为成功，然后停止轮询
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log('Server is up, stop polling.');
        clearInterval(intervalId);

        setTimeout(() => {
          // 服务器启动后，立即执行一次cron任务
          executeCronJob();
        }, 3000);

        // 然后设置每小时执行一次cron任务
        setInterval(() => {
          executeCronJob();
        }, 60 * 60 * 1000); // 每小时执行一次

        // 显示服务状态
        console.log('====================================');
        console.log(`✅ Next.js服务运行在: http://${hostname}:${httpPort}`);
        console.log(`✅ WebSocket服务运行在: ws://${hostname}:${wsPort}`);
        console.log('====================================');
      }
    });

    req.setTimeout(2000, () => {
      req.destroy();
    });

    req.on('error', () => {
      // 忽略连接错误，继续轮询
    });
  }, 1000);
}

// 执行cron任务的函数
function executeCronJob() {
  const httpPort = process.env.PORT || 3000;
  const hostname = process.env.HOSTNAME || 'localhost';
  const cronUrl = `http://${hostname}:${httpPort}/api/cron`;

  console.log(`Executing cron job: ${cronUrl}`);

  const req = http.get(cronUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log('Cron job executed successfully:', data);
      } else {
        console.error('Cron job failed:', res.statusCode, data);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Error executing cron job:', err);
  });

  req.setTimeout(30000, () => {
    console.error('Cron job timeout');
    req.destroy();
  });
}

// 优雅关闭处理
const cleanup = () => {
  console.log('\n🛑 正在关闭服务器...');

  // 关闭 WebSocket 服务器
  if (wss) {
    console.log('🔌 关闭 WebSocket 服务器...');
    wss.close(() => {
      console.log('✅ WebSocket 服务器已关闭');
    });
  }

  console.log('✅ 服务器关闭完成');

  // 如果5秒后还没关闭，强制退出
  setTimeout(() => {
    console.log('⚠️  强制退出...');
    process.exit(0);
  }, 5000);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
