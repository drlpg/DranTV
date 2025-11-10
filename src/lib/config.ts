/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import fs from 'fs';
import path from 'path';

import { db } from '@/lib/db';

import { AdminConfig } from './admin.types';

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string; // 节目单
}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  };
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  shortdrama: {
    // 使用 Cloudflare Workers 代理解决403问题
    // 可通过环境变量 NEXT_PUBLIC_SHORTDRAMA_API_URL 自定义
    baseUrl:
      process.env.NEXT_PUBLIC_SHORTDRAMA_API_URL ||
      'https://shortdrama-proxy.danranlpg.workers.dev',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

// 在模块加载时根据环境决定配置来源
let cachedConfig: AdminConfig;

// 解析非JSON格式的配置文件（M3U、TXT）
function parseNonJsonConfig(configContent: string): ConfigFileStruct {
  const config: ConfigFileStruct = {
    lives: {},
  };

  // 检查是否为M3U格式
  if (
    configContent.trim().startsWith('#EXTM3U') ||
    configContent.includes('#EXTINF')
  ) {
    // 解析M3U格式
    const lines = configContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);
    let currentName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 解析 #EXTINF 行获取名称
      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/,(.+)$/);
        if (match) {
          currentName = match[1].trim();
        }
      }
      // 解析URL行
      else if (line.startsWith('http://') || line.startsWith('https://')) {
        if (currentName) {
          const key = currentName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
          config.lives![key] = {
            name: currentName,
            url: line,
          };
          currentName = '';
        }
      }
    }
  }
  // 检查是否为TXT格式（键值对）
  else if (configContent.includes('=')) {
    const lines = configContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    lines.forEach((line) => {
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) return;

      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim();

      if (!key || !value) return;

      const parts = key.split(',').map((s) => s.trim());

      // 格式1: key,name,api,detail（视频源，4个字段）
      if (parts.length === 4) {
        const [sourceKey, sourceName, sourceApi, sourceDetail] = parts;
        config.api_site![sourceKey] = {
          key: sourceKey,
          name: sourceName,
          api: sourceApi,
          detail: sourceDetail,
        };
      }
      // 格式2: key,name,api（视频源，3个字段，detail为空）
      else if (parts.length === 3) {
        const [sourceKey, sourceName, sourceApi] = parts;
        config.api_site![sourceKey] = {
          key: sourceKey,
          name: sourceName,
          api: sourceApi,
          detail: '',
        };
      }
      // 格式3: key,name=url（直播源，2个字段）
      else if (parts.length === 2) {
        const [liveKey, liveName] = parts;
        config.lives![liveKey] = {
          name: liveName,
          url: value,
        };
      }
      // 格式4: key=value（自动判断类型）
      else if (parts.length === 1) {
        // 如果value看起来像视频源API（包含?ac=或/api/）
        if (value.includes('?ac=') || value.includes('/api/')) {
          config.api_site![key] = {
            key: key,
            name: key,
            api: value,
            detail: '',
          };
        }
        // 否则当作直播源
        else {
          config.lives![key] = {
            name: key,
            url: value,
          };
        }
      }
    });
  }

  return config;
}

// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch (e) {
    // 如果不是JSON格式，尝试解析为M3U或TXT格式
    fileConfig = parseNonJsonConfig(adminConfig.ConfigFile);
  }

  // 合并文件中的源信息
  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s])
  );

  // 用于跟踪已存在的API地址，避免重复
  const existingApiUrls = new Set(
    Array.from(currentApiSites.values()).map((s) => s.api.toLowerCase().trim())
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    const normalizedApiUrl = site.api.toLowerCase().trim();

    if (existingSource) {
      // 如果已存在，只覆盖 name、api、detail 和 from
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.from = 'config';
      // 更新API地址记录
      existingApiUrls.add(normalizedApiUrl);
    } else {
      // 检查API地址是否已存在
      if (existingApiUrls.has(normalizedApiUrl)) {
        return; // 跳过重复的API地址
      }

      // 如果不存在，创建新条目
      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: 'config',
        disabled: false,
      });
      existingApiUrls.add(normalizedApiUrl);
    }
  });

  // 检查现有源是否在 fileConfig.api_site 中，如果不在则标记为 custom
  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.SourceConfig = Array.from(currentApiSites.values());

  // 覆盖 CustomCategories
  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c])
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = 'config';
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 CustomCategories 是否在 fileConfig.custom_category 中，如果不在则标记为 custom
  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type)
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.CustomCategories = Array.from(currentCustomCategories.values());

  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l])
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      // 如果不存在，创建新条目
      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 LiveConfig 是否在 fileConfig.lives 中，如果不在则标记为 custom
  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.LiveConfig = Array.from(currentLives.values());

  return adminConfig;
}

