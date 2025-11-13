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

    // 订阅配置只更新订阅信息，不修改LiveConfig
    // LiveConfig的管理由导入API和直播源管理API负责

    // 保存配置
    await db.saveAdminConfig(adminConfig);
    await setCachedConfig(adminConfig);

    console.log(`直播源订阅配置已保存: ${url}, 自动更新: ${autoUpdate}`);

    return NextResponse.json({
      success: true,
      message: '订阅配置保存成功',
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
