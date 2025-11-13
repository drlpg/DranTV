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

// 启动Next.js服务器
console.log('Starting Next.js production server...');
const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');

const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || 3000;

// 检查是否使用 standalone 模式
// 在 Docker 环境中，standalone 文件已经在根目录
const standaloneServerPath = process.env.DOCKER_ENV
  ? path.join(__dirname, 'server.js')
  : path.join(__dirname, '.next', 'standalone', 'server.js');

const useStandalone = fs.existsSync(standaloneServerPath);

if (useStandalone) {
  console.log('Using standalone mode server...');
  console.log('Standalone server path:', standaloneServerPath);

  // Docker 环境中不需要切换目录
  if (!process.env.DOCKER_ENV) {
    process.chdir(path.join(__dirname, '.next', 'standalone'));
  }

  require(standaloneServerPath);

  // standalone 模式下，server.js 会自己启动服务器
  // 我们需要等待一下再设置任务
  setTimeout(() => {
    setupServerTasks();
  }, 3000);
} else {
  console.log('Using standard Next.js server...');
  // 使用标准的 Next.js 启动方式
  const next = require('next');

  const app = next({
    dev: false,
    hostname,
    port,
    dir: __dirname,
  });

  const handle = app.getRequestHandler();

  app
    .prepare()
    .then(() => {
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
    })
    .catch((err) => {
      console.error('Next.js启动失败:', err);
      process.exit(1);
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

// 如果直接运行此文件，设置任务
if (require.main === module) {
  // 延迟启动任务，等待服务器完全启动
  setTimeout(() => {
    setupServerTasks();
  }, 5000);
}