async function getInitConfig(
  configFile: string,
  subConfig: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  } = {
    URL: '',
    AutoUpdate: false,
    LastCheck: '',
  }
): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;
  try {
    cfgFile = JSON.parse(configFile) as ConfigFileStruct;
  } catch (e) {
    cfgFile = {} as ConfigFileStruct;
  }
  const adminConfig: AdminConfig = {
    ConfigFile: configFile,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'DranTV',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE ||
        'cmliussss-cdn-tencent',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      RequireDeviceCode: process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true',
    },
    UserConfig: {
      Users: [],
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
  };

  // 补充用户信息
  let userNames: string[] = [];
  try {
    userNames = await db.getAllUsers();
  } catch (e) {
    // 静默处理错误
  }
  const allUsers = userNames
    .filter((u) => u !== process.env.LOGIN_USERNAME)
    .map((u) => ({
      username: u,
      role: 'user',
      banned: false,
    }));
  allUsers.unshift({
    username: process.env.LOGIN_USERNAME!,
    role: 'owner',
    banned: false,
  });
  adminConfig.UserConfig.Users = allUsers as any;

  // 从配置文件中补充源信息
  Object.entries(cfgFile.api_site || []).forEach(([key, site]) => {
    adminConfig.SourceConfig.push({
      key: key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充自定义分类信息
  cfgFile.custom_category?.forEach((category) => {
    adminConfig.CustomCategories.push({
      name: category.name || category.query,
      type: category.type,
      query: category.query,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充直播源信息
  Object.entries(cfgFile.lives || []).forEach(([key, live]) => {
    if (!adminConfig.LiveConfig) {
      adminConfig.LiveConfig = [];
    }
    adminConfig.LiveConfig.push({
      key,
      name: live.name,
      url: live.url,
      ua: live.ua,
      epg: live.epg,
      channelNumber: 0,
      from: 'config',
      disabled: false,
    });
  });

  return adminConfig;
}

export async function getConfig(): Promise<AdminConfig> {
  const startTime = Date.now();
  console.log('[Config] ========== 开始获取配置 ==========');
  console.log('[Config] 时间:', new Date().toISOString());

  // 直接使用内存缓存
  if (cachedConfig) {
    console.log('[Config] 使用内存缓存配置');
    console.log('[Config] 缓存配置摘要:', {
      sourcesCount: cachedConfig.SourceConfig?.length || 0,
      liveSourcesCount: cachedConfig.LiveConfig?.length || 0,
      customCategoriesCount: cachedConfig.CustomCategories?.length || 0,
    });
    console.log(
      '[Config] 获取配置完成（缓存），耗时:',
      Date.now() - startTime,
      'ms'
    );
    console.log('[Config] ========== 获取配置结束 ==========');
    return cachedConfig;
  }

  // 读 db
  let adminConfig: AdminConfig | null = null;
  let needsSave = false;
  let isTimeout = false;

  try {
    console.log('[Config] 开始从数据库获取配置...');
    // 添加10秒超时控制（缩短超时时间，提高响应速度）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('数据库操作超时')), 10000);
    });

    adminConfig = await Promise.race([db.getAdminConfig(), timeoutPromise]);
    console.log(
      '[Config] 数据库配置获取成功，耗时:',
      Date.now() - startTime,
      'ms'
    );
    if (adminConfig) {
      console.log('[Config] 数据库配置摘要:', {
        sourcesCount: adminConfig.SourceConfig?.length || 0,
        liveSourcesCount: adminConfig.LiveConfig?.length || 0,
        customCategoriesCount: adminConfig.CustomCategories?.length || 0,
      });
    }
  } catch (e) {
    console.error('[Config] 数据库操作失败:', e);
    console.error('[Config] 错误堆栈:', e instanceof Error ? e.stack : 'N/A');
    console.error('[Config] 耗时:', Date.now() - startTime, 'ms');

    // 判断是否为超时错误
    if (e instanceof Error && e.message.includes('超时')) {
      isTimeout = true;
      console.warn('[Config] 数据库连接超时，使用降级配置');
    } else {
      console.error('[Config] 获取配置失败:', e);
    }
  }

  // db 中无配置且不是超时，执行一次初始化
  if (!adminConfig && !isTimeout) {
    console.log('[Config] 数据库中无配置，执行初始化...');
    // 读取config.json文件
    let configFileContent = '';
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      console.log('[Config] 尝试读取配置文件:', configPath);
      if (fs.existsSync(configPath)) {
        configFileContent = fs.readFileSync(configPath, 'utf-8');
        console.log(
          '[Config] 配置文件读取成功，长度:',
          configFileContent.length
        );
      } else {
        console.warn('[Config] 配置文件不存在');
      }
    } catch (e) {
      console.error('[Config] 读取配置文件失败:', e);
      // 静默处理读取错误
    }

    adminConfig = await getInitConfig(configFileContent);
    console.log('[Config] 初始化配置完成');
    needsSave = true;
  } else if (isTimeout) {
    // 超时情况：使用降级配置，避免页面崩溃
    console.warn('[Config] 使用降级配置（基于环境变量和config.json）');

    let configFileContent = '';
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      console.log('[Config] 尝试读取配置文件:', configPath);
      if (fs.existsSync(configPath)) {
        configFileContent = fs.readFileSync(configPath, 'utf-8');
        console.log(
          '[Config] 配置文件读取成功，长度:',
          configFileContent.length
        );
      } else {
        console.warn('[Config] 配置文件不存在');
      }
    } catch (e) {
      console.error('[Config] 读取配置文件失败:', e);
      // 静默处理读取错误
    }

    adminConfig = await getInitConfig(configFileContent);
    console.log('[Config] 降级配置初始化完成');

    // 后台异步重试获取配置（不阻塞当前请求）
    setTimeout(async () => {
      try {
        console.log('[Config] 后台重试获取数据库配置...');
        const retryConfig = await db.getAdminConfig();
        if (retryConfig) {
          cachedConfig = configSelfCheck(retryConfig);
          console.log('[Config] 后台重试成功，已更新缓存配置');
        } else {
          console.warn('[Config] 后台重试返回空配置');
        }
      } catch (retryError) {
        console.error('[Config] 后台重试失败:', retryError);
      }
    }, 1000);
  }

  // 确保 adminConfig 不为 null
  if (!adminConfig) {
    console.error('[Config] 无法获取配置，使用默认配置');
    // 使用最小默认配置
    adminConfig = await getInitConfig('');
  }

  console.log('[Config] 执行配置自检...');
  // 执行配置自检
  adminConfig = configSelfCheck(adminConfig);
  console.log('[Config] 配置自检完成');
  console.log('[Config] 最终配置摘要:', {
    sourcesCount: adminConfig.SourceConfig?.length || 0,
    liveSourcesCount: adminConfig.LiveConfig?.length || 0,
    customCategoriesCount: adminConfig.CustomCategories?.length || 0,
  });

  // 缓存配置
  cachedConfig = adminConfig;
  console.log('[Config] 配置已缓存到内存');

  // 只在初始化时保存到数据库，避免覆盖已有数据
  if (needsSave) {
    console.log('[Config] 异步保存配置到数据库...');
    // 异步保存，不阻塞返回
    db.saveAdminConfig(cachedConfig).catch((err) => {
      console.error('[Config] 保存配置失败:', err);
    });
  }

  console.log('[Config] 获取配置完成，总耗时:', Date.now() - startTime, 'ms');
  console.log('[Config] ========== 获取配置结束 ==========');
  return cachedConfig;
}

export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  // 确保必要的属性存在和初始化
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = { Users: [] };
  }
  if (
    !adminConfig.UserConfig.Users ||
    !Array.isArray(adminConfig.UserConfig.Users)
  ) {
    adminConfig.UserConfig.Users = [];
  }
  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (
    !adminConfig.CustomCategories ||
    !Array.isArray(adminConfig.CustomCategories)
  ) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }

  // 确保 SiteConfig 及其属性存在
  if (!adminConfig.SiteConfig) {
    adminConfig.SiteConfig = {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'DranTV',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE ||
        'cmliussss-cdn-tencent',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      RequireDeviceCode: process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true',
    };
  }

  // 确保 RequireDeviceCode 属性存在
  if (adminConfig.SiteConfig.RequireDeviceCode === undefined) {
    adminConfig.SiteConfig.RequireDeviceCode =
      process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true';
  }

  // 确保 ThemeConfig 存在
  if (!adminConfig.ThemeConfig) {
    adminConfig.ThemeConfig = {
      defaultTheme: 'default',
      customCSS: '',
      allowUserCustomization: true,
    };
  }

  // 站长变更自检
  const ownerUser = process.env.LOGIN_USERNAME;

  // 去重
  const seenUsernames = new Set<string>();
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => {
    if (seenUsernames.has(user.username)) {
      return false;
    }
    seenUsernames.add(user.username);
    return true;
  });
  // 过滤站长
  const originOwnerCfg = adminConfig.UserConfig.Users.find(
    (u) => u.username === ownerUser
  );
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter(
    (user) => user.username !== ownerUser
  );
  // 其他用户不得拥有 owner 权限
  adminConfig.UserConfig.Users.forEach((user) => {
    if (user.role === 'owner') {
      user.role = 'user';
    }
  });
  // 重新添加回站长
  adminConfig.UserConfig.Users.unshift({
    username: ownerUser!,
    role: 'owner',
    banned: false,
    enabledApis: originOwnerCfg?.enabledApis || undefined,
    tags: originOwnerCfg?.tags || undefined,
  });

  // 采集源去重
  const seenSourceKeys = new Set<string>();
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((source) => {
    if (seenSourceKeys.has(source.key)) {
      return false;
    }
    seenSourceKeys.add(source.key);
    return true;
  });

  // 自定义分类去重
  const seenCustomCategoryKeys = new Set<string>();
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter(
    (category) => {
      if (seenCustomCategoryKeys.has(category.query + category.type)) {
        return false;
      }
      seenCustomCategoryKeys.add(category.query + category.type);
      return true;
    }
  );

  // 直播源去重
  const seenLiveKeys = new Set<string>();
  adminConfig.LiveConfig = adminConfig.LiveConfig.filter((live) => {
    if (seenLiveKeys.has(live.key)) {
      return false;
    }
    seenLiveKeys.add(live.key);
    return true;
  });

  return adminConfig;
}

