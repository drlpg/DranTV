/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';

export function useSettings() {
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(true);
  const [doubanProxyUrl, setDoubanProxyUrl] = useState('');
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [fluidSearch, setFluidSearch] = useState(true);
  const [liveDirectConnect, setLiveDirectConnect] = useState(false);
  const [doubanDataSource, setDoubanDataSource] = useState(
    'cmliussss-cdn-tencent'
  );
  const [doubanImageProxyType, setDoubanImageProxyType] = useState(
    'cmliussss-cdn-tencent'
  );
  const [doubanImageProxyUrl, setDoubanImageProxyUrl] = useState('');

  // 从 localStorage 读取设置
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedAggregateSearch = localStorage.getItem('defaultAggregateSearch');
    if (savedAggregateSearch !== null) {
      setDefaultAggregateSearch(JSON.parse(savedAggregateSearch));
    }

    const savedDoubanDataSource = localStorage.getItem('doubanDataSource');
    const defaultDoubanProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    if (savedDoubanDataSource !== null) {
      setDoubanDataSource(savedDoubanDataSource);
    } else if (defaultDoubanProxyType) {
      setDoubanDataSource(defaultDoubanProxyType);
    }

    const savedDoubanProxyUrl = localStorage.getItem('doubanProxyUrl');
    const defaultDoubanProxy =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
    if (savedDoubanProxyUrl !== null) {
      setDoubanProxyUrl(savedDoubanProxyUrl);
    } else if (defaultDoubanProxy) {
      setDoubanProxyUrl(defaultDoubanProxy);
    }

    const savedDoubanImageProxyType = localStorage.getItem(
      'doubanImageProxyType'
    );
    const defaultDoubanImageProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    if (savedDoubanImageProxyType !== null) {
      setDoubanImageProxyType(savedDoubanImageProxyType);
    } else if (defaultDoubanImageProxyType) {
      setDoubanImageProxyType(defaultDoubanImageProxyType);
    }

    const savedDoubanImageProxyUrl = localStorage.getItem(
      'doubanImageProxyUrl'
    );
    const defaultDoubanImageProxyUrl =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
    if (savedDoubanImageProxyUrl !== null) {
      setDoubanImageProxyUrl(savedDoubanImageProxyUrl);
    } else if (defaultDoubanImageProxyUrl) {
      setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);
    }

    const savedEnableOptimization = localStorage.getItem('enableOptimization');
    if (savedEnableOptimization !== null) {
      setEnableOptimization(JSON.parse(savedEnableOptimization));
    }

    const savedFluidSearch = localStorage.getItem('fluidSearch');
    const defaultFluidSearch =
      (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
    if (savedFluidSearch !== null) {
      setFluidSearch(JSON.parse(savedFluidSearch));
    } else if (defaultFluidSearch !== undefined) {
      setFluidSearch(defaultFluidSearch);
    }

    const savedLiveDirectConnect = localStorage.getItem('liveDirectConnect');
    if (savedLiveDirectConnect !== null) {
      setLiveDirectConnect(JSON.parse(savedLiveDirectConnect));
    }
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
