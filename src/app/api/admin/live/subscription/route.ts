import { NextRequest, NextResponse } from 'next/server';

import { checkAuth } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await checkAuth(request, ['owner', 'admin']);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { url, autoUpdate, lastCheck } = body;

    if (typeof url !== 'string') {
      return NextResponse.json({ error: '订阅URL格式错误' }, { status: 400 });
    }

    // 获取当前配置
    const adminConfig = await getConfig();

    // 如果URL为空，清除订阅配置并删除导入的直播源
    if (!url || url.trim() === '') {
      adminConfig.LiveSubscription = undefined;

      // 删除所有从订阅导入的直播源（from === 'subscription'）
      if (adminConfig.LiveConfig) {
        const originalCount = adminConfig.LiveConfig.length;
        adminConfig.LiveConfig = adminConfig.LiveConfig.filter(
          (source) => source.from !== 'subscription'
        );
        const removedCount = originalCount - adminConfig.LiveConfig.length;
        console.log(`已删除 ${removedCount} 个从订阅导入的直播源`);
      }

      await db.saveAdminConfig(adminConfig);
      await setCachedConfig(adminConfig);
      console.log('直播源订阅配置已清除');
      return NextResponse.json({
        success: true,
        message: '订阅配置已清除，已同步删除导入的直播源',
      });
    }

    // 更新订阅配置
    adminConfig.LiveSubscription = {
      URL: url,
      AutoUpdate: autoUpdate || false,
      LastCheck: new Date().toISOString(),
    };

    // 订阅URL本身就是M3U文件地址，不需要解析
    // 直接将订阅URL作为一个直播源添加
    console.log(`添加订阅URL作为直播源: ${url}`);

    // 删除旧的订阅导入的直播源
    if (adminConfig.LiveConfig) {
      adminConfig.LiveConfig = adminConfig.LiveConfig.filter(
        (source) => source.from !== 'subscription'
      );
    } else {
      adminConfig.LiveConfig = [];
    }

    // 从URL提取名称
    const urlParts = url.split('/');
    const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
    const sourceName = fileName.replace('.m3u', '');

    // 生成友好的key
    const sourceKey = sourceName
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // 添加订阅URL作为直播源
    const newSource = {
      key: sourceKey || 'subscription',
      name: sourceName || '订阅直播源',
      url: url,
      from: 'subscription' as const,
      channelNumber: 0,
      disabled: false,
    };

    adminConfig.LiveConfig.push(newSource);

    console.log(`成功添加订阅直播源: ${sourceName} (${sourceKey})`);

    // 立即获取频道数
    try {
      const { refreshLiveChannels } = await import('@/lib/live');
      const channelCount = await refreshLiveChannels(newSource);
      newSource.channelNumber = channelCount;
      console.log(`已获取频道数: ${channelCount}`);
    } catch (refreshError) {
      console.warn('获取频道数失败，将在首次访问时加载:', refreshError);
    }

    // 保存配置
    await db.saveAdminConfig(adminConfig);
    await setCachedConfig(adminConfig);

    console.log(`直播源订阅配置已保存: ${url}, 自动更新: ${autoUpdate}`);

    return NextResponse.json({
      success: true,
      message: `订阅配置保存成功，已导入 ${
        adminConfig.LiveConfig?.filter((s) => s.from === 'subscription')
          .length || 0
      } 个直播源`,
    });
  } catch (error) {
    console.error('保存直播源订阅配置失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}
