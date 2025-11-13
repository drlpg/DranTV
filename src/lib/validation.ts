/**
 * 输入验证工具
 * 无需外部依赖的简单验证
 */

export interface ValidationResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * 验证用户名
 * - 长度：3-20 个字符
 * - 字符：字母、数字、下划线
 */
export function validateUsername(username: unknown): ValidationResult {
  if (typeof username !== 'string') {
    return { success: false, error: '用户名必须是字符串' };
  }

  if (username.length < 3) {
    return { success: false, error: '用户名至少3个字符' };
  }

  if (username.length > 20) {
    return { success: false, error: '用户名最多20个字符' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { success: false, error: '用户名只能包含字母、数字和下划线' };
  }

  return { success: true, data: username };
}

/**
 * 验证密码
 * - 长度：6-100 个字符
 */
export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== 'string') {
    return { success: false, error: '密码必须是字符串' };
  }

  if (password.length < 6) {
    return { success: false, error: '密码至少6个字符' };
  }

  if (password.length > 100) {
    return { success: false, error: '密码最多100个字符' };
  }

  return { success: true, data: password };
}

/**
 * 验证登录请求
 */
export function validateLoginRequest(body: any): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { success: false, error: '请求体格式错误' };
  }

  const usernameResult = validateUsername(body.username);
  if (!usernameResult.success) {
    return usernameResult;
  }

  // 登录时密码只需非空
  if (!body.password || typeof body.password !== 'string') {
    return { success: false, error: '密码不能为空' };
  }

  return {
    success: true,
    data: {
      username: usernameResult.data,
      password: body.password,
    },
  };
}

/**
 * 验证注册请求
 */
export function validateRegisterRequest(body: any): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { success: false, error: '请求体格式错误' };
  }

  const usernameResult = validateUsername(body.username);
  if (!usernameResult.success) {
    return usernameResult;
  }

  const passwordResult = validatePassword(body.password);
  if (!passwordResult.success) {
    return passwordResult;
  }

  return {
    success: true,
    data: {
      username: usernameResult.data,
      password: passwordResult.data,
    },
  };
}

/**
 * 验证修改密码请求
 */
export function validateChangePasswordRequest(body: any): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { success: false, error: '请求体格式错误' };
  }

  // 验证旧密码
  if (!body.oldPassword || typeof body.oldPassword !== 'string') {
    return { success: false, error: '旧密码不能为空' };
  }

  // 验证新密码
  const newPasswordResult = validatePassword(body.newPassword);
  if (!newPasswordResult.success) {
    return newPasswordResult;
  }

  return {
    success: true,
    data: {
      oldPassword: body.oldPassword,
      newPassword: newPasswordResult.data,
    },
  };
}
