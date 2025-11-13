/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { clearAllCachedLiveChannels } from '@/lib/live';

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

    console.log('[Live Refresh] 清除直播源缓存...');

    // 只清除缓存，不实际刷新（刷新会在用户访问时自动进行）
    clearAllCachedLiveChannels();

    console.log('[Live Refresh] 缓存已清除，下次访问时会自动刷新');

    return NextResponse.json({
      success: true,
      message: '直播源刷新成功',
    });
  } catch (error) {
    console.error('直播源刷新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刷新失败' },
      { status: 500 }
    );
  }
}
