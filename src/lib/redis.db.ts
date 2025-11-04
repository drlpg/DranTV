/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { BaseRedisStorage } from './redis-base.db';

export class RedisStorage extends BaseRedisStorage {
  constructor() {
    // 支持多种Redis配置方式
    let redisUrl = process.env.REDIS_URL;

    // 如果没有REDIS_URL，尝试使用Upstash配置
    if (!redisUrl && process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
      // 构建Upstash Redis URL
      const upstashUrl = process.env.UPSTASH_URL.replace(/^https?:\/\//, '');
      redisUrl = `rediss://:${process.env.UPSTASH_TOKEN}@${upstashUrl}`;
    }

    if (!redisUrl) {
      throw new Error(
        'Redis configuration not found. Please set REDIS_URL or UPSTASH_URL/UPSTASH_TOKEN'
      );
    }

    const config = {
      url: redisUrl,
      clientName: 'Redis',
    };
    const globalSymbol = Symbol.for('__DranTV_REDIS_CLIENT__');
    super(config, globalSymbol);
  }
}
