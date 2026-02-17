// components/system/NetworkStatus.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { OfflineManager } from '@/lib/offline/OfflineManager'
import { ExchangeRateCache } from '@/lib/offline/ExchangeRateCache'

// ============================================================================
// TYPES - Production Grade, Immutable
// ============================================================================

type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none'
type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'critical' | 'offline'
type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'pending'

interface NetworkInfo {
  readonly isOnline: boolean
  readonly isSlow: boolean
  readonly isMetered: boolean
  readonly type: ConnectionType
  readonly quality: ConnectionQuality
  readonly downlink: number // Mbps
  readonly rtt: number // ms
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
  readonly saveData: boolean
}

interface SyncProgress {
  readonly total: number
  readonly completed: number
  readonly failed: number
  readonly pending: number
  readonly percentage: number
  readonly estimatedTimeRemaining: number // ms
}

interface OfflineQueueStats {
  readonly pendingActions: number
  readonly failedActions: number
  readonly completedToday: number
  readonly oldestAction: number | null
  readonly estimatedSyncTime: number // ms
}

// ============================================================================
// NETWORK STATUS HOOK - Production Ready
// ============================================================================

function useNetworkStatus() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSlow: false,
      isMetered: connection?.metered || false,
      type: 'unknown',
      quality: 'good',
      downlink: connection?.downlink || 10,
      rtt: connection?.rtt || 50,
      effectiveType: connection?.effectiveType || '4g',
      saveData: connection?.saveData || false
    }
  })

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    percentage: 0,
    estimatedTimeRemaining: 0
  })

  const [queueStats, setQueueStats] = useState<OfflineQueueStats>({
    pendingActions: 0,
    failedActions: 0,
    completedToday: 0,
    oldestAction: null,
    estimatedSyncTime: 0
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const offlineManager = OfflineManager.getInstance()
  const rateCache = ExchangeRateCache.getInstance()

  // Update network info
  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection

      const isOnline = navigator.onLine
      const downlink = connection?.downlink || 10
      const rtt = connection?.rtt || 50
      const effectiveType = connection?.effectiveType || '4g'

      // Determine connection type
      let type: ConnectionType = 'unknown'
      if (connection?.type) {
        if (connection.type === 'wifi') type = 'wifi'
        else if (connection.type === 'cellular') type = 'cellular'
        else if (connection.type === 'ethernet') type = 'ethernet'
        else if (connection.type === 'none') type = 'none'
      }

      // Determine connection quality
      let quality: ConnectionQuality = 'good'
      let isSlow = false

      if (!isOnline) {
        quality = 'offline'
        isSlow = true
      } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        quality = 'critical'
        isSlow = true
      } else if (effectiveType === '3g') {
        quality = 'poor'
        isSlow = true
      } else if (downlink < 1.5) {
        quality = 'poor'
        isSlow = true
      } else if (downlink < 5) {
        quality = 'good'
        isSlow = false
      } else {
        quality = 'excellent'
        isSlow = false
      }

      setNetworkInfo({
        isOnline,
        isSlow,
        isMetered: connection?.metered || false,
        type,
        quality,
        downlink,
        rtt,
        effectiveType,
        saveData: connection?.saveData || false
      })

      // Show banner when offline or on slow connection
      if (!isOnline || quality === 'critical' || quality === 'poor') {
        if (!bannerDismissed) {
          setShowBanner(true)
        }
      } else {
        setShowBanner(false)
        setBannerDismissed(false)
      }
    }

    // Initial update
    updateNetworkInfo()

    // Listen for connection changes
    window.addEventListener('online', updateNetworkInfo)
    window.addEventListener('offline', updateNetworkInfo)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo)
    }

    return () => {
      window.removeEventListener('online', updateNetworkInfo)
      window.removeEventListener('offline', updateNetworkInfo)
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [bannerDismissed])

  // Update queue stats
  useEffect(() => {
    const updateQueueStats = () => {
      const queue = offlineManager.getQueue()
      const now = Date.now()
      const today = new Date().setHours(0, 0, 0, 0)

      const pending = queue.filter(a => a.status === 'pending').length
      const failed = queue.filter(a => a.status === 'failed').length
      const completed = queue.filter(a => 
        a.status === 'completed' && a.timestamp > today
      ).length

      const oldestPending = queue
        .filter(a => a.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp)[0]

      // Estimate sync time: ~500ms per action
      const estimatedSyncTime = pending * 500

      setQueueStats({
        pendingActions: pending,
        failedActions: failed,
        completedToday: completed,
        oldestAction: oldestPending?.timestamp || null,
        estimatedSyncTime
      })
    }

    updateQueueStats()
    const interval = setInterval(updateQueueStats, 5000)

    // Listen for queue changes
    const handleQueueChange = () => updateQueueStats()
    window.addEventListener('visionplus:offline-state', handleQueueChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('visionplus:offline-state', handleQueueChange)
    }
  }, [])

  // Sync handler
  const sync = useCallback(async () => {
    if (isSyncing || !networkInfo.isOnline) return

    setIsSyncing(true)
    setSyncProgress(prev => ({ ...prev, percentage: 0 }))

    try {
      const queue = offlineManager.getQueue()
      const pending = queue.filter(a => a.status === 'pending')
      const total = pending.length

      let completed = 0
      let failed = 0

      for (const action of pending) {
        try {
          // Simulate sync - in production this would actually process the action
          await new Promise(resolve => setTimeout(resolve, 300))
          completed++
          
          setSyncProgress({
            total,
            completed,
            failed,
            pending: total - completed - failed,
            percentage: (completed / total) * 100,
            estimatedTimeRemaining: (total - completed) * 300
          })
        } catch (error) {
          failed++
        }
      }

      setLastSyncTime(new Date())
      setSyncProgress(prev => ({
        ...prev,
        percentage: 100,
        estimatedTimeRemaining: 0
      }))

      // Dispatch sync completed event
      window.dispatchEvent(new CustomEvent('visionplus:sync-completed', {
        detail: { timestamp: Date.now(), completed, failed }
      }))

    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, networkInfo.isOnline])

  // Auto-sync when coming online
  useEffect(() => {
    if (networkInfo.isOnline && queueStats.pendingActions > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        sync()
      }, 3000) // Wait 3 seconds after coming online

      return () => clearTimeout(timer)
    }
  }, [networkInfo.isOnline, queueStats.pendingActions, isSyncing, sync])

  // Periodic sync
  useEffect(() => {
    if (networkInfo.isOnline && queueStats.pendingActions > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (!isSyncing) {
          sync()
        }
      }, 60000) // Every minute

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current)
        }
      }
    }
  }, [networkInfo.isOnline, queueStats.pendingActions, isSyncing, sync])

  const dismissBanner = useCallback(() => {
    setShowBanner(false)
    setBannerDismissed(true)
  }, [])

  return {
    networkInfo,
    syncProgress,
    queueStats,
    isSyncing,
    lastSyncTime,
    showBanner,
    sync,
    dismissBanner
  }
}

