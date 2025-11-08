// 诊断登录问题
const fs = require('fs');
const path = require('path');

// 读取 .env.local 文件
let UPSTASH_URL = process.env.UPSTASH_URL;
let UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;
let LOGIN_USERNAME = process.env.LOGIN_USERNAME;
let LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;
let STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE;

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'UPSTASH_URL') UPSTASH_URL = value;
        if (key === 'UPSTASH_TOKEN') UPSTASH_TOKEN = value;
        if (key === 'LOGIN_USERNAME') LOGIN_USERNAME = value;
        if (key === 'LOGIN_PASSWORD') LOGIN_PASSWORD = value;
        if (key === 'NEXT_PUBLIC_STORAGE_TYPE') STORAGE_TYPE = value;
      }
    });
  }
} catch (error) {
  console.error('读取环境变量失败:', error.message);
}

console.log('=== 登录问题诊断 ===\n');

async function diagnose() {
  try {
    // 1. 检查环境变量
    console.log('📋 步骤 1: 检查环境变量');
    console.log('─────────────────────────────────');
    console.log(
      `LOGIN_USERNAME: ${
        LOGIN_USERNAME ? '✅ 已设置 (' + LOGIN_USERNAME + ')' : '❌ 未设置'
      }`
    );
    console.log(
      `LOGIN_PASSWORD: ${
        LOGIN_PASSWORD
          ? '✅ 已设置 (长度: ' + LOGIN_PASSWORD.length + ')'
          : '❌ 未设置'
      }`
    );
    console.log(
      `STORAGE_TYPE: ${STORAGE_TYPE || '未设置 (默认: localstorage)'}`
    );
    console.log(`UPSTASH_URL: ${UPSTASH_URL ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`UPSTASH_TOKEN: ${UPSTASH_TOKEN ? '✅ 已设置' : '❌ 未设置'}`);
    console.log('');

    // 2. 检查数据库配置
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      console.log('❌ Upstash 配置不完整，无法继续检查数据库\n');
      return;
    }

    console.log('📋 步骤 2: 检查数据库配置');
    console.log('─────────────────────────────────');
    const response = await fetch(`${UPSTASH_URL}/get/admin_config`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.log('❌ 获取数据库配置失败:', response.status);
      return;
    }

    const data = await response.json();
    if (!data.result) {
      console.log('❌ 数据库中没有配置数据');
      console.log('');
      console.log('🔧 解决方案: 运行 node init-remote-config.js');
      return;
    }

    const config = JSON.parse(data.result);
    console.log(
      `RequireDeviceCode: ${
        config.SiteConfig?.RequireDeviceCode ? '✅ 启用' : '❌ 禁用'
      }`
    );
    console.log(`用户数量: ${config.UserConfig?.Users?.length || 0}`);
    console.log('');

    // 3. 分析问题
    console.log('📋 步骤 3: 问题分析');
    console.log('─────────────────────────────────');

    // 问题 1: 为什么环境变量用户名密码无法登录
    console.log(
      '\n🔍 问题 1: 为什么 LOGIN_USERNAME 和 LOGIN_PASSWORD 无法登录？'
    );
    console.log('');

    if (STORAGE_TYPE === 'localstorage') {
      console.log('❌ 当前 STORAGE_TYPE = localstorage');
      console.log('   在 localstorage 模式下：');
      console.log('   - 只验证 LOGIN_PASSWORD（不需要用户名）');
      console.log('   - LOGIN_USERNAME 会被忽略');
      console.log('   - 登录页面不显示用户名输入框');
      console.log('');
      console.log('✅ 解决方案：');
      console.log('   你的 .env.local 中 STORAGE_TYPE=upstash');
      console.log('   但 Railway 上可能没有设置这个环境变量！');
      console.log('   需要在 Railway 上设置: NEXT_PUBLIC_STORAGE_TYPE=upstash');
    } else {
      console.log('✅ STORAGE_TYPE = ' + STORAGE_TYPE);
      console.log('   在数据库模式下：');
      console.log('   - 需要用户名和密码');
      console.log('   - LOGIN_USERNAME 和 LOGIN_PASSWORD 用于站长登录');
      console.log('   - 站长账号不存储在数据库中');
      console.log('');

      if (!LOGIN_USERNAME || !LOGIN_PASSWORD) {
        console.log('❌ 环境变量未正确设置！');
        console.log('   当前值:');
        console.log(`   LOGIN_USERNAME = "${LOGIN_USERNAME}"`);
        console.log(`   LOGIN_PASSWORD = "${LOGIN_PASSWORD}"`);
      } else {
        console.log('✅ 环境变量已正确设置');
        console.log(`   站长用户名: ${LOGIN_USERNAME}`);
        console.log(`   站长密码: ${LOGIN_PASSWORD}`);
        console.log('');
        console.log('⚠️  请确认 Railway 上也设置了这些环境变量：');
        console.log('   - LOGIN_USERNAME=Dran');
        console.log('   - LOGIN_PASSWORD=Tv43510004lpg');
      }
    }

    // 问题 2: 为什么远程服务器不显示用户名输入框
    console.log('\n🔍 问题 2: 为什么远程服务器不显示用户名输入框？');
    console.log('');
    console.log('登录页面的逻辑：');
    console.log('1. 调用 /api/server-config 获取配置');
    console.log('2. 检查 StorageType 字段');
    console.log('3. 如果 StorageType !== "localstorage"，显示用户名输入框');
    console.log('');

    console.log('server-config API 返回的 StorageType 来自：');
    console.log('  process.env.NEXT_PUBLIC_STORAGE_TYPE || "localstorage"');
    console.log('');

    if (STORAGE_TYPE !== 'upstash') {
      console.log('❌ 本地环境变量问题：');
      console.log(`   NEXT_PUBLIC_STORAGE_TYPE = "${STORAGE_TYPE}"`);
      console.log('   应该是 "upstash"');
    } else {
      console.log('✅ 本地环境变量正确');
      console.log('');
      console.log('❌ Railway 上的问题：');
      console.log('   Railway 上可能没有设置 NEXT_PUBLIC_STORAGE_TYPE');
      console.log('   导致默认值为 "localstorage"');
      console.log('   所以不显示用户名输入框');
    }

    // 4. 总结和解决方案
    console.log('\n');
    console.log('📊 总结和解决方案');
    console.log('═════════════════════════════════');
    console.log('');
    console.log('🎯 核心问题：Railway 上缺少关键环境变量');
    console.log('');
    console.log('✅ 需要在 Railway 上设置以下环境变量：');
    console.log('');
    console.log('1. NEXT_PUBLIC_STORAGE_TYPE=upstash');
    console.log('   → 让前端知道使用数据库模式');
    console.log('   → 显示用户名输入框');
    console.log('');
    console.log('2. LOGIN_USERNAME=Dran');
    console.log('   → 站长用户名');
    console.log('');
    console.log('3. LOGIN_PASSWORD=Tv43510004lpg');
    console.log('   → 站长密码');
    console.log('');
    console.log('4. UPSTASH_URL=' + UPSTASH_URL);
    console.log('   → 数据库连接地址');
    console.log('');
    console.log(
      '5. UPSTASH_TOKEN=' +
        (UPSTASH_TOKEN ? UPSTASH_TOKEN.substring(0, 20) + '...' : '')
    );
    console.log('   → 数据库访问令牌');
    console.log('');
    console.log('📝 操作步骤：');
    console.log('1. 登录 Railway 控制台');
    console.log('2. 进入项目设置 → Variables');
    console.log('3. 添加上述环境变量');
    console.log('4. 重新部署应用');
    console.log('5. 清除浏览器缓存');
    console.log('6. 使用 Dran / Tv43510004lpg 登录');
    console.log('');
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error(error.stack);
  }
}

diagnose();
