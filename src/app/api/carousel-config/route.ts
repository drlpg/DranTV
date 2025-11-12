/* eslint-disable no-console */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getConfig();

    const carouselConfig = config.CarouselConfig || {
      mode: 'default',
      autoPlayInterval: 10000,
      maxItems: 5,
      customItems: [],
    };

    return NextResponse.json(carouselConfig);
  } catch (error) {
    console.error('[轮播图配置] 获取失败:', error);
    return NextResponse.json(
      {
        mode: 'default',
        autoPlayInterval: 10000,
        maxItems: 5,
        customItems: [],
      },
      { status: 200 }
    );
  }
}
