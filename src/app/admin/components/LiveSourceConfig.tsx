'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  GripVertical,
  ExternalLink,
  Copy,
  RefreshCw,
  Download,
  Upload,
  AlertCircle,
  Eye,
  Tv,
} from 'lucide-react';
import { AdminConfig, LiveDataSource, Channel } from '../types';
import { buttonStyles } from '../utils/constants';
import { showError, showSuccess } from '../utils/helpers';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { AlertModal } from './modals/AlertModal';

const LiveSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [liveSources, setLiveSources] = useState<LiveDataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLiveSource, setEditingLiveSource] =
    useState<LiveDataSource | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [newLiveSource, setNewLiveSource] = useState<LiveDataSource>({
    name: '',
    key: '',
    url: '',
    ua: '',
    epg: '',
    disabled: false,
    from: 'custom',
  });

  // 订阅配置相关状态
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // 导入配置相关状态
  const [showImportForm, setShowImportForm] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // 批量选择状态
  const [selectedLiveSources, setSelectedLiveSources] = useState<Set<string>>(
    new Set()
  );

  // 有效性检测相关状态
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Array<{
      key: string;
      name: string;
      status: 'valid' | 'invalid' | 'validating';
      message: string;
      channelCount?: number;
    }>
  >([]);

  // 单个直播源检测状态
  const [isSingleValidating, setIsSingleValidating] = useState(false);
  const [singleValidationResult, setSingleValidationResult] = useState<{
    status: 'valid' | 'invalid' | 'validating' | null;
    message: string;
    channelCount?: number;
  }>({ status: null, message: '' });

  // 频道管理相关状态
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [currentLiveSourceKey, setCurrentLiveSourceKey] = useState<string>('');
  const [channels, setChannels] = useState<
    Array<{
      id: string;
      name: string;
      url: string;
      disabled?: boolean;
    }>
  >([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set()
  );
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelSearchKeyword, setChannelSearchKeyword] = useState('');

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
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.LiveConfig) {
      setLiveSources(config.LiveConfig);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
    if (config?.LiveSubscription) {
      setSubscriptionUrl(config.LiveSubscription.URL);
      setAutoUpdate(config.LiveSubscription.AutoUpdate);
      setLastCheckTime(config.LiveSubscription.LastCheck || '');
    } else {
      // 如果订阅配置不存在，清空状态
      setSubscriptionUrl('');
      setAutoUpdate(false);
      setLastCheckTime('');
    }
  }, [config]);

  // 过滤直播源
  const filteredLiveSources = useMemo(() => {
    if (!searchKeyword.trim()) {
      return liveSources;
    }
    const keyword = searchKeyword.toLowerCase().trim();
    return liveSources.filter(
      (source) =>
        source.name.toLowerCase().includes(keyword) ||
        source.key.toLowerCase().includes(keyword) ||
        source.url.toLowerCase().includes(keyword) ||
        (source.epg && source.epg.toLowerCase().includes(keyword))
    );
  }, [liveSources, searchKeyword]);

  // 通用 API 请求
  const callLiveSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/live', {
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
    const target = liveSources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleLiveSource_${key}`, () =>
      callLiveSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteLiveSource_${key}`, () =>
      callLiveSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  // 刷新直播源
  const handleRefreshLiveSources = async () => {
    if (isRefreshing) return;

    await withLoading('refreshLiveSources', async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch('/api/admin/live/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `刷新失败: ${response.status}`);
        }

        // 刷新成功后重新获取配置
        await refreshConfig();
        showAlert({
          type: 'success',
          title: '刷新成功',
          message: '直播源已刷新',
          timer: 2000,
        });
      } catch (err) {
        showError(err instanceof Error ? err.message : '刷新失败', showAlert);
        throw err;
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  // 批量操作
  const handleBatchOperation = async (
    action: 'batch_enable' | 'batch_disable' | 'batch_delete'
  ) => {
    if (selectedLiveSources.size === 0) return;

    const keys = Array.from(selectedLiveSources);
    await withLoading(`batchLiveSource_${action}`, async () => {
      try {
        const resp = await fetch('/api/admin/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, keys }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${resp.status}`);
        }

        await refreshConfig();
        setSelectedLiveSources(new Set());
        showSuccess(
          action === 'batch_enable'
            ? '批量启用成功'
            : action === 'batch_disable'
            ? '批量禁用成功'
            : '批量删除成功',
          showAlert
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  // 获取检测状态
  const getValidationStatus = (key: string) => {
    const result = validationResults.find((r) => r.key === key);
    if (!result) return null;

    if (result.status === 'validating') {
      return {
        text: '检测中',
        icon: '⏳',
        className:
          'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
        message: '正在检测直播源...',
      };
    } else if (result.status === 'valid') {
      return {
        text: '可用',
        icon: '✓',
        className:
          'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
        message: `检测通过，频道数: ${result.channelCount || 0}`,
      };
    } else {
      return {
        text: '不可用',
        icon: '✗',
        className:
          'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
        message: result.message || '检测失败',
      };
    }
  };

  // 批量检测直播源
  const handleValidateLiveSources = async () => {
    const sourcesToValidate = liveSources.filter((s) => !s.disabled);

    if (sourcesToValidate.length === 0) {
      showAlert({
        type: 'warning',
        title: '没有可检测的直播源',
        message: '请确保至少有一个启用的直播源',
        showConfirm: true,
      });
      return;
    }

    setIsValidating(true);
    setValidationResults(
      sourcesToValidate.map((s) => ({
        key: s.key,
        name: s.name,
        status: 'validating' as const,
        message: '等待检测...',
      }))
    );

    // 逐个检测
    for (const source of sourcesToValidate) {
      try {
        // 使用channels API来检测直播源是否可用
        const response = await fetch(
          `/api/live/channels?source=${encodeURIComponent(source.key)}`
        );

        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data)) {
          const channelCount = data.data.length;
          setValidationResults((prev) =>
            prev.map((r) =>
              r.key === source.key
                ? {
                    ...r,
                    status: channelCount > 0 ? 'valid' : 'invalid',
                    message:
                      channelCount > 0
                        ? `检测通过，频道数: ${channelCount}`
                        : '未找到可用频道',
                    channelCount: channelCount,
                  }
                : r
            )
          );
        } else {
          setValidationResults((prev) =>
            prev.map((r) =>
              r.key === source.key
                ? {
                    ...r,
                    status: 'invalid' as const,
                    message: data.error || '检测失败',
                  }
                : r
            )
          );
        }
      } catch (error) {
        setValidationResults((prev) =>
          prev.map((r) =>
            r.key === source.key
              ? {
                  ...r,
                  status: 'invalid' as const,
                  message: '网络错误或服务异常',
                }
              : r
          )
        );
      }
    }

    setIsValidating(false);
  };

  // 获取频道列表
  const handleViewChannels = async (liveSourceKey: string) => {
    setCurrentLiveSourceKey(liveSourceKey);
    setShowChannelModal(true);
    setIsLoadingChannels(true);
    setChannels([]);
    setSelectedChannels(new Set());

    try {
      const url = `/api/live/channels?source=${encodeURIComponent(
        liveSourceKey
      )}`;
      const response = await fetch(url, {
        cache: 'no-store', // 禁用缓存
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data)) {
        setChannels(data.data);
      } else {
        showAlert({
          type: 'error',
          title: '获取频道失败',
          message: data.error || '无法获取频道列表',
          showConfirm: true,
        });
      }
    } catch (error) {
      console.error('[LiveSourceConfig] 获取频道失败:', error);
      showAlert({
        type: 'error',
        title: '获取频道失败',
        message: '网络错误或服务异常',
        showConfirm: true,
      });
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // 关闭频道管理弹窗（不保存）
  const handleCloseChannelModal = () => {
    setShowChannelModal(false);
    setCurrentLiveSourceKey('');
    setChannels([]);
    setSelectedChannels(new Set());
    setChannelSearchKeyword('');
  };

  // 保存所有配置修改
  const handleSaveAllConfig = async () => {
    // 验证必要数据
    if (!currentLiveSourceKey) {
      showAlert({
        type: 'error',
        title: '保存失败',
        message: '未找到直播源标识',
        showConfirm: true,
      });
      return;
    }

    if (!channels || channels.length === 0) {
      showAlert({
        type: 'warning',
        title: '提示',
        message: '没有频道数据需要保存',
        showConfirm: true,
      });
      return;
    }

    await withLoading('saveLiveSubscription', async () => {
      try {
        // 1. 保存频道修改到数据库
        const channelResponse = await fetch('/api/live/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKey: currentLiveSourceKey,
            channels: channels,
          }),
        });

        if (!channelResponse.ok) {
          const data = await channelResponse.json().catch(() => ({}));
          throw new Error(data.error || '保存频道失败');
        }

        // 2. 如果有订阅配置，保存订阅配置
        if (subscriptionUrl) {
          const subscriptionResponse = await fetch(
            '/api/admin/live/subscription',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: subscriptionUrl,
                autoUpdate: autoUpdate,
                lastCheck: lastCheckTime || new Date().toISOString(),
              }),
            }
          );

          if (!subscriptionResponse.ok) {
            const data = await subscriptionResponse.json().catch(() => ({}));
            if (subscriptionResponse.status === 504) {
              throw new Error('保存超时，操作可能已完成。请刷新页面查看状态。');
            }
            throw new Error(
              data.error ||
                `保存失败 (${subscriptionResponse.status}): ${
                  subscriptionResponse.statusText || '未知错误'
                }`
            );
          }
        }

        // 刷新配置（后端已经更新了频道数，刷新后会自动同步）
        await refreshConfig();

        showAlert({
          type: 'success',
          title: '保存成功',
          message: '配置已保存',
          timer: 1500,
        });

        // 关闭弹窗
        handleCloseChannelModal();
      } catch (error) {
        console.error('[LiveSourceConfig] 保存配置失败:', error);
        showAlert({
          type: 'error',
          title: '保存失败',
          message: error instanceof Error ? error.message : '保存配置失败',
          showConfirm: true,
        });
        throw error;
      }
    });
  };

  // 过滤频道列表
  const filteredChannels = useMemo(() => {
    if (!channelSearchKeyword.trim()) {
      return channels;
    }
    const keyword = channelSearchKeyword.toLowerCase().trim();
    return channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(keyword) ||
        channel.url.toLowerCase().includes(keyword)
    );
  }, [channels, channelSearchKeyword]);

  // 切换频道启用/禁用状态
  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, disabled: !ch.disabled } : ch
      )
    );
  };

  // 删除频道
  const handleDeleteChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
  };

  // 批量操作频道
  const handleBatchChannelOperation = (
    action: 'enable' | 'disable' | 'delete'
  ) => {
    if (selectedChannels.size === 0) return;

    if (action === 'delete') {
      setChannels((prev) => prev.filter((ch) => !selectedChannels.has(ch.id)));
    } else {
      setChannels((prev) =>
        prev.map((ch) =>
          selectedChannels.has(ch.id)
            ? { ...ch, disabled: action === 'disable' }
            : ch
        )
      );
    }
    setSelectedChannels(new Set());
  };

  // 全选/取消全选频道（基于过滤后的列表）
  const handleSelectAllChannels = () => {
    const filteredIds = new Set(filteredChannels.map((ch) => ch.id));
    const allFilteredSelected = filteredChannels.every((ch) =>
      selectedChannels.has(ch.id)
    );

    if (allFilteredSelected) {
      // 取消选中所有过滤后的频道
      setSelectedChannels(
        new Set(
          Array.from(selectedChannels).filter((id) => !filteredIds.has(id))
        )
      );
    } else {
      // 选中所有过滤后的频道
      setSelectedChannels(
        new Set([...Array.from(selectedChannels), ...Array.from(filteredIds)])
      );
    }
  };

  // 切换单个频道选择
  const handleToggleChannelSelect = (channelId: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId);
    } else {
      newSelected.add(channelId);
    }
    setSelectedChannels(newSelected);
  };

  // 单个直播源检测
  const handleValidateSingleLiveSource = async () => {
    if (!editingLiveSource?.url) {
      showAlert({
        type: 'warning',
        title: '直播源URL不能为空',
        message: '请输入直播源URL',
        showConfirm: true,
      });
      return;
    }

    setIsSingleValidating(true);
    setSingleValidationResult({
      status: 'validating',
      message: '正在检测...',
    });

    try {
      const response = await fetch('/api/live/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editingLiveSource.url }),
      });

      const data = await response.json();

      setSingleValidationResult({
        status: data.success ? 'valid' : 'invalid',
        message: data.success
          ? `检测通过，频道数: ${data.channelCount || 0}`
          : data.error || '检测失败',
        channelCount: data.channelCount,
      });
    } catch (error) {
      setSingleValidationResult({
        status: 'invalid',
        message: '网络错误或服务异常',
      });
    } finally {
      setIsSingleValidating(false);
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedLiveSources.size === filteredLiveSources.length) {
      setSelectedLiveSources(new Set());
    } else {
      setSelectedLiveSources(
        new Set(filteredLiveSources.map((source) => source.key))
      );
    }
  };

  // 切换单个选择
  const handleToggleSelect = (key: string) => {
    const newSelected = new Set(selectedLiveSources);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedLiveSources(newSelected);
  };

  const handleAddLiveSource = () => {
    if (!newLiveSource.name || !newLiveSource.key || !newLiveSource.url) return;
    withLoading('addLiveSource', async () => {
      await callLiveSourceApi({
        action: 'add',
        key: newLiveSource.key,
        name: newLiveSource.name,
        url: newLiveSource.url,
        ua: newLiveSource.ua,
        epg: newLiveSource.epg,
      });
      setNewLiveSource({
        name: '',
        key: '',
        url: '',
        epg: '',
        ua: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newLiveSource);
    });
  };

  const handleEditLiveSource = () => {
    if (!editingLiveSource || !editingLiveSource.name || !editingLiveSource.url)
      return;
    withLoading('editLiveSource', async () => {
      await callLiveSourceApi({
        action: 'edit',
        key: editingLiveSource.key,
        name: editingLiveSource.name,
        url: editingLiveSource.url,
        ua: editingLiveSource.ua,
        epg: editingLiveSource.epg,
      });
      setEditingLiveSource(null);
    }).catch(() => {
      console.error('操作失败', 'edit', editingLiveSource);
    });
  };

  const handleCancelEdit = () => {
    setEditingLiveSource(null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = liveSources.findIndex((s) => s.key === active.id);
    const newIndex = liveSources.findIndex((s) => s.key === over.id);
    setLiveSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = liveSources.map((s) => s.key);
    withLoading('saveLiveSourceOrder', () =>
      callLiveSourceApi({ action: 'sort', order })
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
    await withLoading('saveLiveSubscription', async () => {
      try {
        const resp = await fetch('/api/admin/live/subscription', {
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
              `保存失败 (${resp.status}): ${resp.statusText || '未知错误'}`
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
    await withLoading('clearLiveSubscription', async () => {
      try {
        const resp = await fetch('/api/admin/live/subscription', {
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
              '清除超时，可能是数据量较大。操作可能已部分完成，请刷新页面查看状态。'
            );
          }
          throw new Error(
            data.error ||
              `清除失败 (${resp.status}): ${resp.statusText || '未知错误'}`
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

  // 从URL导入直播源配置
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      showError('请输入导入URL', showAlert);
      return;
    }

    await withLoading('importLiveSources', async () => {
      try {
        const resp = await fetch('/api/admin/live/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: importUrl,
            saveSubscription: true,
            autoUpdate: autoUpdate,
          }),
        }).catch((error) => {
          // 处理网络错误
          throw new Error(
            '无法连接到服务器，请检查网络连接或服务器是否正常运行'
          );
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          // 特殊处理504超时错误
          if (resp.status === 504) {
            throw new Error(
              '导入超时，可能是订阅源响应较慢或包含大量数据。请稍后重试或检查订阅链接是否可访问。'
            );
          }
          throw new Error(
            data.error ||
              `导入失败 (${resp.status}): ${resp.statusText || '未知错误'}`
          );
        }

        const data = await resp.json();
        if (data.sources && data.sources.length > 0) {
          const formatInfo = data.format
            ? ` (格式: ${data.format.toUpperCase()})`
            : '';
          showSuccess(
            data.message ||
              `成功导入 ${data.sources.length} 个直播源${formatInfo}`,
            showAlert
          );
          // 刷新配置以获取最新数据
          await refreshConfig();

          // 更新订阅URL为当前导入的URL
          setSubscriptionUrl(importUrl);
          setLastCheckTime(new Date().toISOString());
          setImportUrl('');
          setShowImportForm(false);
        } else {
          showError('导入失败：未获取到直播源数据', showAlert);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '导入失败', showAlert);
        throw err;
      }
    });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ liveSource }: { liveSource: LiveDataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: liveSource.key });

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
        <div
          className='w-6 flex-shrink-0 flex justify-center cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </div>
        <div className='w-10 flex-shrink-0 flex justify-center'>
          <input
            type='checkbox'
            checked={selectedLiveSources.has(liveSource.key)}
            onChange={() => handleToggleSelect(liveSource.key)}
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer'
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className='w-28 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'>
          {liveSource.name}
        </div>
        <div className='w-32 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'>
          {liveSource.key}
        </div>
        <div
          className='flex-1 min-w-[180px] px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'
          title={liveSource.url}
        >
          {liveSource.url}
        </div>
        <div className='w-16 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 text-center'>
          {liveSource.channelNumber && liveSource.channelNumber > 0
            ? liveSource.channelNumber
            : '-'}
        </div>
        <div className='w-20 flex-shrink-0 px-2'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !liveSource.disabled
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!liveSource.disabled ? '启用中' : '已禁用'}
          </span>
        </div>
        {/* 有效性 */}
        <div className='w-28 flex-shrink-0 px-2'>
          {(() => {
            const status = getValidationStatus(liveSource.key);
            if (!status) {
              return (
                <span className='px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                  未检测
                </span>
              );
            }
            return (
              <span
                className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${status.className}`}
                title={status.message}
              >
                {status.icon} {status.text}
              </span>
            );
          })()}
        </div>
        <div className='w-72 flex-shrink-0 px-2 flex gap-2'>
          <button
            onClick={() => handleViewChannels(liveSource.key)}
            className={`flex-1 inline-flex items-center justify-center ${buttonStyles.roundedPrimary}`}
          >
            查看
          </button>
          <button
            onClick={() => handleToggleEnable(liveSource.key)}
            disabled={isLoading(`toggleLiveSource_${liveSource.key}`)}
            className={`flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !liveSource.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleLiveSource_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!liveSource.disabled ? '禁用' : '启用'}
          </button>
          <button
            onClick={() => setEditingLiveSource(liveSource)}
            disabled={isLoading(`editLiveSource_${liveSource.key}`)}
            className={`flex-1 inline-flex items-center justify-center ${
              buttonStyles.roundedPrimary
            } ${
              isLoading(`editLiveSource_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(liveSource.key)}
            disabled={isLoading(`deleteLiveSource_${liveSource.key}`)}
            className={`flex-1 inline-flex items-center justify-center ${
              buttonStyles.roundedSecondary
            } ${
              isLoading(`deleteLiveSource_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            删除
          </button>
        </div>
      </div>
    );
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
      {/* 导入直播源表单 */}
      {showImportForm && (
        <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              从URL导入直播源
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
              placeholder='https://example.com/live.m3u'
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
              disabled={isLoading('importLiveSources') || !importUrl.trim()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isLoading('importLiveSources') || !importUrl.trim()
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('importLiveSources') ? (
                <div className='flex items-center justify-center gap-2'>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                  导入中…
                </div>
              ) : (
                '导入直播源'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 标题和搜索栏 */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          直播源列表 ({liveSources.length})
        </h4>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2'>
          {/* 批量操作按钮 */}
          {selectedLiveSources.size > 0 && (
            <>
              <div className='flex flex-wrap items-center gap-3'>
                <span className='text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                  已选择 {selectedLiveSources.size} 个直播源
                </span>
                <button
                  onClick={() => handleBatchOperation('batch_enable')}
                  disabled={isLoading('batchLiveSource_batch_enable')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchLiveSource_batch_enable')
                      ? buttonStyles.disabled
                      : buttonStyles.success
                  }`}
                >
                  {isLoading('batchLiveSource_batch_enable')
                    ? '启用中...'
                    : '批量启用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_disable')}
                  disabled={isLoading('batchLiveSource_batch_disable')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchLiveSource_batch_disable')
                      ? buttonStyles.disabled
                      : buttonStyles.warning
                  }`}
                >
                  {isLoading('batchLiveSource_batch_disable')
                    ? '禁用中...'
                    : '批量禁用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_delete')}
                  disabled={isLoading('batchLiveSource_batch_delete')}
                  className={`px-3 py-1 text-sm whitespace-nowrap ${
                    isLoading('batchLiveSource_batch_delete')
                      ? buttonStyles.disabled
                      : buttonStyles.danger
                  }`}
                >
                  {isLoading('batchLiveSource_batch_delete')
                    ? '删除中...'
                    : '批量删除'}
                </button>
              </div>
              <div className='hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600'></div>
            </>
          )}
          {/* 当没有选中项时显示搜索框和其他按钮 */}
          {selectedLiveSources.size === 0 && (
            <input
              type='text'
              placeholder='搜索名称、KEY、地址...'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className='px-[10px] py-[5px] text-sm border border-gray-300 focus:!border-blue-500 dark:border-gray-600 dark:focus:!border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-full sm:w-64'
              style={{ outline: 'none', boxShadow: 'none' }}
              onFocus={(e) => {
                e.target.style.outline = 'none';
                e.target.style.boxShadow = 'none';
              }}
            />
          )}
          <button
            onClick={() => {
              setShowImportForm(!showImportForm);
              if (showImportForm) {
                setImportUrl('');
              }
              // 关闭添加表单
              if (showAddForm) {
                setShowAddForm(false);
              }
            }}
            className={`w-full sm:w-auto text-center ${
              showImportForm ? buttonStyles.secondary : buttonStyles.primary
            }`}
          >
            {showImportForm ? '取消导入' : '导入配置'}
          </button>
          <button
            onClick={handleRefreshLiveSources}
            disabled={isRefreshing || isLoading('refreshLiveSources')}
            className={`w-full sm:w-auto px-3 py-1.5 text-sm font-medium flex items-center justify-center space-x-2 ${
              isRefreshing || isLoading('refreshLiveSources')
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors'
            }`}
          >
            <span>
              {isRefreshing || isLoading('refreshLiveSources')
                ? '刷新中...'
                : '刷新直播源'}
            </span>
          </button>
          <button
            onClick={handleValidateLiveSources}
            disabled={isValidating}
            className={`w-full sm:w-auto px-3 py-1.5 text-sm font-medium ${
              isValidating ? buttonStyles.disabled : buttonStyles.primary
            }`}
          >
            {isValidating ? '检测中...' : '有效性检测'}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
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
            {showAddForm ? '取消' : '添加直播源'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newLiveSource.name}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newLiveSource.key}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='M3U 地址'
              value={newLiveSource.url}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, url: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='节目单地址（选填）'
              value={newLiveSource.epg}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, epg: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='自定义 UA（选填）'
              value={newLiveSource.ua}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, ua: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddLiveSource}
              disabled={
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addLiveSource') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 编辑直播源表单 */}
      {editingLiveSource && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='flex items-center justify-between'>
            <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              编辑直播源: {editingLiveSource.name}
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
                value={editingLiveSource.name}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
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
                value={editingLiveSource.key}
                disabled
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                M3U 地址
              </label>
              <input
                type='text'
                value={editingLiveSource.url}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, url: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                节目单地址（选填）
              </label>
              <input
                type='text'
                value={editingLiveSource.epg}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, epg: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                自定义 UA（选填）
              </label>
              <input
                type='text'
                value={editingLiveSource.ua}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, ua: e.target.value } : null
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
                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {singleValidationResult.status === 'valid' && '✓ '}
                      {singleValidationResult.status === 'validating' && '⏳ '}
                      {singleValidationResult.status === 'invalid' && '✗ '}
                      {singleValidationResult.message}
                    </span>
                  </div>
                  {singleValidationResult.channelCount !== undefined && (
                    <div className='text-xs text-gray-600 dark:text-gray-400'>
                      频道数: {singleValidationResult.channelCount}
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
              onClick={handleValidateSingleLiveSource}
              disabled={
                !editingLiveSource.url ||
                isSingleValidating ||
                isLoading('validateSingleLiveSource')
              }
              className={`${
                !editingLiveSource.url ||
                isSingleValidating ||
                isLoading('validateSingleLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.primary
              }`}
            >
              {isSingleValidating || isLoading('validateSingleLiveSource')
                ? '检测中...'
                : '有效性检测'}
            </button>
            <button
              onClick={handleEditLiveSource}
              disabled={
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
              }
              className={`${
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('editLiveSource') ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* 直播源列表 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto md:overflow-x-hidden relative'>
          {/* 表头 */}
          <div className='sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[800px] md:min-w-0'>
            <div className='flex items-center px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              <div className='w-6 flex-shrink-0 flex justify-center'></div>
              <div className='w-10 flex-shrink-0 flex justify-center'>
                <input
                  type='checkbox'
                  checked={
                    filteredLiveSources.length > 0 &&
                    selectedLiveSources.size === filteredLiveSources.length
                  }
                  onChange={handleSelectAll}
                  className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer'
                />
              </div>
              <div className='w-28 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                名称
              </div>
              <div className='w-32 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                KEY
              </div>
              <div className='flex-1 min-w-[180px] px-2 whitespace-nowrap text-left'>
                M3U地址
              </div>
              <div className='w-16 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                频道数
              </div>
              <div className='w-20 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                状态
              </div>
              <div className='w-28 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                有效性
              </div>
              <div className='w-72 flex-shrink-0 px-2 whitespace-nowrap text-left'>
                操作
              </div>
            </div>
          </div>

          {/* 内容 */}
          <SortableContext
            items={filteredLiveSources.map((s) => s.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className='divide-y divide-gray-200 dark:divide-gray-700 min-w-[800px] md:min-w-0'>
              {filteredLiveSources.length > 0 ? (
                filteredLiveSources.map((liveSource) => (
                  <DraggableRow key={liveSource.key} liveSource={liveSource} />
                ))
              ) : (
                <div className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                  {searchKeyword.trim() ? '没有找到匹配的直播源' : '暂无直播源'}
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
            disabled={isLoading('saveLiveSourceOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveLiveSourceOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveLiveSourceOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 频道管理弹窗 */}
      {showChannelModal &&
        createPortal(
          <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'
            onClick={handleCloseChannelModal}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden'
              onClick={(e) => e.stopPropagation()}
            >
              {/* 弹窗标题 */}
              <div className='flex items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-700'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0'>
                  直播源管理
                </h3>
                <div className='flex items-center gap-3 flex-1 justify-end'>
                  <input
                    type='text'
                    placeholder='搜索频道名称或地址...'
                    value={channelSearchKeyword}
                    onChange={(e) => setChannelSearchKeyword(e.target.value)}
                    className='px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-64'
                  />
                  <button
                    onClick={handleCloseChannelModal}
                    className='text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0'
                  >
                    <svg
                      className='w-6 h-6'
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
              </div>

              {/* 频道列表 */}
              <div className='flex-1 overflow-y-auto overflow-x-auto'>
                {isLoadingChannels ? (
                  <div className='flex items-center justify-center h-64'>
                    <div className='text-center'>
                      <div className='w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2'></div>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>
                        加载中...
                      </p>
                    </div>
                  </div>
                ) : channels.length === 0 ? (
                  <div className='flex items-center justify-center h-64'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      暂无频道数据
                    </p>
                  </div>
                ) : (
                  <table className='w-full'>
                    <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                      <tr>
                        <th className='w-12 px-4 py-3 text-left'>
                          <input
                            type='checkbox'
                            checked={
                              filteredChannels.length > 0 &&
                              filteredChannels.every((ch) =>
                                selectedChannels.has(ch.id)
                              )
                            }
                            onChange={handleSelectAllChannels}
                            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer'
                          />
                        </th>
                        <th className='w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          序号
                        </th>
                        <th className='w-40 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          频道名称
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          频道地址
                        </th>
                        <th className='w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          状态
                        </th>
                        <th className='w-40 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
                      {filteredChannels.map((channel, index) => (
                        <tr
                          key={channel.id}
                          className='hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                        >
                          <td className='px-4 py-3'>
                            <input
                              type='checkbox'
                              checked={selectedChannels.has(channel.id)}
                              onChange={() =>
                                handleToggleChannelSelect(channel.id)
                              }
                              className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer'
                            />
                          </td>
                          <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                            {index + 1}
                          </td>
                          <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                            {channel.name}
                          </td>
                          <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                            <div
                              className='max-w-xs overflow-hidden text-ellipsis whitespace-nowrap'
                              title={channel.url}
                            >
                              {channel.url}
                            </div>
                          </td>
                          <td className='px-4 py-3'>
                            <span
                              className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                !channel.disabled
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                              }`}
                            >
                              {!channel.disabled ? '启用' : '禁用'}
                            </span>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='flex gap-2'>
                              <button
                                onClick={() => handleToggleChannel(channel.id)}
                                className={`px-3 py-1 text-xs rounded-lg ${
                                  !channel.disabled
                                    ? buttonStyles.warning
                                    : buttonStyles.success
                                }`}
                              >
                                {!channel.disabled ? '禁用' : '启用'}
                              </button>
                              <button
                                onClick={() => handleDeleteChannel(channel.id)}
                                className={`px-3 py-1 text-xs rounded-lg ${buttonStyles.danger}`}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 底部操作栏 */}
              <div className='border-t border-gray-200 dark:border-gray-700'>
                {/* 批量操作栏 */}
                {selectedChannels.size > 0 && (
                  <div className='flex flex-wrap items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      已选择 {selectedChannels.size} 个频道
                    </span>
                    <button
                      onClick={() => handleBatchChannelOperation('enable')}
                      className={`px-3 py-1 text-sm ${buttonStyles.success}`}
                    >
                      批量启用
                    </button>
                    <button
                      onClick={() => handleBatchChannelOperation('disable')}
                      className={`px-3 py-1 text-sm ${buttonStyles.warning}`}
                    >
                      批量禁用
                    </button>
                    <button
                      onClick={() => handleBatchChannelOperation('delete')}
                      className={`px-3 py-1 text-sm ${buttonStyles.danger}`}
                    >
                      批量删除
                    </button>
                  </div>
                )}

                {/* 订阅配置区域 */}
                {subscriptionUrl && (
                  <div className='p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                      <div className='flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
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
                            最后更新:{' '}
                            {new Date(lastCheckTime).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setAutoUpdate(!autoUpdate)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            autoUpdate
                              ? buttonStyles.warning
                              : buttonStyles.success
                          }`}
                        >
                          {autoUpdate ? '禁用自动更新' : '启用自动更新'}
                        </button>
                        <button
                          onClick={handleSaveAllConfig}
                          disabled={isLoading('saveLiveSubscription')}
                          className={`px-6 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            isLoading('saveLiveSubscription')
                              ? buttonStyles.disabled
                              : buttonStyles.primary
                          }`}
                        >
                          {isLoading('saveLiveSubscription')
                            ? '保存中...'
                            : '保存配置'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
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
    </div>
  );
};

export default LiveSourceConfig;
