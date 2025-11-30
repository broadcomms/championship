/**
 * Mobile Responsive Utilities
 * Touch gestures, viewport detection, and mobile-specific helpers
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Breakpoint definitions (matching Tailwind defaults)
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

type NavigatorWithConnection = Navigator & {
  msMaxTouchPoints?: number;
  connection?: ConnectionInfo;
  mozConnection?: ConnectionInfo;
  webkitConnection?: ConnectionInfo;
};

const getExtendedNavigator = (): NavigatorWithConnection | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator as NavigatorWithConnection;
};

const getNetworkConnection = () => {
  const extendedNavigator = getExtendedNavigator();
  return extendedNavigator?.connection ?? extendedNavigator?.mozConnection ?? extendedNavigator?.webkitConnection;
};

/**
 * Device type detection
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

/**
 * Touch detection
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const extendedNavigator = getExtendedNavigator();

  return (
    'ontouchstart' in window ||
    (extendedNavigator?.maxTouchPoints ?? 0) > 0 ||
    (extendedNavigator?.msMaxTouchPoints ?? 0) > 0
  );
}

/**
 * Hook to detect current device type
 */
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>(() => getDeviceType());

  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}

/**
 * Hook to detect if device supports touch
 */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(isTouchDevice());
  }, []);

  return isTouch;
}

/**
 * Touch gesture types
 */
export interface TouchGesture {
  type: 'swipe' | 'tap' | 'longpress' | 'pinch';
  direction?: 'up' | 'down' | 'left' | 'right';
  deltaX?: number;
  deltaY?: number;
  scale?: number;
  duration?: number;
}

/**
 * Swipe gesture handler
 */
export function useSwipeGesture(
  onSwipe: (gesture: TouchGesture) => void,
  threshold = 50,
  timeout = 300
) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const duration = Date.now() - touchStart.current.time;

      // Check if it's a valid swipe
      if (duration > timeout) {
        touchStart.current = null;
        return;
      }

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > threshold || absY > threshold) {
        // Determine direction
        let direction: 'up' | 'down' | 'left' | 'right';
        if (absX > absY) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        onSwipe({
          type: 'swipe',
          direction,
          deltaX,
          deltaY,
          duration,
        });
      }

      touchStart.current = null;
    },
    [onSwipe, threshold, timeout]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}

/**
 * Long press gesture handler
 */
export function useLongPress(
  onLongPress: () => void,
  duration = 500
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleStart = useCallback(() => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
    }, duration);
  }, [onLongPress, duration]);

  const handleEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    onMouseDown: handleStart,
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onClick: handleClick,
  };
}

/**
 * Pinch zoom gesture handler
 */
export function usePinchZoom(
  onPinch: (scale: number) => void
) {
  const initialDistance = useRef<number | null>(null);

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current) {
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance.current;
        onPinch(scale);
      }
    },
    [onPinch]
  );

  const handleTouchEnd = useCallback(() => {
    initialDistance.current = null;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

/**
 * Viewport height fix for mobile browsers (accounts for address bar)
 */
export function useViewportHeight() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);
}

/**
 * Orientation detection
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };

    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, []);

  return orientation;
}

/**
 * Safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue('--sat') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10),
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
}

/**
 * Prevent scroll on mobile (useful for modals)
 */
export function usePreventScroll(prevent: boolean) {
  useEffect(() => {
    if (!prevent) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // iOS Safari specific
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      e.preventDefault();
    };

    document.body.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.removeEventListener('touchmove', preventDefault);
    };
  }, [prevent]);
}

/**
 * Mobile menu state management
 */
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  // Prevent scroll when open
  usePreventScroll(isOpen);

  return { isOpen, open, close, toggle };
}

/**
 * Responsive value hook
 */
export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop: T;
}): T {
  const deviceType = useDeviceType();

  if (deviceType === 'mobile' && values.mobile !== undefined) {
    return values.mobile;
  }
  if (deviceType === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.desktop;
}

/**
 * Network information (for adaptive loading)
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<{
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }>({
    online: true,
  });

  useEffect(() => {
    const updateStatus = () => {
      const connection = getNetworkConnection();

      setStatus({
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
      });
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const connection = getNetworkConnection();
    if (connection?.addEventListener) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (connection?.removeEventListener) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return status;
}
