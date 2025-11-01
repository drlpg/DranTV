/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';

export function useSettings() {
  // 使用 lazy initialization 优化初始加载性能
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('defaultAggregateSearch');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [doubanProxyUrl, setDoubanProxyUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem('doubanProxyUrl');
    const defaultValue = (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
    return saved !== null ? saved : defaultValue;
  });

  const [enableOptimization, setEnableOptimization] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('enableOptimization');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [fluidSearch, setFluidSearch] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('fluidSearch');
    const defaultValue = (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
    return saved !== null ? JSON.parse(saved) : defaultValue;
  });

  const [liveDirectConnect, setLiveDirectConnect] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('liveDirectConnect');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [doubanDataSource, setDoubanDataSource] = useState(() => {
    if (typeof window === 'undefined') return 'cmliussss-cdn-tencent';
    const saved = localStorage.getItem('doubanDataSource');
    const defaultValue =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    return saved !== null ? saved : defaultValue;
  });

  const [doubanImageProxyType, setDoubanImageProxyType] = useState(() => {
    if (typeof window === 'undefined') return 'cmliussss-cdn-tencent';
    const saved = localStorage.getItem('doubanImageProxyType');
    const defaultValue =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    return saved !== null ? saved : defaultValue;
  });

  const [doubanImageProxyUrl, setDoubanImageProxyUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem('doubanImageProxyUrl');
    const defaultValue =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
    return saved !== null ? saved : defaultValue;
  });

  // 移除 useEffect，因为已经使用 lazy initialization
  // 从 localStorage 读取设置
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 空的 useEffect，保持代码结构
    // 所有初始化已移至 lazy initialization
  }, []);

  const handleAggregateToggle = (value: boolean) => {
    setDefaultAggregateSearch(value);
    localStorage.setItem('defaultAggregateSearch', JSON.stringify(value));
  };

  const handleDoubanProxyUrlChange = (value: string) => {
    setDoubanProxyUrl(value);
    localStorage.setItem('doubanProxyUrl', value);
  };

  const handleOptimizationToggle = (value: boolean) => {
    setEnableOptimization(value);
    localStorage.setItem('enableOptimization', JSON.stringify(value));
  };

  const handleFluidSearchToggle = (value: boolean) => {
    setFluidSearch(value);
    localStorage.setItem('fluidSearch', JSON.stringify(value));
  };

  const handleLiveDirectConnectToggle = (value: boolean) => {
    setLiveDirectConnect(value);
    localStorage.setItem('liveDirectConnect', JSON.stringify(value));
  };

  const handleDoubanDataSourceChange = (value: string) => {
    setDoubanDataSource(value);
    localStorage.setItem('doubanDataSource', value);
  };

  const handleDoubanImageProxyTypeChange = (value: string) => {
    setDoubanImageProxyType(value);
    localStorage.setItem('doubanImageProxyType', value);
  };

  const handleDoubanImageProxyUrlChange = (value: string) => {
    setDoubanImageProxyUrl(value);
    localStorage.setItem('doubanImageProxyUrl', value);
  };

  const handleResetSettings = () => {
    const defaultDoubanProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    const defaultDoubanProxy =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
    const defaultDoubanImageProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    const defaultDoubanImageProxyUrl =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
    const defaultFluidSearch =
      (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;

    setDefaultAggregateSearch(true);
    setEnableOptimization(true);
    setFluidSearch(defaultFluidSearch);
    setLiveDirectConnect(false);
    setDoubanProxyUrl(defaultDoubanProxy);
    setDoubanDataSource(defaultDoubanProxyType);
    setDoubanImageProxyType(defaultDoubanImageProxyType);
    setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);

    localStorage.setItem('defaultAggregateSearch', JSON.stringify(true));
    localStorage.setItem('enableOptimization', JSON.stringify(true));
    localStorage.setItem('fluidSearch', JSON.stringify(defaultFluidSearch));
    localStorage.setItem('liveDirectConnect', JSON.stringify(false));
    localStorage.setItem('doubanProxyUrl', defaultDoubanProxy);
    localStorage.setItem('doubanDataSource', defaultDoubanProxyType);
    localStorage.setItem('doubanImageProxyType', defaultDoubanImageProxyType);
    localStorage.setItem('doubanImageProxyUrl', defaultDoubanImageProxyUrl);
  };

  return {
    // 状态
    defaultAggregateSearch,
    doubanProxyUrl,
    enableOptimization,
    fluidSearch,
    liveDirectConnect,
    doubanDataSource,
    doubanImageProxyType,
    doubanImageProxyUrl,
    // 处理函数
    handleAggregateToggle,
    handleDoubanProxyUrlChange,
    handleOptimizationToggle,
    handleFluidSearchToggle,
    handleLiveDirectConnectToggle,
    handleDoubanDataSourceChange,
    handleDoubanImageProxyTypeChange,
    handleDoubanImageProxyUrlChange,
    handleResetSettings,
  };
}
