/* eslint-disable @typescript-eslint/no-var-requires, no-console */
/**
 * 通用启动文件 - 支持多种部署模式
 */

process.env.NODE_ENV = 'production';

const path = require('path');
const http = require('http');
const { parse } = require('url');
const WebSocket = require('ws');
const fs = require('fs');

const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'shared';
const HTTP_PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log('🚀 Starting server in', DEPLOYMENT_MODE.toUpperCase(), 'mode');

// 生成 manifest
try {
  require(path.join(__dirname, 'scripts', 'generate-manifest.js'));
} catch (error) {
  console.error('❌ Error generating manifest:', error);
}

// WebSocket 用户管理
const connectedUsers = new Map();

function handleWebSocketMessage(ws, message, userId) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'user_connect': {
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
    }

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

    case 'friend_request': {
      const targetUser = message.data.to_user;
      if (targetUser && connectedUsers.has(targetUser)) {
        const targetWs = connectedUsers.get(targetUser);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify(message));
        }
      }
      break;
    }

    case 'friend_accepted': {
      const fromUser = message.data.from_user;
      if (fromUser && connectedUsers.has(fromUser)) {
        const fromUserWs = connectedUsers.get(fromUser);
        if (fromUserWs && fromUserWs.readyState === WebSocket.OPEN) {
          fromUserWs.send(JSON.stringify(message));
        }
      }
      break;
    }

    default:
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

function createWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    perMessageDeflate: false,
    clientTracking: true,
  });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
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
        console.log(`👋 User ${userId} disconnected`);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error:`, error.message);
    });
  });

  setInterval(() => {
    let activeConnections = 0;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try {
        ws.ping();
        activeConnections++;
      } catch (error) {
        // Ignore ping errors
      }
    });
    if (activeConnections > 0) {
      console.log(`💓 Active connections: ${activeConnections}`);
    }
  }, 30000);

  return wss;
}

// 全局函数
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

// 检查 standalone 模式
const standaloneServerPath = path.join(__dirname, '.next/standalone/server.js');

if (fs.existsSync(standaloneServerPath)) {
  console.log('🔧 Using Next.js standalone mode');

  // Standalone 模式不能直接 require server.js
  // 需要使用标准 Next.js 启动
  const next = require('next');
  const app = next({
    dev: false,
    dir: path.join(__dirname, '.next/standalone'),
  });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('❌ Error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    createWebSocketServer(server);

    server.listen(HTTP_PORT, HOSTNAME, () => {
      console.log('====================================');
      console.log(`✅ Server: http://${HOSTNAME}:${HTTP_PORT}`);
      console.log(`✅ WebSocket: ws://${HOSTNAME}:${HTTP_PORT}`);
      console.log('====================================');
    });
  });
} else {
  console.log('🔧 Using standard Next.js mode');

  const next = require('next');
  const app = next({ dev: false });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    if (DEPLOYMENT_MODE === 'separate') {
      // 分离端口模式
      const wsServer = http.createServer();
      createWebSocketServer(wsServer);
      wsServer.listen(WS_PORT, HOSTNAME, () => {
        console.log(`✅ WebSocket: ws://${HOSTNAME}:${WS_PORT}`);
      });

      const httpServer = http.createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('❌ Error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });

      httpServer.listen(HTTP_PORT, HOSTNAME, () => {
        console.log(`✅ HTTP: http://${HOSTNAME}:${HTTP_PORT}`);
      });
    } else {
      // 共享端口模式（默认）
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('❌ Error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });

      createWebSocketServer(server);

      server.listen(HTTP_PORT, HOSTNAME, () => {
        console.log('====================================');
        console.log(`✅ Server: http://${HOSTNAME}:${HTTP_PORT}`);
        console.log(`✅ WebSocket: ws://${HOSTNAME}:${HTTP_PORT}`);
      });
    }
  });
}
