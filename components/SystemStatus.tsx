// components/SystemStatus.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { OfflineManager } from '@/lib/offline/OfflineManager'
import { ExchangeRateCache } from '@/lib/offline/ExchangeRateCache'

// ============================================================================
// TYPES - Production Grade, Zimbabwe Clinic Specific
// ============================================================================

type SystemStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'offline'
type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown'
type ServiceName = 
  | 'rbz_exchange_rates' 
  | 'medical_aid_gateway' 
  | 'payment_processor' 
  | 'database' 
  | 'offline_queue' 
  | 'receipt_service'
  | 'clinic_sync'

interface ServiceHealth {
  readonly name: ServiceName
  readonly displayName: string
  readonly status: ServiceStatus
  readonly latency: number // ms
  readonly lastCheck: Date
  readonly message?: string
  readonly icon: string
  readonly critical: boolean
  readonly dependencies?: ServiceName[]
}

interface SystemMetrics {
  readonly activeUsers: number
  readonly pendingTransactions: number
  readonly offlineQueueSize: number
  readonly todayRevenueUSD: number
  readonly todayRevenueZWG: number
  readonly todayClaims: number
  readonly averageResponseTime: number
  readonly errorRate24h: number
  readonly uptimePercentage: number
  readonly lastBackup: Date | null
  readonly storageUsed: number // MB
  readonly storageTotal: number // MB
}

interface RateInfo {
  readonly currentRate: number
  readonly source: string
  readonly lastUpdated: Date
  readonly validUntil: Date
  readonly change24h: number
  readonly volatility: 'low' | 'medium' | 'high'
}

// ============================================================================
// SERVICE HEALTH MONITOR - Zimbabwe Specific
// ============================================================================

const SERVICE_HEALTH_CONFIG: Record<ServiceName, Omit<ServiceHealth, 'status' | 'latency' | 'lastCheck'>> = {
  rbz_exchange_rates: {
    name: 'rbz_exchange_rates',
    displayName: 'RBZ Exchange Rates',
    icon: '💱',
    critical: true,
    dependencies: []
  },
  medical_aid_gateway: {
    name: 'medical_aid_gateway',
    displayName: 'Medical Aid Gateway',
    icon: '🏥',
    critical: true,
    dependencies: []
  },
  payment_processor: {
    name: 'payment_processor',
    displayName: 'Payment Processor',
    icon: '💰',
    critical: true,
    dependencies: []
  },
  database: {
    name: 'database',
    displayName: 'Database',
    icon: '🗄️',
    critical: true,
    dependencies: []
  },
  offline_queue: {
    name: 'offline_queue',
    displayName: 'Offline Queue',
    icon: '📋',
    critical: false,
    dependencies: ['database']
  },
  receipt_service: {
    name: 'receipt_service',
    displayName: 'Receipt Service',
    icon: '🧾',
    critical: false,
    dependencies: ['database']
  },
  clinic_sync: {
    name: 'clinic_sync',
    displayName: 'Clinic Sync',
    icon: '🔄',
    critical: false,
    dependencies: ['database']
  }
}

// ============================================================================
// SYSTEM STATUS HOOK - Production Ready
// ============================================================================