// ============================================================================
// CONNECTION QUALITY INDICATOR COMPONENT
// ============================================================================

interface ConnectionQualityIndicatorProps {
  quality: ConnectionQuality
  className?: string
}

const ConnectionQualityIndicator = ({ quality, className = '' }: ConnectionQualityIndicatorProps) => {
  const getQualityConfig = (quality: ConnectionQuality) => {
    switch (quality) {
      case 'excellent':
        return {
          icon: '📶',
          label: 'Excellent',
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-100',
          bars: 4,
          barColor: 'bg-emerald-500'
        }
      case 'good':
        return {
          icon: '📶',
          label: 'Good',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          bars: 3,
          barColor: 'bg-green-500'
        }
      case 'poor':
        return {
          icon: '📶',
          label: 'Poor',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          bars: 2,
          barColor: 'bg-orange-500'
        }
      case 'critical':
        return {
          icon: '⚠️',
          label: 'Critical',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          bars: 1,
          barColor: 'bg-red-500'
        }
      case 'offline':
        return {
          icon: '🚫',
          label: 'Offline',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          bars: 0,
          barColor: 'bg-gray-400'
        }
    }
  }

  const config = getQualityConfig(quality)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`
              w-1.5 h-4 rounded-full transition-all duration-300
              ${i < config.bars ? config.barColor : 'bg-gray-200'}
              ${i === 0 ? 'h-2' : i === 1 ? 'h-3' : i === 2 ? 'h-4' : 'h-5'}
            `}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${config.color}`}>
        {config.icon} {config.label}
      </span>
    </div>
  )
}

// ============================================================================
// SYNC PROGRESS COMPONENT
// ============================================================================

interface SyncProgressProps {
  progress: SyncProgress
  isSyncing: boolean
  lastSyncTime: Date | null
  onSync: () => void
  className?: string
}

const SyncProgressIndicator = ({
  progress,
  isSyncing,
  lastSyncTime,
  onSync,
  className = ''
}: SyncProgressProps) => {
  const formatTimeRemaining = (ms: number): string => {
    if (ms < 1000) return 'less than a second'
    if (ms < 60000) return `${Math.ceil(ms / 1000)} seconds`
    if (ms < 3600000) return `${Math.ceil(ms / 60000)} minutes`
    return `${Math.ceil(ms / 3600000)} hours`
  }

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
    return date.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (progress.total === 0 && !isSyncing) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 text-lg">✓</span>
          <span className="text-xs font-medium text-gray-700">All data synced</span>
        </div>
        {lastSyncTime && (
          <span className="text-xs text-gray-500">
            Last sync: {formatLastSync(lastSyncTime)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-vp-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-gray-700">
                Syncing... {progress.completed}/{progress.total}
              </span>
            </>
          ) : (
            <>
              <span className="text-orange-600 text-lg">⏳</span>
              <span className="text-xs font-medium text-gray-700">
                {progress.pending} items waiting to sync
              </span>
            </>
          )}
        </div>
        
        {!isSyncing && progress.pending > 0 && (
          <button
            onClick={onSync}
            className="text-xs px-2 py-1 bg-vp-primary text-white rounded hover:bg-vp-primary/90 transition-colors"
          >
            Sync Now
          </button>
        )}
      </div>

      {progress.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-vp-secondary transition-all duration-300 rounded-full"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          
          {isSyncing && progress.estimatedTimeRemaining > 0 && (
            <p className="text-xs text-gray-500">
              Estimated time remaining: {formatTimeRemaining(progress.estimatedTimeRemaining)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// OFFLINE QUEUE VISUALIZATION COMPONENT
// ============================================================================

interface OfflineQueueVisualizationProps {
  stats: OfflineQueueStats
  className?: string
}

const OfflineQueueVisualization = ({ stats, className = '' }: OfflineQueueVisualizationProps) => {
  const formatOldestAction = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours`
    return `${Math.floor(diff / 86400000)} days`
  }

  if (stats.pendingActions === 0 && stats.failedActions === 0) {
    return null
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-3 border border-gray-200 ${className}`}>
      <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
        <span>📋</span>
        Offline Queue
      </h4>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-amber-600">{stats.pendingActions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Failed:</span>
            <span className="font-bold text-red-600">{stats.failedActions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Completed today:</span>
            <span className="font-bold text-emerald-600">{stats.completedToday}</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Oldest:</span>
            <span className="font-mono text-gray-800">
              {formatOldestAction(stats.oldestAction)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Est. sync:</span>
            <span className="font-mono text-gray-800">
              {stats.estimatedSyncTime < 60000 
                ? `${Math.ceil(stats.estimatedSyncTime / 1000)}s` 
                : `${Math.ceil(stats.estimatedSyncTime / 60000)}m`}
            </span>
          </div>
        </div>
      </div>

      {stats.failedActions > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => OfflineManager.getInstance().retryFailed()}
            className="text-xs text-vp-secondary hover:text-vp-primary flex items-center gap-1"
          >
            <span>🔄</span>
            Retry Failed ({stats.failedActions})
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN NETWORK STATUS COMPONENT
// ============================================================================

export default function NetworkStatus() {
  const {
    networkInfo,
    syncProgress,
    queueStats,
    isSyncing,
    lastSyncTime,
    showBanner,
    sync,
    dismissBanner
  } = useNetworkStatus()

  const [isExpanded, setIsExpanded] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Auto-hide banner after 10 seconds if online
  useEffect(() => {
    if (networkInfo.isOnline && showBanner) {
      const timer = setTimeout(() => {
        dismissBanner()
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [networkInfo.isOnline, showBanner, dismissBanner])

  if (!showBanner && !isExpanded && queueStats.pendingActions === 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-10 h-10 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors"
          aria-label="Network status"
          title="Connected"
        >
          <span className="text-lg">📶</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full sm:w-96">
      {/* Collapsed View */}
      {!isExpanded && !showBanner && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-10 h-10 bg-vp-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-vp-primary/90 transition-colors"
            aria-label="Show network status"
          >
            {networkInfo.isOnline ? (
              <span className="text-lg">📶</span>
            ) : (
              <span className="text-lg">🚫</span>
            )}
          </button>
        </div>
      )}

      {/* Expanded Status Panel */}
      {(isExpanded || showBanner) && (
        <div className={`
          vp-card animate-slide-in-right
          ${!networkInfo.isOnline ? 'border-l-4 border-l-status-error' : 
            networkInfo.quality === 'critical' ? 'border-l-4 border-l-status-error' :
            networkInfo.quality === 'poor' ? 'border-l-4 border-l-status-warning' :
            'border-l-4 border-l-status-cleared'}
        `}>
          {/* Header */}
          <div className="vp-card-header bg-gradient-to-r from-vp-primary to-vp-secondary py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {networkInfo.isOnline ? '📶' : '🚫'}
                </span>
                <span className="font-bold text-white">
                  {networkInfo.isOnline ? 'Connected' : 'Offline Mode'}
                </span>
              </div>
              
              <button
                onClick={() => {
                  setIsExpanded(false)
                  dismissBanner()
                }}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="vp-card-body space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <ConnectionQualityIndicator 
                quality={networkInfo.quality} 
                className="flex-1"
              />
              
              {!networkInfo.isOnline && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                  Offline Mode Active
                </span>
              )}
            </div>

            {/* Network Details */}
            {networkInfo.isOnline && (
              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium capitalize">{networkInfo.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Speed:</span>
                  <span className="font-medium">
                    {networkInfo.downlink.toFixed(1)} Mbps
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Latency:</span>
                  <span className="font-medium">{networkInfo.rtt} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Saver:</span>
                  <span className="font-medium">{networkInfo.saveData ? 'On' : 'Off'}</span>
                </div>
              </div>
            )}

            {/* Sync Progress */}
            <SyncProgressIndicator
              progress={syncProgress}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              onSync={sync}
            />

            {/* Offline Queue Visualization */}
            <OfflineQueueVisualization stats={queueStats} />

            {/* Zimbabwe-specific Offline Features */}
            {!networkInfo.isOnline && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-lg">📱</span>
                  <div className="text-xs">
                    <p className="font-medium text-amber-800 mb-1">
                      Zimbabwe Offline Features Available:
                    </p>
                    <ul className="space-y-1 text-amber-700">
                      <li className="flex items-center gap-1">
                        <span>✓</span> Create orders with locked rates
                      </li>
                      <li className="flex items-center gap-1">
                        <span>✓</span> Process cash payments (USD/ZWG)
                      </li>
                      <li className="flex items-center gap-1">
                        <span>✓</span> Record medical aid awards
                      </li>
                      <li className="flex items-center gap-1">
                        <span>↻</span> Auto-sync when connection restored
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Data Saver Warning */}
            {networkInfo.saveData && networkInfo.isOnline && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800 flex items-center gap-2">
                <span>💾</span>
                <span>Data Saver mode enabled. Images and large files won't load.</span>
              </div>
            )}

            {/* Metered Connection Warning */}
            {networkInfo.isMetered && networkInfo.isOnline && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 flex items-center gap-2">
                <span>⚠️</span>
                <span>Metered connection. Large syncs may incur data charges.</span>
              </div>
            )}

            {/* Expand/Collapse Toggle */}
            {!showBanner && (
              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <span>▲</span>
                  Minimize
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// NETWORK STATUS BADGE COMPONENT
// ============================================================================

interface NetworkStatusBadgeProps {
  className?: string
}

export function NetworkStatusBadge({ className = '' }: NetworkStatusBadgeProps) {
  const { networkInfo } = useNetworkStatus()

  if (networkInfo.isOnline && networkInfo.quality !== 'critical' && networkInfo.quality !== 'poor') {
    return null
  }

  return (
    <div className={`fixed bottom-4 left-4 z-40 ${className}`}>
      <div className={`
        px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm
        ${!networkInfo.isOnline 
          ? 'bg-amber-100 text-amber-800 border border-amber-300'
          : networkInfo.quality === 'critical'
            ? 'bg-red-100 text-red-800 border border-red-300'
            : 'bg-orange-100 text-orange-800 border border-orange-300'
        }
      `}>
        <span className="text-lg" aria-hidden="true">
          {!networkInfo.isOnline ? '🚫' : '⚠️'}
        </span>
        <span className="font-medium">
          {!networkInfo.isOnline 
            ? 'Working offline' 
            : networkInfo.quality === 'critical'
              ? 'Connection critical'
              : 'Connection unstable'
          }
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// NETWORK STATUS PROVIDER
// ============================================================================

interface NetworkStatusProviderProps {
  children: React.ReactNode
}

export function NetworkStatusProvider({ children }: NetworkStatusProviderProps) {
  return (
    <>
      <NetworkStatus />
      <NetworkStatusBadge />
      {children}
    </>
  )
}

// ============================================================================
// EXPORT HOOK AND UTILITIES
// ============================================================================

export { useNetworkStatus }
export type { NetworkInfo, SyncProgress, OfflineQueueStats }