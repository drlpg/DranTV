/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { AdminConfig } from '@/lib/admin.types';
import { ChevronDown, Check, Eye, EyeOff } from 'lucide-react';
import { buttonStyles } from '../utils/constants';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { showError, showSuccess } from '../utils/helpers';
import { AlertModal } from './modals/AlertModal';

interface ImageHostingConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => void;
}

type ImageHostingType =
  | 'S3'
  | 'RemoteAPI'
  | 'FTP'
  | 'DogeCloud'
  | 'AliyunOSS'
  | 'Github'
  | 'YoupaiyunUSS';

const IMAGE_HOSTING_TYPES: { value: ImageHostingType; label: string }[] = [
  { value: 'S3', label: 'S3协议' },
  { value: 'RemoteAPI', label: '远程API' },
  { value: 'FTP', label: 'FTP协议' },
  { value: 'DogeCloud', label: 'DogeCloud云存储' },
  { value: 'AliyunOSS', label: '阿里云OSS' },
  { value: 'Github', label: 'Github' },
  { value: 'YoupaiyunUSS', label: '又拍云-云存储' },
];

interface ImageHostingConfigState {
  type: ImageHostingType;
  s3: {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    region: string;
    pathFormat: string;
    customDomain: string;
  };
}

export default function ImageHostingConfig({
  config,
  refreshConfig,
}: ImageHostingConfigProps) {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [imageHostingConfig, setImageHostingConfig] =
    useState<ImageHostingConfigState>({
      type: 'S3',
      s3: {
        accessKeyId: '',
        secretAccessKey: '',
        bucket: '',
        endpoint: '',
        region: '',
        pathFormat: '',
        customDomain: '',
      },
    });

  const [originalConfig, setOriginalConfig] =
    useState<ImageHostingConfigState | null>(null);

  // 当config变化时更新状态
  useEffect(() => {
    if (config?.ImageHostingConfig) {
      const newConfig: ImageHostingConfigState = {
        type: config.ImageHostingConfig.type || 'S3',
        s3: {
          accessKeyId: config.ImageHostingConfig.s3?.accessKeyId || '',
          secretAccessKey: config.ImageHostingConfig.s3?.secretAccessKey || '',
          bucket: config.ImageHostingConfig.s3?.bucket || '',
          endpoint: config.ImageHostingConfig.s3?.endpoint || '',
          region: config.ImageHostingConfig.s3?.region || '',
          pathFormat: config.ImageHostingConfig.s3?.pathFormat || '',
          customDomain: config.ImageHostingConfig.s3?.customDomain || '',
        },
      };
      setImageHostingConfig(newConfig);
      setOriginalConfig(newConfig);
    }
  }, [config]);

  const hasChanges = () => {
    // 如果没有原始配置，检查当前配置是否有非空值
    if (!originalConfig) {
      const hasData =
        imageHostingConfig.s3.accessKeyId ||
        imageHostingConfig.s3.secretAccessKey ||
        imageHostingConfig.s3.bucket ||
        imageHostingConfig.s3.endpoint ||
        imageHostingConfig.s3.region ||
        imageHostingConfig.s3.pathFormat ||
        imageHostingConfig.s3.customDomain;
      return !!hasData;
    }
    return (
      JSON.stringify(imageHostingConfig) !== JSON.stringify(originalConfig)
    );
  };

  const handleSave = async () => {
    // 检查是否有改动
    if (!hasChanges()) {
      showAlert({
        type: 'info',
        title: '提示',
        message: '没有任何改动，无需保存',
        timer: 2000,
      });
      return;
    }

    await withLoading('saveImageHosting', async () => {
      try {
        const response = await fetch('/api/admin/image-hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ImageHostingConfig: imageHostingConfig,
          }),
        });

        if (response.ok) {
          showSuccess('图床配置已保存', showAlert);
          setOriginalConfig(imageHostingConfig);
          await refreshConfig();
        } else {
          let errorMsg = '未知错误';
          try {
            const data = await response.json();
            errorMsg = data.error || errorMsg;
          } catch {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          }
          showError(errorMsg, showAlert);
        }
      } catch (error) {
        console.error('保存图床配置失败:', error);
        showError(
          error instanceof Error ? error.message : '网络错误',
          showAlert
        );
      }
    });
  };

  return (
    <div className='space-y-6'>
      {/* 图床类型和储存桶名 */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            图床类型
          </label>
          <div className='relative'>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between'
            >
              <span>
                {IMAGE_HOSTING_TYPES.find(
                  (t) => t.value === imageHostingConfig.type
                )?.label || '选择图床类型'}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                {IMAGE_HOSTING_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      setImageHostingConfig((prev) => ({
                        ...prev,
                        type: type.value,
                      }));
                      setIsDropdownOpen(false);
                    }}
                    className='w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between'
                  >
                    <span className='text-gray-900 dark:text-gray-100'>
                      {type.label}
                    </span>
                    {imageHostingConfig.type === type.value && (
                      <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {imageHostingConfig.type === 'S3' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              储存桶名
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.bucket}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, bucket: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
        )}
      </div>

      {/* S3配置 */}
      {imageHostingConfig.type === 'S3' && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              应用密钥 ID
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.accessKeyId}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, accessKeyId: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              应用秘钥
            </label>
            <div className='relative'>
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={imageHostingConfig.s3.secretAccessKey}
                onChange={(e) =>
                  setImageHostingConfig((prev) => ({
                    ...prev,
                    s3: { ...prev.s3, secretAccessKey: e.target.value },
                  }))
                }
                className='w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <button
                type='button'
                onClick={() => setShowSecretKey(!showSecretKey)}
                className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              >
                {showSecretKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              边缘节点
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.endpoint}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, endpoint: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              地区
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.region}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, region: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              保存路径
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.pathFormat}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, pathFormat: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              自定义域名
            </label>
            <input
              type='text'
              value={imageHostingConfig.s3.customDomain}
              onChange={(e) =>
                setImageHostingConfig((prev) => ({
                  ...prev,
                  s3: { ...prev.s3, customDomain: e.target.value },
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
        </div>
      )}

      {/* 其他类型的配置表单可以后续添加 */}
      {imageHostingConfig.type !== 'S3' && (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          该图床类型的配置界面正在开发中...
        </div>
      )}

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveImageHosting')}
          className={
            isLoading('saveImageHosting')
              ? buttonStyles.disabled
              : buttonStyles.primary
          }
        >
          {isLoading('saveImageHosting') ? '保存中...' : '保存'}
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
}
