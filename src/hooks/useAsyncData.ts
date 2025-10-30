import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAsyncDataOptions<T> {
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean; // 是否自动执行
}

interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

/**
 * 通用的异步数据加载Hook
 * 简化数据获取逻辑，提供统一的加载状态管理
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataReturn<T> {
  const { initialData = null, onSuccess, onError, enabled = true } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 使用ref跟踪最新的请求，避免竞态条件
  const latestRequestId = useRef(0);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();

      // 只有当这是最新的请求且组件仍然挂载时才更新状态
      if (requestId === latestRequestId.current && isMounted.current) {
        setData(result);
        onSuccess?.(result);
      }
    } catch (err) {
      if (requestId === latestRequestId.current && isMounted.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      if (requestId === latestRequestId.current && isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetcher, enabled, onSuccess, onError]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, [...deps, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}
