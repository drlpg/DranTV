// Upstash 连接测试脚本
const fs = require('fs');
const path = require('path');

// 手动读取 .env.local 文件
let UPSTASH_REDIS_REST_URL = process.env.UPSTASH_URL;
let UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_TOKEN;

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'UPSTASH_URL') UPSTASH_REDIS_REST_URL = value;
        if (key === 'UPSTASH_TOKEN') UPSTASH_REDIS_REST_TOKEN = value;
      }
    });
  }
} catch (error) {
  // 忽略错误，使用环境变量
}

console.log('=== Upstash 连接测试 ===\n');

// 检查环境变量
console.log('1. 检查环境变量:');
console.log(
  '   UPSTASH_REDIS_REST_URL:',
  UPSTASH_REDIS_REST_URL ? '✓ 已设置' : '✗ 未设置'
);
console.log(
  '   UPSTASH_REDIS_REST_TOKEN:',
  UPSTASH_REDIS_REST_TOKEN ? '✓ 已设置' : '✗ 未设置'
);

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.log('\n❌ 环境变量未正确配置！');
  console.log('请在 .env.local 文件中设置：');
  console.log('   UPSTASH_REDIS_REST_URL=your_url');
  console.log('   UPSTASH_REDIS_REST_TOKEN=your_token');
  process.exit(1);
}

console.log('   URL:', UPSTASH_REDIS_REST_URL.substring(0, 30) + '...');
console.log('   Token:', UPSTASH_REDIS_REST_TOKEN.substring(0, 20) + '...\n');

// 测试连接
async function testConnection() {
  console.log('2. 测试连接:');

  try {
    const startTime = Date.now();

    // 测试 PING 命令
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/ping`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      console.log(`   ✗ 连接失败 (${response.status} ${response.statusText})`);
      const text = await response.text();
      console.log('   响应:', text);
      return false;
    }

    const data = await response.json();
    console.log(`   ✓ 连接成功 (${duration}ms)`);
    console.log('   响应:', data);

    return true;
  } catch (error) {
    console.log('   ✗ 连接失败');
    console.log('   错误:', error.message);
    return false;
  }
}

// 测试读写操作
async function testReadWrite() {
  console.log('\n3. 测试读写操作:');

  try {
    const testKey = 'test_connection_' + Date.now();
    const testValue = 'Hello Upstash!';

    // 写入测试
    console.log('   测试写入...');
    const setResponse = await fetch(
      `${UPSTASH_REDIS_REST_URL}/set/${testKey}/${testValue}`,
      {
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (!setResponse.ok) {
      console.log('   ✗ 写入失败');
      return false;
    }

    console.log('   ✓ 写入成功');

    // 读取测试
    console.log('   测试读取...');
    const getResponse = await fetch(
      `${UPSTASH_REDIS_REST_URL}/get/${testKey}`,
      {
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (!getResponse.ok) {
      console.log('   ✗ 读取失败');
      return false;
    }

    const data = await getResponse.json();
    console.log('   ✓ 读取成功');
    console.log('   读取值:', data.result);

    // 删除测试数据
    await fetch(`${UPSTASH_REDIS_REST_URL}/del/${testKey}`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    return data.result === testValue;
  } catch (error) {
    console.log('   ✗ 操作失败');
    console.log('   错误:', error.message);
    return false;
  }
}

// 运行测试
(async () => {
  const connectionOk = await testConnection();

  if (connectionOk) {
    const readWriteOk = await testReadWrite();

    if (readWriteOk) {
      console.log('\n✅ Upstash 连接正常，所有测试通过！');
    } else {
      console.log('\n⚠️  连接成功但读写操作失败');
    }
  } else {
    console.log('\n❌ Upstash 连接失败！');
    console.log('\n可能的原因：');
    console.log('1. URL 或 Token 配置错误');
    console.log('2. Upstash 服务不可用');
    console.log('3. 网络连接问题');
    console.log('4. 防火墙阻止连接');
  }
})();
