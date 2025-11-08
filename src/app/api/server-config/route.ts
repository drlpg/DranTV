/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const config = await getConfig();
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  console.log('[Server Config API] NEXT_PUBLIC_STORAGE_TYPE:', storageType);

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
