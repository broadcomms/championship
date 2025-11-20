/**
 * Skeleton Loading Components
 * Beautiful loading states for better perceived performance
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

/**
 * Base Skeleton component
 */
export function Skeleton({ className = '', animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 rounded ${
        animate ? 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]' : ''
      } ${className}`}
    />
  );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for conversation sidebar
 */
export function SkeletonConversation() {
  return (
    <div className="p-4 space-y-3 animate-fadeIn">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for message
 */
export function SkeletonMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fadeIn`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-start gap-2 mb-1">
          {!isUser && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for chat interface
 */
export function SkeletonChatInterface() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SkeletonMessage isUser={false} />
        <SkeletonMessage isUser={true} />
        <SkeletonMessage isUser={false} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton for analytics dashboard
 */
export function SkeletonAnalytics() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <Skeleton className="h-8 w-64" />

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 space-y-3">
            <Skeleton className="h-6 w-32 mb-4" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for notification center
 */
export function SkeletonNotifications() {
  return (
    <div className="space-y-3 animate-fadeIn">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 bg-white rounded-lg space-y-2">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for settings panel
 */
export function SkeletonSettings() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for details sidebar
 */
export function SkeletonDetailsSidebar() {
  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      {/* Session Details */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Score */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4">
          <div className="flex justify-center mb-4">
            <Skeleton className="w-20 h-20 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested Actions */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for full page
 */
export function SkeletonFullPage() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-[280px] border-r border-gray-200">
        <SkeletonConversation />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <SkeletonChatInterface />
      </div>

      {/* Details */}
      <div className="w-[320px] border-l border-gray-200">
        <SkeletonDetailsSidebar />
      </div>
    </div>
  );
}

/**
 * Skeleton Card
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg p-6 space-y-4 ${className}`}>
      <Skeleton className="h-6 w-3/4" />
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton List
 */
export function SkeletonList({ items = 5, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Table
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b border-gray-200 p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
