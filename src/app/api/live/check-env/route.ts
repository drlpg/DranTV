/* eslint-disable no-console */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const logs: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  log('[Check Env] ========== 检查环境变量 ==========');
  log('[Check Env] 时间: ' + new Date().toISOString());

  // 检查存储类型
  log('[Check Env] --- 存储配置 ---');
  log(
    '[Check Env] NEXT_PUBLIC_STORAGE_TYPE: ' +
      (process.env.NEXT_PUBLIC_STORAGE_TYPE || '未设置')
  );

  // 检查 Upstash 环境变量（两种可能的命名）
  log('[Check Env] --- Upstash 配置 (方式1) ---');
  log(
    '[Check Env] UPSTASH_URL: ' +
      (process.env.UPSTASH_URL
        ? '已设置 (' + process.env.UPSTASH_URL.substring(0, 30) + '...)'
        : '未设置')
  );
  log(
    '[Check Env] UPSTASH_TOKEN: ' +
      (process.env.UPSTASH_TOKEN
        ? '已设置 (长度: ' + process.env.UPSTASH_TOKEN.length + ')'
        : '未设置')
  );

  log('[Check Env] --- Upstash 配置 (方式2) ---');
  log(
    '[Check Env] UPSTASH_REDIS_REST_URL: ' +
      (process.env.UPSTASH_REDIS_REST_URL
        ? '已设置 (' +
          process.env.UPSTASH_REDIS_REST_URL.substring(0, 30) +
          '...)'
        : '未设置')
  );
  log(
    '[Check Env] UPSTASH_REDIS_REST_TOKEN: ' +
      (process.env.UPSTASH_REDIS_REST_TOKEN
        ? '已设置 (长度: ' + process.env.UPSTASH_REDIS_REST_TOKEN.length + ')'
        : '未设置')
  );

  // 判断使用哪种配置
  let usingConfig = 'none';
  if (process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
    usingConfig = 'UPSTASH_URL + UPSTASH_TOKEN';
  } else if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    usingConfig =
      'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (需要修改代码)';
  }

  log('[Check Env] --- 结论 ---');
  log('[Check Env] 当前使用的配置: ' + usingConfig);

  if (usingConfig === 'none') {
    log('[Check Env] ❌ 没有找到有效的 Upstash 配置！');
  } else if (usingConfig.includes('需要修改代码')) {
    log(
      '[Check Env] ⚠️ 环境变量使用了 UPSTASH_REDIS_REST_* 格式，但代码期望 UPSTASH_* 格式'
    );
    log('[Check Env] 建议: 修改环境变量或修改代码以匹配');
  } else {
    log('[Check Env] ✅ 配置正确');
  }

  log('[Check Env] ========== 检查结束 ==========');

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    logs: logs,
    config: {
      storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'not set',
      hasUpstashUrl: !!process.env.UPSTASH_URL,
      hasUpstashToken: !!process.env.UPSTASH_TOKEN,
      hasUpstashRedisRestUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashRedisRestToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      usingConfig,
    },
  });
}