function useSystemStatus() {
  const [overallStatus, setOverallStatus] = useState<SystemStatus>('operational')
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [rateInfo, setRateInfo] = useState<RateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshInterval, setRefreshInterval] = useState<number>(30000) // 30 seconds

  const offlineManager = OfflineManager.getInstance()
  const rateCache = ExchangeRateCache.getInstance()

  // Fetch service health
  const fetchServiceHealth = useCallback(async (): Promise<ServiceHealth[]> => {
    // Simulate service health checks
    // In production, these would be real API calls to health endpoints
    
    const now = new Date()
    const services: ServiceHealth[] = []

    // RBZ Exchange Rates
    const rbzRate = rateCache.getCurrentRate()
    services.push({
      ...SERVICE_HEALTH_CONFIG.rbz_exchange_rates,
      status: rbzRate ? 'healthy' : Math.random() > 0.8 ? 'degraded' : 'healthy',
      latency: Math.floor(Math.random() * 150) + 50,
      lastCheck: now,
      message: rbzRate ? `1 USD = ${rbzRate.rate} ZWG` : undefined
    })

    // Medical Aid Gateway
    services.push({
      ...SERVICE_HEALTH_CONFIG.medical_aid_gateway,
      status: Math.random() > 0.85 ? 'degraded' : Math.random() > 0.95 ? 'unhealthy' : 'healthy',
      latency: Math.floor(Math.random() * 300) + 100,
      lastCheck: now,
      message: Math.random() > 0.9 ? 'Cimas API slow response' : undefined
    })

    // Payment Processor
    services.push({
      ...SERVICE_HEALTH_CONFIG.payment_processor,
      status: Math.random() > 0.9 ? 'degraded' : 'healthy',
      latency: Math.floor(Math.random() * 200) + 50,
      lastCheck: now,
      message: undefined
    })

    // Database
    services.push({
      ...SERVICE_HEALTH_CONFIG.database,
      status: Math.random() > 0.98 ? 'degraded' : 'healthy',
      latency: Math.floor(Math.random() * 100) + 20,
      lastCheck: now,
      message: undefined
    })

    // Offline Queue
    const queueState = offlineManager.getState()
    services.push({
      ...SERVICE_HEALTH_CONFIG.offline_queue,
      status: queueState.pendingCount > 50 ? 'degraded' : 
              queueState.failedCount > 10 ? 'unhealthy' : 'healthy',
      latency: 0,
      lastCheck: now,
      message: queueState.pendingCount > 0 
        ? `${queueState.pendingCount} items pending sync` 
        : undefined
    })

    // Receipt Service
    services.push({
      ...SERVICE_HEALTH_CONFIG.receipt_service,
      status: Math.random() > 0.95 ? 'degraded' : 'healthy',
      latency: Math.floor(Math.random() * 150) + 50,
      lastCheck: now,
      message: undefined
    })

    // Clinic Sync
    services.push({
      ...SERVICE_HEALTH_CONFIG.clinic_sync,
      status: queueState.pendingCount > 0 ? 'degraded' : 'healthy',
      latency: 0,
      lastCheck: now,
      message: queueState.pendingCount > 0 
        ? `Syncing ${queueState.pendingCount} items` 
        : 'Up to date'
    })

    return services
  }, [])

  // Fetch system metrics
  const fetchSystemMetrics = useCallback(async (): Promise<SystemMetrics> => {
    // Simulate metrics
    // In production, these would be real metrics from the backend
    
    const queueState = offlineManager.getState()
    
    return {
      activeUsers: Math.floor(Math.random() * 15) + 5,
      pendingTransactions: Math.floor(Math.random() * 10),
      offlineQueueSize: queueState.pendingCount,
      todayRevenueUSD: Math.floor(Math.random() * 5000) + 1000,
      todayRevenueZWG: Math.floor(Math.random() * 5000000) + 1000000,
      todayClaims: Math.floor(Math.random() * 25) + 5,
      averageResponseTime: Math.floor(Math.random() * 200) + 100,
      errorRate24h: Math.random() * 2,
      uptimePercentage: 99.8 + (Math.random() * 0.2),
      lastBackup: new Date(Date.now() - Math.random() * 3600000),
      storageUsed: Math.floor(Math.random() * 500) + 100,
      storageTotal: 1024
    }
  }, [])

  // Fetch exchange rate info
  const fetchRateInfo = useCallback(async (): Promise<RateInfo> => {
    const currentRate = rateCache.getCurrentRate()
    const yesterdayRate = 1245 // Simulated
    
    return {
      currentRate: currentRate?.rate || 32.5,
      source: currentRate?.source || 'reserve_bank',
      lastUpdated: currentRate?.timestamp ? new Date(currentRate.timestamp) : new Date(),
      validUntil: currentRate?.validUntil ? new Date(currentRate.validUntil) : new Date(Date.now() + 1800000),
      change24h: ((currentRate?.rate || 32.5) - yesterdayRate) / yesterdayRate * 100,
      volatility: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
    }
  }, [])

  // Determine overall system status
  const determineOverallStatus = useCallback((services: ServiceHealth[]): SystemStatus => {
    const criticalServices = services.filter(s => s.critical)
    const offline = !navigator.onLine
    
    if (offline) {
      return 'offline'
    }

    const unhealthyCritical = criticalServices.filter(s => s.status === 'unhealthy')
    if (unhealthyCritical.length > 0) {
      return 'outage'
    }

    const degradedCritical = criticalServices.filter(s => s.status === 'degraded')
    if (degradedCritical.length > 0) {
      return 'degraded'
    }

    return 'operational'
  }, [])

  // Refresh all status data
  const refresh = useCallback(async () => {
    setIsLoading(true)
    
    try {
      const [servicesData, metricsData, rateData] = await Promise.all([
        fetchServiceHealth(),
        fetchSystemMetrics(),
        fetchRateInfo()
      ])

      setServices(servicesData)
      setMetrics(metricsData)
      setRateInfo(rateData)
      setOverallStatus(determineOverallStatus(servicesData))
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh system status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchServiceHealth, fetchSystemMetrics, fetchRateInfo, determineOverallStatus])

  // Initial load and periodic refresh
  useEffect(() => {
    refresh()

    const interval = setInterval(() => {
      refresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refresh, refreshInterval])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => refresh()
    const handleOffline = () => {
      setOverallStatus('offline')
      setServices(prev => prev.map(s => ({
        ...s,
        status: s.critical ? 'unhealthy' : s.status,
        message: s.critical ? 'Offline - Using cached data' : s.message
      })))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refresh])

  return {
    overallStatus,
    services,
    metrics,
    rateInfo,
    isLoading,
    lastRefresh,
    refreshInterval,
    setRefreshInterval,
    refresh
  }
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

interface StatusBadgeProps {
  status: SystemStatus | ServiceStatus
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showText?: boolean
  className?: string
}

const StatusBadge = ({ 
  status, 
  size = 'md', 
  showIcon = true, 
  showText = true,
  className = '' 
}: StatusBadgeProps) => {
  const getStatusConfig = (status: SystemStatus | ServiceStatus) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return {
          icon: '✅',
          text: status === 'operational' ? 'Operational' : 'Healthy',
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-800',
          borderColor: 'border-emerald-300',
          dotColor: 'bg-emerald-500'
        }
      case 'degraded':
        return {
          icon: '⚠️',
          text: 'Degraded',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-300',
          dotColor: 'bg-orange-500'
        }
      case 'outage':
      case 'unhealthy':
        return {
          icon: '❌',
          text: status === 'outage' ? 'Outage' : 'Unhealthy',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300',
          dotColor: 'bg-red-500'
        }
      case 'maintenance':
        return {
          icon: '🔧',
          text: 'Maintenance',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300',
          dotColor: 'bg-blue-500'
        }
      case 'offline':
        return {
          icon: '📴',
          text: 'Offline',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-300',
          dotColor: 'bg-gray-500'
        }
      case 'unknown':
        return {
          icon: '❓',
          text: 'Unknown',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-300',
          dotColor: 'bg-gray-400'
        }
    }
  }

  const config = getStatusConfig(status)
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        rounded-full border
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showIcon && <span>{config.icon}</span>}
      {showText && <span>{config.text}</span>}
      {!showIcon && !showText && (
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      )}
    </span>
  )
}

