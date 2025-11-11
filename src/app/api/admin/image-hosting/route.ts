/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    // 获取当前配置
    const config = await getConfig();

    // 检查权限
    if (username !== process.env.LOGIN_USERNAME) {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { ImageHostingConfig } = body;

    // 参数校验
    if (!ImageHostingConfig || typeof ImageHostingConfig !== 'object') {
      return NextResponse.json({ error: '图床配置格式错误' }, { status: 400 });
    }

    // 更新配置
    config.ImageHostingConfig = ImageHostingConfig;

    // 保存到数据库（使用正确的保存方法）
    await db.saveAdminConfig(config);

    // 更新缓存
    setCachedConfig(config);

    console.log('[图床配置] 配置已更新');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[图床配置] 保存失败:', error);
    return NextResponse.json(
      {
        error: '保存失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
