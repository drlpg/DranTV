import { useState } from 'react';

import { AlertConfig } from '../types';

export const useAlertModal = () => {
  const [alertModal, setAlertModal] = useState<
    AlertConfig & { isOpen: boolean }
  >({
    isOpen: false,
    type: 'success',
    title: '',
  });

  const showAlert = (config: AlertConfig) => {
    setAlertModal({ ...config, isOpen: true });
  };

  const hideAlert = () => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  };

  return { alertModal, showAlert, hideAlert };
};
