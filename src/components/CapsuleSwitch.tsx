/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const activeIndex = options.findIndex((opt) => opt.value === active);

  // 更新指示器位置
  const updateIndicatorPosition = () => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current
    ) {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (button && container) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (buttonRect.width > 0) {
          setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
          });
        }
      }
    }
  };

  // 组件挂载时立即计算初始位置
  useEffect(() => {
    // 多次尝试计算位置，确保在内容加载完成后正确定位
    const timeouts: NodeJS.Timeout[] = [];

    // 立即计算一次
    updateIndicatorPosition();

    // 在不同时间点重新计算，确保捕获到正确的位置
    [0, 50, 100, 200, 500].forEach((delay) => {
      const timeoutId = setTimeout(updateIndicatorPosition, delay);
      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  // 监听选中项变化
  useEffect(() => {
    updateIndicatorPosition();
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex bg-gray-300/80 rounded-full p-1 dark:bg-gray-700 ${
        className || ''
      }`}
    >
      {/* 滑动的白色背景指示器 */}
      {indicatorStyle && (
        <div
          className='absolute top-1 bottom-1 bg-white dark:bg-gray-500 rounded-full shadow-sm transition-all duration-300 ease-out'
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      )}

      {options.map((opt, index) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 px-4 py-1.5 text-sm sm:px-5 sm:py-2 rounded-full font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
              isActive
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
