/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Debug API] ========== 开始诊断 ==========');
  log('[Debug API] 时间: ' + new Date().toISOString());
  log('[Debug API] 请求URL: ' + request.url);

  try {
    // 1. 测试环境变量
    log('[Debug API] --- 环境变量检查 ---');
    log(
      '[Debug API] NEXT_PUBLIC_STORAGE_TYPE: ' +
        (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'undefined')
    );
    log('[Debug API] NODE_ENV: ' + (process.env.NODE_ENV || 'undefined'));
    log(
      '[Debug API] NEXT_PUBLIC_BASE_URL: ' +
        (process.env.NEXT_PUBLIC_BASE_URL || 'undefined')
    );

    // 2. 测试配置获取
    log('[Debug API] --- 配置获取测试 ---');
    log('[Debug API] 开始获取配置...');
    const config = await getConfig();
    log('[Debug API] 配置获取成功');
    log('[Debug API] SourceConfig数量: ' + (config.SourceConfig?.length || 0));
    log('[Debug API] LiveConfig数量: ' + (config.LiveConfig?.length || 0));
    log(
      '[Debug API] CustomCategories数量: ' +
        (config.CustomCategories?.length || 0)
    );

    if (config.LiveConfig && config.LiveConfig.length > 0) {
      log('[Debug API] --- 直播源详情 ---');
      config.LiveConfig.forEach((source, index) => {
        log(`[Debug API] 直播源 ${index + 1}: ${source.name} (${source.key})`);
        log(`[Debug API]   - URL: ${source.url}`);
        log(`[Debug API]   - disabled: ${source.disabled || false}`);
        log(`[Debug API]   - from: ${source.from}`);
      });

      const enabledSources = config.LiveConfig.filter((s) => !s.disabled);
      log('[Debug API] 启用的直播源数量: ' + enabledSources.length);
    } else {
      log('[Debug API] ⚠️ LiveConfig为空或不存在');
    }

    // 3. 测试config.json文件
    log('[Debug API] --- config.json文件检查 ---');
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.json');
      log('[Debug API] config.json路径: ' + configPath);

      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        log('[Debug API] config.json存在，大小: ' + content.length + ' bytes');
        log('[Debug API] config.json前100字符: ' + content.substring(0, 100));
      } else {
        log('[Debug API] ⚠️ config.json不存在');
      }
    } catch (e) {
      log(
        '[Debug API] ❌ 读取config.json失败: ' +
          (e instanceof Error ? e.message : String(e))
      );
    }

    log('[Debug API] 诊断完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Debug API] ========== 诊断结束 ==========');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      logs: logs,
      config: {
        sourceCount: config.SourceConfig?.length || 0,
        liveSourceCount: config.LiveConfig?.length || 0,
        enabledLiveSourceCount:
          config.LiveConfig?.filter((s) => !s.disabled).length || 0,
        liveSources:
          config.LiveConfig?.map((s) => ({
            key: s.key,
            name: s.name,
            url: s.url,
            disabled: s.disabled || false,
            from: s.from,
          })) || [],
      },
    });
  } catch (error) {
    log(
      '[Debug API] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Debug API] 错误堆栈: ' + error.stack);
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
