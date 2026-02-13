// components/system/ErrorBoundary.tsx
'use client'

import { Component, ErrorInfo, JSX, ReactNode, createElement, useEffect } from 'react'

// ============================================================================
// TYPES - Production Grade, Immutable
// ============================================================================

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
type ErrorCategory = 
  | 'network' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'not_found' 
  | 'timeout' 
  | 'rate_limit' 
  | 'server' 
  | 'client' 
  | 'unknown'

interface ErrorMetadata {
  readonly componentStack?: string
  readonly timestamp: number
  readonly url: string
  readonly userAgent: string
  readonly severity: ErrorSeverity
  readonly category: ErrorCategory
  readonly retryable: boolean
  readonly dismissible: boolean
  readonly code?: string
  readonly context?: Record<string, unknown>
  readonly source?: string
  readonly lineno?: number
  readonly colno?: number
}

interface ErrorFallbackProps {
  error: Error
  errorInfo?: ErrorInfo
  resetError: () => void
  metadata: ErrorMetadata
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo, metadata: ErrorMetadata) => void
  onReset?: () => void
  resetKeys?: unknown[]
  severity?: ErrorSeverity
  category?: ErrorCategory
  retryable?: boolean
  dismissible?: boolean
  showDetails?: boolean
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  metadata: ErrorMetadata | null
}

// ============================================================================
// ERROR CLASSIFIER - Determines error type and handling strategy
// ============================================================================

class ErrorClassifier {
  static classify(error: Error, errorInfo?: ErrorInfo): ErrorMetadata {
    const timestamp = Date.now()
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

    // Network errors
    if (error.message.includes('network') || 
        error.message.includes('fetch') || 
        error.message.includes('xhr') ||
        error.message.includes('offline') ||
        error.name === 'NetworkError' ||
        error.name === 'AbortError') {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'medium',
        category: 'network',
        retryable: true,
        dismissible: true,
        code: 'NETWORK_ERROR'
      }
    }

    // Timeout errors
    if (error.message.includes('timeout') || 
        error.name === 'TimeoutError') {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'medium',
        category: 'timeout',
        retryable: true,
        dismissible: true,
        code: 'TIMEOUT_ERROR'
      }
    }

    // Rate limit errors
    if (error.message.includes('rate limit') || 
        error.message.includes('too many requests') ||
        error.message.includes('429')) {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'medium',
        category: 'rate_limit',
        retryable: false,
        dismissible: true,
        code: 'RATE_LIMIT_ERROR'
      }
    }

    // Validation errors
    if (error.message.includes('validation') || 
        error.message.includes('invalid') ||
        error.name === 'ValidationError' ||
        error.name === 'TypeError') {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'low',
        category: 'validation',
        retryable: false,
        dismissible: true,
        code: 'VALIDATION_ERROR'
      }
    }

    // Not found errors
    if (error.message.includes('not found') || 
        error.message.includes('404') ||
        error.name === 'NotFoundError') {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'low',
        category: 'not_found',
        retryable: false,
        dismissible: true,
        code: 'NOT_FOUND_ERROR'
      }
    }

    // Authentication errors
    if (error.message.includes('unauthorized') || 
        error.message.includes('unauthenticated') ||
        error.message.includes('401') ||
        error.message.includes('403')) {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'high',
        category: 'authentication',
        retryable: false,
        dismissible: false,
        code: 'AUTH_ERROR'
      }
    }

    // Server errors (5xx)
    if (error.message.includes('500') || 
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'high',
        category: 'server',
        retryable: true,
        dismissible: false,
        code: 'SERVER_ERROR'
      }
    }

    // React specific errors
    if (error.message.includes('React') || 
        error.name === 'React Error') {
      return {
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
        severity: 'critical',
        category: 'client',
        retryable: false,
        dismissible: false,
        code: 'REACT_ERROR'
      }
    }

    // Default / Unknown
    return {
      componentStack: errorInfo?.componentStack,
      timestamp,
      url,
      userAgent,
      severity: 'medium',
      category: 'unknown',
      retryable: false,
      dismissible: true,
      code: 'UNKNOWN_ERROR'
    }
  }
}

// ============================================================================
// OFFLINE ERROR LOGGER - Persists errors for later sync
// ============================================================================

