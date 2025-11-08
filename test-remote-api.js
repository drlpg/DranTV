// 测试远程服务器 API
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('=== 测试远程服务器 API ===\n');

rl.question(
  '请输入你的 Railway 应用 URL (例如: https://your-app.railway.app): ',
  async (url) => {
    if (!url) {
      console.log('❌ 未输入 URL');
      rl.close();
      return;
    }

    // 移除末尾的斜杠
    url = url.replace(/\/$/, '');

    console.log('\n📋 测试 /api/server-config...');
    console.log('─────────────────────────────────');

    try {
      const response = await fetch(`${url}/api/server-config`);

      if (!response.ok) {
        console.log('❌ API 请求失败:', response.status);
        rl.close();
        return;
      }

      const data = await response.json();
      console.log('✅ API 响应成功！');
      console.log('');
      console.log('📊 服务器配置：');
      console.log(JSON.stringify(data, null, 2));
      console.log('');

      // 分析结果
      console.log('🔍 分析结果：');
      console.log('─────────────────────────────────');

      if (data.StorageType === 'upstash') {
        console.log('✅ StorageType = "upstash" (正确)');
        console.log('   → 登录页面应该显示用户名输入框');
      } else {
        console.log(`❌ StorageType = "${data.StorageType}" (错误)`);
        console.log('   → 登录页面不会显示用户名输入框');
        console.log('');
        console.log('🔧 问题原因：');
        console.log('   Railway 上的 NEXT_PUBLIC_STORAGE_TYPE 环境变量未生效');
        console.log('');
        console.log('✅ 解决方案：');
        console.log(
          '   1. 确认 Railway 上已设置: NEXT_PUBLIC_STORAGE_TYPE=upstash'
        );
        console.log('   2. 在 Railway 控制台手动触发重新部署');
        console.log('   3. 等待部署完成');
        console.log('   4. 再次测试');
      }

      console.log('');
      console.log(
        `RequireDeviceCode: ${data.RequireDeviceCode ? '启用' : '禁用'}`
      );
      console.log(`SiteName: ${data.SiteName}`);
      console.log(`Version: ${data.Version}`);
      console.log('');

      if (data.StorageType === 'upstash') {
        console.log('🎯 下一步操作：');
        console.log('─────────────────────────────────');
        console.log('1. 清除浏览器缓存（重要！）');
        console.log('2. 访问登录页面');
        console.log('3. 应该看到用户名和密码输入框');
        console.log('4. 输入：');
        console.log('   用户名: Dran');
        console.log('   密码: Tv43510004lpg');
        console.log('5. 点击登录');
        console.log('');
        console.log('💡 如果仍然不显示用户名输入框：');
        console.log('   - 使用无痕模式访问');
        console.log('   - 或者完全清除浏览器缓存和 Cookie');
      }
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
    }

    rl.close();
  }
);
