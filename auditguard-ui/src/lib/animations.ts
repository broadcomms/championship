/**
 * Animation Utilities
 * Centralized animation configurations and helper functions
 */

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
  fast: 150,
  base: 200,
  slow: 300,
  slower: 400,
} as const;

// Easing functions
export const EASING = {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// Transition classes for Tailwind
export const TRANSITIONS = {
  all: 'transition-all duration-200 ease-out',
  colors: 'transition-colors duration-150 ease-out',
  transform: 'transition-transform duration-200 ease-out',
  opacity: 'transition-opacity duration-200 ease-out',
  height: 'transition-[height] duration-300 ease-out',
  width: 'transition-[width] duration-300 ease-out',
} as const;

// Animation classes
export const ANIMATIONS = {
  fadeIn: 'animate-fadeIn',
  fadeOut: 'animate-fadeOut',
  slideUp: 'animate-slideUp',
  slideDown: 'animate-slideDown',
  slideLeft: 'animate-slideLeft',
  slideRight: 'animate-slideRight',
  scaleIn: 'animate-scaleIn',
  scaleOut: 'animate-scaleOut',
  bounce: 'animate-bounce',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
} as const;

// Hover effects
export const HOVER_EFFECTS = {
  lift: 'hover:-translate-y-0.5 hover:shadow-md',
  scale: 'hover:scale-105',
  glow: 'hover:shadow-lg hover:shadow-primary-500/20',
  border: 'hover:border-primary-500',
  background: 'hover:bg-gray-50',
} as const;

// Focus effects
export const FOCUS_EFFECTS = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  ringInset: 'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500',
  border: 'focus:border-primary-500 focus:outline-none',
  glow: 'focus:shadow-lg focus:shadow-primary-500/20',
} as const;

// Loading state animations
export const LOADING_STATES = {
  spinner: 'animate-spin',
  pulse: 'animate-pulse',
  shimmer: 'animate-shimmer',
  dots: 'animate-bounce',
} as const;

/**
 * Get transition class with custom duration
 */
export function getTransition(property: string, duration: number = 200): string {
  return `transition-${property} duration-${duration} ease-out`;
}

/**
 * Combine animation classes
 */
export function combineAnimations(...animations: string[]): string {
  return animations.join(' ');
}

/**
 * Stagger animation delay helper
 */
export function getStaggerDelay(index: number, baseDelay: number = 50): string {
  return `animation-delay: ${index * baseDelay}ms;`;
}

/**
 * Spring animation config for framer-motion
 */
export const SPRING_CONFIG = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 1,
} as const;

/**
 * Tween animation config for framer-motion
 */
export const TWEEN_CONFIG = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.2,
} as const;

/**
 * Page transition variants for framer-motion
 */
export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: TWEEN_CONFIG,
};

/**
 * Modal transition variants
 */
export const MODAL_TRANSITION = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  content: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  },
};

/**
 * Toast transition variants
 */
export const TOAST_TRANSITION = {
  topRight: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 },
  },
  topLeft: {
    initial: { opacity: 0, x: -100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  },
  bottom: {
    initial: { opacity: 0, y: 100 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 100 },
  },
};

/**
 * List item stagger animation
 */
export const LIST_STAGGER = {
  container: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
};

/**
 * Skeleton pulse animation
 */
export const SKELETON_ANIMATION = {
  animate: {
    backgroundColor: ['#f3f4f6', '#e5e7eb', '#f3f4f6'],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

/**
 * Reduced motion check
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation with reduced motion support
 */
export function getAnimation(animation: string): string {
  return prefersReducedMotion() ? '' : animation;
}

/**
 * Intersection observer animation helper
 */
export function useIntersectionAnimation(threshold: number = 0.1) {
  if (typeof window === 'undefined') return null;
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeIn');
        }
      });
    },
    { threshold }
  );
}
