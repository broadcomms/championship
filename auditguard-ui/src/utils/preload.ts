/**
 * Component Preloading Utilities
 * 
 * Preload lazy components before they're needed to improve perceived performance.
 * Use these to preload components on hover, focus, or route change.
 */

import { ComponentType } from 'react';

/**
 * Preload a lazy-loaded component
 * @param factory - The lazy component factory function
 */
export function preloadComponent<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): void {
  factory().catch(err => {
    console.warn('Failed to preload component:', err);
  });
}

/**
 * Create a preload function for a lazy component
 * Usage: const preloadModal = createPreloader(() => import('./Modal'))
 */
export function createPreloader<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  let preloaded = false;
  
  return () => {
    if (!preloaded) {
      preloaded = true;
      preloadComponent(factory);
    }
  };
}

/**
 * Preload components on mouse enter (hover)
 * @param factory - The lazy component factory
 * @returns Event handler for onMouseEnter
 */
export function preloadOnHover<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return () => preloadComponent(factory);
}

/**
 * Preload components on focus
 * @param factory - The lazy component factory
 * @returns Event handler for onFocus
 */
export function preloadOnFocus<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return () => preloadComponent(factory);
}
