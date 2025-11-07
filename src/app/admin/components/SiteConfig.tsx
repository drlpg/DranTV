'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, ExternalLink, Settings } from 'lucide-react';
import { AdminConfig, SiteConfig as SiteConfigType } from '../types';
import { buttonStyles } from '../utils/constants';
import { showError, showSuccess } from '../utils/helpers';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { AlertModal } from './modals/AlertModal';

const SiteConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [siteSettings, setSiteSettings] = useState<SiteConfigType>({
    SiteName: '',
    Announcement: '',
    SearchDownstreamMaxPage: 5,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'cmliussss-cdn-tencent',
    DoubanProxy: '',
    DoubanImageProxyType: 'cmliussss-cdn-tencent',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    RequireDeviceCode: false,
  });

  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);

  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  useEffect(() => {
    if (config?.SiteConfig) {
      setSiteSettings(config.SiteConfig);
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveSiteConfig', async () => {
      try {
        const response = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteConfig: siteSettings }),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }

        showSuccess('站点配置已保存', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
      }
    });
  };

  return (
    <div className='space-y-6'>
      {/* 两行两列布局 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 第一栏：基本信息 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
              <Settings className='w-4 h-4 text-blue-600 dark:text-blue-400' />
            </div>
            <div>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                基本信息
              </h3>
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                站点名称
              </label>
              <input
                type='text'
                value={siteSettings.SiteName}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    SiteName: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                placeholder='DranTV'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                站点公告
              </label>
              <textarea
                value={siteSettings.Announcement}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    Announcement: e.target.value,
                  }))
                }
                rows={4}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none'
                placeholder='本网站仅提供影视信息搜索服务...'
              />
            </div>
          </div>
        </div>

        {/* 第二栏：豆瓣数据代理 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center'>
              <ExternalLink className='w-4 h-4 text-green-600 dark:text-green-400' />
            </div>
            <div>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                豆瓣数据代理
              </h3>
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣数据代理
              </label>
              <div className='relative'>
                <button
                  onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between'
                >
                  <span>
                    {doubanDataSourceOptions.find(
                      (opt) => opt.value === siteSettings.DoubanProxyType
                    )?.label || '选择代理类型'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${
                      isDoubanDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isDoubanDropdownOpen && (
                  <div className='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                    {doubanDataSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSiteSettings((prev) => ({
                            ...prev,
                            DoubanProxyType: option.value,
                          }));
                          setIsDoubanDropdownOpen(false);
                        }}
                        className='w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between'
                      >
                        <span className='text-gray-900 dark:text-gray-100'>
                          {option.label}
                        </span>
                        {siteSettings.DoubanProxyType === option.value && (
                          <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className='mt-1 flex items-center justify-between'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  选择获取豆瓣数据的方式
                </p>
                {siteSettings.DoubanProxyType === 'cmliussss-cdn-tencent' && (
                  <a
                    href='https://github.com/CMLiussss'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline'
                  >
                    Thanks to @CMLiussss
                    <ExternalLink className='w-3.5 opacity-70' />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣图片代理
              </label>
              <div className='relative'>
                <button
                  onClick={() =>
                    setIsDoubanImageProxyDropdownOpen(
                      !isDoubanImageProxyDropdownOpen
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between'
                >
                  <span>
                    {doubanDataSourceOptions.find(
                      (opt) => opt.value === siteSettings.DoubanImageProxyType
                    )?.label || '选择代理类型'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${
                      isDoubanImageProxyDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isDoubanImageProxyDropdownOpen && (
                  <div className='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                    {doubanDataSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSiteSettings((prev) => ({
                            ...prev,
                            DoubanImageProxyType: option.value,
                          }));
                          setIsDoubanImageProxyDropdownOpen(false);
                        }}
                        className='w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between'
                      >
                        <span className='text-gray-900 dark:text-gray-100'>
                          {option.label}
                        </span>
                        {siteSettings.DoubanImageProxyType === option.value && (
                          <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className='mt-1 flex items-center justify-between'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  选择获取豆瓣图片的方式
                </p>
                {siteSettings.DoubanImageProxyType ===
                  'cmliussss-cdn-tencent' && (
                  <a
                    href='https://github.com/CMLiussss'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline'
                  >
                    Thanks to @CMLiussss
                    <ExternalLink className='w-3.5 opacity-70' />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 第三栏：接口配置 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center'>
              <Settings className='w-4 h-4 text-purple-600 dark:text-purple-400' />
            </div>
            <div>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                接口配置
              </h3>
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                搜索接口可取最大页数
              </label>
              <input
                type='number'
                value={siteSettings.SearchDownstreamMaxPage}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    SearchDownstreamMaxPage: parseInt(e.target.value) || 1,
                  }))
                }
                min='1'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                站点接口缓存时间（秒）
              </label>
              <input
                type='number'
                value={siteSettings.SiteInterfaceCacheTime}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    SiteInterfaceCacheTime: parseInt(e.target.value) || 0,
                  }))
                }
                min='0'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
        </div>

        {/* 第四栏：功能开关 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center'>
              <Check className='w-4 h-4 text-orange-600 dark:text-orange-400' />
            </div>
            <div>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>
                功能开关
              </h3>
            </div>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-4'>
              <div className='flex-1 max-w-[calc(100%-60px)]'>
                <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用设备码验证
                </div>
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  启用后用户登录时需要绑定设备码，提升账户安全性。禁用后用户可以直接登录无需绑定设备码。
                </div>
              </div>
              <button
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    RequireDeviceCode: !prev.RequireDeviceCode,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  siteSettings.RequireDeviceCode
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    siteSettings.RequireDeviceCode
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className='flex items-center justify-between gap-4'>
              <div className='flex-1 max-w-[calc(100%-60px)]'>
                <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  禁用黄色过滤器
                </div>
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  禁用黄色内容过滤器，允许显示所有内容。
                </div>
              </div>
              <button
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    DisableYellowFilter: !prev.DisableYellowFilter,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  siteSettings.DisableYellowFilter
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    siteSettings.DisableYellowFilter
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className='flex items-center justify-between gap-4'>
              <div className='flex-1 max-w-[calc(100%-60px)]'>
                <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用流式搜索
                </div>
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  启用后搜索结果将实时流式返回，提升用户体验。
                </div>
              </div>
              <button
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    FluidSearch: !prev.FluidSearch,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  siteSettings.FluidSearch
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    siteSettings.FluidSearch ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveSiteConfig')}
          className={
            isLoading('saveSiteConfig')
              ? buttonStyles.disabled
              : buttonStyles.primary
          }
        >
          {isLoading('saveSiteConfig') ? '保存中...' : '保存'}
        </button>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

export default SiteConfigComponent;
