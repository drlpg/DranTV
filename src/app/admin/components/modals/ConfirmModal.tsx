'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { buttonStyles } from '../../utils/constants';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
}: ConfirmModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleCancel}
    >
      <div
        className={`rounded-lg shadow-xl max-w-sm w-full border backdrop-blur-md bg-gray-800 dark:bg-gray-800 border-gray-700 dark:border-gray-700 transition-all duration-200 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='p-6'>
          <div className='flex items-start gap-4 mb-4'>
            <div className='flex-shrink-0'>
              <AlertTriangle className='w-6 h-6 text-yellow-500' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-100 mb-2'>
                {title}
              </h3>
              {message && (
                <p className='text-gray-300 text-sm whitespace-pre-line'>
                  {message}
                </p>
              )}
            </div>
          </div>

          <div className='flex gap-3 justify-end'>
            <button onClick={handleCancel} className={buttonStyles.secondary}>
              {cancelText}
            </button>
            <button onClick={handleConfirm} className={buttonStyles.primary}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
