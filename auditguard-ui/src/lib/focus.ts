/**
 * Focus Management Utilities
 * Accessibility-focused utilities for keyboard navigation
 */

/**
 * Focusable elements selector
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  
  return elements.filter((el) => {
    // Check if element is visible
    return el.offsetParent !== null;
  });
}

/**
 * Get the first focusable element in a container
 */
export function getFirstFocusableElement(container: HTMLElement | null): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements[0] || null;
}

/**
 * Get the last focusable element in a container
 */
export function getLastFocusableElement(container: HTMLElement | null): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements[elements.length - 1] || null;
}

/**
 * Focus trap for modals and dialogs
 */
export class FocusTrap {
  private container: HTMLElement;
  private previousActiveElement: HTMLElement | null = null;
  private isActive = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Activate the focus trap
   */
  activate(): void {
    if (this.isActive) return;

    // Store currently focused element
    this.previousActiveElement = document.activeElement as HTMLElement;

    // Focus first element in container
    const firstElement = getFirstFocusableElement(this.container);
    if (firstElement) {
      firstElement.focus();
    }

    // Add keydown listener for tab trapping
    this.container.addEventListener('keydown', this.handleKeyDown);

    this.isActive = true;
  }

  /**
   * Deactivate the focus trap and restore previous focus
   */
  deactivate(): void {
    if (!this.isActive) return;

    // Remove listener
    this.container.removeEventListener('keydown', this.handleKeyDown);

    // Restore previous focus
    if (this.previousActiveElement && document.body.contains(this.previousActiveElement)) {
      this.previousActiveElement.focus();
    }

    this.isActive = false;
  }

  /**
   * Handle keydown events for focus trapping
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(this.container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Shift + Tab (backwards)
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    }
    // Tab (forwards)
    else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };
}

/**
 * React hook for focus trap
 */
export function useFocusTrap(isActive: boolean): {
  ref: React.RefCallback<HTMLElement>;
} {
  const trapRef = React.useRef<FocusTrap | null>(null);

  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous trap
      if (trapRef.current) {
        trapRef.current.deactivate();
        trapRef.current = null;
      }

      // Create new trap if node exists and should be active
      if (node && isActive) {
        trapRef.current = new FocusTrap(node);
        trapRef.current.activate();
      }
    },
    [isActive]
  );

  React.useEffect(() => {
    return () => {
      if (trapRef.current) {
        trapRef.current.deactivate();
      }
    };
  }, []);

  return { ref };
}

/**
 * Focus the first error in a form
 */
export function focusFirstError(formElement: HTMLElement | null): boolean {
  if (!formElement) return false;

  // Look for elements with aria-invalid="true"
  const errorElement = formElement.querySelector<HTMLElement>('[aria-invalid="true"]');
  
  if (errorElement) {
    errorElement.focus();
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  return false;
}

/**
 * Focus management for roving tabindex (e.g., toolbars, menus)
 */
export class RovingTabIndex {
  private container: HTMLElement;
  private items: HTMLElement[] = [];
  private currentIndex = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.updateItems();
  }

  /**
   * Update the list of items
   */
  updateItems(): void {
    this.items = getFocusableElements(this.container);
    this.updateTabIndexes();
  }

  /**
   * Focus the next item
   */
  focusNext(): void {
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    this.focusCurrent();
  }

  /**
   * Focus the previous item
   */
  focusPrevious(): void {
    this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
    this.focusCurrent();
  }

  /**
   * Focus the first item
   */
  focusFirst(): void {
    this.currentIndex = 0;
    this.focusCurrent();
  }

  /**
   * Focus the last item
   */
  focusLast(): void {
    this.currentIndex = this.items.length - 1;
    this.focusCurrent();
  }

  /**
   * Focus the current item
   */
  private focusCurrent(): void {
    this.updateTabIndexes();
    this.items[this.currentIndex]?.focus();
  }

  /**
   * Update tabindex attributes
   */
  private updateTabIndexes(): void {
    this.items.forEach((item, index) => {
      item.setAttribute('tabindex', index === this.currentIndex ? '0' : '-1');
    });
  }
}

/**
 * Save and restore scroll position
 */
export class ScrollRestoration {
  private positions = new Map<string, number>();

  /**
   * Save current scroll position
   */
  save(key: string, element: HTMLElement = document.documentElement): void {
    this.positions.set(key, element.scrollTop);
  }

  /**
   * Restore saved scroll position
   */
  restore(key: string, element: HTMLElement = document.documentElement): void {
    const position = this.positions.get(key);
    if (position !== undefined) {
      element.scrollTop = position;
    }
  }

  /**
   * Clear saved position
   */
  clear(key: string): void {
    this.positions.delete(key);
  }

  /**
   * Clear all saved positions
   */
  clearAll(): void {
    this.positions.clear();
  }
}

/**
 * Announce changes to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  // Create or get existing live region
  let liveRegion = document.getElementById('sr-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'sr-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }

  // Update priority if different
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority);
  }

  // Clear and set message (forces screen reader to announce)
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view if needed
 */
export function scrollIntoViewIfNeeded(element: HTMLElement, options?: ScrollIntoViewOptions): void {
  if (!isElementInViewport(element)) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      ...options,
    });
  }
}

import React from 'react';
