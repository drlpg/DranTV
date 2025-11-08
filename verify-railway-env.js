// 验证 Railway 环境变量配置
console.log('=== 验证 Railway 环境变量 ===\n');

const railwayEnv = {
  NODE_ENV: 'production',
  LOGIN_USERNAME: 'Dran',
  LOGIN_PASSWORD: 'Tv43510004lpg',
  NEXT_PUBLIC_STORAGE_TYPE: 'upstash',
  UPSTASH_URL: 'https://cunning-sponge-18736.upstash.io',
  UPSTASH_TOKEN:
    'AUkwAAIncDI1NjcyN2E0ZDY4YTU0MTJlOTIxNTQ4OTYxMjEwN2JjNnAyMTg3MzY',
  TMDB_ENABLED: 'true',
  TMDB_API_KEY: '8bad3dd2f5fd422297dd855cab92cb41',
  TMDB_API_PROXY: 'https://api.themoviedb.org/3',
};

console.log('📋 Railway 环境变量检查：');
console.log('─────────────────────────────────');

// 检查关键变量
const checks = [
  {
    name: 'LOGIN_USERNAME',
    value: railwayEnv.LOGIN_USERNAME,
    expected: 'Dran',
    critical: true,
  },
  {
    name: 'LOGIN_PASSWORD',
    value: railwayEnv.LOGIN_PASSWORD,
    expected: 'Tv43510004lpg',
    critical: true,
  },
  {
    name: 'NEXT_PUBLIC_STORAGE_TYPE',
    value: railwayEnv.NEXT_PUBLIC_STORAGE_TYPE,
    expected: 'upstash',
    critical: true,
  },
  {
    name: 'UPSTASH_URL',
    value: railwayEnv.UPSTASH_URL,
    expected: 'https://cunning-sponge-18736.upstash.io',
    critical: true,
  },
  {
    name: 'UPSTASH_TOKEN',
    value: railwayEnv.UPSTASH_TOKEN,
    expected: 'AUkwAAIncDI1NjcyN2E0ZDY4YTU0MTJlOTIxNTQ4OTYxMjEwN2JjNnAyMTg3MzY',
    critical: true,
  },
];

let allCorrect = true;

checks.forEach((check) => {
  const isCorrect = check.value === check.expected;
  const status = isCorrect ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.value || '(未设置)'}`);

  if (!isCorrect && check.critical) {
    allCorrect = false;
    console.log(`   ⚠️  期望值: ${check.expected}`);
  }
});

console.log('');

if (allCorrect) {
  console.log('✅ 所有关键环境变量配置正确！');
  console.log('');
  console.log('🔍 如果登录仍然有问题，可能的原因：');
  console.log('');
  console.log('1️⃣ 缓存问题');
  console.log('   解决方案：');
  console.log('   - 清除浏览器所有缓存和 Cookie');
  console.log('   - 使用无痕模式访问');
  console.log('   - 硬刷新页面 (Ctrl+Shift+R 或 Cmd+Shift+R)');
  console.log('');
  console.log('2️⃣ 部署未生效');
  console.log('   解决方案：');
  console.log('   - 在 Railway 控制台手动触发重新部署');
  console.log('   - 等待部署完全完成（查看日志）');
  console.log('   - 确认新版本已上线');
  console.log('');
  console.log('3️⃣ API 响应问题');
  console.log('   解决方案：');
  console.log('   - 打开浏览器开发者工具 (F12)');
  console.log('   - 访问登录页面');
  console.log('   - 查看 Console 标签页的日志');
  console.log('   - 查看 Network 标签页，找到 /api/server-config 请求');
  console.log('   - 检查返回的 StorageType 是否为 "upstash"');
  console.log('');
  console.log('4️⃣ 数据库连接问题');
  console.log('   解决方案：');
  console.log('   - 测试数据库连接（运行下面的测试脚本）');
  console.log('');
  console.log('📝 测试步骤：');
  console.log('1. 访问登录页面');
  console.log('2. 打开浏览器控制台 (F12)');
  console.log('3. 查找以 [Login] 开头的日志');
  console.log('4. 确认输出：');
  console.log('   - [Login] 服务器配置: { storageType: "upstash", ... }');
  console.log('   - [Login] 是否显示用户名输入框: true');
  console.log('5. 如果看到用户名输入框，输入：');
  console.log('   - 用户名: Dran');
  console.log('   - 密码: Tv43510004lpg');
  console.log('6. 点击登录');
  console.log('');
} else {
  console.log('❌ 发现配置错误！');
  console.log('');
  console.log('请在 Railway 上修正上述标记为 ❌ 的环境变量');
}

console.log('');
console.log('🧪 测试数据库连接...');
console.log('─────────────────────────────────');

async function testConnection() {
  try {
    const response = await fetch(`${railwayEnv.UPSTASH_URL}/get/admin_config`, {
      headers: {
        Authorization: `Bearer ${railwayEnv.UPSTASH_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.log('❌ 数据库连接失败:', response.status);
      return;
    }

    const data = await response.json();
    if (!data.result) {
      console.log('⚠️  数据库连接成功，但没有配置数据');
      console.log('   需要运行: node init-remote-config.js');
      return;
    }

    const config = JSON.parse(data.result);
    console.log('✅ 数据库连接成功！');
    console.log(`   - 视频源: ${config.SourceConfig?.length || 0} 个`);
    console.log(`   - 直播源: ${config.LiveConfig?.length || 0} 个`);
    console.log(`   - 用户数: ${config.UserConfig?.Users?.length || 0} 个`);
    console.log(
      `   - 设备码验证: ${
        config.SiteConfig?.RequireDeviceCode ? '启用' : '禁用'
      }`
    );
    console.log('');

    console.log('🎯 预期登录行为：');
    console.log('─────────────────────────────────');
    console.log('1. 登录页面应该显示：');
    console.log('   ✅ 用户名输入框');
    console.log('   ✅ 密码输入框');
    console.log('   ❌ 不显示设备码（因为 RequireDeviceCode = false）');
    console.log('');
    console.log('2. 使用以下凭据登录：');
    console.log('   用户名: Dran');
    console.log('   密码: Tv43510004lpg');
    console.log('');
    console.log('3. 登录成功后应该：');
    console.log('   ✅ 跳转到首页');
    console.log('   ✅ 可以访问管理后台');
    console.log('   ✅ 显示为站长权限');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testConnection();
