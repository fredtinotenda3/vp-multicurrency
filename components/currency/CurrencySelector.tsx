// components/currency/CurrencySelector.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================================
// TYPES - Explicit, immutable, production-grade
// ============================================================================

type Currency = 'USD' | 'ZWL'
type RateSource = 'reserve_bank' | 'manual' | 'clinic_rate' | 'interbank' | 'parallel'
type RateStatus = 'live' | 'locked' | 'stale' | 'offline'

interface ExchangeRate {
  readonly rate: number
  readonly currency: Currency
  readonly source: RateSource
  readonly status: RateStatus
  readonly timestamp: Date
  readonly validUntil: Date
  readonly lockedAt?: Date
  readonly lockedBy?: string
  readonly lockedReason?: string
  readonly previousRate?: number
  readonly variance?: number // Percentage change from previous
}

interface RateAuditEntry {
  readonly id: string
  readonly transactionId?: string
  readonly orderId?: string
  readonly previousRate: number
  readonly newRate: number
  readonly source: RateSource
  readonly action: 'lock' | 'unlock' | 'update' | 'manual_override'
  readonly performedBy: string
  readonly timestamp: Date
  readonly reason?: string
  readonly terminalId?: string
}

interface CurrencySelectorProps {
  // Core Props
  initialCurrency?: Currency
  initialRate?: number
  onCurrencyChange?: (currency: Currency) => void
  onRateLock?: (rate: number, currency: Currency, source: RateSource, lockedAt: Date) => void
  onRateUnlock?: () => void
  
  // State Props
  isRateLocked?: boolean
  baseCurrency?: 'USD'
  
  // Configuration
  showAuditTrail?: boolean
  showHistoricalRates?: boolean
  requireLockReason?: boolean
  requireUnlockReason?: boolean
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
  
  // User Context
  currentUser?: string
  terminalId?: string
  orderId?: string
  transactionId?: string
  
  // Styling
  className?: string
}

// ============================================================================
// MOCK EXCHANGE RATE SERVICE - In production, this would be a real API
// ============================================================================

class ExchangeRateService {
  private static instance: ExchangeRateService
  private subscribers: ((rate: ExchangeRate) => void)[] = []
  private currentRate: ExchangeRate
  private refreshInterval: NodeJS.Timeout | null = null
  private readonly RBZ_ENDPOINT = 'https://www.rbz.co.zw/index.php/exchange-rates' // Mock
  
  private constructor() {
    // Initialize with Reserve Bank of Zimbabwe rate
    this.currentRate = {
      rate: 1250,
      currency: 'ZWL',
      source: 'reserve_bank',
      status: 'live',
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      previousRate: 1248,
      variance: 0.16
    }
  }

  static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService()
    }
    return ExchangeRateService.instance
  }

  async fetchLiveRate(): Promise<ExchangeRate> {
    // Simulate API call to Reserve Bank of Zimbabwe
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Simulate small fluctuations
    const baseRate = 1250
    const variance = Math.random() * 10 - 5
    const newRate = Math.max(1200, Math.min(1300, baseRate + variance))
    
    const rate: ExchangeRate = {
      rate: Number(newRate.toFixed(2)),
      currency: 'ZWL',
      source: 'reserve_bank',
      status: 'live',
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 30 * 60 * 1000),
      previousRate: this.currentRate.rate,
      variance: Number(((newRate - this.currentRate.rate) / this.currentRate.rate * 100).toFixed(2))
    }
    
    this.currentRate = rate
    this.notifySubscribers()
    
    return rate
  }

  async getParallelMarketRate(): Promise<ExchangeRate> {
    // Parallel market rate (sometimes used in Zimbabwe)
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const baseRate = await this.fetchLiveRate()
    const parallelRate = baseRate.rate * 1.05 // 5% premium
    
    return {
      rate: Number(parallelRate.toFixed(2)),
      currency: 'ZWL',
      source: 'parallel',
      status: 'live',
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes validity
      previousRate: baseRate.rate,
      variance: 5.0
    }
  }

  async getInterbankRate(): Promise<ExchangeRate> {
    // Interbank rate (official)
    await new Promise(resolve => setTimeout(resolve, 250))
    
    const baseRate = await this.fetchLiveRate()
    const interbankRate = baseRate.rate * 0.98 // 2% discount
    
    return {
      rate: Number(interbankRate.toFixed(2)),
      currency: 'ZWL',
      source: 'interbank',
      status: 'live',
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 45 * 60 * 1000),
      previousRate: baseRate.rate,
      variance: -2.0
    }
  }

  subscribe(callback: (rate: ExchangeRate) => void): () => void {
    this.subscribers.push(callback)
    callback(this.currentRate)
    
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentRate))
  }

  startAutoRefresh(intervalMs: number = 30000): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
    this.refreshInterval = setInterval(() => {
      this.fetchLiveRate()
    }, intervalMs)
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  getCurrentRate(): ExchangeRate {
    return this.currentRate
  }
}

