/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';
import { GET as sourcesGET } from '../sources/route';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Test Real Sources] ========== 测试开始 ==========');
  log('[Test Real Sources] 时间: ' + new Date().toISOString());

  try {
    // 直接调用真实的 sources API 逻辑
    log('[Test Real Sources] 调用 sources API GET方法...');
    const mockRequest = new Request('http://localhost:3000/api/live/sources', {
      method: 'GET',
    }) as any as NextRequest;

    const response = await sourcesGET(mockRequest);
    const data = await response.json();

    log('[Test Real Sources] API响应: ' + JSON.stringify(data, null, 2));
    log(
      '[Test Real Sources] 测试完成，总耗时: ' + (Date.now() - startTime) + 'ms'
    );
    log('[Test Real Sources] ========== 测试结束 ==========');

    return NextResponse.json({
      success: true,
      apiResponse: data,
      logs: logs,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    log(
      '[Test Real Sources] ❌ 测试失败: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Test Real Sources] 错误堆栈: ' + error.stack);
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
