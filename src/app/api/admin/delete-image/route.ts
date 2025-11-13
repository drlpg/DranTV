/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  console.log('[图片删除] 开始处理删除请求');

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    console.log('[图片删除] 错误: 不支持本地存储');
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    console.log('[图片删除] 认证信息:', authInfo ? '已认证' : '未认证');

    if (!authInfo || !authInfo.username) {
      console.log('[图片删除] 错误: 未授权');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    // 获取当前配置
    const config = await getConfig();

    // 检查权限
    if (username !== process.env.LOGIN_USERNAME) {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (
        !user ||
        (user.role !== 'admin' && user.role !== 'owner') ||
        user.banned
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 检查图床配置
    if (!config.ImageHostingConfig) {
      console.log('[图片删除] 错误: 未配置图床');
      return NextResponse.json({ error: '未配置图床' }, { status: 400 });
    }

    const { url } = await request.json();

    if (!url) {
      console.log('[图片删除] 错误: 未提供图片URL');
      return NextResponse.json({ error: '未提供图片URL' }, { status: 400 });
    }

    const imageHostingConfig = config.ImageHostingConfig;

    // 目前只支持S3协议
    if (imageHostingConfig.type !== 'S3' || !imageHostingConfig.s3) {
      console.log('[图片删除] 错误: 不支持的图床类型');
      return NextResponse.json(
        { error: '暂不支持该图床类型' },
        { status: 400 }
      );
    }

    const s3Config = imageHostingConfig.s3;

    // 验证S3配置完整性
    if (
      !s3Config.endpoint ||
      !s3Config.bucket ||
      !s3Config.region ||
      !s3Config.accessKeyId ||
      !s3Config.secretAccessKey
    ) {
      console.log('[图片删除] 错误: S3配置不完整');
      return NextResponse.json(
        { error: 'S3配置不完整，请检查图床配置' },
        { status: 400 }
      );
    }

    // 从URL中提取文件路径
    let filePath: string;
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // 移除开头的 /bucket/ 部分
      const parts = pathname.split('/').filter((p) => p);
      if (parts[0] === s3Config.bucket) {
        filePath = parts.slice(1).join('/');
      } else {
        filePath = parts.join('/');
      }
      console.log('[图片删除] 文件路径:', filePath);
    } catch (error) {
      console.error('[图片删除] URL解析失败:', error);
      return NextResponse.json({ error: 'URL格式错误' }, { status: 400 });
    }

    // AWS签名V4（Cloudflare R2要求）
    const endpoint = s3Config.endpoint.replace(/^https?:\/\//, '');
    const host = endpoint;
    const deleteUrl = `https://${host}/${s3Config.bucket}/${filePath}`;
    console.log('[图片删除] 删除URL:', deleteUrl);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // 构建规范请求（AWS签名V4格式）
    const canonicalUri = `/${s3Config.bucket}/${filePath}`;
    const canonicalQuerystring = '';
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');
    const canonicalRequest = `DELETE\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // 构建待签名字符串
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${s3Config.region}/s3/aws4_request`;
    const canonicalRequestHash = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    // 计算签名
    const secretKey = s3Config.secretAccessKey.trim();
    const kDate = crypto
      .createHmac('sha256', `AWS4${secretKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto
      .createHmac('sha256', kDate)
      .update(s3Config.region)
      .digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto
      .createHmac('sha256', kService)
      .update('aws4_request')
      .digest();
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    const authorization = `${algorithm} Credential=${s3Config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    console.log('[图片删除] 开始从R2删除...');
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Host: host,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      console.error('[图片删除] R2删除失败:', deleteResponse.status, errorText);
      return NextResponse.json(
        {
          error: `删除失败: ${deleteResponse.statusText}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    console.log('[图片删除] R2删除成功');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[图片删除] 删除失败:', error);
    return NextResponse.json(
      {
        error: '删除失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
