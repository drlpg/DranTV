/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setCachedConfig, refineConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Fix Config] ========== 开始修复配置 ==========');
  log('[Fix Config] 时间: ' + new Date().toISOString());

  try {
    // 1. 获取当前数据库配置
    log('[Fix Config] 获取当前数据库配置...');
    const currentConfig = await db.getAdminConfig();

    if (!currentConfig) {
      log('[Fix Config] ❌ 数据库配置为null，无法修复');
      return NextResponse.json(
        {
          success: false,
          error: '数据库配置为null',
          logs: logs,
        },
        { status: 500 }
      );
    }

    log('[Fix Config] 当前配置状态:');
    log(
      '[Fix Config]   - SourceConfig: ' +
        (currentConfig.SourceConfig?.length || 0)
    );
    log(
      '[Fix Config]   - LiveConfig: ' + (currentConfig.LiveConfig?.length || 0)
    );
    log(
      '[Fix Config]   - ConfigFile长度: ' +
        (currentConfig.ConfigFile?.length || 0)
    );

    // 2. 检查ConfigFile是否有内容
    if (!currentConfig.ConfigFile || currentConfig.ConfigFile.trim() === '') {
      log('[Fix Config] ⚠️ ConfigFile为空，无法从中恢复配置');
      return NextResponse.json({
        success: false,
        error: 'ConfigFile为空，无法恢复配置',
        logs: logs,
        suggestion: '请在管理后台重新添加直播源配置',
      });
    }

    // 3. 尝试从ConfigFile恢复配置
    log('[Fix Config] 尝试从ConfigFile恢复配置...');
    const refinedConfig = refineConfig(currentConfig);

    log('[Fix Config] 恢复后的配置:');
    log(
      '[Fix Config]   - SourceConfig: ' +
        (refinedConfig.SourceConfig?.length || 0)
    );
    log(
      '[Fix Config]   - LiveConfig: ' + (refinedConfig.LiveConfig?.length || 0)
    );

    if (refinedConfig.LiveConfig && refinedConfig.LiveConfig.length > 0) {
      log(
        '[Fix Config] ✅ 成功恢复 ' +
          refinedConfig.LiveConfig.length +
          ' 个直播源'
      );
      log('[Fix Config] 直播源列表:');
      refinedConfig.LiveConfig.forEach((source, index) => {
        log(`[Fix Config]   ${index + 1}. ${source.name} (${source.key})`);
      });

      // 4. 保存恢复的配置
      log('[Fix Config] 保存恢复的配置到数据库...');
      await db.saveAdminConfig(refinedConfig);
      log('[Fix Config] ✅ 配置已保存');

      // 5. 更新缓存（不清空，直接更新）
      log('[Fix Config] 更新缓存...');
      setCachedConfig(refinedConfig);
      log('[Fix Config] ✅ 缓存已更新');

      log('[Fix Config] 修复完成，总耗时: ' + (Date.now() - startTime) + 'ms');
      log('[Fix Config] ========== 修复结束 ==========');

      return NextResponse.json({
        success: true,
        message: '配置已成功恢复',
        recoveredLiveSources: refinedConfig.LiveConfig.length,
        liveSources: refinedConfig.LiveConfig.map((s) => ({
          key: s.key,
          name: s.name,
          disabled: s.disabled || false,
        })),
        logs: logs,
        duration: Date.now() - startTime,
      });
    } else {
      log('[Fix Config] ❌ ConfigFile中没有直播源配置');
      return NextResponse.json({
        success: false,
        error: 'ConfigFile中没有直播源配置',
        logs: logs,
        suggestion: '请在管理后台添加直播源配置',
      });
    }
  } catch (error) {
    log(
      '[Fix Config] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Fix Config] 错误堆栈: ' + error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        logs: logs,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
