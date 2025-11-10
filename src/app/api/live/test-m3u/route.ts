/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少url参数',
      },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Test M3U] ========== 开始测试 ==========');
  log('[Test M3U] 目标URL: ' + url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    log('[Test M3U] 发送请求...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AptvPlayer/1.4.10',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    log('[Test M3U] 响应状态: ' + response.status + ' ' + response.statusText);
    log(
      '[Test M3U] Content-Type: ' +
        (response.headers.get('content-type') || 'N/A')
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    log('[Test M3U] 内容长度: ' + text.length + ' bytes');
    log('[Test M3U] 前500字符: ' + text.substring(0, 500));

    // 简单解析M3U
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    const channelCount = lines.filter((l) => l.startsWith('#EXTINF:')).length;
    log('[Test M3U] 频道数量: ' + channelCount);

    log('[Test M3U] 测试完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Test M3U] ========== 测试结束 ==========');

    return NextResponse.json({
      success: true,
      url: url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: text.length,
      channelCount: channelCount,
      preview: text.substring(0, 500),
      duration: Date.now() - startTime,
      logs: logs,
    });
  } catch (error) {
    log(
      '[Test M3U] ❌ 测试失败: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Test M3U] 错误堆栈: ' + error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        url: url,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
        logs: logs,
      },
      { status: 500 }
    );
  }
}
