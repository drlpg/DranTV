import { NextRequest, NextResponse } from 'next/server';

import { getCachedLiveChannels, deleteCachedLiveChannels } from '@/lib/live';
import { db } from '@/lib/db';
import { getConfig, setCachedConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceKey, channels } = body;

    if (!sourceKey || !channels) {
      console.error('[Channels API POST] 缺少必要参数');
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 保存修改后的频道列表到数据库
    const dbKey = `live_channels_${sourceKey}`;
    const jsonString = JSON.stringify(channels);

    // 先删除旧数据（如果存在），确保没有残留
    try {
      await db.delete(dbKey);
    } catch (error) {
      // 忽略删除错误，可能是数据不存在
    }

    // 保存新数据
    await db.set(dbKey, jsonString);

    // 清除内存缓存，强制下次重新加载（会从数据库读取保存的版本）
    deleteCachedLiveChannels(sourceKey);

    // 更新配置中的频道数
    try {
      const config = await getConfig();

      if (config?.LiveConfig) {
        const liveSource = config.LiveConfig.find((s) => s.key === sourceKey);
        if (liveSource) {
          const enabledCount = channels.filter(
            (ch: any) => !ch.disabled
          ).length;
          liveSource.channelNumber = enabledCount;

          // 保存更新后的配置
          await db.saveAdminConfig(config);
          await setCachedConfig(config);
        }
      }
    } catch (error) {
      console.error('[Channels API] 更新频道数失败:', error);
      // 不抛出错误，因为频道数据已经保存成功
    }

    return NextResponse.json({
      success: true,
      message: '频道保存成功',
    });
  } catch (error) {
    console.error('[Channels API POST] 保存频道失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存频道失败',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Channels API] ========== 开始处理请求 ==========');
  console.log('[Channels API] 请求时间:', new Date().toISOString());
  console.log('[Channels API] 请求URL:', request.url);

  try {
    const { searchParams } = new URL(request.url);
    const sourceKey = searchParams.get('source');

    console.log('[Channels API] 直播源Key:', sourceKey);

    if (!sourceKey) {
      console.error('[Channels API] 缺少直播源参数');
      console.error('[Channels API] 总耗时:', Date.now() - startTime, 'ms');
      return NextResponse.json(
        {
          error: '缺少直播源参数',
          debug: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          },
        },
        { status: 400 }
      );
    }

    // 添加超时控制
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('获取频道信息超时')), 15000);
    });

    let channelData;
    try {
      console.log('[Channels API] 开始获取频道数据...');
      channelData = await Promise.race([
        getCachedLiveChannels(sourceKey),
        timeoutPromise,
      ]);
      console.log(
        '[Channels API] 频道数据获取成功，耗时:',
        Date.now() - startTime,
        'ms'
      );
      console.log(
        '[Channels API] 频道数量:',
        channelData?.channels?.length || 0
      );
    } catch (fetchError) {
      console.error('[Channels API] 获取频道数据失败:', fetchError);
      console.error(
        '[Channels API] 错误堆栈:',
        fetchError instanceof Error ? fetchError.stack : 'N/A'
      );
      console.error('[Channels API] 总耗时:', Date.now() - startTime, 'ms');

      const errorMsg =
        fetchError instanceof Error ? fetchError.message : '获取频道数据失败';
      return NextResponse.json(
        {
          success: false,
          error: `无法获取频道数据: ${errorMsg}`,
          details:
            '可能原因：1) 直播源URL无法访问 2) M3U文件格式错误 3) 网络连接问题',
          debug: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            sourceKey,
            errorStack:
              fetchError instanceof Error ? fetchError.stack : undefined,
          },
        },
        { status: 500 }
      );
    }

    if (!channelData) {
      console.warn('[Channels API] 频道数据为空');
      console.warn('[Channels API] 总耗时:', Date.now() - startTime, 'ms');
      return NextResponse.json(
        {
          success: false,
          error: '频道信息未找到或直播源无可用频道',
          debug: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            sourceKey,
          },
        },
        { status: 404 }
      );
    }

    console.log(
      '[Channels API] 请求处理完成，总耗时:',
      Date.now() - startTime,
      'ms'
    );
    console.log('[Channels API] ========== 请求处理结束 ==========');

    return NextResponse.json({
      success: true,
      data: channelData.channels,
      debug: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        channelCount: channelData.channels.length,
      },
    });
  } catch (error) {
    console.error('[Channels API] ========== 发生错误 ==========');
    console.error('[Channels API] 获取频道信息失败:', error);
    console.error(
      '[Channels API] 错误堆栈:',
      error instanceof Error ? error.stack : 'N/A'
    );
    console.error('[Channels API] 总耗时:', Date.now() - startTime, 'ms');
    console.error('[Channels API] ========== 错误处理结束 ==========');

    const errorMessage =
      error instanceof Error ? error.message : '获取频道信息失败';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        debug: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}