export async function resetConfig() {
  let originConfig: AdminConfig | null = null;
  try {
    originConfig = await db.getAdminConfig();
  } catch (e) {
    // 静默处理错误
  }
  if (!originConfig) {
    originConfig = {} as AdminConfig;
  }
  const adminConfig = await getInitConfig(
    originConfig.ConfigFile,
    originConfig.ConfigSubscribtion
  );
  cachedConfig = adminConfig;
  await db.saveAdminConfig(adminConfig);

  return;
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);

  if (!user) {
    return allApiSites;
  }

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  if (!userConfig) {
    return allApiSites;
  }

  // 优先根据用户自己的 enabledApis 配置查找
  if (userConfig.enabledApis && userConfig.enabledApis.length > 0) {
    const userApiSitesSet = new Set(userConfig.enabledApis);
    return allApiSites
      .filter((s) => userApiSitesSet.has(s.key))
      .map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        detail: s.detail,
      }));
  }

  // 如果没有 enabledApis 配置，则根据 tags 查找
  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    const enabledApisFromTags = new Set<string>();

    // 遍历用户的所有 tags，收集对应的 enabledApis
    userConfig.tags.forEach((tagName) => {
      const tagConfig = config.UserConfig.Tags?.find((t) => t.name === tagName);
      if (tagConfig && tagConfig.enabledApis) {
        tagConfig.enabledApis.forEach((apiKey) =>
          enabledApisFromTags.add(apiKey)
        );
      }
    });

    if (enabledApisFromTags.size > 0) {
      return allApiSites
        .filter((s) => enabledApisFromTags.has(s.key))
        .map((s) => ({
          key: s.key,
          name: s.name,
          api: s.api,
          detail: s.detail,
        }));
    }
  }

  // 如果都没有配置，返回所有可用的 API 站点
  return allApiSites;
}

export async function setCachedConfig(config: AdminConfig) {
  cachedConfig = config;
}

export function clearCachedConfig() {
  cachedConfig = undefined as any;
}

// 获取管理员配置（用于API路由）
export async function getAdminConfig(): Promise<AdminConfig> {
  return await getConfig();
}

// 保存管理员配置（用于API路由）
export async function saveAdminConfig(config: AdminConfig): Promise<void> {
  // 验证配置完整性
  if (!config.SourceConfig) {
    config.SourceConfig = [];
  }
  if (!config.LiveConfig) {
    config.LiveConfig = [];
  }
  if (!config.CustomCategories) {
    config.CustomCategories = [];
  }

  // 去重LiveConfig（防止重复）
  if (config.LiveConfig.length > 0) {
    const seen = new Set<string>();
    config.LiveConfig = config.LiveConfig.filter((source) => {
      if (seen.has(source.key)) {
        console.warn(`[Config] 检测到重复的直播源key: ${source.key}，已移除`);
        return false;
      }
      seen.add(source.key);
      return true;
    });
  }

  // 更新缓存
  cachedConfig = config;

  // 保存到数据库
  await db.saveAdminConfig(config);
}
