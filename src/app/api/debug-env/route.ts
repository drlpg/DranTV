import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    DOCKER_ENV: process.env.DOCKER_ENV,
    PASSWORD: process.env.PASSWORD ? '***' : undefined,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
      ? '***'
      : undefined,
    // 列出所有 NEXT_PUBLIC_ 开头的变量
    allNextPublic: Object.keys(process.env)
      .filter((key) => key.startsWith('NEXT_PUBLIC_'))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {} as Record<string, string | undefined>),
    // 列出所有环境变量的键（不显示值）
    allEnvKeys: Object.keys(process.env).sort(),
  };

  return NextResponse.json(envVars);
}
