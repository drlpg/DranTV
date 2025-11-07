import { NextRequest, NextResponse } from 'next/server';

import { getCachedLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceKey = searchParams.get('source');

    if (!sourceKey) {
      console.error('[Channels API] 缺少直播源参数');
      return NextResponse.json({ error: '缺少直播源参数' }, { status: 400 });
    }

    // 添加超时控制
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('获取频道信息超时')), 15000);
    });

    let channelData;
    try {
      channelData = await Promise.race([
        getCachedLiveChannels(sourceKey),
        timeoutPromise,
      ]);
    } catch (fetchError) {
      console.error('[Channels API] 获取频道数据时出错:', fetchError);
      const errorMsg =
        fetchError instanceof Error ? fetchError.message : '获取频道数据失败';
      return NextResponse.json(
        {
          success: false,
          error: `无法获取频道数据: ${errorMsg}`,
          details:
            '可能原因：1) 直播源URL无法访问 2) M3U文件格式错误 3) 网络连接问题',
        },
        { status: 500 }
      );
    }

    if (!channelData) {
      console.warn(`[Channels API] 频道信息未找到: ${sourceKey}`);
      return NextResponse.json(
        {
          success: false,
          error: '频道信息未找到或直播源无可用频道',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: channelData.channels,
    });
  } catch (error) {
    console.error('[Channels API] 获取频道信息失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '获取频道信息失败';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
