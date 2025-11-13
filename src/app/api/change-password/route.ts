/* eslint-disable no-console*/

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { validatePassword } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // 不支持 localstorage 模式
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储模式修改密码',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { newPassword } = body;

    // 获取认证信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 输入验证
    const validationResult = validatePassword(newPassword);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    const username = authInfo.username;

    // 不允许站长修改密码（站长用户名等于 process.env.LOGIN_USERNAME）
    if (username === process.env.LOGIN_USERNAME) {
      return NextResponse.json(
        { error: '站长不能通过此接口修改密码' },
        { status: 403 }
      );
    }

    // 修改密码
    await db.changePassword(username, newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      {
        error: '修改密码失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
