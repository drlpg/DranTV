/**
 * 生产模式下的服务器入口
 * 使用 NODE_ENV=production node production.js 来启动
 */
process.env.NODE_ENV = 'production';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const http = require('http');
const { createWebSocketServer } = require('./websocket');

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

const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || 3000;

// 在生产模式下初始化 Next.js
const app = next({
  dev: false,
  hostname,
  port,
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // 检查是否是WebSocket升级请求，如果是则跳过Next.js处理
      const upgrade = req.headers.upgrade;
      if (upgrade && upgrade.toLowerCase() === 'websocket') {
        // 不处理WebSocket升级请求，让upgrade事件处理器处理
        return;
      }

      // 使用Next.js处理所有非WebSocket请求
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('处理请求时出错:', req.url, err);
      res.statusCode = 500;
      res.end('内部服务器错误');
    }
  });

  // 初始化 WebSocket 服务器
  const wss = createWebSocketServer();

  // 将 WebSocket 服务器实例存储到全局对象中，供 API 路由使用
  global.wss = wss;

  // 使用WeakSet来跟踪已处理的socket，避免重复处理
  const handledSockets = new WeakSet();

  // 处理 WebSocket 升级请求
  server.on('upgrade', (request, socket, head) => {
    // 如果socket已经被处理过，直接返回
    if (handledSockets.has(socket)) {
      return;
    }

    const pathname = parse(request.url).pathname;

    if (pathname === '/ws') {
      console.log('处理 WebSocket 升级请求:', pathname);

      // 标记socket已被处理
      handledSockets.add(socket);

      // 处理WebSocket连接
      try {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (error) {
        console.error('WebSocket升级错误:', error);
        socket.destroy();
      }
    } else {
      console.log('未知的升级请求路径:', pathname);
      // 不销毁socket，让它自然关闭
    }
  });

  // 启动服务器
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 服务已启动 (生产模式): http://${hostname}:${port}`);
    console.log(`> WebSocket 服务已启动: ws://${hostname}:${port}/ws`);

    // 设置服务器启动后的任务
    setupServerTasks();
  });

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

    // 关闭 HTTP 服务器
    server.close(() => {
      console.log('✅ HTTP 服务器已关闭');
      process.exit(0);
    });

    // 如果5秒后还没关闭，强制退出
    setTimeout(() => {
      console.log('⚠️  强制退出...');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});

// 设置服务器启动后的任务
function setupServerTasks() {
  // 每 1 秒轮询一次，直到请求成功
  const TARGET_URL = `http://${process.env.HOSTNAME || 'localhost'}:${
    process.env.PORT || 3000
  }/login`;

  const intervalId = setInterval(() => {
    console.log(`Fetching ${TARGET_URL} ...`);

    const req = http.get(TARGET_URL, (res) => {
      // 当返回 2xx 状态码时认为成功，然后停止轮询
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log('Server is up, stop polling.');
        clearInterval(intervalId);

        setTimeout(() => {
          // 服务器启动后，立即执行一次 cron 任务
          executeCronJob();
        }, 3000);

        // 然后设置每小时执行一次 cron 任务
        setInterval(() => {
          executeCronJob();
        }, 60 * 60 * 1000); // 每小时执行一次
      }
    });

    req.setTimeout(2000, () => {
      req.destroy();
    });
  }, 1000);
}

// 执行 cron 任务的函数
function executeCronJob() {
  const cronUrl = `http://${process.env.HOSTNAME || 'localhost'}:${
    process.env.PORT || 3000
  }/api/cron`;

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
