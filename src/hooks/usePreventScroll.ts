import { useEffect } from 'react';

/**
 * Hook to prevent scroll on mobile devices
 * This is necessary because CSS overflow:hidden doesn't prevent touch scrolling on mobile browsers
 */
export function usePreventScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    // Prevent scroll on touch devices
    const preventScroll = (e: TouchEvent) => {
      // Allow scrolling within specific elements (like modals)
      const target = e.target as HTMLElement;

      // Check if the touch is on a scrollable element
      const isScrollable = target.closest('[data-scrollable="true"]');

      if (!isScrollable) {
        e.preventDefault();
      }
    };

    // Prevent scroll on wheel events
    const preventWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventWheel, { passive: false });

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventWheel);

      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, [enabled]);
}
