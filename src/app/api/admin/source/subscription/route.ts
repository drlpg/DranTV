import { NextRequest, NextResponse } from 'next/server';

import { checkAuth } from '@/lib/auth';
import { getAdminConfig, saveAdminConfig } from '@/lib/config';

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
    const adminConfig = await getAdminConfig();

    // 如果URL为空，清除订阅配置并删除导入的视频源
    if (!url || url.trim() === '') {
      adminConfig.SourceSubscription = undefined;

      // 删除所有从订阅导入的视频源（from === 'subscription'）
      if (adminConfig.SourceConfig) {
        const originalCount = adminConfig.SourceConfig.length;
        adminConfig.SourceConfig = adminConfig.SourceConfig.filter(
          (source) => source.from !== 'subscription'
        );
        const removedCount = originalCount - adminConfig.SourceConfig.length;
        console.log(`已删除 ${removedCount} 个从订阅导入的视频源`);
      }

      await saveAdminConfig(adminConfig);
      console.log('视频源订阅配置已清除');
      return NextResponse.json({
        success: true,
        message: '订阅配置已清除，已同步删除导入的视频源',
      });
    }

    // 更新订阅配置
    adminConfig.SourceSubscription = {
      URL: url,
      AutoUpdate: autoUpdate || false,
      LastCheck: lastCheck || new Date().toISOString(),
    };

    // 保存配置
    await saveAdminConfig(adminConfig);

    console.log(`视频源订阅配置已保存: ${url}, 自动更新: ${autoUpdate}`);

    return NextResponse.json({
      success: true,
      message: '订阅配置保存成功',
    });
  } catch (error) {
    console.error('保存视频源订阅配置失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}