class ErrorLogger {
  private static readonly STORAGE_KEY = 'visionplus_error_log'
  private static readonly MAX_LOG_ENTRIES = 100
  private static readonly SYNC_INTERVAL = 60000 // 1 minute

  static async log(
    error: Error,
    errorInfo: ErrorInfo | null,
    metadata: ErrorMetadata
  ): Promise<void> {
    const entry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: errorInfo ? {
        componentStack: errorInfo.componentStack
      } : null,
      metadata,
      timestamp: Date.now(),
      synced: false
    }

    // Store in IndexedDB if available
    try {
      await this.storeInIndexedDB(entry)
    } catch {
      // Fallback to localStorage
      this.storeInLocalStorage(entry)
    }

    // Dispatch event for offline sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('visionplus:error-logged', {
        detail: entry
      }))
    }
  }

  private static async storeInIndexedDB(entry: any): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB not available')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VisionPlusErrorDB', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['errors'], 'readwrite')
        const store = transaction.objectStore('errors')
        store.put(entry)
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('errors')) {
          const store = db.createObjectStore('errors', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('synced', 'synced', { unique: false })
        }
      }
    })
  }

  private static storeInLocalStorage(entry: any): void {
    try {
      const existing = localStorage.getItem(this.STORAGE_KEY)
      let entries = existing ? JSON.parse(existing) : []
      
      entries = [entry, ...entries].slice(0, this.MAX_LOG_ENTRIES)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries))
    } catch (error) {
      console.error('Failed to store error in localStorage:', error)
    }
  }

  static async getUnsyncedErrors(): Promise<any[]> {
    if (typeof window === 'undefined') return []

    // Try IndexedDB first
    try {
      if (window.indexedDB) {
        return new Promise((resolve) => {
          const request = indexedDB.open('VisionPlusErrorDB', 1)

          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('errors')) {
              resolve([])
              return
            }

            const transaction = db.transaction(['errors'], 'readonly')
            const store = transaction.objectStore('errors')
            const index = store.index('synced')
            const range = IDBKeyRange.only(false)
            const getRequest = index.getAll(range)

            getRequest.onsuccess = () => resolve(getRequest.result || [])
            getRequest.onerror = () => resolve([])
          }

          request.onerror = () => resolve([])
        })
      }
    } catch {
      // Fallback to localStorage
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const entries = JSON.parse(stored)
      return entries.filter((e: any) => !e.synced)
    } catch {
      return []
    }
  }

  static async markAsSynced(errorIds: string[]): Promise<void> {
    // Implementation would update synced status
    // This would be called by the offline sync service
  }
}

// ============================================================================
// DEFAULT FALLBACK COMPONENTS - Zimbabwe Clinic Themed
// ============================================================================

