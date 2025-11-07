// 管理后台工具函数

import { AlertConfig } from '../types';

// 统一弹窗方法
export const showError = (
  message: string,
  showAlert?: (config: AlertConfig) => void
) => {
  if (showAlert) {
    showAlert({ type: 'error', title: '错误', message, showConfirm: true });
  } else {
    alert(message);
  }
};

export const showSuccess = (
  message: string,
  showAlert?: (config: AlertConfig) => void
) => {
  if (showAlert) {
    showAlert({ type: 'success', title: '成功', message, timer: 2000 });
  } else {
    alert(message);
  }
};

// 获取用户头像
export const getUserAvatar = async (
  username: string
): Promise<string | null> => {
  try {
    const response = await fetch(`/api/avatar?username=${username}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      return data.avatar || null;
    }
    return null;
  } catch {
    return null;
  }
};
