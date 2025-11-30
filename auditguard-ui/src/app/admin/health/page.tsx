'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Zap,
  XCircle,
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    avgLatency: number;
    lastCheck: number;
    uptime: number;
    errorRate: number;
    details?: Record<string, string | number | boolean | null>;
  }>;
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionPool: {
      active: number;
      idle: number;
      total: number;
    };
    slowQueries: number;
    avgQueryTime: number;
  };
  embeddingService?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    url: string;
    modelName: string;
    totalRequests: number;
    errorRate: number;
    avgLatency: number;
  };
  storage?: {
    status: 'healthy' | 'warning' | 'critical';
    used: number;
    total: number;
    percentage: number;
  };
  metrics: {
    totalErrors24h?: number;
    errorRate24h?: number;
    avgResponseTime24h?: number;
    requestsPerMinute?: number;
    // Legacy fields for backwards compatibility
    totalRequests?: number;
    avgResponseTime?: number;
    errorRate?: number;
    uptime?: number;
  };
  alerts?: Array<{
    severity: 'warning' | 'error' | 'critical';
    service: string;
    message: string;
    timestamp: number;
  }>;
}

export default function SystemHealthPage() {
  const { data: health, isLoading, refetch } = useQuery<SystemHealth>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/health', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch system health');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
      case 'down':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'critical':
      case 'down':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor system status and performance
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Overall Status */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-full ${getStatusColor(health?.status || 'unknown')}`}>
                {getStatusIcon(health?.status || 'unknown')}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 capitalize">
                  {health?.status || 'Unknown'}
                </h3>
                <p className="text-sm text-gray-600">Overall System Status</p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {health?.metrics?.totalRequests?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {health?.metrics?.avgResponseTime?.toFixed(0) || '0'}ms
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {health?.metrics?.errorRate?.toFixed(2) || '0.00'}%
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-lg font-bold text-gray-900 mt-2">
                    {health?.metrics?.uptime ? formatUptime(health.metrics.uptime) : 'N/A'}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Services Status */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Services</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {health?.services.map((service) => (
                <div key={service.name} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${getStatusColor(service.status)}`}>
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{service.name}</h4>
                      <p className="text-sm text-gray-500 capitalize">{service.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {service.avgLatency != null ? `${service.avgLatency}ms` : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {service.lastCheck
                        ? new Date(service.lastCheck).toLocaleTimeString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Database & Storage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-lg ${getStatusColor(health?.database?.status || 'unknown')}`}>
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Database</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {health?.database?.status || 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Connection Pool</span>
                  <span className="text-sm font-medium text-gray-900">
                    {health?.database?.connectionPool?.active || 0} active / {health?.database?.connectionPool?.total || 0} total
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Slow Queries</span>
                  <span className="text-sm font-medium text-gray-900">
                    {health?.database?.slowQueries || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Query Time</span>
                  <span className="text-sm font-medium text-gray-900">
                    {health?.database?.avgQueryTime?.toFixed(0) || 0}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Storage */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-lg ${getStatusColor(health?.storage?.status || 'unknown')}`}>
                  <HardDrive className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Storage</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {health?.storage?.status || 'unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Used</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatBytes(health?.storage?.used || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatBytes(health?.storage?.total || 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (health?.storage?.percentage || 0) > 90
                        ? 'bg-red-600'
                        : (health?.storage?.percentage || 0) > 70
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}
                    style={{ width: `${health?.storage?.percentage || 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {health?.storage?.percentage?.toFixed(1) || '0.0'}% Used
                </p>
              </div>
            </div>
          </div>

          {/* Queues section removed - not yet implemented in backend */}
        </>
      )}
    </div>
  );
}
