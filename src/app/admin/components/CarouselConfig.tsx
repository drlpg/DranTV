/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ExternalLink,Plus, Trash2, Upload } from 'lucide-react';
import { useEffect,useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';

import { AlertModal } from './modals/AlertModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { buttonStyles } from '../utils/constants';
import { showError, showSuccess } from '../utils/helpers';

interface CarouselConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => void;
}

interface CarouselItem {
  id: string;
  title: string;
  image: string;
  link?: string;
}

interface CarouselConfigState {
  mode: 'default' | 'custom';
  autoPlayInterval: number;
  maxItems: number;
  customItems: CarouselItem[];
}

export default function CarouselConfig({
  config,
  refreshConfig,
}: CarouselConfigProps) {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    itemId: string;
  }>({ isOpen: false, itemId: '' });

  const [carouselConfig, setCarouselConfig] = useState<CarouselConfigState>({
    mode: 'default',
    autoPlayInterval: 10000,
    maxItems: 5,
    customItems: [],
  });

  const [originalConfig, setOriginalConfig] =
    useState<CarouselConfigState | null>(null);

  // 当config变化时更新状态
  useEffect(() => {
    if (config?.CarouselConfig) {
      const newConfig: CarouselConfigState = {
        mode: config.CarouselConfig.mode || 'default',
        autoPlayInterval: config.CarouselConfig.autoPlayInterval || 10000,
        maxItems: config.CarouselConfig.maxItems || 5,
        customItems: config.CarouselConfig.customItems || [],
      };
      setCarouselConfig(newConfig);
      setOriginalConfig(newConfig);
    }
  }, [config]);

  const hasChanges = () => {
    if (!originalConfig) {
      return (
        carouselConfig.mode !== 'default' ||
        carouselConfig.autoPlayInterval !== 10000 ||
        carouselConfig.maxItems !== 5 ||
        carouselConfig.customItems.length > 0
      );
    }
    return JSON.stringify(carouselConfig) !== JSON.stringify(originalConfig);
  };

  const handleAddItem = () => {
    const newItem: CarouselItem = {
      id: `custom-${Date.now()}`,
      title: '',
      image: '',
      link: '',
    };
    setCarouselConfig((prev) => ({
      ...prev,
      customItems: [...prev.customItems, newItem],
    }));
  };

  const handleRemoveItem = async (id: string, deleteRemote = false) => {
    const item = carouselConfig.customItems.find((i) => i.id === id);
    if (!item) return;

    // 如果需要删除远程图片且有图片URL
    if (deleteRemote && item.image && config?.ImageHostingConfig) {
      try {
        // 只删除来自配置的图床的图片
        const s3Config = config.ImageHostingConfig.s3;
        if (
          s3Config &&
          (item.image.includes(s3Config.endpoint) ||
            (s3Config.customDomain &&
              item.image.includes(s3Config.customDomain.split('/')[0])))
        ) {
          console.log('[轮播图] 删除R2图片:', item.image);
          const response = await fetch('/api/admin/delete-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.image }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.warn(
              '[轮播图] R2图片删除失败:',
              response.status,
              errorData
            );
            showError(
              'R2图片删除失败，可能是权限不足。已删除轮播图配置。',
              showAlert
            );
          } else {
            console.log('[轮播图] R2图片删除成功');
          }
        }
      } catch (error) {
        console.error('[轮播图] 删除R2图片时出错:', error);
        showError('R2图片删除失败，已删除轮播图配置', showAlert);
      }
    }

    // 从配置中删除轮播图
    setCarouselConfig((prev) => ({
      ...prev,
      customItems: prev.customItems.filter((item) => item.id !== id),
    }));
  };

  const confirmRemoveItem = (id: string) => {
    const item = carouselConfig.customItems.find((i) => i.id === id);
    if (!item) return;

    // 检查是否是R2图片
    const s3Config = config?.ImageHostingConfig?.s3;
    const isR2Image =
      item.image &&
      s3Config &&
      (item.image.includes(s3Config.endpoint) ||
        (s3Config.customDomain &&
          item.image.includes(s3Config.customDomain.split('/')[0])));

    if (isR2Image) {
      // 显示确认对话框
      setConfirmModal({ isOpen: true, itemId: id });
    } else {
      // 直接删除
      handleRemoveItem(id, false);
    }
  };

  const handleConfirmDelete = () => {
    handleRemoveItem(confirmModal.itemId, true);
  };

  const handleCancelDelete = () => {
    handleRemoveItem(confirmModal.itemId, false);
  };

  const handleUpdateItem = (
    id: string,
    field: keyof CarouselItem,
    value: string
  ) => {
    setCarouselConfig((prev) => ({
      ...prev,
      customItems: prev.customItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleImageUpload = async (id: string, file: File) => {
    if (!config?.ImageHostingConfig) {
      showError('请先配置图床', showAlert);
      return;
    }

    await withLoading(`upload-${id}`, async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          handleUpdateItem(id, 'image', data.url);
          showSuccess('图片上传成功', showAlert);
        } else {
          let errorMsg = '上传失败';
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } catch (e) {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          }
          showError(errorMsg, showAlert);
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        showError(
          error instanceof Error ? error.message : '网络错误',
          showAlert
        );
      }
    });
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      showAlert({
        type: 'info',
        title: '提示',
        message: '没有任何改动，无需保存',
        timer: 2000,
      });
      return;
    }

    // 验证自定义模式下的数据
    if (carouselConfig.mode === 'custom') {
      if (carouselConfig.customItems.length === 0) {
        showError('自定义模式下至少需要添加一张轮播图', showAlert);
        return;
      }

      for (const item of carouselConfig.customItems) {
        if (!item.image.trim()) {
          showError('请上传所有轮播图的图片', showAlert);
          return;
        }
      }
    }

    await withLoading('saveCarousel', async () => {
      try {
        const response = await fetch('/api/admin/carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            CarouselConfig: carouselConfig,
          }),
        });

        if (response.ok) {
          showSuccess('轮播图配置已保存', showAlert);
          setOriginalConfig(carouselConfig);
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
        console.error('保存轮播图配置失败:', error);
        showError(
          error instanceof Error ? error.message : '网络错误',
          showAlert
        );
      }
    });
  };

  return (
    <div className='space-y-6'>
      {/* 模式切换 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          轮播模式
        </label>
        <div className='flex gap-4'>
          <label className='flex items-center'>
            <input
              type='radio'
              checked={carouselConfig.mode === 'default'}
              onChange={() =>
                setCarouselConfig((prev) => ({ ...prev, mode: 'default' }))
              }
              className='mr-2'
            />
            <span className='text-gray-900 dark:text-gray-100'>
              默认（TMDB热门影片）
            </span>
          </label>
          <label className='flex items-center'>
            <input
              type='radio'
              checked={carouselConfig.mode === 'custom'}
              onChange={() =>
                setCarouselConfig((prev) => ({ ...prev, mode: 'custom' }))
              }
              className='mr-2'
            />
            <span className='text-gray-900 dark:text-gray-100'>自定义</span>
          </label>
        </div>
      </div>

      {/* 基础配置 */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            停留时长（秒）
          </label>
          <input
            type='number'
            value={carouselConfig.autoPlayInterval / 1000}
            onChange={(e) =>
              setCarouselConfig((prev) => ({
                ...prev,
                autoPlayInterval: (parseInt(e.target.value) || 10) * 1000,
              }))
            }
            min='1'
            step='1'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            轮播图张数（最大）
          </label>
          <input
            type='number'
            value={carouselConfig.maxItems}
            onChange={(e) =>
              setCarouselConfig((prev) => ({
                ...prev,
                maxItems: parseInt(e.target.value) || 5,
              }))
            }
            min='1'
            max='10'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
        </div>
      </div>

      {/* 自定义轮播图列表 */}
      {carouselConfig.mode === 'custom' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
              自定义轮播图
            </h3>
            <button
              onClick={handleAddItem}
              className={`${buttonStyles.primary} flex items-center`}
              disabled={isLoading('saveCarousel')}
            >
              <Plus size={16} className='mr-1' />
              添加
            </button>
          </div>

          {carouselConfig.customItems.length === 0 ? (
            <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
              暂无自定义轮播图，点击"添加"开始配置
            </div>
          ) : (
            <div className='space-y-4'>
              {carouselConfig.customItems.map((item, index) => (
                <div
                  key={item.id}
                  className='p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800'
                >
                  <div className='flex items-start justify-between mb-3'>
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      轮播图 #{index + 1}
                    </span>
                    <button
                      onClick={() => confirmRemoveItem(item.id)}
                      className='text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                      disabled={isLoading('saveCarousel')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className='grid grid-cols-1 gap-3'>
                    <div>
                      <label className='block text-sm text-gray-700 dark:text-gray-300 mb-1'>
                        标题（可选）
                      </label>
                      <input
                        type='text'
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateItem(item.id, 'title', e.target.value)
                        }
                        placeholder='请输入轮播图标题（可选）'
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      />
                    </div>

                    <div>
                      <label className='block text-sm text-gray-700 dark:text-gray-300 mb-1'>
                        图片
                      </label>
                      <div className='relative'>
                        <input
                          type='text'
                          value={item.image}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'image', e.target.value)
                          }
                          placeholder='图片URL或上传图片'
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          style={{ paddingRight: '84px' }}
                        />
                        <label
                          className={`absolute top-1/2 -translate-y-1/2 ${buttonStyles.secondary} cursor-pointer flex items-center`}
                          style={{ right: '5px', borderRadius: '4px' }}
                        >
                          <Upload size={16} className='mr-1' />
                          上传
                          <input
                            type='file'
                            accept='image/*'
                            className='hidden'
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageUpload(item.id, file);
                                // 重置文件输入框，允许重新选择同一文件
                                e.target.value = '';
                              }
                            }}
                            disabled={isLoading(`upload-${item.id}`)}
                          />
                        </label>
                      </div>
                      {isLoading(`upload-${item.id}`) && (
                        <p className='text-sm text-blue-600 dark:text-blue-400 mt-1'>
                          上传中...
                        </p>
                      )}
                    </div>

                    <div>
                      <label className='block text-sm text-gray-700 dark:text-gray-300 mb-1'>
                        跳转链接（可选）
                      </label>
                      <div className='relative'>
                        <input
                          type='text'
                          value={item.link || ''}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'link', e.target.value)
                          }
                          placeholder='https://example.com'
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          style={{ paddingRight: item.link ? '84px' : '12px' }}
                        />
                        {item.link && (
                          <a
                            href={item.link}
                            target='_blank'
                            rel='noopener noreferrer'
                            className={`absolute top-1/2 -translate-y-1/2 ${buttonStyles.secondary} flex items-center justify-center`}
                            style={{
                              right: '5px',
                              borderRadius: '4px',
                              height: '32px',
                            }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveCarousel')}
          className={
            isLoading('saveCarousel')
              ? buttonStyles.disabled
              : buttonStyles.primary
          }
        >
          {isLoading('saveCarousel') ? '保存中...' : '保存'}
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, itemId: '' })}
        onConfirm={handleConfirmDelete}
        title='是否同时删除R2存储桶中的图片？'
        message='点击"确定"删除图片和配置&#10;点击"取消"仅删除配置'
        confirmText='确定'
        cancelText='取消'
      />
    </div>
  );
}
