'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { AlertModal } from './modals/AlertModal';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { AdminConfig, DataSource } from '../types';
import { buttonStyles } from '../utils/constants';
import { showError, showSuccess } from '../utils/helpers';

const VideoSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'config',
  });

  // 批量操作相关状态
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );

  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState('');

  // 订阅配置相关状态
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // 导入配置相关状态
  const [showImportForm, setShowImportForm] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // 过滤后的视频源列表
  const filteredSources = useMemo(() => {
    if (!searchKeyword.trim()) {
      return sources;
    }
    const keyword = searchKeyword.toLowerCase().trim();
    return sources.filter(
      (source) =>
        source.name.toLowerCase().includes(keyword) ||
        source.key.toLowerCase().includes(keyword) ||
        source.api.toLowerCase().includes(keyword),
    );
  }, [sources, searchKeyword]);

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计算
  const selectAll = useMemo(() => {
    return (
      selectedSources.size === filteredSources.length &&
      selectedSources.size > 0
    );
  }, [selectedSources.size, filteredSources.length]);

  // 确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // 有效性检测相关状态
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationKeyword, setValidationKeyword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Array<{
      key: string;
      name: string;
      status: 'valid' | 'no_results' | 'invalid' | 'validating';
      message: string;
      resultCount: number;
      resultTitles?: string[];
    }>
  >([]);

  // 移动端点击显示详情的状态
  const [showValidationDetail, setShowValidationDetail] = useState<
    string | null
  >(null);

  // 单个视频源验证状态
  const [singleValidationResult, setSingleValidationResult] = useState<{
    status: 'valid' | 'invalid' | 'no_results' | 'validating' | null;
    message: string;
    details?: {
      responseTime?: number;
      resultCount?: number;
      error?: string;
      searchKeyword?: string;
    };
  }>({ status: null, message: '' });
  const [isSingleValidating, setIsSingleValidating] = useState(false);

  // 新增视频源验证状态
  const [newSourceValidationResult, setNewSourceValidationResult] = useState<{
    status: 'valid' | 'invalid' | 'no_results' | 'validating' | null;
    message: string;
    details?: {
      responseTime?: number;
      resultCount?: number;
      error?: string;
      searchKeyword?: string;
    };
  }>({ status: null, message: '' });
  const [isNewSourceValidating, setIsNewSourceValidating] = useState(false);

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    }),
  );

  // 初始化
  useEffect(() => {
    if (config?.SourceConfig) {
      setSources(config.SourceConfig);
      // 进入时重置 orderChanged
      setOrderChanged(false);
      // 重置选择状态
      setSelectedSources(new Set());
    }
    if (config?.SourceSubscription) {
      setSubscriptionUrl(config.SourceSubscription.URL);
      setAutoUpdate(config.SourceSubscription.AutoUpdate);
      setLastCheckTime(config.SourceSubscription.LastCheck || '');
    } else {
      // 如果订阅配置不存在，清空状态
      setSubscriptionUrl('');
      setAutoUpdate(false);
      setLastCheckTime('');
    }
  }, [config]);

  // 通用 API 请求
  const callSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 刷新配置以获取最新数据
      await resp.json(); // 消费响应体
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key }),
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key }),
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) return;
    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
      // 清除检测结果
      clearNewSourceValidation();
    }).catch(() => {
      console.error('操作失败', 'add', newSource);
    });
  };

  const handleEditSource = () => {
    if (!editingSource || !editingSource.name || !editingSource.api) return;
    withLoading('editSource', async () => {
      await callSourceApi({
        action: 'edit',
        key: editingSource.key,
        name: editingSource.name,
        api: editingSource.api,
        detail: editingSource.detail,
      });
      setEditingSource(null);
    }).catch(() => {
      console.error('操作失败', 'edit', editingSource);
    });
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    // 清除单个源的检测结果
    setSingleValidationResult({ status: null, message: '' });
    setIsSingleValidating(false);
  };

  // 清除新增视频源检测结果
  const clearNewSourceValidation = () => {
    setNewSourceValidationResult({ status: null, message: '' });
    setIsNewSourceValidating(false);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sources.findIndex((s) => s.key === active.id);
    const newIndex = sources.findIndex((s) => s.key === over.id);
    setSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = sources.map((s) => s.key);
    withLoading('saveSourceOrder', () =>
      callSourceApi({ action: 'sort', order }),
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 保存订阅配置
  const handleSaveSubscription = async () => {
    await withLoading('saveSourceSubscription', async () => {
      try {
        const resp = await fetch('/api/admin/source/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: subscriptionUrl,
            autoUpdate: autoUpdate,
            lastCheck: lastCheckTime || new Date().toISOString(),
          }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          // 特殊处理504超时错误
          if (resp.status === 504) {
            throw new Error('保存超时，操作可能已完成。请刷新页面查看状态。');
          }
          throw new Error(
            data.error ||
              `保存失败 (${resp.status}): ${resp.statusText || '未知错误'}`,
          );
        }

        showSuccess('订阅配置保存成功', showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  // 清除订阅配置
  const handleClearSubscription = async () => {
    await withLoading('clearSourceSubscription', async () => {
      try {
        const resp = await fetch('/api/admin/source/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: '',
            autoUpdate: false,
            lastCheck: '',
          }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          // 特殊处理504超时错误
          if (resp.status === 504) {
            throw new Error(
              '清除超时，可能是数据量较大。操作可能已部分完成，请刷新页面查看状态。',
            );
          }
          throw new Error(
            data.error ||
              `清除失败 (${resp.status}): ${resp.statusText || '未知错误'}`,
          );
        }

        showSuccess('订阅配置已清除', showAlert);
        setSubscriptionUrl('');
        setAutoUpdate(false);
        setLastCheckTime('');
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '清除失败', showAlert);
        throw err;
      }
    });
  };

  // 从URL导入视频源配置
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      showError('请输入导入URL', showAlert);
      return;
    }

    await withLoading('importSources', async () => {
      try {
        const resp = await fetch('/api/admin/source/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: importUrl,
            saveSubscription: true,
            autoUpdate: autoUpdate,
          }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          // 特殊处理504超时错误
          if (resp.status === 504) {
            throw new Error(
              '导入超时，可能是订阅源响应较慢或包含大量数据。请稍后重试或检查订阅链接是否可访问。',
            );
          }
          throw new Error(
            data.error ||
              `导入失败 (${resp.status}): ${resp.statusText || '未知错误'}`,
          );
        }

        const data = await resp.json();
        if (data.sources && data.sources.length > 0) {
          const formatInfo = data.format
            ? ` (格式: ${data.format.toUpperCase()})`
            : '';
          showSuccess(
            data.message ||
              `成功导入 ${data.sources.length} 个视频源${formatInfo}`,
            showAlert,
          );
          // 刷新配置以获取最新数据
          await refreshConfig();

          // 更新订阅URL为当前导入的URL
          setSubscriptionUrl(importUrl);
          setLastCheckTime(new Date().toISOString());
          setImportUrl('');
          setShowImportForm(false);
        } else {
          showError('导入失败：未获取到视频源数据', showAlert);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '导入失败', showAlert);
        throw err;
      }
    });
  };

  // 有效性检测函数
  const handleValidateSources = async () => {
    if (!validationKeyword.trim()) {
      showAlert({
        type: 'warning',
        title: '请输入搜索关键词',
        message: '搜索关键词不能为空',
        showConfirm: true,
      });
      return;
    }

    await withLoading('validateSources', async () => {
      setIsValidating(true);
      setValidationResults([]); // 清空之前的结果
      setShowValidationModal(false); // 立即关闭弹窗

      // 初始化所有视频源为检测中状态
      const initialResults = sources.map((source) => ({
        key: source.key,
        name: source.name,
        status: 'validating' as const,
        message: '检测中...',
        resultCount: 0,
      }));
      setValidationResults(initialResults);

      try {
        // 使用EventSource接收流式数据
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(
            validationKeyword.trim(),
          )}`,
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'start':
                break;

              case 'source_result':
              case 'source_error':
                // 更新验证结果
                setValidationResults((prev) => {
                  const existing = prev.find((r) => r.key === data.source);
                  if (existing) {
                    return prev.map((r) =>
                      r.key === data.source
                        ? {
                            key: data.source,
                            name:
                              sources.find((s) => s.key === data.source)
                                ?.name || data.source,
                            status: data.status,
                            message:
                              data.status === 'valid'
                                ? '搜索正常'
                                : data.status === 'no_results'
                                  ? '无法搜索到结果'
                                  : '连接失败',
                            resultCount: data.resultCount || 0,
                            resultTitles: data.resultTitles || [],
                          }
                        : r,
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        key: data.source,
                        name:
                          sources.find((s) => s.key === data.source)?.name ||
                          data.source,
                        status: data.status,
                        message:
                          data.status === 'valid'
                            ? '搜索正常'
                            : data.status === 'no_results'
                              ? '无法搜索到结果'
                              : '连接失败',
                        resultCount: data.resultCount || 0,
                        resultTitles: data.resultTitles || [],
                      },
                    ];
                  }
                });
                break;

              case 'complete':
                eventSource.close();
                setIsValidating(false);

                // 自动排序：将有效的视频源移到前面
                setValidationResults((prev) => {
                  const sorted = [...prev].sort((a, b) => {
                    // 有效的排在前面
                    if (a.status === 'valid' && b.status !== 'valid') return -1;
                    if (a.status !== 'valid' && b.status === 'valid') return 1;
                    // 其他状态保持原顺序
                    return 0;
                  });

                  // 统计有效源数量
                  const validCount = sorted.filter(
                    (r) => r.status === 'valid',
                  ).length;

                  // 获取有效源的key集合
                  const validKeys = new Set(
                    sorted
                      .filter((r) => r.status === 'valid')
                      .map((r) => r.key),
                  );

                  // 对sources列表进行排序
                  setSources((prevSources) => {
                    const sortedSources = [...prevSources].sort((a, b) => {
                      const aValid = validKeys.has(a.key);
                      const bValid = validKeys.has(b.key);

                      if (aValid && !bValid) return -1;
                      if (!aValid && bValid) return 1;
                      return 0;
                    });

                    return sortedSources;
                  });

                  // 显示排序完成提示
                  if (validCount > 0) {
                    showAlert({
                      type: 'success',
                      title: '检测完成',
                      message: `已将 ${validCount} 个有效视频源移至列表前端`,
                      showConfirm: true,
                    });
                  }

                  return sorted;
                });

                break;
            }
          } catch (error) {
            console.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource错误:', error);
          eventSource.close();
          setIsValidating(false);
          showAlert({
            type: 'error',
            title: '验证失败',
            message: '连接错误，请重试',
            showConfirm: true,
          });
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setIsValidating(false);
            showAlert({
              type: 'warning',
              title: '验证超时',
              message: '检测超时，请重试',
              showConfirm: true,
            });
          }
        }, 60000); // 60秒超时
      } catch (error) {
        setIsValidating(false);
        showAlert({
          type: 'error',
          title: '验证失败',
          message: error instanceof Error ? error.message : '未知错误',
          showConfirm: true,
        });
        throw error;
      }
    });
  };

  // 通用视频源有效性检测函数
  const handleValidateSource = async (
    api: string,
    name: string,
    isNewSource = false,
  ) => {
    if (!api.trim()) {
      showAlert({
        type: 'warning',
        title: 'API地址不能为空',
        message: '请输入有效的API地址',
        showConfirm: true,
      });
      return;
    }

    const validationKey = isNewSource
      ? 'validateNewSource'
      : 'validateSingleSource';
    const setValidating = isNewSource
      ? setIsNewSourceValidating
      : setIsSingleValidating;
    const setResult = isNewSource
      ? setNewSourceValidationResult
      : setSingleValidationResult;

    await withLoading(validationKey, async () => {
      setValidating(true);
      setResult({ status: 'validating', message: '检测中...' });

      const startTime = Date.now();
      const testKeyword = '灵笼';

      try {
        // 构建检测 URL，使用临时 API 地址
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(
            testKeyword,
          )}&tempApi=${encodeURIComponent(
            api.trim(),
          )}&tempName=${encodeURIComponent(name)}`,
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const responseTime = Date.now() - startTime;

            switch (data.type) {
              case 'start':
                break;

              case 'source_result':
              case 'source_error':
                if (data.source === 'temp') {
                  let message = '';
                  const details: any = {
                    responseTime,
                    searchKeyword: testKeyword,
                  };

                  if (data.status === 'valid') {
                    message = '搜索正常';
                    details.resultCount = data.resultCount || 0;
                  } else if (data.status === 'no_results') {
                    message = '无法搜索到结果';
                    details.resultCount = 0;
                  } else {
                    message = '连接失败';
                    details.error = data.error || '未知错误';
                  }

                  setResult({
                    status: data.status,
                    message,
                    details,
                  });
                }
                break;

              case 'complete':
                eventSource.close();
                setValidating(false);
                break;
            }
          } catch (error) {
            console.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource错误:', error);
          eventSource.close();
          setValidating(false);
          const responseTime = Date.now() - startTime;
          setResult({
            status: 'invalid',
            message: '连接错误，请重试',
            details: {
              responseTime,
              error: '网络连接失败',
              searchKeyword: testKeyword,
            },
          });
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setValidating(false);
            const responseTime = Date.now() - startTime;
            setResult({
              status: 'invalid',
              message: '检测超时，请重试',
              details: {
                responseTime,
                error: '请求超时（30秒）',
                searchKeyword: testKeyword,
              },
            });
          }
        }, 30000); // 30秒超时
      } catch (error) {
        setValidating(false);
        const responseTime = Date.now() - startTime;
        setResult({
          status: 'invalid',
          message: error instanceof Error ? error.message : '未知错误',
          details: {
            responseTime,
            error: error instanceof Error ? error.message : '未知错误',
            searchKeyword: testKeyword,
          },
        });
      }
    });
  };

  // 单个视频源有效性检测函数
  const handleValidateSingleSource = async () => {
    if (!editingSource) {
      showAlert({
        type: 'warning',
        title: '没有可检测的视频源',
        message: '请确保正在编辑视频源',
        showConfirm: true,
      });
      return;
    }
    await handleValidateSource(editingSource.api, editingSource.name, false);
  };

  // 新增视频源有效性检测函数
  const handleValidateNewSource = async () => {
    if (!newSource.name.trim()) {
      showAlert({
        type: 'warning',
        title: '视频源名称不能为空',
        message: '请输入视频源名称',
        showConfirm: true,
      });
      return;
    }
    await handleValidateSource(newSource.api, newSource.name, true);
  };

  // 获取有效性状态显示
  const getValidationStatus = (sourceKey: string) => {
    const result = validationResults.find((r) => r.key === sourceKey);
    if (!result) return null;

    // 构建详细信息
    let detailMessage = result.message;
    if (result.resultTitles && result.resultTitles.length > 0) {
      detailMessage += `\n找到 ${result.resultCount} 个结果:\n${result.resultTitles.join('\n')}`;
    }

    switch (result.status) {
      case 'validating':
        return {
          text: '检测中',
          className:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
          icon: '⟳',
          message: result.message,
          detailMessage,
          resultTitles: result.resultTitles,
          resultCount: result.resultCount,
        };
      case 'valid':
        return {
          text: '有效',
          className:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
          icon: '✓',
          message: result.message,
          detailMessage,
          resultTitles: result.resultTitles,
          resultCount: result.resultCount,
        };
      case 'no_results':
        return {
          text: '无法搜索',
          className:
            'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
          icon: '⚠',
          message: result.message,
          detailMessage,
          resultTitles: result.resultTitles,
          resultCount: result.resultCount,
        };
      case 'invalid':
        return {
          text: '无效',
          className:
            'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
          icon: '✗',
          message: result.message,
          detailMessage,
          resultTitles: result.resultTitles,
          resultCount: result.resultCount,
        };
      default:
        return null;
    }
  };

  // 可拖拽行封装 (dnd-kit) - Flex布局
  const DraggableRow = ({ source }: { source: DataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: source.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className='flex items-center px-2 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        {/* 拖拽手柄 */}
        <div
          className='w-6 flex-shrink-0 flex justify-center cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </div>

        {/* 复选框 */}
        <div className='w-10 flex-shrink-0 flex justify-center'>
          <input
            type='checkbox'
            checked={selectedSources.has(source.key)}
            onChange={(e) => handleSelectSource(source.key, e.target.checked)}
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
          />
        </div>

        {/* 名称 */}
        <div
          className='w-24 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'
          title={source.name}
        >
          {source.name}
        </div>

        {/* Key */}
        <div
          className='w-20 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis min-w-[5rem]'
          title={source.key}
        >
          {source.key}
        </div>

        {/* API 地址 - 固定宽度，溢出省略 */}
        <div
          className='w-64 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis min-w-[16rem]'
          title={source.api}
        >
          {source.api}
        </div>

        {/* Detail 地址 - 弹性宽度，溢出省略 */}
        <div
          className='flex-1 min-w-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'
          title={source.detail || '-'}
        >
          {source.detail || '-'}
        </div>

        {/* 状态 */}
        <div className='w-20 flex-shrink-0 px-2'>
          <span
            className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
              !source.disabled
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!source.disabled ? '启用中' : '已禁用'}
          </span>
        </div>

        {/* 有效性 */}
        <div className='w-28 flex-shrink-0 px-2'>
          {(() => {
            const status = getValidationStatus(source.key);
            if (!status) {
              return (
                <span className='px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                  未检测
                </span>
              );
            }
            return (
              <div className='relative group'>
                <span
                  className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${status.className} ${
                    status.resultTitles && status.resultTitles.length > 0
                      ? 'cursor-pointer md:cursor-help'
                      : 'cursor-help'
                  }`}
                  onClick={(e) => {
                    // 移动端点击显示弹窗
                    if (
                      status.resultTitles &&
                      status.resultTitles.length > 0 &&
                      window.innerWidth < 768
                    ) {
                      e.stopPropagation();
                      setShowValidationDetail(source.key);
                    }
                  }}
                  title={
                    status.resultTitles && status.resultTitles.length === 0
                      ? status.message
                      : undefined
                  }
                >
                  {status.icon} {status.text}
                  {status.resultCount > 0 && ` (${status.resultCount})`}
                </span>
                {/* 桌面端悬停提示 */}
                {status.resultTitles && status.resultTitles.length > 0 && (
                  <div className='hidden md:group-hover:block absolute right-0 top-full mt-1 z-50 w-64 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg'>
                    <div className='text-xs text-gray-700 dark:text-gray-300'>
                      <div className='font-medium mb-1'>
                        搜索结果 ({status.resultCount}个):
                      </div>
                      <ul className='list-disc list-inside space-y-0.5'>
                        {status.resultTitles.map((title, idx) => (
                          <li key={idx} className='truncate' title={title}>
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 操作按钮 */}
        <div className='w-52 flex-shrink-0 px-2 flex items-center gap-2'>
          <button
            onClick={() => handleToggleEnable(source.key)}
            disabled={isLoading(`toggleSource_${source.key}`)}
            className={`flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              !source.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!source.disabled ? '禁用' : '启用'}
          </button>
          <button
            onClick={() => {
              setEditingSource(source);
              // 清除之前的检测结果
              setSingleValidationResult({ status: null, message: '' });
              setIsSingleValidating(false);
            }}
            disabled={isLoading(`editSource_${source.key}`)}
            className={`flex-1 ${
              buttonStyles.roundedPrimary
            } whitespace-nowrap justify-center ${
              isLoading(`editSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            title='编辑此视频源'
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(source.key)}
            disabled={isLoading(`deleteSource_${source.key}`)}
            className={`flex-1 ${
              buttonStyles.roundedSecondary
            } whitespace-nowrap justify-center ${
              isLoading(`deleteSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            title='删除此视频源'
          >
            删除
          </button>
        </div>
      </div>
    );
  };

  // 全选/取消全选
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allKeys = filteredSources.map((s) => s.key);
        setSelectedSources(new Set(allKeys));
      } else {
        setSelectedSources(new Set());
      }
    },
    [filteredSources],
  );

  // 单个选择
  const handleSelectSource = useCallback((key: string, checked: boolean) => {
    setSelectedSources((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      return newSelected;
    });
  }, []);

  // 批量操作
  const handleBatchOperation = async (
    action: 'batch_enable' | 'batch_disable' | 'batch_delete',
  ) => {
    if (selectedSources.size === 0) {
      showAlert({
        type: 'warning',
        title: '请先选择要操作的视频源',
        message: '请选择至少一个视频源',
        showConfirm: true,
      });
      return;
    }

    const keys = Array.from(selectedSources);
    let confirmMessage = '';
    let actionName = '';

    switch (action) {
      case 'batch_enable':
        confirmMessage = `确定要启用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量启用';
        break;
      case 'batch_disable':
        confirmMessage = `确定要禁用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量禁用';
        break;
      case 'batch_delete':
        confirmMessage = `确定要删除选中的 ${keys.length} 个视频源吗？此操作不可恢复！`;
        actionName = '批量删除';
        break;
    }

    // 显示确认弹窗
    setConfirmModal({
      isOpen: true,
      title: '确认操作',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          await withLoading(`batchSource_${action}`, () =>
            callSourceApi({ action, keys }),
          );
          showAlert({
            type: 'success',
            title: `${actionName}成功`,
            message: `${actionName}了 ${keys.length} 个视频源`,
            timer: 2000,
          });
          // 重置选择状态
          setSelectedSources(new Set());
        } catch (err) {
          showAlert({
            type: 'error',
            title: `${actionName}失败`,
            message: err instanceof Error ? err.message : '操作失败',
            showConfirm: true,
          });
        }
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 导入视频源表单 */}
      {showImportForm && (
        <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              从URL导入视频源
            </h4>
            <button
              onClick={() => {
                setShowImportForm(false);
                setImportUrl('');
              }}
              className='text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
          <div className='space-y-3'>
            <input
              type='url'
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder='https://example.com/sources.txt'
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-transparent'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              支持格式：JSON、M3U 播放列表、TXT 文本配置
            </p>
            {/* 自动更新开关 */}
            <div className='flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  自动更新
                </label>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  启用后系统将定期自动拉取最新配置
                </p>
              </div>
              <button
                type='button'
                onClick={() => setAutoUpdate(!autoUpdate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  autoUpdate ? buttonStyles.toggleOn : buttonStyles.toggleOff
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full ${
                    buttonStyles.toggleThumb
                  } transition-transform ${
                    autoUpdate
                      ? buttonStyles.toggleThumbOn
                      : buttonStyles.toggleThumbOff
                  }`}
                />
              </button>
            </div>
            <button
              onClick={handleImportFromUrl}
              disabled={isLoading('importSources') || !importUrl.trim()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isLoading('importSources') || !importUrl.trim()
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('importSources') ? (
                <div className='flex items-center justify-center gap-2'>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                  导入中…
                </div>
              ) : (
                '导入视频源'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 订阅配置显示 */}
      {subscriptionUrl && !showImportForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex-1'>
              <div className='flex items-center gap-2'>
                <h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                  订阅配置
                </h4>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    autoUpdate
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300'
                  }`}
                >
                  {autoUpdate ? '自动更新已启用' : '自动更新已禁用'}
                </span>
              </div>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1 break-all'>
                {subscriptionUrl}
              </p>
              {lastCheckTime && (
                <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                  最后更新: {new Date(lastCheckTime).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => setAutoUpdate(!autoUpdate)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  autoUpdate ? buttonStyles.warning : buttonStyles.success
                }`}
              >
                {autoUpdate ? '禁用自动更新' : '启用自动更新'}
              </button>
              <button
                onClick={handleSaveSubscription}
                disabled={isLoading('saveSourceSubscription')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isLoading('saveSourceSubscription')
                    ? buttonStyles.disabled
                    : buttonStyles.primary
                }`}
              >
                {isLoading('saveSourceSubscription') ? '保存中...' : '保存配置'}
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      '确定要清除订阅配置吗？\n\n这将删除所有通过订阅导入的视频源，但会保留手动添加的视频源。',
                    )
                  ) {
                    handleClearSubscription();
                  }
                }}
                disabled={isLoading('clearSourceSubscription')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isLoading('clearSourceSubscription')
                    ? buttonStyles.disabled
                    : buttonStyles.danger
                }`}
              >
                {isLoading('clearSourceSubscription')
                  ? '清除中...'
                  : '清除配置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加视频源表单 */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          视频源列表 ({sources.length})
        </h4>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2'>
          {/* 批量操作按钮 */}
          {selectedSources.size > 0 && (
            <>
              <div className='flex flex-wrap items-center gap-3'>
                <span className='text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                  已选择 {selectedSources.size} 个视频源
                </span>
                {/* 搜索框 */}
                <input
                  type='text'
                  placeholder='搜索视频源...'
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className='px-[10px] py-[5px] text-sm border border-gray-300 focus:!border-blue-500 dark:border-gray-600 dark:focus:!border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-48'
                  style={{ outline: 'none', boxShadow: 'none' }}
                  onFocus={(e) => {
                    e.target.style.outline = 'none';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  onClick={() => handleBatchOperation('batch_enable')}
                  disabled={isLoading('batchSource_batch_enable')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchSource_batch_enable')
                      ? buttonStyles.disabled
                      : buttonStyles.success
                  }`}
                >
                  {isLoading('batchSource_batch_enable')
                    ? '启用中...'
                    : '批量启用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_disable')}
                  disabled={isLoading('batchSource_batch_disable')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchSource_batch_disable')
                      ? buttonStyles.disabled
                      : buttonStyles.warning
                  }`}
                >
                  {isLoading('batchSource_batch_disable')
                    ? '禁用中...'
                    : '批量禁用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_delete')}
                  disabled={isLoading('batchSource_batch_delete')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchSource_batch_delete')
                      ? buttonStyles.disabled
                      : buttonStyles.danger
                  }`}
                >
                  {isLoading('batchSource_batch_delete')
                    ? '删除中...'
                    : '批量删除'}
                </button>
              </div>
              <div className='hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600'></div>
            </>
          )}
          {/* 当没有选中项时显示搜索框和导入配置按钮 */}
          {selectedSources.size === 0 && (
            <>
              <input
                type='text'
                placeholder='搜索视频源...'
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className='px-[10px] py-[5px] text-sm border border-gray-300 focus:!border-blue-500 dark:border-gray-600 dark:focus:!border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-full sm:w-48'
                style={{ outline: 'none', boxShadow: 'none' }}
                onFocus={(e) => {
                  e.target.style.outline = 'none';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => {
                  setShowImportForm(!showImportForm);
                  if (showImportForm) {
                    setImportUrl('');
                  }
                  // 关闭添加表单
                  if (showAddForm) {
                    setShowAddForm(false);
                    clearNewSourceValidation();
                  }
                }}
                className={`w-full sm:w-auto text-center ${
                  showImportForm ? buttonStyles.secondary : buttonStyles.primary
                }`}
              >
                {showImportForm ? '取消导入' : '导入配置'}
              </button>
            </>
          )}
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto'>
            <button
              onClick={() => setShowValidationModal(true)}
              disabled={isValidating}
              className={`px-3 py-1 text-sm rounded-lg transition-colors flex items-center justify-center space-x-1 w-full sm:w-auto ${
                isValidating ? buttonStyles.disabled : buttonStyles.primary
              }`}
            >
              {isValidating ? (
                <>
                  <div className='w-3 h-3 border border-white border-t-transparent rounded-full animate-spin'></div>
                  <span>检测中...</span>
                </>
              ) : (
                '有效性检测'
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                // 切换表单时清除检测结果
                if (!showAddForm) {
                  clearNewSourceValidation();
                }
                // 关闭导入表单
                if (showImportForm) {
                  setShowImportForm(false);
                  setImportUrl('');
                }
              }}
              className={`w-full sm:w-auto text-center ${
                showAddForm ? buttonStyles.secondary : buttonStyles.success
              }`}
            >
              {showAddForm ? '取消' : '添加视频源'}
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newSource.key}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='API 地址'
              value={newSource.api}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, api: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Detail 地址（选填）'
              value={newSource.detail}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, detail: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          {/* 新增视频源有效性检测结果显示 */}
          {newSourceValidationResult.status && (
            <div className='p-3 rounded-lg border'>
              <div className='space-y-2'>
                <div className='flex items-center space-x-2'>
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    检测结果:
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      newSourceValidationResult.status === 'valid'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : newSourceValidationResult.status === 'validating'
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                          : newSourceValidationResult.status === 'no_results'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                            : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {newSourceValidationResult.status === 'valid' && '✓ '}
                    {newSourceValidationResult.status === 'validating' && '⏳ '}
                    {newSourceValidationResult.status === 'no_results' && '⚠️ '}
                    {newSourceValidationResult.status === 'invalid' && '✗ '}
                    {newSourceValidationResult.message}
                  </span>
                </div>
                {newSourceValidationResult.details && (
                  <div className='text-xs text-gray-600 dark:text-gray-400 space-y-1'>
                    {newSourceValidationResult.details.searchKeyword && (
                      <div>
                        测试关键词:{' '}
                        {newSourceValidationResult.details.searchKeyword}
                      </div>
                    )}
                    {newSourceValidationResult.details.responseTime && (
                      <div>
                        响应时间:{' '}
                        {newSourceValidationResult.details.responseTime}ms
                      </div>
                    )}
                    {newSourceValidationResult.details.resultCount !==
                      undefined && (
                      <div>
                        搜索结果数:{' '}
                        {newSourceValidationResult.details.resultCount}
                      </div>
                    )}
                    {newSourceValidationResult.details.error && (
                      <div className='text-red-600 dark:text-red-400'>
                        错误信息: {newSourceValidationResult.details.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className='flex justify-end space-x-2'>
            <button
              onClick={handleValidateNewSource}
              disabled={
                !newSource.api ||
                isNewSourceValidating ||
                isLoading('validateNewSource')
              }
              className={`px-4 py-2 ${
                !newSource.api ||
                isNewSourceValidating ||
                isLoading('validateNewSource')
                  ? buttonStyles.disabled
                  : buttonStyles.primary
              }`}
            >
              {isNewSourceValidating || isLoading('validateNewSource')
                ? '检测中...'
                : '有效性检测'}
            </button>
            <button
              onClick={handleAddSource}
              disabled={
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
              }
              className={`px-4 py-2 ${
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addSource') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 编辑视频源表单 */}
      {editingSource && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='flex items-center justify-between'>
            <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              编辑视频源: {editingSource.name}
            </h5>
            <button
              onClick={handleCancelEdit}
              className='text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            >
              ✕
            </button>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                名称
              </label>
              <input
                type='text'
                value={editingSource.name}
                onChange={(e) =>
                  setEditingSource((prev) =>
                    prev ? { ...prev, name: e.target.value } : null,
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Key (不可编辑)
              </label>
              <input
                type='text'
                value={editingSource.key}
                disabled
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                API 地址
              </label>
              <input
                type='text'
                value={editingSource.api}
                onChange={(e) =>
                  setEditingSource((prev) =>
                    prev ? { ...prev, api: e.target.value } : null,
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Detail 地址（选填）
              </label>
              <input
                type='text'
                value={editingSource.detail || ''}
                onChange={(e) =>
                  setEditingSource((prev) =>
                    prev ? { ...prev, detail: e.target.value } : null,
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>

            {/* 有效性检测结果显示 */}
            {singleValidationResult.status && (
              <div className='col-span-full mt-4 p-3 rounded-lg border'>
                <div className='space-y-2'>
                  <div className='flex items-center space-x-2'>
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      检测结果:
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        singleValidationResult.status === 'valid'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : singleValidationResult.status === 'validating'
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                            : singleValidationResult.status === 'no_results'
                              ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {singleValidationResult.status === 'valid' && '✓ '}
                      {singleValidationResult.status === 'validating' && '⏳ '}
                      {singleValidationResult.status === 'no_results' && '⚠️ '}
                      {singleValidationResult.status === 'invalid' && '✗ '}
                      {singleValidationResult.message}
                    </span>
                  </div>
                  {singleValidationResult.details && (
                    <div className='text-xs text-gray-600 dark:text-gray-400 space-y-1'>
                      {singleValidationResult.details.searchKeyword && (
                        <div>
                          测试关键词:{' '}
                          {singleValidationResult.details.searchKeyword}
                        </div>
                      )}
                      {singleValidationResult.details.responseTime && (
                        <div>
                          响应时间:{' '}
                          {singleValidationResult.details.responseTime}ms
                        </div>
                      )}
                      {singleValidationResult.details.resultCount !==
                        undefined && (
                        <div>
                          搜索结果数:{' '}
                          {singleValidationResult.details.resultCount}
                        </div>
                      )}
                      {singleValidationResult.details.error && (
                        <div className='text-red-600 dark:text-red-400'>
                          错误信息: {singleValidationResult.details.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className='flex justify-end space-x-2'>
            <button
              onClick={handleCancelEdit}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={handleValidateSingleSource}
              disabled={
                !editingSource.api ||
                isSingleValidating ||
                isLoading('validateSingleSource')
              }
              className={`${
                !editingSource.api ||
                isSingleValidating ||
                isLoading('validateSingleSource')
                  ? buttonStyles.disabled
                  : buttonStyles.primary
              }`}
            >
              {isSingleValidating || isLoading('validateSingleSource')
                ? '检测中...'
                : '有效性检测'}
            </button>
            <button
              onClick={handleEditSource}
              disabled={
                !editingSource.name ||
                !editingSource.api ||
                isLoading('editSource')
              }
              className={`${
                !editingSource.name ||
                !editingSource.api ||
                isLoading('editSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('editSource') ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* 视频源列表 - Flex布局 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <div
          className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
          data-table='source-list'
        >
          {/* 表头 */}
          <div className='sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[1000px]'>
            <div className='flex items-center px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              <div className='w-6 flex-shrink-0 flex justify-center'></div>
              <div className='w-10 flex-shrink-0 flex justify-center'>
                <input
                  type='checkbox'
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                />
              </div>
              <div className='w-24 flex-shrink-0 px-2 text-left'>名称</div>
              <div className='w-20 flex-shrink-0 px-2 text-left min-w-[5rem]'>
                KEY
              </div>
              <div className='w-64 flex-shrink-0 px-2 text-left min-w-[16rem]'>
                API 地址
              </div>
              <div className='flex-1 min-w-0 px-2 text-left'>DETAIL 地址</div>
              <div className='w-20 flex-shrink-0 px-2 text-left'>状态</div>
              <div className='w-28 flex-shrink-0 px-2 text-left'>有效性</div>
              <div className='w-52 flex-shrink-0 px-2 text-left'>操作</div>
            </div>
          </div>

          {/* 列表内容 */}
          <SortableContext
            items={filteredSources.map((s) => s.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className='divide-y divide-gray-200 dark:divide-gray-700 min-w-[1000px]'>
              {filteredSources.length > 0 ? (
                filteredSources.map((source) => (
                  <DraggableRow key={source.key} source={source} />
                ))
              ) : (
                <div className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                  {searchKeyword.trim() ? '没有找到匹配的视频源' : '暂无视频源'}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </DndContext>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveSourceOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveSourceOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveSourceOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 有效性检测弹窗 */}
      {showValidationModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
            onClick={() => setShowValidationModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4'
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
                视频源有效性检测
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                请输入检测用的搜索关键词
              </p>
              <div className='space-y-4'>
                <input
                  type='text'
                  placeholder='请输入搜索关键词'
                  value={validationKeyword}
                  onChange={(e) => setValidationKeyword(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  onKeyPress={(e) =>
                    e.key === 'Enter' && handleValidateSources()
                  }
                />
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className='px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleValidateSources}
                    disabled={!validationKeyword.trim()}
                    className={`px-4 py-2 ${
                      !validationKeyword.trim()
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    开始检测
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 验证详情弹窗 */}
      {showValidationDetail &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowValidationDetail(null)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full relative'
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={() => setShowValidationDetail(null)}
                className='absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>

              <div className='p-6'>
                <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
                  搜索结果
                </h3>
                {(() => {
                  const status = getValidationStatus(showValidationDetail);
                  if (
                    !status ||
                    !status.resultTitles ||
                    status.resultTitles.length === 0
                  ) {
                    return (
                      <p className='text-sm text-gray-600 dark:text-gray-400'>
                        暂无搜索结果
                      </p>
                    );
                  }
                  return (
                    <div className='space-y-3'>
                      <p className='text-sm text-gray-600 dark:text-gray-400'>
                        找到 {status.resultCount} 个结果:
                      </p>
                      <ul className='space-y-2'>
                        {status.resultTitles.map((title, idx) => (
                          <li
                            key={idx}
                            className='text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700 rounded'
                          >
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 批量操作确认弹窗 */}
      {confirmModal.isOpen &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={confirmModal.onCancel}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                    {confirmModal.title}
                  </h3>
                  <button
                    onClick={confirmModal.onCancel}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {confirmModal.message}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={confirmModal.onCancel}
                    className={`px-4 py-2 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    disabled={
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                    }
                    className={`px-4 py-2 text-sm font-medium ${
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    {isLoading('batchSource_batch_enable') ||
                    isLoading('batchSource_batch_disable') ||
                    isLoading('batchSource_batch_delete')
                      ? '操作中...'
                      : '确认'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

// 分类配置组件

export default VideoSourceConfig;
