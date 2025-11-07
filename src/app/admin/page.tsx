/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Video,
  Tv,
  FolderOpen,
  Palette,
  Settings,
  Database,
} from 'lucide-react';

import { AdminConfig, AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import DataMigration from '@/components/DataMigration';
import PageLayout from '@/components/PageLayout';
import ThemeManager from '@/components/ThemeManager';

import { useAlertModal } from './hooks/useAlertModal';
import { useLoadingState } from './hooks/useLoadingState';
import { buttonStyles } from './utils/constants';
import { showError, showSuccess } from './utils/helpers';
import { CollapsibleTab } from './components/shared/CollapsibleTab';
import { AlertModal } from './components/modals/AlertModal';
import UserConfig from './components/UserConfig';
import VideoSourceConfig from './components/VideoSourceConfig';
import CategoryConfig from './components/CategoryConfig';
import SiteConfig from './components/SiteConfig';
import LiveSourceConfig from './components/LiveSourceConfig';

function AdminPageClient() {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [showResetConfigModal, setShowResetConfigModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [expandedTabs, setExpandedTabs] = useState<{ [key: string]: boolean }>({
    userConfig: false,
    videoSource: false,
    liveSource: false,
    siteConfig: false,
    categoryConfig: false,
    dataMigration: false,
    themeManager: false,
  });

  // 使用 ref 保存 showAlert，避免依赖变化
  const showAlertRef = useRef(showAlert);
  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const [machineCodeUsers, setMachineCodeUsers] = useState<
    Record<
      string,
      { machineCode: string; deviceInfo?: string; bindTime: number }
    >
  >({});

  const fetchMachineCodeUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/machine-code?action=list');
      if (response.ok) {
        const data = await response.json();
        setMachineCodeUsers(data.users || {});
      }
    } catch (error) {
      console.error('获取机器码用户列表失败:', error);
    }
  }, []);

  const fetchConfig = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await fetch(`/api/admin/config`);

      if (!response.ok) {
        const data = (await response.json()) as any;
        const errorMsg = data.error || '获取配置失败';

        // 显示友好的错误提示
        if (
          errorMsg.includes('数据库连接超时') ||
          errorMsg.includes('timeout')
        ) {
          showAlertRef.current({
            type: 'error',
            title: '连接超时',
            message: '数据库连接超时，请稍后重试',
            showConfirm: true,
          });
        } else {
          showAlertRef.current({
            type: 'error',
            title: '加载失败',
            message: errorMsg,
            showConfirm: true,
          });
        }

        setError(errorMsg);
        return;
      }

      const data = (await response.json()) as AdminConfigResult;
      setConfig(data.Config);
      setRole(data.Role);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取配置失败';

      // 网络错误或其他异常
      showAlertRef.current({
        type: 'error',
        title: '加载失败',
        message: msg.includes('fetch') ? '网络连接失败，请检查网络' : msg,
        showConfirm: true,
      });

      setError(msg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    // 检查权限
    const authInfo = getAuthInfoFromBrowserCookie();
    if (!authInfo || (authInfo.role !== 'owner' && authInfo.role !== 'admin')) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    setHasPermission(true);
    fetchConfig(true);

    const timer = setTimeout(() => {
      fetchMachineCodeUsers();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchConfig, fetchMachineCodeUsers]);

  const toggleTab = (tabKey: string) => {
    setExpandedTabs((prev) => ({
      ...prev,
      [tabKey]: !prev[tabKey],
    }));
  };

  const handleResetConfig = () => {
    setShowResetConfigModal(true);
  };

  const handleConfirmResetConfig = async () => {
    await withLoading('resetConfig', async () => {
      try {
        const response = await fetch(`/api/admin/reset`);
        if (!response.ok) {
          throw new Error(`重置失败: ${response.status}`);
        }
        showSuccess('配置已重置为默认值', showAlert);
        setShowResetConfigModal(false);
        await fetchConfig(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '重置失败';
        showError(msg, showAlert);
      }
    });
  };

  // 避免 hydration 错误，等待客户端挂载
  if (!mounted) {
    return (
      <PageLayout>
        <div className='container mx-auto px-8 py-8 max-w-7xl'>
          {/* 标题骨架 */}
          <div className='flex items-end gap-4 mb-8'>
            <div className='h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
            <div className='h-[30px] w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          </div>

          {/* 标签页骨架 */}
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className='rounded-xl mb-4 overflow-hidden bg-white/80 backdrop-blur-md dark:bg-gray-800/50'
            >
              <div className='px-6 py-4 bg-gray-50/70 dark:bg-gray-800/60'>
                <div className='flex items-center gap-3'>
                  <div className='w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
                  <div className='h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageLayout>
    );
  }

  if (!hasPermission) {
    return (
      <PageLayout>
        <div className='flex items-center justify-center min-h-screen'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4'>
              权限不足
            </h1>
            <p className='text-gray-600 dark:text-gray-400'>
              您没有权限访问此页面
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <div className='container mx-auto px-8 py-8 max-w-7xl'>
          {/* 标题骨架 */}
          <div className='flex items-end gap-4 mb-8'>
            <div className='h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
            <div className='h-[30px] w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          </div>

          {/* 标签页骨架 */}
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className='rounded-xl mb-4 overflow-hidden bg-white/80 backdrop-blur-md dark:bg-gray-800/50'
            >
              <div className='px-6 py-4 bg-gray-50/70 dark:bg-gray-800/60'>
                <div className='flex items-center gap-3'>
                  <div className='w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
                  <div className='h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageLayout>
    );
  }

  if (error) {
    const isTimeout = error.includes('超时') || error.includes('timeout');
    const isFetchError =
      error.includes('fetch') || error.includes('Failed to fetch');

    return (
      <PageLayout>
        <div className='flex items-center justify-center min-h-screen'>
          <div className='text-center max-w-md mx-auto px-4'>
            <div className='mb-6'>
              <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4'>
                <svg
                  className='w-8 h-8 text-red-600 dark:text-red-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  />
                </svg>
              </div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
                {isTimeout
                  ? '连接超时'
                  : isFetchError
                  ? '网络错误'
                  : '加载失败'}
              </h1>
              <p className='text-gray-600 dark:text-gray-400 mb-6'>
                {isTimeout
                  ? '数据库连接超时，请稍后重试'
                  : isFetchError
                  ? '网络连接失败，请检查网络连接'
                  : '无法加载管理配置'}
              </p>
            </div>
            <button
              onClick={() => {
                setError(null);
                fetchConfig(true);
              }}
              className={buttonStyles.primary}
            >
              重试
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className='container mx-auto px-8 py-8 max-w-7xl'>
        <div className='flex items-end gap-4 mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none'>
            管理后台
          </h1>
          <button
            onClick={handleResetConfig}
            className='px-3 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-colors h-[30px] flex items-center'
            title='重置所有配置为默认值'
          >
            重置配置
          </button>
        </div>

        <CollapsibleTab
          title='站点配置'
          icon={
            <Settings size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.siteConfig}
          onToggle={() => toggleTab('siteConfig')}
        >
          <SiteConfig
            config={config}
            refreshConfig={() => fetchConfig(false)}
          />
        </CollapsibleTab>

        <CollapsibleTab
          title='用户配置'
          icon={
            <Users size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.userConfig}
          onToggle={() => toggleTab('userConfig')}
        >
          <UserConfig
            config={config}
            role={role}
            refreshConfig={() => fetchConfig(false)}
            machineCodeUsers={machineCodeUsers}
            fetchMachineCodeUsers={fetchMachineCodeUsers}
          />
        </CollapsibleTab>

        <CollapsibleTab
          title='视频源配置'
          icon={
            <Video size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.videoSource}
          onToggle={() => toggleTab('videoSource')}
        >
          <VideoSourceConfig
            config={config}
            refreshConfig={() => fetchConfig(false)}
          />
        </CollapsibleTab>

        <CollapsibleTab
          title='直播源配置'
          icon={<Tv size={20} className='text-gray-600 dark:text-gray-400' />}
          isExpanded={expandedTabs.liveSource}
          onToggle={() => toggleTab('liveSource')}
        >
          <LiveSourceConfig
            config={config}
            refreshConfig={() => fetchConfig(false)}
          />
        </CollapsibleTab>

        <CollapsibleTab
          title='自定义分类'
          icon={
            <FolderOpen
              size={20}
              className='text-gray-600 dark:text-gray-400'
            />
          }
          isExpanded={expandedTabs.categoryConfig}
          onToggle={() => toggleTab('categoryConfig')}
        >
          <CategoryConfig
            config={config}
            refreshConfig={() => fetchConfig(false)}
          />
        </CollapsibleTab>

        <CollapsibleTab
          title='主题配置'
          icon={
            <Palette size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.themeManager}
          onToggle={() => toggleTab('themeManager')}
        >
          <ThemeManager showAlert={showAlert} role={role} />
        </CollapsibleTab>

        <CollapsibleTab
          title='数据迁移'
          icon={
            <Database size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.dataMigration}
          onToggle={() => toggleTab('dataMigration')}
        >
          <DataMigration />
        </CollapsibleTab>

        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={hideAlert}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          timer={alertModal.timer}
          showConfirm={alertModal.showConfirm}
        />

        {showResetConfigModal &&
          createPortal(
            <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
              <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
                  确认重置配置
                </h3>
                <p className='text-gray-600 dark:text-gray-400 mb-6'>
                  此操作将重置所有配置为默认值，包括用户、视频源、直播源等。此操作不可撤销，确定要继续吗？
                </p>
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    disabled={isLoading('resetConfig')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('resetConfig')
                        ? buttonStyles.disabled
                        : buttonStyles.secondary
                    }`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmResetConfig}
                    disabled={isLoading('resetConfig')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('resetConfig')
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }`}
                  >
                    {isLoading('resetConfig') ? '重置中...' : '确认重置'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </PageLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageClient />
    </Suspense>
  );
}
