import { NextRequest, NextResponse } from 'next/server';

import { getTMDBBackdrops } from '@/lib/tmdb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const backdrops = await getTMDBBackdrops(items);

    return NextResponse.json({ backdrops });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('TMDB backdrop API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backdrops' },
      { status: 500 }
    );
  }
}
