/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, refineConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

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

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    // 检查用户权限
    let adminConfig = await getConfig();

    // 仅站长可以修改配置文件
    if (username !== process.env.LOGIN_USERNAME) {
      return NextResponse.json(
        { error: '权限不足，只有站长可以修改配置文件' },
        { status: 401 }
      );
    }

    // 获取请求体
    const body = await request.json();
    const { configFile, subscriptionUrl, autoUpdate, lastCheckTime } = body;

    if (!configFile || typeof configFile !== 'string') {
      return NextResponse.json(
        { error: '配置文件内容不能为空' },
        { status: 400 }
      );
    }

    // 验证配置文件格式（支持多种格式）
    let isValidFormat = false;
    let formatType = 'unknown';

    // 1. 尝试解析为JSON
    try {
      JSON.parse(configFile);
      isValidFormat = true;
      formatType = 'json';
    } catch {
      // 2. 检查是否为M3U格式
      if (
        configFile.trim().startsWith('#EXTM3U') ||
        configFile.includes('#EXTINF')
      ) {
        isValidFormat = true;
        formatType = 'm3u';
      }
      // 3. 检查是否为TXT格式
      else if (configFile.includes('=') || configFile.split('\n').length > 1) {
        isValidFormat = true;
        formatType = 'txt';
      }
    }

    if (!isValidFormat) {
      return NextResponse.json(
        { error: '配置文件格式错误，支持的格式：JSON、M3U、TXT' },
        { status: 400 }
      );
    }

    adminConfig.ConfigFile = configFile;
    if (!adminConfig.ConfigSubscribtion) {
      adminConfig.ConfigSubscribtion = {
        URL: '',
        AutoUpdate: false,
        LastCheck: '',
      };
    }

    // 更新订阅配置
    if (subscriptionUrl !== undefined) {
      adminConfig.ConfigSubscribtion.URL = subscriptionUrl;
    }
    if (autoUpdate !== undefined) {
      adminConfig.ConfigSubscribtion.AutoUpdate = autoUpdate;
    }
    adminConfig.ConfigSubscribtion.LastCheck = lastCheckTime || '';

    adminConfig = refineConfig(adminConfig);
    // 更新配置文件
    await db.saveAdminConfig(adminConfig);

    // 更新内存缓存
    await setCachedConfig(adminConfig);

    return NextResponse.json({
      success: true,
      message: '配置文件更新成功',
    });
  } catch (error) {
    console.error('更新配置文件失败:', error);
    return NextResponse.json(
      {
        error: '更新配置文件失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