const NetworkErrorFallback = ({ resetError, metadata }: ErrorFallbackProps) => (
  <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
    <div className="vp-card max-w-md w-full border-l-4 border-l-currency-locked">
      <div className="vp-card-header bg-gradient-to-r from-currency-locked to-vp-primary">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">📶</span>
          <span className="font-bold">Network Connection Issue</span>
        </div>
      </div>
      
      <div className="vp-card-body">
        <div className="text-center mb-6">
          <div className="text-7xl mb-4 inline-block animate-pulse" aria-hidden="true">
            🌍
          </div>
          <h2 className="text-xl font-bold text-vp-primary mb-2">
            Unable to Connect
          </h2>
          <p className="text-gray-600 mb-2">
            Please check your internet connection and try again.
          </p>
          <p className="text-sm text-gray-500">
            Zimbabwe clinics: Offline mode is available for continued operation
          </p>
        </div>
        
        {metadata.code && (
          <div className="bg-gray-50 p-3 rounded-lg mb-4 text-center">
            <span className="text-xs font-mono text-gray-500">
              Error Code: {metadata.code}
            </span>
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={resetError}
            className="vp-btn vp-btn-primary flex-1 flex items-center justify-center gap-2"
            aria-label="Retry connection"
          >
            <span aria-hidden="true">🔄</span>
            Retry
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="vp-btn vp-btn-outline flex-1"
          >
            Dashboard
          </button>
        </div>
        
        <div className="mt-6 text-xs text-gray-400 text-center border-t pt-4">
          <p>VisionPlus works offline. Your pending changes are saved.</p>
          <p className="mt-1">📱 Ecocash | 💳 Cards | 🏥 Medical Aid - All available offline</p>
        </div>
      </div>
    </div>
  </div>
)

const TimeoutErrorFallback = ({ resetError }: ErrorFallbackProps) => (
  <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
    <div className="vp-card max-w-md">
      <div className="vp-card-header bg-status-warning">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">⏱️</span>
          <span className="font-bold">Request Timeout</span>
        </div>
      </div>
      
      <div className="vp-card-body text-center">
        <div className="text-6xl mb-4" aria-hidden="true">
          ⌛
        </div>
        <h2 className="text-xl font-bold text-vp-primary mb-2">
          Taking Longer Than Expected
        </h2>
        <p className="text-gray-600 mb-6">
          The server is taking too long to respond. This might be due to:
        </p>
        
        <ul className="text-left text-sm text-gray-600 mb-6 space-y-2 bg-gray-50 p-4 rounded-lg">
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Slow network connection in your area</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>High traffic on medical aid systems</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Temporary RBZ rate service delay</span>
          </li>
        </ul>
        
        <div className="flex gap-3">
          <button
            onClick={resetError}
            className="vp-btn vp-btn-primary flex-1"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="vp-btn vp-btn-outline flex-1"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
)

const ServerErrorFallback = ({ resetError }: ErrorFallbackProps) => (
  <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
    <div className="vp-card max-w-md border-l-4 border-l-status-error">
      <div className="vp-card-header bg-status-error text-white">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">⚠️</span>
          <span className="font-bold">Service Unavailable</span>
        </div>
      </div>
      
      <div className="vp-card-body text-center">
        <div className="text-6xl mb-4" aria-hidden="true">
          🏥
        </div>
        <h2 className="text-xl font-bold text-vp-primary mb-2">
          Medical Aid System Temporarily Unavailable
        </h2>
        <p className="text-gray-600 mb-4">
          We're experiencing issues connecting to provider systems. 
          Please try again in a few minutes.
        </p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <span className="font-bold">Offline Option:</span> You can still process cash payments 
            and create orders. Medical aid claims will sync automatically when connection is restored.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={resetError}
            className="vp-btn vp-btn-primary flex-1"
          >
            Retry
          </button>
          <button
            onClick={() => window.location.href = '/order/create'}
            className="vp-btn vp-btn-success flex-1 flex items-center justify-center gap-2"
          >
            <span aria-hidden="true">💰</span>
            Cash Payment
          </button>
        </div>
      </div>
    </div>
  </div>
)

const AuthErrorFallback = ({ resetError }: ErrorFallbackProps) => (
  <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
    <div className="vp-card max-w-md">
      <div className="vp-card-header bg-currency-locked">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🔒</span>
          <span className="font-bold">Session Expired</span>
        </div>
      </div>
      
      <div className="vp-card-body text-center">
        <div className="text-6xl mb-4" aria-hidden="true">
          👤
        </div>
        <h2 className="text-xl font-bold text-vp-primary mb-2">
          Your Session Has Expired
        </h2>
        <p className="text-gray-600 mb-6">
          For security, your session has timed out. Please log in again to continue.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/login'}
            className="vp-btn vp-btn-primary flex-1"
          >
            Log In Again
          </button>
          <button
            onClick={resetError}
            className="vp-btn vp-btn-outline flex-1"
          >
            Retry
          </button>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          <p>Your work has been saved. You won't lose any data.</p>
        </div>
      </div>
    </div>
  </div>
)

const ValidationErrorFallback = ({ resetError }: ErrorFallbackProps) => (
  <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
    <div className="vp-card max-w-md">
      <div className="vp-card-header bg-status-partial">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">📋</span>
          <span className="font-bold">Invalid Input</span>
        </div>
      </div>
      
      <div className="vp-card-body">
        <div className="flex items-start gap-4 mb-6">
          <div className="text-4xl" aria-hidden="true">
            ⚠️
          </div>
          <div>
            <h2 className="text-lg font-bold text-vp-primary mb-1">
              Please Check Your Information
            </h2>
            <p className="text-sm text-gray-600">
              The form contains invalid or missing information. 
              This has been logged for review.
            </p>
          </div>
        </div>
        
        <button
          onClick={resetError}
          className="vp-btn vp-btn-primary w-full"
        >
          Go Back and Fix
        </button>
      </div>
    </div>
  </div>
)

const CriticalErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  const [showDetails, setShowDetails] = useState(false)
  const [errorId, setErrorId] = useState<string>('')

  useEffect(() => {
    // Generate error ID for support reference
    setErrorId(`ERR-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`)
  }, [])

  return (
    <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
      <div className="vp-card max-w-2xl w-full border-l-4 border-l-status-error">
        <div className="vp-card-header bg-status-error text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🚨</span>
            <span className="font-bold">Critical System Error</span>
          </div>
        </div>
        
        <div className="vp-card-body">
          <div className="text-center mb-6">
            <div className="text-7xl mb-4" aria-hidden="true">
              ⚡
            </div>
            <h2 className="text-xl font-bold text-vp-primary mb-2">
              Something Went Wrong
            </h2>
            <p className="text-gray-600">
              We've encountered an unexpected error. Our team has been notified.
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-gray-700">Error Reference</span>
              <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">
                {errorId}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Please quote this reference number when contacting support.
            </p>
          </div>
          
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-vp-secondary hover:text-vp-primary flex items-center gap-1"
              aria-expanded={showDetails}
            >
              <span aria-hidden="true">{showDetails ? '▼' : '▶'}</span>
              {showDetails ? 'Hide' : 'Show'} technical details
            </button>
            
            {showDetails && (
              <div className="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {error.name}: {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={resetError}
              className="vp-btn vp-btn-primary flex-1"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="vp-btn vp-btn-outline flex-1"
            >
              Reload Application
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
            <p className="font-medium mb-1">Need immediate assistance?</p>
            <p>Contact VisionPlus Support: <span className="font-mono">+263 2033 725 718</span></p>
            <p className="mt-1">support@visionplus.co.zw | Available 24/7</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const DefaultFallback = ({ resetError, metadata }: ErrorFallbackProps) => {
  const category = metadata.category
  const severity = metadata.severity

  // Route to specific fallbacks based on category
  if (category === 'network') return <NetworkErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />
  if (category === 'timeout') return <TimeoutErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />
  if (category === 'server') return <ServerErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />
  if (category === 'authentication') return <AuthErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />
  if (category === 'validation') return <ValidationErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />
  if (severity === 'critical') return <CriticalErrorFallback resetError={resetError} error={new Error()} metadata={metadata} errorInfo={null} />

  // Generic fallback
  return (
    <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
      <div className="vp-card max-w-md">
        <div className="vp-card-header">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">⚠️</span>
            <span className="font-bold">System Notification</span>
          </div>
        </div>
        
        <div className="vp-card-body text-center">
          <div className="text-6xl mb-4" aria-hidden="true">
            🔧
          </div>
          <h2 className="text-xl font-bold text-vp-primary mb-2">
            Unable to Complete Action
          </h2>
          <p className="text-gray-600 mb-6">
            We're having trouble processing your request. Please try again.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={resetError}
              className="vp-btn vp-btn-primary flex-1"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="vp-btn vp-btn-outline flex-1"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN ERROR BOUNDARY COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      metadata: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Classify the error
    const metadata = ErrorClassifier.classify(error, errorInfo)
    
    // Merge with props metadata
    const finalMetadata: ErrorMetadata = {
      ...metadata,
      severity: this.props.severity || metadata.severity,
      category: this.props.category || metadata.category,
      retryable: this.props.retryable ?? metadata.retryable,
      dismissible: this.props.dismissible ?? metadata.dismissible,
      context: {
        ...metadata.context,
        componentName: this.constructor.name
      }
    }

    this.setState({
      errorInfo,
      metadata: finalMetadata
    })

    // Log the error
    ErrorLogger.log(error, errorInfo, finalMetadata).catch(console.error)

    // Call onError prop
    if (this.props.onError) {
      this.props.onError(error, errorInfo, finalMetadata)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('📋 Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Metadata:', finalMetadata)
      console.groupEnd()
    }

    // Dispatch global error event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('visionplus:error', {
        detail: {
          error,
          errorInfo,
          metadata: finalMetadata
        }
      }))
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = !this.areArraysEqual(
        prevProps.resetKeys,
        this.props.resetKeys
      )
      
      if (hasChanged) {
        this.resetError()
      }
    }
  }

  componentWillUnmount(): void {
    // Cleanup if needed
  }

  private areArraysEqual(a?: unknown[], b?: unknown[]): boolean {
    if (a === b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    
    return true
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      metadata: null
    })

    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render(): ReactNode {
    const { hasError, error, errorInfo, metadata } = this.state
    const { children, fallback, showDetails = false, className = '' } = this.props

    if (hasError && error && metadata) {
      // Use custom fallback if provided
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback({
            error,
            errorInfo: errorInfo || undefined,
            resetError: this.resetError,
            metadata
          })
        }
        return fallback
      }

      // Use default fallback based on error category
      return (
        <div className={className}>
          <DefaultFallback
            error={error}
            errorInfo={errorInfo || undefined}
            resetError={this.resetError}
            metadata={metadata}
          />
        </div>
      )
    }

    return children
  }
}

