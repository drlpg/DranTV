/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 权限检查：仅站长可以拉取配置订阅
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authInfo.username !== process.env.LOGIN_USERNAME) {
      return NextResponse.json(
        { error: '权限不足，只有站长可以拉取配置订阅' },
        { status: 401 }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 });
    }

    // 直接 fetch URL 获取配置内容
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `请求失败: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const configContent = await response.text();

    // 尝试解析配置内容
    let decodedContent;
    let format = 'unknown';

    // 1. 尝试直接解析为JSON
    try {
      JSON.parse(configContent);
      decodedContent = configContent;
      format = 'json';
    } catch {
      // 2. 尝试Base58解码
      try {
        const bs58 = (await import('bs58')).default;
        const decodedBytes = bs58.decode(configContent);
        decodedContent = new TextDecoder().decode(decodedBytes);
        JSON.parse(decodedContent); // 验证解码后是否为有效JSON
        format = 'base58';
      } catch {
        // 3. 检查是否为M3U格式
        if (
          configContent.trim().startsWith('#EXTM3U') ||
          configContent.includes('#EXTINF')
        ) {
          decodedContent = configContent;
          format = 'm3u';
        }
        // 4. 检查是否为TXT格式（简单的键值对或列表）
        else if (
          configContent.includes('=') ||
          configContent.split('\n').length > 1
        ) {
          decodedContent = configContent;
          format = 'txt';
        } else {
          throw new Error(
            '无法识别的配置格式，支持的格式：JSON、Base58、M3U、TXT'
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      configContent: decodedContent,
      format: format,
      message: `配置拉取成功 (格式: ${format.toUpperCase()})`,
    });
  } catch (error) {
    console.error('拉取配置失败:', error);
    return NextResponse.json({ error: '拉取配置失败' }, { status: 500 });
  }
}
