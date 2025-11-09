/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Shield } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import MachineCode from '@/lib/machine-code';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import GlobalThemeLoader from '@/components/GlobalThemeLoader';
import { usePreventScroll } from '@/hooks/usePreventScroll';

// 版本显示组件
function VersionDisplay() {
  return (
    <div className='absolute bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400'>
      <span className='font-mono'>v{CURRENT_VERSION}</span>
    </div>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(true);

  // 机器码相关状态
  const [machineCode, setMachineCode] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [requireMachineCode, setRequireMachineCode] = useState(false);
  const [machineCodeGenerated, setMachineCodeGenerated] = useState(false);
  const [bindMachineCode, setBindMachineCode] = useState(false);
  const [deviceCodeEnabled, setDeviceCodeEnabled] = useState(true);

  // Turnstile 验证相关状态
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);

  const { siteName } = useSite();

  // 禁用移动端滚动和橡皮筋效果
  usePreventScroll(true);

  // 加载 Turnstile 脚本
  useEffect(() => {
    // 设置全局回调函数
    (window as any).onTurnstileSuccess = (token: string) => {
      setTurnstileToken(token);
    };

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setTurnstileLoaded(true);
    };
    script.onerror = () => {
      setError('人机验证加载失败，请刷新页面重试');
    };
    document.head.appendChild(script);

    return () => {
      delete (window as any).onTurnstileSuccess;
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // 在客户端挂载后从API获取配置并生成机器码
  useEffect(() => {
    const fetchConfigAndGenerateMachineInfo = async () => {
      try {
        const response = await fetch('/api/server-config');
        const serverConfig = await response.json();

        const requireDeviceCode = serverConfig?.RequireDeviceCode;

        // 始终显示用户名输入框（所有模式统一）
        setShouldAskUsername(true);
        setDeviceCodeEnabled(requireDeviceCode === true);

        // 只有在启用设备码功能时才生成机器码和设备信息
        if (requireDeviceCode === true && MachineCode.isSupported()) {
          try {
            const code = await MachineCode.generateMachineCode();
            const info = await MachineCode.getDeviceInfo();
            setMachineCode(code);
            setDeviceInfo(info);
            setMachineCodeGenerated(true);
          } catch (error) {
            console.error('生成机器码失败:', error);
          }
        }
      } catch (error) {
        console.error('获取服务器配置失败:', error);
        // 降级处理：始终显示用户名输入框
        setShouldAskUsername(true);
        setDeviceCodeEnabled(false);
      }
    };

    fetchConfigAndGenerateMachineInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    // 要求完成 Turnstile 验证
    if (!turnstileToken) {
      setError('请完成人机验证');
      return;
    }

    try {
      setLoading(true);

      // 构建请求数据
      const requestData: any = {
        password,
        turnstileToken,
        ...(shouldAskUsername ? { username } : {}),
      };

      // 只有在启用设备码功能时才处理机器码逻辑
      if (
        deviceCodeEnabled &&
        (requireMachineCode || bindMachineCode) &&
        machineCode
      ) {
        requestData.machineCode = machineCode;
      }

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // 登录成功，如果启用设备码功能且用户选择绑定机器码，则绑定
        if (
          deviceCodeEnabled &&
          bindMachineCode &&
          machineCode &&
          shouldAskUsername
        ) {
          try {
            await fetch('/api/machine-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                machineCode,
                deviceInfo,
              }),
            });
          } catch (bindError) {
            console.error('绑定机器码失败:', bindError);
          }
        }

        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else if (res.status === 403) {
        // 处理机器码相关错误
        if (data.requireMachineCode) {
          setRequireMachineCode(true);
          setError('该账户已绑定设备，请验证机器码');
        } else if (data.machineCodeMismatch) {
          setError('机器码不匹配，此账户只能在绑定的设备上使用');
        } else {
          setError(data.error || '访问被拒绝');
        }
      } else if (res.status === 409) {
        // 机器码被其他用户绑定
        setError(data.error || '机器码冲突');
      } else if (res.status === 401) {
        setError('用户名或密码错误');
      } else {
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 flex flex-col items-center justify-center px-5 overflow-hidden md:relative md:h-screen'>
      <GlobalThemeLoader />
      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>

      {/* Logo 和标题 - 移动端居中，桌面端左上角 */}
      <div className='flex items-center justify-center gap-2 mb-24 z-10 md:absolute md:top-4 md:left-4 md:mb-0'>
        <img
          src='/logo.png'
          alt='Logo'
          className='h-8 w-auto object-contain md:h-6'
        />
        <h1 className='text-gray-900 dark:text-gray-100 tracking-tight text-2xl font-normal md:text-lg'>
          {siteName}
        </h1>
      </div>

      <div
        className='relative z-10 w-full max-w-sm sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-9'
        data-scrollable='true'
      >
        <h1 className='text-gray-900 dark:text-gray-100 tracking-tight text-center text-xl sm:text-2xl font-normal mb-5 sm:mb-6'>
          登录或注册
        </h1>
        <form onSubmit={handleSubmit} className='space-y-5'>
          {shouldAskUsername && (
            <div className='relative'>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className='peer block w-full rounded-lg border border-gray-200 dark:border-gray-700 pt-6 pb-1.5 px-4 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur placeholder-transparent transition-colors'
                placeholder='用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <label
                htmlFor='username'
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  username
                    ? 'top-2 text-xs text-blue-600 dark:text-blue-400'
                    : 'top-1/2 -translate-y-1/2 text-base text-gray-500 dark:text-gray-400'
                } peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-blue-600 peer-focus:dark:text-blue-400`}
              >
                用户名
              </label>
            </div>
          )}

          <div className='relative'>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              className='peer block w-full rounded-lg border border-gray-200 dark:border-gray-700 pt-6 pb-1.5 px-4 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur placeholder-transparent transition-colors'
              placeholder='密码'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label
              htmlFor='password'
              className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                password
                  ? 'top-2 text-xs text-blue-600 dark:text-blue-400'
                  : 'top-1/2 -translate-y-1/2 text-base text-gray-500 dark:text-gray-400'
              } peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-blue-600 peer-focus:dark:text-blue-400`}
            >
              密码
            </label>
          </div>

          {/* 机器码信息显示 - 只有在启用设备码功能时才显示 */}
          {deviceCodeEnabled && machineCodeGenerated && shouldAskUsername && (
            <div className='space-y-4'>
              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                <div className='flex items-center space-x-2 mb-2'>
                  <Shield className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                  <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                    设备识别码
                  </span>
                </div>
                <div className='space-y-2'>
                  <div className='text-xs font-mono text-gray-700 dark:text-gray-300 break-all'>
                    {MachineCode.formatMachineCode(machineCode)}
                  </div>
                  <div className='text-xs text-gray-600 dark:text-gray-400'>
                    设备信息: {deviceInfo}
                  </div>
                </div>
              </div>

              {/* 绑定选项 */}
              {!requireMachineCode && (
                <div className='space-y-2'>
                  <div className='flex items-center space-x-3'>
                    <input
                      id='bindMachineCode'
                      type='checkbox'
                      checked={bindMachineCode}
                      onChange={(e) => setBindMachineCode(e.target.checked)}
                      className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                    />
                    <label
                      htmlFor='bindMachineCode'
                      className='text-sm text-gray-700 dark:text-gray-300'
                    >
                      绑定此设备（提升账户安全性）
                    </label>
                  </div>
                  {/* <p className='text-xs text-gray-500 dark:text-gray-400 ml-7'>
                    // 管理员可选择不绑定机器码直接登录
                  </p> */}
                </div>
              )}
            </div>
          )}

          {/* Turnstile 人机验证 */}
          {turnstileLoaded && (
            <div className='w-full'>
              <div
                className='cf-turnstile'
                data-sitekey={
                  (window as any).RUNTIME_CONFIG?.TURNSTILE_SITE_KEY
                }
                data-callback='onTurnstileSuccess'
                data-theme='auto'
                data-size='flexible'
              />
            </div>
          )}

          {error && (
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          )}

          {/* 登录按钮 */}
          <button
            type='submit'
            disabled={
              !password ||
              loading ||
              (shouldAskUsername && !username) ||
              !turnstileToken
            }
            className='inline-flex w-full justify-center rounded-lg bg-blue-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50 !mt-6'
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>

      {/* 版本信息显示 */}
      <VersionDisplay />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
