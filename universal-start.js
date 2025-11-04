/**
 * 通用启动文件 - 支持多种部署模式
 *
 * 部署模式：
 * 1. SHARED_PORT (默认): WebSocket 和 HTTP 共享同一端口 - 适用于 Railway, Vercel, Render 等
 * 2. SEPARATE_PORTS: WebSocket 和 HTTP 使用不同端口 - 适用于 VPS, Docker 等
 *
 * 环境变量：
 * - DEPLOYMENT_MODE: 'shared' | 'separate' (默认: 'shared')
 * - PORT: HTTP 服务端口 (默认: 3000)
 * - WS_PORT: WebSocket 端口 (仅在 separate 模式下使用，默认: 3001)
 * - NEXT_PUBLIC_WS_URL: 客户端 WebSocket URL (可选，用于自定义配置)
 */

process.env.NODE_ENV = 'production';

const path = require('path');
const http = require('http');
const { parse } = require('url');
const WebSocket = require('ws');

// 读取部署模式
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'shared';
const HTTP_PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log('🚀 Starting server in', DEPLOYMENT_MODE.toUpperCase(), 'mode');
console.log('📋 Configuration:', {
  mode: DEPLOYMENT_MODE,
  httpPort: HTTP_PORT,
  wsPort: WS_PORT,
  hostname: HOSTNAME,
});

// 生成 manifest
function generateManifest() {
  console.log('📝 Generating manifest.json...');
  try {
    const generateManifestScript = path.join(
      __dirname,
      'scripts',
      'generate-manifest.js'
    );
    require(generateManifestScript);
  } catch (error) {
    console.error('❌ Error generating manifest:', error);
  }
}

generateManifest();

// WebSocket 用户管理
const connectedUsers = new Map();

// WebSocket 消息处理
function handleWebSocketMessage(ws, message, userId) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'user_connect':
      const newUserId = message.data.userId;
      connectedUsers.set(newUserId, ws);
      console.log(
        `✅ User ${newUserId} connected (total: ${connectedUsers.size})`
      );

      ws.send(
        JSON.stringify({
          type: 'connection_confirmed',
          data: { userId: newUserId },
          timestamp: Date.now(),
        })
      );

      broadcastUserStatus(newUserId, 'online');

      ws.send(
        JSON.stringify({
          type: 'online_users',
          data: { users: Array.from(connectedUsers.keys()) },
          timestamp: Date.now(),
        })
      );
      return newUserId;

    case 'message':
      if (
        message.data.participants &&
        Array.isArray(message.data.participants)
      ) {
        message.data.participants.forEach((participantId) => {
          if (participantId !== userId && connectedUsers.has(participantId)) {
            const participantWs = connectedUsers.get(participantId);
            if (participantWs && participantWs.readyState === WebSocket.OPEN) {
              participantWs.send(JSON.stringify(message));
            }
          }
        });
      } else if (
        message.data.receiverId &&
        connectedUsers.has(message.data.receiverId)
      ) {
        const receiverWs = connectedUsers.get(message.data.receiverId);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
          receiverWs.send(JSON.stringify(message));
        }
      }
      break;

    case 'typing':
      if (
        message.data.receiverId &&
        connectedUsers.has(message.data.receiverId)
      ) {
        const receiverWs = connectedUsers.get(message.data.receiverId);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
          receiverWs.send(JSON.stringify(message));
        }
      }
      break;

    case 'friend_request':
      const targetUser = message.data.to_user;
      if (targetUser && connectedUsers.has(targetUser)) {
        const targetWs = connectedUsers.get(targetUser);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify(message));
        }
      }
      break;

    case 'friend_accepted':
      const fromUser = message.data.from_user;
      if (fromUser && connectedUsers.has(fromUser)) {
        const fromUserWs = connectedUsers.get(fromUser);
        if (fromUserWs && fromUserWs.readyState === WebSocket.OPEN) {
          fromUserWs.send(JSON.stringify(message));
        }
      }
      break;
  }
  return userId;
}

function broadcastUserStatus(userId, status) {
  const statusMessage = {
    type: 'user_status',
    data: { userId, status },
    timestamp: Date.now(),
  };
  connectedUsers.forEach((ws, connectedUserId) => {
    if (connectedUserId !== userId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(statusMessage));
    }
  });
}

// 创建 WebSocket 服务器
function createWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    perMessageDeflate: false,
    clientTracking: true,
  });

  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection from', req.socket.remoteAddress);
    let userId = null;

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        userId = handleWebSocketMessage(ws, message, userId);
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        connectedUsers.delete(userId);
        broadcastUserStatus(userId, 'offline');
        console.log(
          `👋 User ${userId} disconnected (total: ${connectedUsers.size})`
        );
      }
    });

    ws.on('error', (error) => {
      console.error(
        `❌ WebSocket error ${userId ? `(user: ${userId})` : ''}:`,
        error.message
      );
    });
  });

  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    let activeConnections = 0;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
        activeConnections++;
      } catch (error) {
        console.error('❌ Ping failed:', error.message);
      }
    });
    if (activeConnections > 0) {
      console.log(`💓 Active WebSocket connections: ${activeConnections}`);
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

// 全局 WebSocket 函数
global.getOnlineUsers = () => Array.from(connectedUsers.keys());
global.sendMessageToUsers = (userIds, message) => {
  let success = false;
  userIds.forEach((userId) => {
    const ws = connectedUsers.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      success = true;
    }
  });
  return success;
};

// 启动 Next.js
const next = require('next');
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  if (DEPLOYMENT_MODE === 'separate') {
    // 模式 1: 分离端口 - WebSocket 和 HTTP 使用不同端口
    console.log('🔧 Using SEPARATE PORTS mode');

    // 启动独立的 WebSocket 服务器
    const wsServer = http.createServer();
    createWebSocketServer(wsServer);
    wsServer.listen(WS_PORT, HOSTNAME, () => {
      console.log(`✅ WebSocket server running on ws://${HOSTNAME}:${WS_PORT}`);
    });

    // 启动 HTTP 服务器
    const httpServer = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('❌ Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    httpServer.listen(HTTP_PORT, HOSTNAME, () => {
      console.log('====================================');
      console.log(`✅ HTTP server running on http://${HOSTNAME}:${HTTP_PORT}`);
      console.log(`✅ WebSocket server running on ws://${HOSTNAME}:${WS_PORT}`);
      console.log('📝 Client should connect to: ws://${HOSTNAME}:${WS_PORT}');
      console.log('💡 Set NEXT_PUBLIC_WS_URL=ws://your-domain:${WS_PORT}');
      console.log('====================================');
    });
  } else {
    // 模式 2: 共享端口 - WebSocket 和 HTTP 使用同一端口 (默认)
    console.log('🔧 Using SHARED PORT mode');

    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('❌ Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    // 在同一服务器上创建 WebSocket
    createWebSocketServer(server);

    server.listen(HTTP_PORT, HOSTNAME, () => {
      console.log('====================================');
      console.log(`✅ Server running on http://${HOSTNAME}:${HTTP_PORT}`);
      console.log(`✅ WebSocket ready on ws://${HOSTNAME}:${HTTP_PORT}`);
      console.log('📝 Client will auto-connect to: ws://your-domain');
      console.log('💡 No NEXT_PUBLIC_WS_URL needed');
      console.log('====================================');
    });
  }
});
