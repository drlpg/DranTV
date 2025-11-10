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

  log('[Test Sources] ========== 测试开始 ==========');
  log('[Test Sources] 时间: ' + new Date().toISOString());

  try {
    // 直接调用配置获取逻辑
    log('[Test Sources] 直接调用 getConfig...');
    const config = await getConfig();

    log('[Test Sources] 配置获取成功');
    log('[Test Sources] LiveConfig数量: ' + (config.LiveConfig?.length || 0));

    const allLiveSources = config.LiveConfig || [];
    const liveSources = allLiveSources.filter(
      (source: any) => !source.disabled
    );

    log('[Test Sources] 启用的直播源数量: ' + liveSources.length);
    log(
      '[Test Sources] 直播源列表: ' +
        JSON.stringify(
          liveSources.map((s: any) => ({ key: s.key, name: s.name })),
          null,
          2
        )
    );

    const data = {
      success: true,
      data: liveSources,
      debug: {
        timestamp: new Date().toISOString(),
        totalSources: allLiveSources.length,
        enabledSources: liveSources.length,
      },
    };

    log('[Test Sources] 测试完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Test Sources] ========== 测试结束 ==========');

    return NextResponse.json({
      success: true,
      apiResponse: data,
      logs: logs,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    log(
      '[Test Sources] ❌ 测试失败: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Test Sources] 错误堆栈: ' + error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        logs: logs,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
