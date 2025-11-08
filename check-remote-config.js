// 检查远程 Upstash 数据库配置
const fs = require('fs');
const path = require('path');

// 读取 .env.local 文件
let UPSTASH_URL = process.env.UPSTASH_URL;
let UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;

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
      }
    });
  }
} catch (error) {
  console.error('读取环境变量失败:', error.message);
}

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.log('❌ 环境变量未配置');
  process.exit(1);
}

console.log('=== 检查远程 Upstash 数据库配置 ===\n');

async function checkConfig() {
  try {
    // 获取 admin_config
    console.log('📋 获取 admin_config...\n');
    const response = await fetch(`${UPSTASH_URL}/get/admin_config`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.log('❌ 获取配置失败:', response.status);
      const text = await response.text();
      console.log('响应:', text);
      return;
    }

    const data = await response.json();
    if (!data.result) {
      console.log('❌ 数据库中没有配置数据');
      return;
    }

    const config = JSON.parse(data.result);

    // 显示站点配置
    console.log('🌐 站点配置 (SiteConfig):');
    console.log('─────────────────────────────────');
    console.log(`站点名称: ${config.SiteConfig?.SiteName || '未设置'}`);
    console.log(
      `设备码验证: ${
        config.SiteConfig?.RequireDeviceCode ? '✅ 启用' : '❌ 禁用'
      }`
    );
    console.log(
      `流式搜索: ${config.SiteConfig?.FluidSearch ? '✅ 启用' : '❌ 禁用'}`
    );
    console.log(
      `禁用黄色过滤: ${
        config.SiteConfig?.DisableYellowFilter ? '✅ 是' : '❌ 否'
      }`
    );
    console.log('');

    // 显示用户配置
    console.log('👥 用户配置 (UserConfig):');
    console.log('─────────────────────────────────');
    const users = config.UserConfig?.Users || [];
    if (users.length === 0) {
      console.log('⚠️  没有配置用户');
    } else {
      console.log(`用户数量: ${users.length}`);
      users.forEach((user, index) => {
        console.log(`\n用户 ${index + 1}:`);
        console.log(`  用户名: ${user.username || '未设置'}`);
        console.log(`  密码: ${user.password ? '已设置 (****)' : '未设置'}`);
        console.log(`  角色: ${user.role || '未设置'}`);
        console.log(`  启用: ${user.enabled !== false ? '✅ 是' : '❌ 否'}`);
      });
    }
    console.log('');

    // 显示视频源配置
    console.log('🎬 视频源配置 (SourceConfig):');
    console.log('─────────────────────────────────');
    console.log(`视频源数量: ${config.SourceConfig?.length || 0}`);
    console.log('');

    // 显示直播源配置
    console.log('📺 直播源配置 (LiveConfig):');
    console.log('─────────────────────────────────');
    const lives = config.LiveConfig || [];
    console.log(`直播源数量: ${lives.length}`);
    if (lives.length > 0) {
      lives.forEach((live, index) => {
        console.log(`\n直播源 ${index + 1}:`);
        console.log(`  名称: ${live.name || '未设置'}`);
        console.log(`  Key: ${live.key || '未设置'}`);
        console.log(`  URL: ${live.url ? '已设置' : '未设置'}`);
        console.log(`  启用: ${!live.disabled ? '✅ 是' : '❌ 否'}`);
        console.log(`  频道数: ${live.channelNumber || 0}`);
      });
    }
    console.log('');

    // 显示自定义分类
    console.log('📁 自定义分类 (CustomCategories):');
    console.log('─────────────────────────────────');
    const categories = config.CustomCategories || [];
    console.log(`分类数量: ${categories.length}`);
    console.log('');

    // 总结
    console.log('📊 配置总结:');
    console.log('─────────────────────────────────');
    console.log(`✓ 站点名称: ${config.SiteConfig?.SiteName || '未设置'}`);
    console.log(
      `✓ 设备码验证: ${config.SiteConfig?.RequireDeviceCode ? '启用' : '禁用'}`
    );
    console.log(`✓ 用户数: ${users.length}`);
    console.log(`✓ 视频源数: ${config.SourceConfig?.length || 0}`);
    console.log(`✓ 直播源数: ${lives.length}`);
    console.log(`✓ 自定义分类数: ${categories.length}`);
    console.log('');

    console.log('✅ 检查完成！');
  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error(error.stack);
  }
}

checkConfig();
