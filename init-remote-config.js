// 初始化远程 Upstash 数据库配置
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

console.log('=== 初始化远程 Upstash 数据库配置 ===\n');

async function initConfig() {
  try {
    // 读取 config.json
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
      console.log('❌ config.json 文件不存在');
      return;
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    console.log('1. 读取 config.json:');
    console.log('   ✓ 配置文件读取成功\n');

    // 构建 AdminConfig
    // 转换 api_site 为 SourceConfig 格式
    const sourceConfig = config.api_site
      ? Object.entries(config.api_site).map(([key, value]) => ({
          key,
          name: value.name || key,
          api: value.api,
          detail: value.detail || '',
          is_adult: value.is_adult || false,
          from: 'config',
          disabled: false,
        }))
      : config.sources || [];

    const adminConfig = {
      SiteConfig: {
        SiteName: config.siteName || 'DranTV',
        RequireDeviceCode: false, // 默认禁用设备码验证
        FluidSearch: true,
        DisableYellowFilter: false,
      },
      SourceConfig: sourceConfig,
      LiveConfig: config.lives
        ? Object.entries(config.lives).map(([key, value]) => ({
            key,
            name: value.name || key,
            url: value.url,
            ua: value.ua,
            epg: value.epg,
            from: 'config',
            disabled: false,
            channelNumber: 0,
          }))
        : [],
      CustomCategories: [],
      UserConfig: {
        Users: [],
      },
    };

    console.log('2. 构建 AdminConfig:');
    console.log(`   视频源数量: ${adminConfig.SourceConfig.length}`);
    console.log(`   直播源数量: ${adminConfig.LiveConfig.length}`);
    console.log('');

    // 保存到 Upstash
    console.log('3. 保存到 Upstash:');
    const saveResponse = await fetch(
      `${UPSTASH_URL}/set/admin_config/${encodeURIComponent(
        JSON.stringify(adminConfig)
      )}`,
      {
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
        },
      }
    );

    if (!saveResponse.ok) {
      console.log('   ✗ 保存失败:', saveResponse.status);
      const text = await saveResponse.text();
      console.log('   响应:', text);
      return;
    }

    console.log('   ✓ 保存成功\n');

    // 验证保存
    console.log('4. 验证保存:');
    const verifyResponse = await fetch(`${UPSTASH_URL}/get/admin_config`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
      },
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      if (verifyData.result) {
        const savedConfig = JSON.parse(verifyData.result);
        console.log('   ✓ 配置已成功保存到数据库');
        console.log(`   视频源: ${savedConfig.SourceConfig?.length || 0} 个`);
        console.log(`   直播源: ${savedConfig.LiveConfig?.length || 0} 个`);
        console.log(
          `   站点名称: ${savedConfig.SiteConfig?.SiteName || '未设置'}`
        );
        console.log(
          `   设备码验证: ${
            savedConfig.SiteConfig?.RequireDeviceCode ? '启用' : '禁用'
          }`
        );
      }
    }

    console.log('\n✅ 初始化完成！');
    console.log('\n提示：现在可以重启服务器，配置将从数据库加载。');
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
  }
}

initConfig();
