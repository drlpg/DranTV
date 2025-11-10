/* eslint-disable no-console */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setCachedConfig } from '@/lib/config';
import { AdminConfig } from '@/lib/admin.types';

export const runtime = 'nodejs';

export async function POST() {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Init DB] ========== 开始初始化数据库 ==========');
  log('[Init DB] 时间: ' + new Date().toISOString());

  try {
    // 创建包含直播源的 ConfigFile
    const configFile = JSON.stringify({
      lives: {
        央视频道_1762602986171: {
          name: '央视频道',
          url: 'https://live.hacks.tools/tv/ipv4/categories/央视频道.m3u',
        },
        电影频道_1762603002570: {
          name: '电影频道',
          url: 'https://live.hacks.tools/tv/ipv4/categories/电影频道.m3u',
        },
      },
    });

    log('[Init DB] 创建配置文件，长度: ' + configFile.length + ' 字符');

    // 获取当前数据库配置
    log('[Init DB] 获取当前数据库配置...');
    let currentConfig = await db.getAdminConfig();

    if (!currentConfig) {
      log('[Init DB] 数据库配置为null，创建新配置...');
      // 创建基础配置
      currentConfig = {
        ConfigFile: configFile,
        ConfigSubscribtion: {
          URL: '',
          AutoUpdate: false,
          LastCheck: '',
        },
        SiteConfig: {
          SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'DranTV',
          Announcement:
            process.env.ANNOUNCEMENT ||
            '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。',
          SearchDownstreamMaxPage:
            Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
          SiteInterfaceCacheTime: 7200,
          DoubanProxyType:
            process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE ||
            'cmliussss-cdn-tencent',
          DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
          DoubanImageProxyType:
            process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE ||
            'cmliussss-cdn-tencent',
          DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
          DisableYellowFilter:
            process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
          FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
          RequireDeviceCode:
            process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true',
        },
        UserConfig: {
          Users: [
            {
              username: process.env.LOGIN_USERNAME || 'admin',
              role: 'owner',
              banned: false,
            },
          ],
        },
        SourceConfig: [],
        CustomCategories: [],
        LiveConfig: [],
      } as AdminConfig;
    } else {
      log('[Init DB] 数据库配置存在，更新 ConfigFile...');
    }

    // 更新 ConfigFile
    currentConfig.ConfigFile = configFile;

    // 从 ConfigFile 解析并填充 LiveConfig
    const configObj = JSON.parse(configFile);
    currentConfig.LiveConfig = Object.entries(configObj.lives || {}).map(
      ([key, live]: [string, any]) => ({
        key,
        name: live.name,
        url: live.url,
        ua: live.ua,
        epg: live.epg,
        channelNumber: 0,
        from: 'config' as const,
        disabled: false,
      })
    );

    log('[Init DB] LiveConfig已填充，数量: ' + currentConfig.LiveConfig.length);
    currentConfig.LiveConfig.forEach((source, index) => {
      log(`[Init DB]   ${index + 1}. ${source.name} (${source.key})`);
    });

    // 保存到数据库
    log('[Init DB] 保存配置到数据库...');
    try {
      await db.saveAdminConfig(currentConfig);
      log('[Init DB] ✅ 配置已保存到数据库');

      // 立即验证保存是否成功
      log('[Init DB] 验证保存结果...');
      const verifyConfig = await db.getAdminConfig();
      if (verifyConfig) {
        log(
          '[Init DB] 验证成功 - LiveConfig数量: ' +
            (verifyConfig.LiveConfig?.length || 0)
        );
        log(
          '[Init DB] 验证成功 - ConfigFile长度: ' +
            (verifyConfig.ConfigFile?.length || 0)
        );
      } else {
        log('[Init DB] ⚠️ 验证失败 - 无法读取刚保存的配置');
      }
    } catch (saveError) {
      log(
        '[Init DB] ❌ 保存失败: ' +
          (saveError instanceof Error ? saveError.message : String(saveError))
      );
      if (saveError instanceof Error && saveError.stack) {
        log('[Init DB] 错误堆栈: ' + saveError.stack);
      }
      throw saveError;
    }

    // 更新缓存
    log('[Init DB] 更新缓存...');
    setCachedConfig(currentConfig);
    log('[Init DB] ✅ 缓存已更新');

    log('[Init DB] 初始化完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Init DB] ========== 初始化结束 ==========');

    return NextResponse.json({
      success: true,
      message: '数据库配置已初始化',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      logs: logs,
      summary: {
        sourceCount: currentConfig.SourceConfig?.length || 0,
        liveSourceCount: currentConfig.LiveConfig?.length || 0,
        configFileLength: currentConfig.ConfigFile?.length || 0,
        liveSources:
          currentConfig.LiveConfig?.map((s) => ({
            key: s.key,
            name: s.name,
            disabled: s.disabled || false,
          })) || [],
      },
    });
  } catch (error) {
    log(
      '[Init DB] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Init DB] 错误堆栈: ' + error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        logs: logs,
      },
      { status: 500 }
    );
  }
}
