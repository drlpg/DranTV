'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '../lib/auth';
import { WebSocketMessage } from '../lib/types';

// 全局连接计数器，用于调试
let globalConnectionCount = 0;

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean; // 是否启用WebSocket连接
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false); // 添加连接状态标志，防止重复连接
  const optionsRef = useRef(options); // 使用 ref 存储 options，避免依赖项问题

  // 为每个 useWebSocket 实例创建唯一标识符
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    globalConnectionCount++;
    instanceIdRef.current = `ws-${globalConnectionCount}-${Date.now()}`;
  }

  // 更新 options ref
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 获取WebSocket URL
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const currentPort = window.location.port;

    // 1. 运行时配置（最高优先级，用于 Docker/Railway 等场景）
    if (
      typeof window !== 'undefined' &&
      (window as any).RUNTIME_CONFIG?.WS_URL
    ) {
      const wsUrl = (window as any).RUNTIME_CONFIG.WS_URL;
      return `${wsUrl}?_=${Date.now()}`;
    }

    // 2. 构建时环境变量
    if (process.env.NEXT_PUBLIC_WS_URL) {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      return `${wsUrl}?_=${Date.now()}`;
    }

    // 3. 开发环境 - 使用独立端口 3001
    if (process.env.NODE_ENV === 'development') {
      const wsUrl = `${protocol}//${hostname}:3001`;
      return `${wsUrl}?_=${Date.now()}`;
    }

    // 4. 生产环境自动检测
    // 如果当前页面有非标准端口，尝试使用独立 WebSocket 端口
    if (currentPort && currentPort !== '80' && currentPort !== '443') {
      // 可能是 VPS 或 Docker 部署，尝试 3001 端口
      const wsUrl = `${protocol}//${hostname}:3001`;
      return `${wsUrl}?_=${Date.now()}`;
    }

    // 5. 默认：共享端口模式（适用于 Railway, Vercel, Render 等）
    const wsUrl = `${protocol}//${hostname}`;
    return `${wsUrl}?_=${Date.now()}`;
  };

  // 连接WebSocket
  const connect = useCallback(() => {
    // 防止重复连接
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      isConnectingRef.current
    ) {
      return;
    }

    // 清理之前的定时器
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    // 关闭任何现有连接
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // 忽略关闭错误
      }
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');

    const wsUrl = getWebSocketUrl();

    try {
      wsRef.current = new WebSocket(wsUrl);

      // 设置超时处理
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket 连接超时，正在关闭...');
          wsRef.current.close();
        }
      }, 10000); // 10秒超时

      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        isConnectingRef.current = false; // 重置连接标志

        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;

        // 发送用户连接消息
        const authInfo = getAuthInfoFromBrowserCookie();
        if (authInfo && authInfo.username) {
          sendMessage({
            type: 'user_connect',
            data: { userId: authInfo.username },
            timestamp: Date.now(),
          });
        }

        // 清理之前的保持活动定时器（如果存在）
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }

        // 设置保持活动的定期消息 - 与服务器心跳间隔匹配
        keepAliveIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: 'ping', timestamp: Date.now() }),
            );
          } else {
            if (keepAliveIntervalRef.current) {
              clearInterval(keepAliveIntervalRef.current);
              keepAliveIntervalRef.current = null;
            }
          }
        }, 20000); // 改为20秒，确保在服务器30秒检测前发送

        optionsRef.current.onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          optionsRef.current.onMessage?.(message);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('解析 WebSocket 消息错误:', error);
          }
        }
      };

      wsRef.current.onclose = (event) => {
        isConnectingRef.current = false; // 重置连接标志
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // 清理保持活动定时器
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }

        // 关闭代码含义解释
        let closeReason = '';
        switch (event.code) {
          case 1000:
            closeReason = '正常关闭';
            break;
          case 1001:
            closeReason = '离开页面';
            break;
          case 1002:
            closeReason = '协议错误';
            break;
          case 1003:
            closeReason = '不支持的数据类型';
            break;
          case 1005:
            closeReason = '未提供关闭代码';
            break;
          case 1006:
            closeReason = '异常关闭'; // 通常表示连接突然中断
            break;
          case 1007:
            closeReason = '无效的数据';
            break;
          case 1008:
            closeReason = '违反策略';
            break;
          case 1009:
            closeReason = '消息过大';
            break;
          case 1010:
            closeReason = '客户端要求扩展';
            break;
          case 1011:
            closeReason = '服务器内部错误';
            break;
          case 1012:
            closeReason = '服务重启';
            break;
          case 1013:
            closeReason = '服务器临时问题';
            break;
          case 1015:
            closeReason = 'TLS握手失败';
            break;
          default:
            closeReason = '未知原因';
        }

        optionsRef.current.onDisconnect?.();

        // 自动重连（除非是正常关闭或页面离开）
        if (
          event.code !== 1000 &&
          event.code !== 1001 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          // 增加最小延迟时间，避免太频繁的重连
          const baseDelay = 3000; // 最小3秒，避免过于频繁
          const delay = Math.max(
            baseDelay,
            Math.min(Math.pow(2, reconnectAttemptsRef.current) * 1000, 30000),
          ); // 指数退避，最少3秒，最多30秒

          // 清除之前的重连定时器
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        // WebSocket 错误对象通常是空的，只记录连接失败
        if (process.env.NODE_ENV === 'development') {
          console.warn('WebSocket 连接错误，将尝试重连');
        }
        isConnectingRef.current = false; // 重置连接标志
        optionsRef.current.onError?.(error);
        setConnectionStatus('disconnected');
      };
    } catch (error) {
      console.error(
        `❌ [${instanceIdRef.current}] 创建 WebSocket 连接失败:`,
        error,
      );
      isConnectingRef.current = false; // 重置连接标志
      setConnectionStatus('disconnected');

      // 如果是在开发环境，给出更友好的错误提示
      if (process.env.NODE_ENV === 'development') {
      }
    }
  }, []); // 空依赖项数组，因为我们使用 optionsRef 避免了依赖问题

  // 断开连接
  const disconnect = () => {
    // 重置连接状态标志
    isConnectingRef.current = false;

    // 清除所有计时器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  // 发送消息
  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));

      return true;
    } else {
      console.warn('WebSocket 未连接，无法发送消息:', message);
      return false;
    }
  };

  // 监听enabled状态变化，动态连接或断开
  useEffect(() => {
    const enabled = options.enabled ?? true; // 默认启用

    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    // 页面可见性变化处理 - 避免后台页面保持连接
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时，清理心跳定时器，但保持连接
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
      } else {
        // 页面重新可见时，重新建立心跳
        if (
          wsRef.current?.readyState === WebSocket.OPEN &&
          !keepAliveIntervalRef.current
        ) {
          keepAliveIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: 'ping', timestamp: Date.now() }),
              );
            }
          }, 20000);
        } else if (wsRef.current?.readyState !== WebSocket.OPEN) {
          // 如果连接已断开，尝试重连
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [options.enabled, connect]); // 监听 enabled 状态变化

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
  };
}
