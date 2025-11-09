import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    DOCKER_ENV: process.env.DOCKER_ENV,
    // 列出所有 NEXT_PUBLIC_ 开头的变量
    allNextPublic: Object.keys(process.env)
      .filter((key) => key.startsWith('NEXT_PUBLIC_'))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {} as Record<string, string | undefined>),
  };

  return NextResponse.json(envVars);
}
