/* eslint-disable no-console */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Check DB] ========== 开始检查数据库 ==========');
  log('[Check DB] 时间: ' + new Date().toISOString());

  try {
    // 直接从数据库获取配置
    log('[Check DB] 从数据库获取配置...');
    const dbConfig = await db.getAdminConfig();

    if (!dbConfig) {
      log('[Check DB] ❌ 数据库配置为null');
      return NextResponse.json({
        success: false,
        error: '数据库配置为null',
        logs: logs,
      });
    }

    log('[Check DB] ✅ 数据库配置获取成功');
    log('[Check DB] --- 配置摘要 ---');
    log('[Check DB] SourceConfig数量: ' + (dbConfig.SourceConfig?.length || 0));
    log('[Check DB] LiveConfig数量: ' + (dbConfig.LiveConfig?.length || 0));
    log(
      '[Check DB] ConfigFile长度: ' +
        (dbConfig.ConfigFile?.length || 0) +
        ' 字符'
    );

    // 显示 LiveConfig 详情
    if (dbConfig.LiveConfig && dbConfig.LiveConfig.length > 0) {
      log('[Check DB] --- LiveConfig详情 ---');
      dbConfig.LiveConfig.forEach((source, index) => {
        log(
          `[Check DB] ${index + 1}. ${source.name} (${
            source.key
          }) - disabled: ${source.disabled || false}`
        );
      });
    } else {
      log('[Check DB] ⚠️ LiveConfig为空');
    }

    // 显示 ConfigFile 前500字符
    if (dbConfig.ConfigFile && dbConfig.ConfigFile.length > 0) {
      log('[Check DB] --- ConfigFile内容（前500字符）---');
      log('[Check DB] ' + dbConfig.ConfigFile.substring(0, 500));
    } else {
      log('[Check DB] ⚠️ ConfigFile为空');
    }

    log('[Check DB] 检查完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Check DB] ========== 检查结束 ==========');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      logs: logs,
      summary: {
        sourceCount: dbConfig.SourceConfig?.length || 0,
        liveSourceCount: dbConfig.LiveConfig?.length || 0,
        configFileLength: dbConfig.ConfigFile?.length || 0,
        liveSources:
          dbConfig.LiveConfig?.map((s) => ({
            key: s.key,
            name: s.name,
            url: s.url,
            disabled: s.disabled || false,
          })) || [],
        configFilePreview: dbConfig.ConfigFile?.substring(0, 500) || '',
      },
    });
  } catch (error) {
    log(
      '[Check DB] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Check DB] 错误堆栈: ' + error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        logs: logs,
      },
      { status: 500 }
    );
  }
}