// ============================================================================
// SERVICE HEALTH CARD COMPONENT
// ============================================================================

interface ServiceHealthCardProps {
  service: ServiceHealth
  className?: string
}

const ServiceHealthCard = ({ service, className = '' }: ServiceHealthCardProps) => {
  const [expanded, setExpanded] = useState(false)

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-emerald-600'
    if (latency < 300) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-3
        hover:shadow-md transition-shadow
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="text-2xl">{service.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">{service.displayName}</h4>
              <StatusBadge status={service.status} size="sm" showText={false} />
            </div>
            
            {/* Service Message */}
            {service.message && (
              <p className="text-xs text-gray-600 mt-1">{service.message}</p>
            )}

            {/* Service Details */}
            <div className="flex items-center gap-3 mt-2 text-xs">
              {service.latency > 0 && (
                <span className={`flex items-center gap-1 ${getLatencyColor(service.latency)}`}>
                  <span>⚡</span>
                  <span>{service.latency}ms</span>
                </span>
              )}
              <span className="text-gray-500">
                {service.lastCheck.toLocaleTimeString('en-ZW', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
              {service.critical && (
                <span className="text-amber-600 flex items-center gap-1">
                  <span>⭐</span>
                  <span>Critical</span>
                </span>
              )}
            </div>

            {/* Dependencies */}
            {expanded && service.dependencies && service.dependencies.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                  Dependencies
                </p>
                <div className="flex flex-wrap gap-1">
                  {service.dependencies.map(dep => (
                    <span
                      key={dep}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded"
                    >
                      {SERVICE_HEALTH_CONFIG[dep]?.displayName || dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expand Button */}
        {service.dependencies && service.dependencies.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
            aria-label={expanded ? 'Show less' : 'Show more'}
          >
            <span className="text-lg">{expanded ? '−' : '+'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// METRICS CARD COMPONENT
// ============================================================================

interface MetricsCardProps {
  metrics: SystemMetrics
  className?: string
}

const MetricsCard = ({ metrics, className = '' }: MetricsCardProps) => {
  const formatCurrency = (amount: number, currency: 'USD' | 'ZWG') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount)
    }
    return `ZWG ${amount.toLocaleString('en-US')}`
  }

  const formatStorage = (mb: number) => {
    if (mb < 1024) return `${mb} MB`
    return `${(mb / 1024).toFixed(1)} GB`
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleString('en-ZW', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    })
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {/* Active Users */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-600 text-lg">👥</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Active Users</span>
        </div>
        <div className="text-2xl font-bold text-blue-700">{metrics.activeUsers}</div>
        <p className="text-xs text-gray-500 mt-1">Currently online</p>
      </div>

      {/* Today's Revenue */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-600 text-lg">💰</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Today</span>
        </div>
        <div className="text-lg font-bold text-green-700">
          {formatCurrency(metrics.todayRevenueUSD, 'USD')}
        </div>
        <div className="text-xs text-gray-600">
          {formatCurrency(metrics.todayRevenueZWG, 'ZWG')}
        </div>
      </div>

      {/* Medical Aid Claims */}
      <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 p-3 rounded-lg border border-purple-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-purple-600 text-lg">🏥</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Claims Today</span>
        </div>
        <div className="text-2xl font-bold text-purple-700">{metrics.todayClaims}</div>
        <p className="text-xs text-gray-500 mt-1">
          {metrics.offlineQueueSize > 0 
            ? `${metrics.offlineQueueSize} pending sync` 
            : 'All synced'}
        </p>
      </div>

      {/* System Health */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-600 text-lg">⚡</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Performance</span>
        </div>
        <div className="text-lg font-bold text-gray-700">
          {metrics.averageResponseTime}ms
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {metrics.errorRate24h.toFixed(1)}% error rate
        </p>
      </div>

      {/* Storage */}
      <div className="bg-gradient-to-br from-cyan-50 to-teal-50 p-3 rounded-lg border border-cyan-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-cyan-600 text-lg">💾</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Storage</span>
        </div>
        <div className="text-lg font-bold text-cyan-700">
          {formatStorage(metrics.storageUsed)}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
          <div
            className="bg-cyan-600 h-1.5 rounded-full"
            style={{ width: `${(metrics.storageUsed / metrics.storageTotal) * 100}%` }}
          />
        </div>
      </div>

      {/* Uptime */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-3 rounded-lg border border-emerald-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emerald-600 text-lg">📈</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Uptime</span>
        </div>
        <div className="text-lg font-bold text-emerald-700">
          {metrics.uptimePercentage.toFixed(1)}%
        </div>
        <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
      </div>

      {/* Last Backup */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-3 rounded-lg border border-amber-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-600 text-lg">💿</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Backup</span>
        </div>
        <div className="text-sm font-bold text-amber-700">
          {formatDate(metrics.lastBackup)}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {metrics.lastBackup 
            ? `${Math.round((Date.now() - metrics.lastBackup.getTime()) / 3600000)}h ago`
            : 'Never'}
        </p>
      </div>

      {/* Offline Queue */}
      <div className="bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-orange-600 text-lg">📋</span>
          <span className="text-xs text-gray-600 uppercase tracking-wider">Offline Queue</span>
        </div>
        <div className="text-2xl font-bold text-orange-600">{metrics.offlineQueueSize}</div>
        <p className="text-xs text-gray-500 mt-1">Items pending sync</p>
      </div>
    </div>
  )
}

// ============================================================================
// EXCHANGE RATE CARD COMPONENT
// ============================================================================

interface ExchangeRateCardProps {
  rateInfo: RateInfo
  className?: string
}

const ExchangeRateCard = ({ rateInfo, className = '' }: ExchangeRateCardProps) => {
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'reserve_bank': return 'Reserve Bank of Zimbabwe'
      case 'interbank': return 'Interbank Rate'
      case 'parallel': return 'Parallel Market'
      case 'manual': return 'Manual Entry'
      case 'clinic_rate': return 'Clinic Rate'
      default: return source
    }
  }

  const getVolatilityColor = (volatility: 'low' | 'medium' | 'high') => {
    switch (volatility) {
      case 'low': return 'text-emerald-600 bg-emerald-100'
      case 'medium': return 'text-orange-600 bg-orange-100'
      case 'high': return 'text-red-600 bg-red-100'
    }
  }

  const getTimeUntilExpiry = (validUntil: Date) => {
    const diff = validUntil.getTime() - Date.now()
    if (diff < 0) return 'Expired'
    if (diff < 60000) return 'Less than 1 minute'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours`
    return `${Math.floor(diff / 86400000)} days`
  }

  return (
    <div className={`bg-gradient-to-br from-currency-locked/5 to-transparent rounded-lg border-2 border-currency-locked/30 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-currency-locked text-xl">💱</span>
          <h3 className="font-bold text-currency-locked">Exchange Rate</h3>
        </div>
        <span className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${getVolatilityColor(rateInfo.volatility)}
        `}>
          {rateInfo.volatility} volatility
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-vp-primary">
          1 USD = {rateInfo.currentRate.toLocaleString()} ZWG
        </span>
        {rateInfo.change24h !== 0 && (
          <span className={`
            text-sm font-medium
            ${rateInfo.change24h > 0 ? 'text-green-600' : 'text-red-600'}
          `}>
            {rateInfo.change24h > 0 ? '▲' : '▼'} {Math.abs(rateInfo.change24h).toFixed(2)}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500">Source</span>
          <p className="font-medium">{getSourceLabel(rateInfo.source)}</p>
        </div>
        <div>
          <span className="text-gray-500">Updated</span>
          <p className="font-medium">
            {rateInfo.lastUpdated.toLocaleTimeString('en-ZW', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Valid Until</span>
          <p className="font-medium">
            {rateInfo.validUntil.toLocaleTimeString('en-ZW', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Time Left</span>
          <p className="font-medium text-currency-locked">
            {getTimeUntilExpiry(rateInfo.validUntil)}
          </p>
        </div>
      </div>

      {rateInfo.source === 'manual' && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-1">
          <span>⚠️</span>
          <span>Manual rate override - Verify with clinic policy</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN SYSTEM STATUS COMPONENT
// ============================================================================

export default function SystemStatus() {
  const {
    overallStatus,
    services,
    metrics,
    rateInfo,
    isLoading,
    lastRefresh,
    refreshInterval,
    setRefreshInterval,
    refresh
  } = useSystemStatus()

  const [expanded, setExpanded] = useState(false)
  const criticalServices = services.filter(s => s.critical)
  const nonCriticalServices = services.filter(s => !s.critical)

  if (isLoading && !services.length) {
    return (
      <div className="vp-card mb-6">
        <div className="vp-card-header">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Loading System Status...</span>
          </div>
        </div>
        <div className="vp-card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-4 gap-4">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vp-card mb-6">
      {/* Header */}
      <div className="vp-card-header">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {overallStatus === 'operational' ? '✅' : 
               overallStatus === 'degraded' ? '⚠️' :
               overallStatus === 'outage' ? '❌' :
               overallStatus === 'maintenance' ? '🔧' :
               overallStatus === 'offline' ? '📴' : '❓'}
            </span>
            <div>
              <h2 className="text-lg font-bold">System Status</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={overallStatus} size="sm" />
                {overallStatus === 'offline' && (
                  <span className="text-xs text-amber-200">
                    Working offline - limited functionality
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Interval Selector */}
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-xs bg-white/20 text-white border border-white/30 rounded px-2 py-1"
              aria-label="Refresh interval"
            >
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
              <option value={300000}>5m</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="text-white hover:text-gray-200 disabled:opacity-50 transition-colors"
              aria-label="Refresh status"
            >
              <span className={`text-xl ${isLoading ? 'animate-spin' : ''}`}>
                🔄
              </span>
            </button>

            {/* Expand/Collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label={expanded ? 'Show less' : 'Show more'}
            >
              <span className="text-xl">{expanded ? '−' : '+'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="vp-card-body space-y-4">
        {/* Exchange Rate Card */}
        {rateInfo && <ExchangeRateCard rateInfo={rateInfo} />}

        {/* Metrics Grid */}
        {metrics && <MetricsCard metrics={metrics} />}

        {/* Services Grid */}
        <div className="space-y-3">
          {/* Critical Services */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-amber-500">⭐</span>
              Critical Services
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {criticalServices.map(service => (
                <ServiceHealthCard key={service.name} service={service} />
              ))}
            </div>
          </div>

          {/* Non-Critical Services (Expandable) */}
          {expanded && (
            <div className="pt-3 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-gray-500">⚙️</span>
                Supporting Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nonCriticalServices.map(service => (
                  <ServiceHealthCard key={service.name} service={service} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>🕐</span>
            <span>
              Last updated: {lastRefresh.toLocaleTimeString('en-ZW', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>📊</span>
            <span>
              Auto-refresh: {refreshInterval / 1000}s
            </span>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="text-vp-secondary hover:text-vp-primary transition-colors disabled:opacity-50"
          >
            Refresh now
          </button>
        </div>

        {/* Zimbabwe Offline Notice */}
        {overallStatus === 'offline' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg">📱</span>
              <div className="text-amber-800">
                <p className="font-medium mb-1">Offline Mode Active</p>
                <p className="text-xs">
                  VisionPlus is working offline. You can still create orders, process cash payments, 
                  and record medical aid awards. All data will sync automatically when connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// EXPORT COMPONENTS AND HOOKS
// ============================================================================

export { 
  useSystemStatus,
  StatusBadge,
  ServiceHealthCard,
  MetricsCard,
  ExchangeRateCard
}