// ============================================================================
// AUDIT TRAIL HOOK
// ============================================================================

function useRateAudit() {
  const [auditTrail, setAuditTrail] = useState<RateAuditEntry[]>([])

  const addAuditEntry = useCallback((entry: Omit<RateAuditEntry, 'id' | 'timestamp'>) => {
    const newEntry: RateAuditEntry = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date(),
      ...entry
    }
    
    setAuditTrail(prev => [newEntry, ...prev])
    
    // Persist to localStorage for offline/audit purposes
    try {
      const existing = localStorage.getItem('visionplus_rate_audit')
      const auditLog = existing ? JSON.parse(existing) : []
      localStorage.setItem('visionplus_rate_audit', JSON.stringify([newEntry, ...auditLog].slice(0, 100)))
    } catch (error) {
      console.error('Failed to persist audit entry:', error)
    }
    
    return newEntry
  }, [])

  const getAuditForTransaction = useCallback((transactionId: string): RateAuditEntry[] => {
    return auditTrail.filter(entry => entry.transactionId === transactionId)
  }, [auditTrail])

  const getAuditForOrder = useCallback((orderId: string): RateAuditEntry[] => {
    return auditTrail.filter(entry => entry.orderId === orderId)
  }, [auditTrail])

  const clearAudit = useCallback(() => {
    setAuditTrail([])
    localStorage.removeItem('visionplus_rate_audit')
  }, [])

  return {
    auditTrail,
    addAuditEntry,
    getAuditForTransaction,
    getAuditForOrder,
    clearAudit
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CurrencySelector({
  // Core Props
  initialCurrency = 'ZWL',
  initialRate,
  onCurrencyChange,
  onRateLock,
  onRateUnlock,
  
  // State Props
  isRateLocked: externalLockState,
  baseCurrency = 'USD',
  
  // Configuration
  showAuditTrail = false,
  showHistoricalRates = false,
  requireLockReason = true,
  requireUnlockReason = true,
  autoRefresh = true,
  refreshInterval = 30000,
  
  // User Context
  currentUser = 'system',
  terminalId = 'unknown',
  orderId,
  transactionId,
  
  // Styling
  className = ''
}: CurrencySelectorProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Rate Lock State
  const [isLocked, setIsLocked] = useState(externalLockState || false)
  const [lockedRate, setLockedRate] = useState<number | null>(initialRate || null)
  const [lockedAt, setLockedAt] = useState<Date | null>(null)
  const [lockedBy, setLockedBy] = useState<string | null>(null)
  const [lockReason, setLockReason] = useState<string>('')
  
  // UI State
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualRate, setManualRate] = useState<string>('')
  const [showLockReasonDialog, setShowLockReasonDialog] = useState(false)
  const [showUnlockReasonDialog, setShowUnlockReasonDialog] = useState(false)
  const [unlockReason, setUnlockReason] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'current' | 'historical' | 'audit'>('current')
  const [rateSource, setRateSource] = useState<RateSource>('reserve_bank')
  
  // Hooks
  const { auditTrail, addAuditEntry } = useRateAudit()
  const rateService = ExchangeRateService.getInstance()

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Subscribe to live rate updates
  useEffect(() => {
    const unsubscribe = rateService.subscribe((rate) => {
      setExchangeRate(rate)
      setManualRate(rate.rate.toString())
    })

    // Fetch initial rate
    rateService.fetchLiveRate()

    // Auto-refresh
    if (autoRefresh && !isLocked) {
      rateService.startAutoRefresh(refreshInterval)
    }

    return () => {
      unsubscribe()
      if (autoRefresh) {
        rateService.stopAutoRefresh()
      }
    }
  }, [autoRefresh, refreshInterval, isLocked])

  // Sync external lock state
  useEffect(() => {
    if (externalLockState !== undefined) {
      setIsLocked(externalLockState)
    }
  }, [externalLockState])

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validateRate = useCallback((rate: number): { isValid: boolean; error?: string } => {
    if (isNaN(rate) || rate <= 0) {
      return { isValid: false, error: 'Exchange rate must be greater than zero' }
    }
    
    if (rate < 100) {
      return { isValid: false, error: 'Rate seems unusually low. Please verify.' }
    }
    
    if (rate > 10000) {
      return { isValid: false, error: 'Rate exceeds maximum allowed (10,000 ZWL/USD)' }
    }
    
    const decimalPlaces = rate.toString().split('.')[1]?.length || 0
    if (decimalPlaces > 2) {
      return { isValid: false, error: 'Rate cannot have more than 2 decimal places' }
    }
    
    // Check for unreasonable variance from current rate
    if (exchangeRate && !isLocked) {
      const variance = Math.abs((rate - exchangeRate.rate) / exchangeRate.rate * 100)
      if (variance > 10) {
        return { 
          isValid: false, 
          error: `Rate variance of ${variance.toFixed(1)}% exceeds maximum allowed (10%)` 
        }
      }
    }
    
    return { isValid: true }
  }, [exchangeRate, isLocked])

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleCurrencyChange = useCallback((currency: Currency) => {
    if (isLocked) {
      setError('Cannot change currency while rate is locked. Unlock rate first.')
      return
    }
    
    setSelectedCurrency(currency)
    setError(null)
    onCurrencyChange?.(currency)
  }, [isLocked, onCurrencyChange])

  const handleLockRate = useCallback(async (rate?: number, source: RateSource = 'reserve_bank') => {
    // Show reason dialog if required
    if (requireLockReason && !lockReason && source === 'manual') {
      setShowLockReasonDialog(true)
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      let rateToLock: number
      let rateSource: RateSource = source
      
      if (rate !== undefined) {
        // Manual rate entry
        rateToLock = rate
        rateSource = 'manual'
      } else if (exchangeRate) {
        // Live rate
        rateToLock = exchangeRate.rate
        rateSource = exchangeRate.source
      } else {
        // Fallback
        const liveRate = await rateService.fetchLiveRate()
        rateToLock = liveRate.rate
        rateSource = liveRate.source
      }
      
      // Validate rate
      const validation = validateRate(rateToLock)
      if (!validation.isValid) {
        setError(validation.error || 'Invalid exchange rate')
        setIsLoading(false)
        return
      }
      
      // Lock the rate
      setLockedRate(rateToLock)
      setLockedAt(new Date())
      setLockedBy(currentUser)
      setIsLocked(true)
      
      // Add audit entry
      addAuditEntry({
        transactionId,
        orderId,
        previousRate: exchangeRate?.rate || 0,
        newRate: rateToLock,
        source: rateSource,
        action: 'lock',
        performedBy: currentUser,
        reason: lockReason || (source === 'manual' ? 'Manual rate override' : 'Live rate lock'),
        terminalId
      })
      
      // Notify parent
      onRateLock?.(rateToLock, selectedCurrency, rateSource, new Date())
      
      // Stop auto-refresh
      rateService.stopAutoRefresh()
      
      setShowManualEntry(false)
      setLockReason('')
      
    } catch (err) {
      setError('Failed to lock exchange rate. Please try again.')
      console.error('Rate lock error:', err)
    } finally {
      setIsLoading(false)
      setShowLockReasonDialog(false)
    }
  }, [
    exchangeRate,
    selectedCurrency,
    isLocked,
    lockReason,
    requireLockReason,
    currentUser,
    terminalId,
    orderId,
    transactionId,
    onRateLock,
    addAuditEntry,
    validateRate
  ])

  const handleUnlockRate = useCallback(() => {
    if (requireUnlockReason) {
      setShowUnlockReasonDialog(true)
      return
    }
    
    performUnlock()
  }, [requireUnlockReason])

  const performUnlock = useCallback((reason?: string) => {
    // Add audit entry
    if (lockedRate && exchangeRate) {
      addAuditEntry({
        transactionId,
        orderId,
        previousRate: lockedRate,
        newRate: exchangeRate.rate,
        source: exchangeRate.source,
        action: 'unlock',
        performedBy: currentUser,
        reason: reason || 'Rate unlocked by user',
        terminalId
      })
    }
    
    // Unlock
    setLockedRate(null)
    setLockedAt(null)
    setLockedBy(null)
    setIsLocked(false)
    
    // Restart auto-refresh
    if (autoRefresh) {
      rateService.startAutoRefresh(refreshInterval)
    }
    
    // Notify parent
    onRateUnlock?.()
    
    setShowUnlockReasonDialog(false)
    setUnlockReason('')
  }, [lockedRate, exchangeRate, currentUser, terminalId, orderId, transactionId, autoRefresh, refreshInterval, onRateUnlock, addAuditEntry])

  const handleRefreshRate = useCallback(async () => {
    if (isLocked) {
      setError('Cannot refresh rate while locked. Unlock first.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      let newRate: ExchangeRate
      
      switch (rateSource) {
        case 'parallel':
          newRate = await rateService.getParallelMarketRate()
          break
        case 'interbank':
          newRate = await rateService.getInterbankRate()
          break
        default:
          newRate = await rateService.fetchLiveRate()
      }
      
      setExchangeRate(newRate)
      setManualRate(newRate.rate.toString())
    } catch (err) {
      setError('Failed to refresh exchange rate')
    } finally {
      setIsLoading(false)
    }
  }, [isLocked, rateSource])

  const handleSourceChange = useCallback((source: RateSource) => {
    setRateSource(source)
    handleRefreshRate()
  }, [handleRefreshRate])

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const currentRate = useMemo(() => {
    if (isLocked && lockedRate) {
      return {
        ...exchangeRate,
        rate: lockedRate,
        status: 'locked' as RateStatus,
        lockedAt,
        lockedBy
      }
    }
    return exchangeRate
  }, [exchangeRate, isLocked, lockedRate, lockedAt, lockedBy])

  const rateVariance = useMemo(() => {
    if (!currentRate?.previousRate || !currentRate.rate) return null
    return ((currentRate.rate - currentRate.previousRate) / currentRate.previousRate * 100).toFixed(2)
  }, [currentRate])

  const isRateStale = useMemo(() => {
    if (!currentRate?.validUntil) return false
    return new Date() > currentRate.validUntil
  }, [currentRate])

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const formatCurrency = (amount: number, currency: Currency): string => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return `ZWL ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const formatDate = (date: Date, includeSeconds: boolean = true): string => {
    return date.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds && { second: '2-digit' })
    })
  }

  const getSourceLabel = (source: RateSource): string => {
    const labels: Record<RateSource, string> = {
      reserve_bank: 'Reserve Bank of Zimbabwe',
      manual: 'Manual Entry',
      clinic_rate: 'Clinic Rate',
      interbank: 'Interbank Rate',
      parallel: 'Parallel Market Rate'
    }
    return labels[source] || source
  }

  const getStatusBadge = (status: RateStatus) => {
    switch (status) {
      case 'live':
        return <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">Live</span>
      case 'locked':
        return <span className="px-2 py-0.5 bg-currency-locked/20 text-currency-locked rounded-full text-xs font-medium flex items-center gap-1">
          <span>🔒</span> Locked
        </span>
      case 'stale':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Stale</span>
      case 'offline':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Offline</span>
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`vp-card ${className}`}>
      {/* Header */}
      <div className="vp-card-header">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span>Exchange Rate & Currency</span>
            {currentRate && getStatusBadge(currentRate.status)}
          </div>
          
          {/* Currency Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${selectedCurrency === 'USD'
                  ? 'bg-currency-usd text-white shadow'
                  : 'text-gray-600 hover:bg-gray-200'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={isLocked}
              aria-label="Select USD as transaction currency"
              aria-pressed={selectedCurrency === 'USD'}
            >
              <span className="flex items-center gap-1">
                <span>$</span>
                <span>USD</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange('ZWL')}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${selectedCurrency === 'ZWL'
                  ? 'bg-currency-zwl text-white shadow'
                  : 'text-gray-600 hover:bg-gray-200'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={isLocked}
              aria-label="Select ZWL as transaction currency"
              aria-pressed={selectedCurrency === 'ZWL'}
            >
              <span className="flex items-center gap-1">
                <span>ZW$</span>
                <span>ZWL</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="vp-card-body">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <span className="text-red-500">⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Rate Display */}
        <div className={`
          relative p-6 rounded-lg border-2 transition-all
          ${isLocked 
            ? 'border-currency-locked bg-currency-locked/5' 
            : isRateStale
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-gray-200 bg-white'
          }
        `}>
          {/* Rate Value */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <span>Exchange Rate</span>
                {currentRate?.source && (
                  <span className="text-xs text-gray-400">
                    ({getSourceLabel(currentRate.source)})
                  </span>
                )}
              </div>
              
              <div className="flex items-baseline gap-3">
                <span className="text-3xl lg:text-4xl font-bold text-vp-primary">
                  1 {baseCurrency} = {currentRate?.rate.toLocaleString() || '---'} {selectedCurrency}
                </span>
                
                {currentRate?.variance !== undefined && currentRate.variance !== 0 && !isLocked && (
                  <span className={`
                    text-sm font-medium px-2 py-1 rounded
                    ${currentRate.variance > 0 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                    }
                  `}>
                    {currentRate.variance > 0 ? '▲' : '▼'} {Math.abs(currentRate.variance)}%
                  </span>
                )}
              </div>
              
              {/* Rate Metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {currentRate?.timestamp && (
                  <span className="flex items-center gap-1">
                    <span>🕐</span>
                    Updated: {formatDate(currentRate.timestamp)}
                  </span>
                )}
                
                {currentRate?.validUntil && !isLocked && (
                  <span className="flex items-center gap-1">
                    <span>⏳</span>
                    Valid until: {formatDate(currentRate.validUntil, false)}
                  </span>
                )}
                
                {isLocked && lockedAt && lockedBy && (
                  <>
                    <span className="flex items-center gap-1">
                      <span>🔒</span>
                      Locked: {formatDate(lockedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>👤</span>
                      By: {lockedBy}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!isLocked ? (
                <>
                  {/* Source Selector */}
                  <div className="relative">
                    <select
                      value={rateSource}
                      onChange={(e) => handleSourceChange(e.target.value as RateSource)}
                      className="vp-form-control text-sm pr-8"
                      disabled={isLoading}
                      aria-label="Exchange rate source"
                    >
                      <option value="reserve_bank">Reserve Bank</option>
                      <option value="interbank">Interbank</option>
                      <option value="parallel">Parallel Market</option>
                      <option value="clinic_rate">Clinic Rate</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshRate}
                    className="vp-btn vp-btn-outline flex items-center gap-2"
                    disabled={isLoading}
                  >
                    <span className={isLoading ? 'animate-spin' : ''}>
                      {isLoading ? '⟳' : '🔄'}
                    </span>
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    className="vp-btn vp-btn-outline"
                  >
                    Manual Entry
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLockRate()}
                    className="vp-btn vp-btn-primary flex items-center gap-2"
                    disabled={isLoading || !currentRate}
                  >
                    <span>🔒</span>
                    Lock Rate
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleUnlockRate}
                  className="vp-btn vp-btn-outline text-currency-locked border-currency-locked hover:bg-currency-locked/10 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <span>🔓</span>
                  Unlock Rate
                </button>
              )}
            </div>
          </div>

          {/* Manual Entry Panel */}
          {showManualEntry && !isLocked && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1">
                  <label htmlFor="manual-rate" className="vp-form-label">
                    Manual Exchange Rate
                  </label>
                  <div className="relative">
                    <input
                      id="manual-rate"
                      type="number"
                      value={manualRate}
                      onChange={(e) => setManualRate(e.target.value)}
                      className="vp-form-control pl-16"
                      placeholder="Enter rate"
                      min="100"
                      max="10000"
                      step="0.01"
                      autoFocus
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                      1 USD =
                    </div>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <span className="currency-badge currency-zwl px-2 py-0.5 text-xs">
                        ZWL
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the rate in ZWL per 1 USD (e.g., 1250.00)
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rate = parseFloat(manualRate)
                      if (!isNaN(rate)) {
                        handleLockRate(rate, 'manual')
                      }
                    }}
                    className="vp-btn vp-btn-primary whitespace-nowrap"
                    disabled={isLoading || !manualRate}
                  >
                    Lock Manual Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualEntry(false)
                      setManualRate(currentRate?.rate.toString() || '1250')
                    }}
                    className="vp-btn vp-btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              {/* Rate Validation Warning */}
              {manualRate && currentRate && (
                (() => {
                  const rate = parseFloat(manualRate)
                  if (!isNaN(rate)) {
                    const variance = Math.abs((rate - currentRate.rate) / currentRate.rate * 100)
                    if (variance > 5) {
                      return (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <div className="text-yellow-800">
                              <span className="font-medium">Rate variance: {variance.toFixed(1)}%</span>
                              <p className="text-xs mt-1">
                                This rate is significantly different from the current market rate.
                                Please verify before locking.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  }
                  return null
                })()
              )}
            </div>
          )}
        </div>

        {/* Tabs for Additional Information */}
        {(showAuditTrail || showHistoricalRates) && (
          <div className="mt-6">
            <div className="border-b border-gray-200">
              <nav className="flex gap-4" aria-label="Rate information tabs">
                <button
                  onClick={() => setActiveTab('current')}
                  className={`
                    px-1 py-2 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === 'current'
                      ? 'border-vp-primary text-vp-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  Current Rate
                </button>
                {showHistoricalRates && (
                  <button
                    onClick={() => setActiveTab('historical')}
                    className={`
                      px-1 py-2 text-sm font-medium border-b-2 transition-colors
                      ${activeTab === 'historical'
                        ? 'border-vp-primary text-vp-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                      }
                    `}
                  >
                    Historical
                  </button>
                )}
                {showAuditTrail && (
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`
                      px-1 py-2 text-sm font-medium border-b-2 transition-colors
                      ${activeTab === 'audit'
                        ? 'border-vp-primary text-vp-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                      }
                    `}
                  >
                    Audit Trail
                  </button>
                )}
              </nav>
            </div>

            <div className="mt-4">
              {/* Current Rate Tab */}
              {activeTab === 'current' && currentRate && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Rate Status</div>
                      <div className="font-medium mt-1 flex items-center gap-2">
                        {getStatusBadge(currentRate.status)}
                        {isRateStale && !isLocked && (
                          <span className="text-xs text-yellow-600">
                            Rate is stale. Please refresh.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Previous Rate</div>
                      <div className="font-medium mt-1">
                        {currentRate.previousRate 
                          ? `1 USD = ${currentRate.previousRate.toLocaleString()} ZWL`
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Source</div>
                      <div className="font-medium mt-1">{getSourceLabel(currentRate.source)}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Validity</div>
                      <div className="font-medium mt-1">
                        {currentRate.validUntil
                          ? formatDate(currentRate.validUntil, false)
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Rates Tab */}
              {activeTab === 'historical' && showHistoricalRates && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Historical rate data would appear here
                  </p>
                  <p className="text-xs">
                    In production, this would show the last 30 days of exchange rates
                  </p>
                </div>
              )}

              {/* Audit Trail Tab */}
              {activeTab === 'audit' && showAuditTrail && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {auditTrail.length > 0 ? (
                    auditTrail.slice(0, 10).map(entry => (
                      <div key={entry.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <span className="capitalize">{entry.action.replace('_', ' ')}</span>
                              <span className="text-xs text-gray-500">
                                by {entry.performedBy}
                              </span>
                            </div>
                            <div className="mt-1 text-xs">
                              <span className="text-gray-600">Rate:</span>{' '}
                              <span className="font-mono">
                                {entry.previousRate.toLocaleString()} → {entry.newRate.toLocaleString()} ZWL
                              </span>
                            </div>
                            {entry.reason && (
                              <div className="mt-1 text-xs text-gray-600">
                                Reason: {entry.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(entry.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-3">📋</div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        No audit entries yet
                      </p>
                      <p className="text-xs">
                        Rate locks and unlocks will appear here
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conversion Preview */}
        {!isLocked && currentRate && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
              <span>💰</span>
              <span>Conversion Preview</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500">$10 USD</div>
                <div className="font-medium text-currency-zwl mt-1">
                  {(10 * currentRate.rate).toLocaleString()} ZWL
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500">$50 USD</div>
                <div className="font-medium text-currency-zwl mt-1">
                  {(50 * currentRate.rate).toLocaleString()} ZWL
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500">10,000 ZWL</div>
                <div className="font-medium text-currency-usd mt-1">
                  ${(10000 / currentRate.rate).toFixed(2)} USD
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500">50,000 ZWL</div>
                <div className="font-medium text-currency-usd mt-1">
                  ${(50000 / currentRate.rate).toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lock Reason Dialog */}
      {showLockReasonDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-reason-title"
        >
          <div className="vp-card max-w-md w-full">
            <div className="vp-card-header">
              <h2 id="lock-reason-title" className="text-lg font-semibold">
                Lock Exchange Rate
              </h2>
            </div>
            
            <div className="vp-card-body">
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for locking the rate at {manualRate} ZWL/USD.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="lock-reason" className="vp-form-label">
                    Reason <span className="text-status-error">*</span>
                  </label>
                  <select
                    id="lock-reason"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="vp-form-control"
                    required
                  >
                    <option value="">Select a reason...</option>
                    <option value="Manual rate override">Manual rate override</option>
                    <option value="Clinic special rate">Clinic special rate</option>
                    <option value="Corporate rate">Corporate rate</option>
                    <option value="Promotional rate">Promotional rate</option>
                    <option value="System error correction">System error correction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                {lockReason === 'Other' && (
                  <div>
                    <label htmlFor="lock-reason-other" className="vp-form-label">
                      Specify reason
                    </label>
                    <input
                      id="lock-reason-other"
                      type="text"
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      className="vp-form-control"
                      placeholder="Enter reason"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="vp-card-footer flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLockReasonDialog(false)
                  setLockReason('')
                }}
                className="vp-btn vp-btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleLockRate(parseFloat(manualRate), 'manual')}
                className="vp-btn vp-btn-primary"
                disabled={!lockReason}
              >
                Lock Rate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Reason Dialog */}
      {showUnlockReasonDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlock-reason-title"
        >
          <div className="vp-card max-w-md w-full">
            <div className="vp-card-header bg-status-warning">
              <h2 id="unlock-reason-title" className="text-lg font-semibold">
                Unlock Exchange Rate
              </h2>
            </div>
            
            <div className="vp-card-body">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to unlock the rate? This action is audited and may affect pending transactions.
              </p>
              
              <div>
                <label htmlFor="unlock-reason" className="vp-form-label">
                  Reason <span className="text-status-error">*</span>
                </label>
                <input
                  id="unlock-reason"
                  type="text"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="vp-form-control"
                  placeholder="e.g., Transaction cancelled, Rate correction"
                  required
                />
              </div>
            </div>
            
            <div className="vp-card-footer flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUnlockReasonDialog(false)}
                className="vp-btn vp-btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performUnlock(unlockReason)}
                className="vp-btn vp-btn-warning"
                disabled={!unlockReason}
              >
                Unlock Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}