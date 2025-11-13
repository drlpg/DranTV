/**
 * 密码加密工具
 * 使用 Node.js 内置 crypto 模块，无需额外依赖
 */

import crypto from 'crypto';

/**
 * 生成随机盐值
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 使用 PBKDF2 加密密码
 * @param password 明文密码
 * @param salt 盐值
 * @returns 加密后的密码
 */
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

/**
 * 加密密码（生成盐值并加密）
 * @param password 明文密码
 * @returns 格式：salt$hash
 */
export function encryptPassword(password: string): string {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  return `${salt}$${hash}`;
}

/**
 * 验证密码
 * @param password 明文密码
 * @param encrypted 加密后的密码（格式：salt$hash）
 * @returns 是否匹配
 */
export function verifyPassword(password: string, encrypted: string): boolean {
  try {
    const [salt, hash] = encrypted.split('$');
    if (!salt || !hash) return false;

    const newHash = hashPassword(password, salt);
    return hash === newHash;
  } catch (error) {
    return false;
  }
}

/**
 * 检查密码是否已加密
 * @param password 密码字符串
 * @returns 是否已加密（包含$分隔符）
 */
export function isEncrypted(password: string): boolean {
  return password.includes('$') && password.split('$').length === 2;
}

/**
 * 简单的加密解密工具（用于数据迁移）
 */
export class SimpleCrypto {
  /**
   * 加密数据
   * @param data 明文数据
   * @param password 密码
   * @returns 加密后的数据（格式：iv$encrypted）
   */
  static encrypt(data: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}$${encrypted}`;
  }

  /**
   * 解密数据
   * @param encryptedData 加密的数据（格式：iv$encrypted）
   * @param password 密码
   * @returns 明文数据
   */
  static decrypt(encryptedData: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);

    const [ivHex, encrypted] = encryptedData.split('$');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
