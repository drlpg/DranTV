/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const config = await getConfig();
  // 优先使用 STORAGE_TYPE（运行时），其次使用 NEXT_PUBLIC_STORAGE_TYPE（构建时）
  const storageType =
    process.env.STORAGE_TYPE ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE ||
    'localstorage';

  console.log('[Server Config API] STORAGE_TYPE:', process.env.STORAGE_TYPE);
  console.log(
    '[Server Config API] NEXT_PUBLIC_STORAGE_TYPE:',
    process.env.NEXT_PUBLIC_STORAGE_TYPE
  );
  console.log('[Server Config API] 最终使用:', storageType);

  const result = {
    SiteName: config.SiteConfig.SiteName,
    StorageType: storageType,
    Version: CURRENT_VERSION,
    RequireDeviceCode: config.SiteConfig.RequireDeviceCode ?? false,
    FluidSearch: config.SiteConfig.FluidSearch ?? true,
    DisableYellowFilter: config.SiteConfig.DisableYellowFilter ?? false,
  };

  console.log('[Server Config API] 返回配置:', result);

  return NextResponse.json(result);
}
