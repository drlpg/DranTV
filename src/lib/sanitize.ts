/**
 * HTML 清理工具
 * 防止 XSS 攻击，无需外部依赖
 */

/**
 * 允许的 HTML 标签
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'span',
  'div',
];

/**
 * 允许的属性
 */
const ALLOWED_ATTRS = ['class'];

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * 清理 HTML，移除危险标签和属性
 * @param html 原始 HTML
 * @returns 清理后的 HTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // 移除 script 标签及其内容
  html = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // 移除 style 标签及其内容
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 移除 iframe 标签
  html = html.replace(
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ''
  );

  // 移除事件处理器属性 (on*)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // 移除 javascript: 协议
  html = html.replace(/javascript:/gi, '');

  // 移除 data: 协议（可能包含恶意代码）
  html = html.replace(/data:text\/html/gi, '');

  // 清理标签
  html = html.replace(
    /<(\/?)([\w-]+)([^>]*)>/gi,
    (match, slash, tag, attrs) => {
      const tagLower = tag.toLowerCase();

      // 检查标签是否允许
      if (!ALLOWED_TAGS.includes(tagLower)) {
        return '';
      }

      // 清理属性
      if (attrs) {
        attrs = attrs.replace(
          /(\w+)\s*=\s*["']([^"']*)["']/g,
          (attrMatch: string, name: string, value: string) => {
            const nameLower = name.toLowerCase();
            if (ALLOWED_ATTRS.includes(nameLower)) {
              // 转义属性值
              const escapedValue = escapeHtml(value);
              return `${name}="${escapedValue}"`;
            }
            return '';
          }
        );
      }

      return `<${slash}${tag}${attrs}>`;
    }
  );

  return html;
}

/**
 * 简单的文本转 HTML（保留换行）
 * @param text 纯文本
 * @returns HTML
 */
export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
