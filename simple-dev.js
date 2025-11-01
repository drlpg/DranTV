/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
const wsPort = 3001;

// 启动独立WebSocket服务器
console.log('🔌 启动 WebSocket 服务器...');
const { createStandaloneWebSocketServer } = require('./standalone-websocket');
const wss = createStandaloneWebSocketServer(wsPort);

// 启动Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // 开发环境优化：设置更短的超时时间
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error('Request timeout:', req.url);
        res.statusCode = 504;
        res.end('Gateway Timeout');
      }
    }, 30000);

    // 开发环境优化：禁用缓存
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('internal server error');
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  // 开发环境优化：增加最大连接数
  server.maxConnections = 1000;
  server.keepAliveTimeout = 5000; // 5秒保持连接
  server.headersTimeout = 6000; // 6秒头部超时

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🌐 Next.js ready on http://${hostname}:${port}`);
    console.log(`🔌 WebSocket ready on ws://${hostname}:${wsPort}/ws`);
    console.log('\n✅ 开发环境已启动！按 Ctrl+C 停止服务器');
    console.log('⚡ 本地开发性能优化已启用');
  });

  // 优雅关闭
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
      process.exit(0);
    });

    // 如果5秒后还没关闭，强制退出
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});
