/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { clearAllCachedLiveChannels, refreshLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';
export const maxDuration = 60; // 增加超时时间到60秒

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authInfo = getAuthInfoFromCookie(request);
    const username = authInfo?.username;
    const config = await getConfig();
    if (username !== process.env.LOGIN_USERNAME) {
      // 管理员
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    console.log('[Live Refresh] 开始刷新所有直播源...');

    // 清除缓存
    clearAllCachedLiveChannels();

    // 获取所有启用的直播源
    const liveSources = config.LiveConfig?.filter((s) => !s.disabled) || [];

    if (liveSources.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要刷新的直播源',
      });
    }

    console.log(`[Live Refresh] 共 ${liveSources.length} 个直播源需要刷新`);

    // 并发刷新所有直播源
    const results = await Promise.allSettled(
      liveSources.map(async (source) => {
        try {
          const channelCount = await refreshLiveChannels(source);
          source.channelNumber = channelCount;
          return { key: source.key, success: true, channelCount };
        } catch (error) {
          console.warn(`刷新失败: ${source.name}`, error);
          source.channelNumber = 0;
          return { key: source.key, success: false, error };
        }
      }),
    );

    // 保存更新后的配置
    await db.saveAdminConfig(config);

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length;
    const failCount = results.length - successCount;

    console.log(
      `[Live Refresh] 刷新完成: 成功 ${successCount}, 失败 ${failCount}`,
    );

    return NextResponse.json({
      success: true,
      message: `刷新完成: 成功 ${successCount} 个${failCount > 0 ? `, 失败 ${failCount} 个` : ''}`,
      results: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error('直播源刷新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刷新失败' },
      { status: 500 },
    );
  }
}
