// 管理后台共享类型定义

import { AdminConfig } from '@/lib/admin.types';

export type { AdminConfig };

// 站点配置类型
export interface SiteConfig {
  SiteName: string;
  Announcement: string;
  SearchDownstreamMaxPage: number;
  SiteInterfaceCacheTime: number;
  DoubanProxyType: string;
  DoubanProxy: string;
  DoubanImageProxyType: string;
  DoubanImageProxy: string;
  DisableYellowFilter: boolean;
  FluidSearch: boolean;
  RequireDeviceCode: boolean;
}

// 视频源数据类型
export interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from: 'config' | 'custom' | 'subscription';
}

// 直播源数据类型
export interface LiveDataSource {
  name: string;
  key: string;
  url: string;
  ua?: string;
  epg?: string;
  channelNumber?: number;
  disabled?: boolean;
  from: 'config' | 'custom' | 'subscription';
}

// 自定义分类数据类型
export interface CustomCategory {
  name?: string;
  type: 'movie' | 'tv';
  query: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 频道数据类型
export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

// 组件 Props 类型
export interface BaseConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refreshConfig: () => Promise<void>;
  showAlert: (config: AlertConfig) => void;
  isLoading: (key: string) => boolean;
  withLoading: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
}

export interface AlertConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  showConfirm?: boolean;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  timer?: number;
}
