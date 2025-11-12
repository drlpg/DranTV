/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('[图片上传] 开始处理上传请求');

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    console.log('[图片上传] 错误: 不支持本地存储');
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    console.log('[图片上传] 认证信息:', authInfo ? '已认证' : '未认证');

    if (!authInfo || !authInfo.username) {
      console.log('[图片上传] 错误: 未授权');
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
    console.log(
      '[图片上传] 图床配置:',
      config.ImageHostingConfig ? '已配置' : '未配置'
    );
    if (!config.ImageHostingConfig) {
      console.log('[图片上传] 错误: 未配置图床');
      return NextResponse.json({ error: '未配置图床' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log(
      '[图片上传] 文件信息:',
      file ? `${file.name} (${file.size} bytes)` : '无文件'
    );

    if (!file) {
      console.log('[图片上传] 错误: 未上传文件');
      return NextResponse.json({ error: '未上传文件' }, { status: 400 });
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '只支持图片文件' }, { status: 400 });
    }

    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过5MB' },
        { status: 400 }
      );
    }

    const imageHostingConfig = config.ImageHostingConfig;

    // 目前只支持S3协议
    console.log('[图片上传] 图床类型:', imageHostingConfig.type);
    if (imageHostingConfig.type !== 'S3' || !imageHostingConfig.s3) {
      console.log('[图片上传] 错误: 不支持的图床类型');
      return NextResponse.json(
        { error: '暂不支持该图床类型，请配置S3协议图床' },
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
      console.log('[图片上传] 错误: S3配置不完整');
      return NextResponse.json(
        { error: 'S3配置不完整，请检查图床配置' },
        { status: 400 }
      );
    }

    // 生成文件名
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `carousel-${timestamp}`;

    // 替换路径格式中的变量
    const now = new Date();
    const pathFormat = s3Config.pathFormat || '{filename}.{extName}';
    const filePath = pathFormat
      .replace('{YEAR}', now.getFullYear().toString())
      .replace('{MONTH}', (now.getMonth() + 1).toString().padStart(2, '0'))
      .replace('{DAY}', now.getDate().toString().padStart(2, '0'))
      .replace('{filename}', filename)
      .replace('{extName}', ext);

    // 读取文件内容
    console.log('[图片上传] 开始读取文件内容...');
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('[图片上传] 文件读取完成，大小:', buffer.length);

    // AWS签名V4（Cloudflare R2要求）
    const endpoint = s3Config.endpoint.replace(/^https?:\/\//, '');
    const host = endpoint;
    const uploadUrl = `https://${host}/${s3Config.bucket}/${filePath}`;
    console.log('[图片上传] 上传URL:', uploadUrl);

    const contentType = file.type;
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // 计算payload hash
    const payloadHash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    // 构建规范请求（AWS签名V4格式）
    const canonicalUri = `/${s3Config.bucket}/${filePath}`;
    const canonicalQuerystring = '';
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // 构建待签名字符串
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${s3Config.region}/s3/aws4_request`;
    const canonicalRequestHash = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    // 计算签名（确保密钥没有多余空格）
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

    console.log('[图片上传] 开始上传到R2...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Host: host,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[图片上传] R2上传失败:', uploadResponse.status, errorText);
      return NextResponse.json(
        { error: `上传失败: ${uploadResponse.statusText}`, details: errorText },
        { status: 500 }
      );
    }

    console.log('[图片上传] R2上传成功');

    // 生成访问URL
    let url: string;
    if (s3Config.customDomain) {
      // 使用自定义域名
      url = s3Config.customDomain
        .replace('{YEAR}', now.getFullYear().toString())
        .replace('{MONTH}', (now.getMonth() + 1).toString().padStart(2, '0'))
        .replace('{DAY}', now.getDate().toString().padStart(2, '0'))
        .replace('{filename}', filename)
        .replace('{extName}', ext);
    } else {
      // 使用默认URL
      url = `${s3Config.endpoint}/${s3Config.bucket}/${filePath}`;
    }

    console.log('[图片上传] 上传成功:', url);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[图片上传] 上传失败:', error);
    return NextResponse.json(
      {
        error: '上传失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
