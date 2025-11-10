/* eslint-disable no-console */

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Check Redis] ========== 开始检查 Redis ==========');
  log('[Check Redis] 时间: ' + new Date().toISOString());

  try {
    // 检查环境变量
    log('[Check Redis] --- 环境变量检查 ---');
    log(
      '[Check Redis] UPSTASH_REDIS_REST_URL: ' +
        (process.env.UPSTASH_REDIS_REST_URL ? '已设置' : '未设置')
    );
    log(
      '[Check Redis] UPSTASH_REDIS_REST_TOKEN: ' +
        (process.env.UPSTASH_REDIS_REST_TOKEN ? '已设置' : '未设置')
    );
    log(
      '[Check Redis] NEXT_PUBLIC_STORAGE_TYPE: ' +
        (process.env.NEXT_PUBLIC_STORAGE_TYPE || '未设置')
    );

    const upstashUrl =
      process.env.UPSTASH_URL || process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken =
      process.env.UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      log('[Check Redis] ❌ Upstash Redis 环境变量未配置');
      return NextResponse.json({
        success: false,
        error: 'Upstash Redis 环境变量未配置',
        logs: logs,
      });
    }

    // 创建 Redis 客户端
    log('[Check Redis] 创建 Redis 客户端...');
    const redis = new Redis({
      url: process.env.UPSTASH_URL || process.env.UPSTASH_REDIS_REST_URL || '',
      token:
        process.env.UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });

    // 检查 admin:config 键（注意是冒号，不是下划线）
    log('[Check Redis] --- 检查 admin:config 键 ---');
    const adminConfigKey = 'admin:config';

    // 检查键是否存在
    log('[Check Redis] 检查键是否存在: ' + adminConfigKey);
    const exists = await redis.exists(adminConfigKey);
    log('[Check Redis] 键存在: ' + (exists ? '是' : '否'));

    if (!exists) {
      log('[Check Redis] ⚠️ admin:config 键不存在');

      // 列出所有键
      log('[Check Redis] 列出所有键...');
      const keys = await redis.keys('*');
      log('[Check Redis] 数据库中的所有键: ' + JSON.stringify(keys));

      return NextResponse.json({
        success: true,
        keyExists: false,
        allKeys: keys,
        logs: logs,
        duration: Date.now() - startTime,
      });
    }

    // 获取键的值
    log('[Check Redis] 获取键的值...');
    const value = await redis.get(adminConfigKey);
    log('[Check Redis] 值类型: ' + typeof value);

    if (!value) {
      log('[Check Redis] ⚠️ 键的值为 null 或 undefined');
      return NextResponse.json({
        success: true,
        keyExists: true,
        valueIsNull: true,
        logs: logs,
        duration: Date.now() - startTime,
      });
    }

    // 解析值
    let parsedValue: any;
    if (typeof value === 'string') {
      log('[Check Redis] 值是字符串，长度: ' + value.length);
      try {
        parsedValue = JSON.parse(value);
        log('[Check Redis] ✅ 成功解析为 JSON');
      } catch (e) {
        log('[Check Redis] ❌ 无法解析为 JSON');
        parsedValue = value;
      }
    } else {
      log('[Check Redis] 值是对象');
      parsedValue = value;
    }

    // 分析配置内容
    log('[Check Redis] --- 配置内容分析 ---');
    if (parsedValue && typeof parsedValue === 'object') {
      log(
        '[Check Redis] ConfigFile长度: ' +
          (parsedValue.ConfigFile?.length || 0) +
          ' 字符'
      );
      log(
        '[Check Redis] SourceConfig数量: ' +
          (parsedValue.SourceConfig?.length || 0)
      );
      log(
        '[Check Redis] LiveConfig数量: ' + (parsedValue.LiveConfig?.length || 0)
      );
      log(
        '[Check Redis] CustomCategories数量: ' +
          (parsedValue.CustomCategories?.length || 0)
      );

      if (parsedValue.LiveConfig && parsedValue.LiveConfig.length > 0) {
        log('[Check Redis] LiveConfig详情:');
        parsedValue.LiveConfig.forEach((source: any, index: number) => {
          log(
            `[Check Redis]   ${index + 1}. ${source.name} (${
              source.key
            }) - disabled: ${source.disabled || false}`
          );
        });
      }

      if (parsedValue.ConfigFile && parsedValue.ConfigFile.length > 0) {
        log(
          '[Check Redis] ConfigFile前500字符: ' +
            parsedValue.ConfigFile.substring(0, 500)
        );
      }
    } else {
      log('[Check Redis] ⚠️ 配置值不是对象: ' + JSON.stringify(parsedValue));
    }

    log('[Check Redis] 检查完成，总耗时: ' + (Date.now() - startTime) + 'ms');
    log('[Check Redis] ========== 检查结束 ==========');

    return NextResponse.json({
      success: true,
      keyExists: true,
      valueIsNull: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      logs: logs,
      summary: {
        configFileLength: parsedValue?.ConfigFile?.length || 0,
        sourceCount: parsedValue?.SourceConfig?.length || 0,
        liveSourceCount: parsedValue?.LiveConfig?.length || 0,
        customCategoriesCount: parsedValue?.CustomCategories?.length || 0,
        liveSources:
          parsedValue?.LiveConfig?.map((s: any) => ({
            key: s.key,
            name: s.name,
            disabled: s.disabled || false,
          })) || [],
        configFilePreview: parsedValue?.ConfigFile?.substring(0, 500) || '',
      },
    });
  } catch (error) {
    log(
      '[Check Redis] ❌ 发生错误: ' +
        (error instanceof Error ? error.message : String(error))
    );
    if (error instanceof Error && error.stack) {
      log('[Check Redis] 错误堆栈: ' + error.stack);
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