// ============================================================================
// WITH ERROR BOUNDARY HOC
// ============================================================================

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = Component.displayName || Component.name || 'Component'

  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${displayName})`

  return WrappedComponent
}

// ============================================================================
// ASYNC ERROR BOUNDARY COMPONENT
// ============================================================================

interface AsyncErrorBoundaryProps extends ErrorBoundaryProps {
  fallback?: ReactNode
}

interface AsyncErrorBoundaryState {
  error: Error | null
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): AsyncErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Same as ErrorBoundary but for async errors
    console.error('Async Error Boundary caught:', error, errorInfo)
  }

  render(): ReactNode {
    const { error } = this.state
    const { children, fallback } = this.props

    if (error) {
      if (fallback) {
        return fallback
      }
      
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl" aria-hidden="true">⚠️</span>
            <div>
              <h3 className="font-bold text-red-800 mb-1">Async Operation Failed</h3>
              <p className="text-sm text-red-600">{error.message}</p>
              <button
                onClick={() => this.setState({ error: null })}
                className="mt-3 text-xs text-red-700 hover:text-red-900 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return children
  }
}

// ============================================================================
// ERROR BOUNDARY PROVIDER - Global error handling
// ============================================================================

interface ErrorBoundaryProviderProps {
  children: ReactNode
  onGlobalError?: (error: Error, errorInfo: ErrorInfo) => void
}

export function ErrorBoundaryProvider({ 
  children, 
  onGlobalError 
}: ErrorBoundaryProviderProps): JSX.Element {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message)
      const errorInfo: ErrorInfo = {
        componentStack: event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : ''
      }

      // Log uncaught errors
      ErrorLogger.log(error, errorInfo, ErrorClassifier.classify(error, errorInfo)).catch(console.error)

      if (onGlobalError) {
        onGlobalError(error, errorInfo)
      }

      // Prevent default browser error overlay in development
      if (process.env.NODE_ENV === 'development') {
        event.preventDefault()
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))

      const errorInfo: ErrorInfo = {
        componentStack: 'Unhandled Promise Rejection'
      }

      ErrorLogger.log(error, errorInfo, ErrorClassifier.classify(error, errorInfo)).catch(console.error)

      if (onGlobalError) {
        onGlobalError(error, errorInfo)
      }

      event.preventDefault()
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [onGlobalError])

  return (
    <ErrorBoundary
      severity="critical"
      category="client"
      retryable={false}
      dismissible={false}
    >
      {children}
    </ErrorBoundary>
  )
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const errorUtils = {
  classify: ErrorClassifier.classify,
  log: ErrorLogger.log,
  getUnsyncedErrors: ErrorLogger.getUnsyncedErrors
}

// ============================================================================
// SIMPLE ERROR BOUNDARY - Lightweight version
// ============================================================================

export function SimpleErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary
      fallback={({ resetError }) => (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <span className="text-sm text-red-800">
                An error occurred in this section
              </span>
            </div>
            <button
              onClick={resetError}
              className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ErrorBoundary