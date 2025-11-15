/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const { spawn } = require('child_process');

const hostname = 'localhost';
const port = 3000;
const wsPort = 3001;

// 启动独立WebSocket服务器
console.log('🔌 启动 WebSocket 服务器...');
const { createStandaloneWebSocketServer } = require('./standalone-websocket');
const wss = createStandaloneWebSocketServer(wsPort);

// 使用 spawn 启动 Next.js dev
console.log('🚀 启动 Next.js 开发服务器...');
const nextProcess = spawn(
  'npx',
  ['next', 'dev', '-H', hostname, '-p', port.toString()],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  },
);

nextProcess.on('error', (err) => {
  console.error('❌ 启动 Next.js 失败:', err);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  console.log(`Next.js 进程退出，代码: ${code}`);
  wss.close();
  process.exit(code || 0);
});

// 优雅关闭
const cleanup = () => {
  console.log('\n🛑 正在关闭服务器...');
  nextProcess.kill('SIGTERM');
  wss.close(() => {
    console.log('WebSocket 服务器已关闭');
    process.exit(0);
  });
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

console.log(`🌐 Next.js 将在 http://${hostname}:${port} 启动`);
console.log(`🔌 WebSocket ready on ws://${hostname}:${wsPort}/ws`);
console.log('\n✅ 开发环境启动中...');
console.log('⚡ 使用 webpack 模式（兼容 Tailwind 转义语法）');
