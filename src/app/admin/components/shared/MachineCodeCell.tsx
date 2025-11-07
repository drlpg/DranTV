'use client';

import { useCallback, useRef, useState } from 'react';
import { buttonStyles } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/helpers';
import { AlertConfig } from '../../types';

interface MachineCodeCellProps {
  username: string;
  canManage: boolean;
  machineCodeData: Record<
    string,
    { machineCode: string; deviceInfo?: string; bindTime: number }
  >;
  onRefresh: () => void;
  showAlert: (config: AlertConfig) => void;
}

export const MachineCodeCell = ({
  username,
  canManage,
  machineCodeData,
  onRefresh,
  showAlert,
}: MachineCodeCellProps) => {
  const [unbinding, setUnbinding] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>(
    'bottom'
  );
  const tooltipRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);

  const machineCodeInfo = machineCodeData[username] || null;

  const handleMouseEnter = useCallback(() => {
    if (!codeRef.current) return;

    const element = codeRef.current;
    const rect = element.getBoundingClientRect();
    const tableContainer = element.closest('[data-table="user-list"]');

    if (tableContainer) {
      const containerRect = tableContainer.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      if (elementCenterY < containerCenterY) {
        setTooltipPosition('bottom');
      } else {
        setTooltipPosition('top');
      }
    } else {
      const viewportHeight = window.innerHeight;
      if (rect.top < viewportHeight / 2) {
        setTooltipPosition('bottom');
      } else {
        setTooltipPosition('top');
      }
    }
  }, []);

  const handleUnbind = async () => {
    if (!machineCodeInfo || !canManage) return;

    try {
      setUnbinding(true);
      const response = await fetch('/api/machine-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unbind',
          targetUser: username,
        }),
      });

      if (response.ok) {
        showSuccess('机器码解绑成功', showAlert);
        onRefresh();
      } else {
        const error = await response.json();
        showError(`解绑失败: ${error.error || '未知错误'}`, showAlert);
      }
    } catch (error) {
      console.error('解绑机器码失败:', error);
      showError('解绑失败，请重试', showAlert);
    } finally {
      setUnbinding(false);
    }
  };

  const formatMachineCode = (code: string) => {
    if (code.length !== 32) return code;
    return code.match(/.{1,4}/g)?.join('-') || code;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!machineCodeInfo) {
    return (
      <div className='flex items-center space-x-2'>
        <span className='text-sm text-gray-500 dark:text-gray-400'>未绑定</span>
      </div>
    );
  }

  return (
    <div className='flex flex-col space-y-1'>
      <div className='flex items-center space-x-2'>
        <div className='group relative' onMouseEnter={handleMouseEnter}>
          <code
            ref={codeRef}
            className='text-xs font-mono text-gray-700 dark:text-gray-300 cursor-help'
          >
            {formatMachineCode(machineCodeInfo.machineCode).substring(0, 12)}...
          </code>
          <div
            ref={tooltipRef}
            className={`absolute left-0 px-3 py-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-50 ${
              tooltipPosition === 'bottom'
                ? 'top-full mt-2'
                : 'bottom-full mb-2'
            }`}
          >
            <div className='font-mono'>
              {formatMachineCode(machineCodeInfo.machineCode)}
            </div>
            {machineCodeInfo.deviceInfo && (
              <div className='mt-1 text-gray-300'>
                {machineCodeInfo.deviceInfo}
              </div>
            )}
            <div className='mt-1 text-gray-400'>
              绑定时间: {formatDate(machineCodeInfo.bindTime)}
            </div>
            <div
              className={`absolute left-4 w-0 h-0 border-l-4 border-r-4 border-transparent ${
                tooltipPosition === 'bottom'
                  ? 'bottom-full border-b-4 border-b-gray-800'
                  : 'top-full border-t-4 border-t-gray-800'
              }`}
            ></div>
          </div>
        </div>
        {canManage && (
          <button
            onClick={handleUnbind}
            disabled={unbinding}
            className={`${buttonStyles.roundedDanger} ${
              unbinding ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title='解绑机器码'
          >
            {unbinding ? '解绑中...' : '解绑'}
          </button>
        )}
      </div>
      <div className='flex items-center space-x-1'>
        <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'>
          已绑定
        </span>
      </div>
    </div>
  );
};
