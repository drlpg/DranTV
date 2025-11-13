import { useCallback, useRef } from 'react';

/**
 * 节流Hook
 * 限制函数执行频率
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay = 300
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        return callback(...args);
      }
    }) as T,
    [callback, delay]
  );
}
