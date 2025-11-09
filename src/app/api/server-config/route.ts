import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const config = await getConfig();

  // 调试：输出环境变量（使用 error 避免被移除）
  console.error('[Server Config] STORAGE_TYPE:', process.env.STORAGE_TYPE);
  console.error(
    '[Server Config] NEXT_PUBLIC_STORAGE_TYPE:',
    process.env.NEXT_PUBLIC_STORAGE_TYPE
  );

  const storageType =
    process.env.STORAGE_TYPE ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE ||
    'localstorage';

  const result = {
    SiteName: config.SiteConfig.SiteName,
    StorageType: storageType,
    Version: CURRENT_VERSION,
    RequireDeviceCode: config.SiteConfig.RequireDeviceCode ?? false,
    FluidSearch: config.SiteConfig.FluidSearch ?? true,
    DisableYellowFilter: config.SiteConfig.DisableYellowFilter ?? false,
    // 调试信息
    _debug: {
      env_STORAGE_TYPE: process.env.STORAGE_TYPE || 'undefined',
      env_NEXT_PUBLIC_STORAGE_TYPE:
        process.env.NEXT_PUBLIC_STORAGE_TYPE || 'undefined',
    },
  };

  return NextResponse.json(result);
}
