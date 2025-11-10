/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

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
    // 直接调用 /api/live/sources
    log('[Test Sources] 调用 /api/live/sources...');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const sourcesUrl = `${baseUrl}/api/live/sources`;
    log('[Test Sources] URL: ' + sourcesUrl);

    const response = await fetch(sourcesUrl, {
      cache: 'no-store',
    });

    log('[Test Sources] 响应状态: ' + response.status);
    log('[Test Sources] 响应OK: ' + response.ok);

    const data = await response.json();
    log('[Test Sources] 响应数据: ' + JSON.stringify(data, null, 2));

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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: logs,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
