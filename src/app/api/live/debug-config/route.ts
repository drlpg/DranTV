/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig, clearCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Debug Config] ========== 开始诊断配置 ==========');
  log('[Debug Config] 时间: ' + new Date().toISOString());

  try {
    // 1. 检查cachedConfig状态
    log('[Debug Config] --- 检查缓存状态 ---');

    // 2. 清空缓存，强制重新获取
    log('[Debug Config] 清空缓存...');
    clearCachedConfig();

    // 3. 第一次获取配置
    log('[Debug Config] 第一次调用 getConfig...');
    const config1 = await getConfig();
    log('[Debug Config] 第一次获取结果:');
    log(
      '[Debug Config]   - SourceConfig: ' + (config1.SourceConfig?.length || 0)
    );
    log('[Debug Config]   - LiveConfig: ' + (config1.LiveConfig?.length || 0));
    log(
      '[Debug Config]   - LiveConfig详情: ' +
        JSON.stringify(
          config1.LiveConfig?.map((s) => ({
            key: s.key,
            name: s.name,
            disabled: s.disabled,
          })) || [],
          null,
          2
        )
    );

    // 4. 第二次获取配置（应该使用缓存）
    log('[Debug Config] 第二次调用 getConfig（应该使用缓存）...');
    const config2 = await getConfig();
    log('[Debug Config] 第二次获取结果:');
    log(
      '[Debug Config]   - SourceConfig: ' + (config2.SourceConfig?.length || 0)
    );
    log('[Debug Config]   - LiveConfig: ' + (config2.LiveConfig?.length || 0));

    // 5. 检查是否相同
    log(
      '[Debug Config] 两次获取是否相同: ' +
        (config1 === config2 ? '是（同一对象）' : '否（不同对象）')
    );

    // 6. 检查数据库
    log('[Debug Config] --- 检查数据库 ---');
    try {
      const dbConfig = await db.getAdminConfig();
      log('[Debug Config] 数据库配置:');
      log(
        '[Debug Config]   - 是否为null: ' + (dbConfig === null ? '是' : '否')
      );
      if (dbConfig) {
        log(
          '[Debug Config]   - SourceConfig: ' +
            (dbConfig.SourceConfig?.length || 0)
        );
        log(
          '[Debug Config]   - LiveConfig: ' + (dbConfig.LiveConfig?.length || 0)
        );
        log(
          '[Debug Config]   - LiveConfig详情: ' +
            JSON.stringify(
              dbConfig.LiveConfig?.map((s) => ({
                key: s.key,
                name: s.name,
                disabled: s.disabled,
              })) || [],
              null,
              2
            )
        );
      }
    } catch (dbError) {
      log(
        '[Debug Config] 数据库访问失败: ' +
          (dbError instanceof Error ? dbError.message : String(dbError))
      );
    }

    log('[Debug Config] 诊断完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Debug Config] ========== 诊断结束 ==========');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      logs: logs,
      config1: {
        sourceCount: config1.SourceConfig?.length || 0,
        liveSourceCount: config1.LiveConfig?.length || 0,
        liveSources:
          config1.LiveConfig?.map((s) => ({
            key: s.key,
            name: s.name,
            disabled: s.disabled || false,
          })) || [],
      },
      config2: {
        sourceCount: config2.SourceConfig?.length || 0,
        liveSourceCount: config2.LiveConfig?.length || 0,
      },
      sameObject: config1 === config2,
    });
  } catch (error) {
    log(
      '[Debug Config] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Debug Config] 错误堆栈: ' + error.stack);
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
