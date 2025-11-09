import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const config = await getConfig();
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  const result = {
    SiteName: config.SiteConfig.SiteName,
    StorageType: storageType,
    Version: CURRENT_VERSION,
    RequireDeviceCode: config.SiteConfig.RequireDeviceCode ?? false,
    FluidSearch: config.SiteConfig.FluidSearch ?? true,
    DisableYellowFilter: config.SiteConfig.DisableYellowFilter ?? false,
  };

  return NextResponse.json(result);
}
