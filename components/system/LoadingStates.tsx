// components/system/LoadingStates.tsx
'use client'

import React, { useCallback, useContext } from 'react'
import { ReactNode, useEffect, useState } from 'react'

// ============================================================================
// TYPES - Production Grade, Medical Aid Optimized
// ============================================================================

type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type LoadingVariant = 'spinner' | 'pulse' | 'skeleton' | 'progress' | 'dots'
type LoadingTheme = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'

interface LoadingStateProps {
  isLoading: boolean
  children?: ReactNode
  fallback?: ReactNode
  delay?: number
  minimumLoadingTime?: number
}

interface LoadingSpinnerProps {
  size?: LoadingSize
  variant?: LoadingVariant
  theme?: LoadingTheme
  label?: string
  className?: string
}

interface SkeletonLoaderProps {
  type?: 'card' | 'table' | 'form' | 'text' | 'medical-card' | 'timeline' | 'progress' | 'currency' | 'receipt'
  count?: number
  className?: string
  animated?: boolean
}

interface ProgressLoaderProps {
  progress: number
  total?: number
  label?: string
  showPercentage?: boolean
  showCount?: boolean
  theme?: LoadingTheme
  size?: LoadingSize
  className?: string
}

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  subMessage?: string
  theme?: LoadingTheme
  backdrop?: boolean
  fullScreen?: boolean
  timeout?: number
  onTimeout?: () => void
}

// ============================================================================
// MEDICAL AID SKELETON LOADERS - Zimbabwe Clinic Specific
// ============================================================================

const MedicalCardSkeleton = ({ animated = true }: { animated?: boolean }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-4 ${animated ? 'animate-pulse' : ''}`}>
    {/* Header */}
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
        <div>
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      <div className="h-6 bg-gray-200 rounded-full w-20"></div>
    </div>

    {/* Progress Bar */}
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <div className="h-3 bg-gray-200 rounded w-16"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full w-full"></div>
    </div>

    {/* Amount Grid */}
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-50 p-3 rounded-lg">
          <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-20 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-14"></div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div className="flex gap-2">
      <div className="h-8 bg-gray-200 rounded w-24"></div>
      <div className="h-8 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
)

const TimelineSkeleton = ({ animated = true }: { animated?: boolean }) => (
  <div className={`space-y-4 ${animated ? 'animate-pulse' : ''}`}>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1">
          <div className="flex justify-between mb-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    ))}
  </div>
)

const ProgressStatusSkeleton = ({ animated = true }: { animated?: boolean }) => (
  <div className={`bg-gray-50 rounded-lg p-4 ${animated ? 'animate-pulse' : ''}`}>
    {/* Status Steps */}
    <div className="flex justify-between mb-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-full mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
          <div className="h-2 bg-gray-200 rounded w-12 mt-1"></div>
        </div>
      ))}
    </div>

    {/* Current Status */}
    <div className="border-t pt-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-20"></div>
      </div>
    </div>
  </div>
)

const CurrencySkeleton = ({ animated = true }: { animated?: boolean }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-4 ${animated ? 'animate-pulse' : ''}`}>
    {/* Header */}
    <div className="flex justify-between items-center mb-4">
      <div className="h-5 bg-gray-200 rounded w-32"></div>
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-16"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
    </div>

    {/* Rate Display */}
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
      <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-36"></div>
    </div>

    {/* Conversion Preview */}
    <div className="grid grid-cols-4 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-50 p-2 rounded">
          <div className="h-2 bg-gray-200 rounded w-12 mb-1"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  </div>
)

const ReceiptSkeleton = ({ animated = true }: { animated?: boolean }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-6 ${animated ? 'animate-pulse' : ''}`}>
    {/* Header */}
    <div className="text-center mb-6">
      <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
    </div>

    {/* Business Info */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
      ))}
    </div>

    {/* Items Table */}
    <div className="mb-6">
      <div className="h-5 bg-gray-200 rounded w-32 mb-3"></div>
      <div className="space-y-2">
        <div className="h-10 bg-gray-200 rounded w-full"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded w-full"></div>
        ))}
      </div>
    </div>

    {/* Totals */}
    <div className="border-t pt-4">
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-6 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>
  </div>
)

// ============================================================================
// LOADING SPINNER COMPONENTS
// ============================================================================

const SpinnerIcon = ({ size, theme }: { size: LoadingSize; theme: LoadingTheme }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const themeColors = {
    primary: 'border-vp-primary border-t-transparent',
    secondary: 'border-vp-secondary border-t-transparent',
    success: 'border-status-cleared border-t-transparent',
    warning: 'border-status-pending border-t-transparent',
    danger: 'border-status-error border-t-transparent',
    info: 'border-currency-zwl border-t-transparent'
  }

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        border-2 
        rounded-full 
        animate-spin
        ${themeColors[theme]}
      `}
      role="status"
      aria-label="Loading"
    />
  )
}

const DotsLoader = ({ size, theme }: { size: LoadingSize; theme: LoadingTheme }) => {
  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3'
  }

  const themeColors = {
    primary: 'bg-vp-primary',
    secondary: 'bg-vp-secondary',
    success: 'bg-status-cleared',
    warning: 'bg-status-pending',
    danger: 'bg-status-error',
    info: 'bg-currency-zwl'
  }

  return (
    <div className="flex items-center gap-1" role="status" aria-label="Loading">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`
            ${sizeClasses[size]}
            ${themeColors[theme]}
            rounded-full
            animate-bounce
          `}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export const LoadingSpinner = ({
  size = 'md',
  variant = 'spinner',
  theme = 'primary',
  label,
  className = ''
}: LoadingSpinnerProps) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {variant === 'spinner' && <SpinnerIcon size={size} theme={theme} />}
      {variant === 'dots' && <DotsLoader size={size} theme={theme} />}
      {variant === 'pulse' && (
        <div className={`${size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-12 h-12'} bg-${theme} rounded-full animate-pulse`} />
      )}
      {label && (
        <span className="mt-2 text-sm text-gray-600">{label}</span>
      )}
    </div>
  )
}

// ============================================================================
// SKELETON LOADER - Medical Aid Enhanced
// ============================================================================

export function SkeletonLoader({
  type = 'card',
  count = 1,
  className = '',
  animated = true
}: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'medical-card':
        return <MedicalCardSkeleton animated={animated} />
      
      case 'timeline':
        return <TimelineSkeleton animated={animated} />
      
      case 'progress':
        return <ProgressStatusSkeleton animated={animated} />
      
      case 'currency':
        return <CurrencySkeleton animated={animated} />
      
      case 'receipt':
        return <ReceiptSkeleton animated={animated} />
      
      case 'card':
        return (
          <div className={`bg-white rounded-lg border border-gray-200 p-4 ${animated ? 'animate-pulse' : ''}`}>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        )
      
      case 'table':
        return (
          <div className={`space-y-3 ${animated ? 'animate-pulse' : ''}`}>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        )
      
      case 'form':
        return (
          <div className={`space-y-4 ${animated ? 'animate-pulse' : ''}`}>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        )
      
      case 'text':
        return (
          <div className={`space-y-2 ${animated ? 'animate-pulse' : ''}`}>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className={className}>
      {[...Array(count)].map((_, index) => (
        <div key={index} className={index > 0 ? 'mt-4' : ''}>
          {renderSkeleton()}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// PROGRESS LOADER - Zimbabwe Clinic Specific
// ============================================================================

export function ProgressLoader({
  progress,
  total,
  label,
  showPercentage = true,
  showCount = false,
  theme = 'primary',
  size = 'md',
  className = ''
}: ProgressLoaderProps) {
  const percentage = total ? (progress / total) * 100 : progress
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  const sizeClasses = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4'
  }

  const themeColors = {
    primary: 'bg-vp-primary',
    secondary: 'bg-vp-secondary',
    success: 'bg-status-cleared',
    warning: 'bg-status-pending',
    danger: 'bg-status-error',
    info: 'bg-currency-zwl'
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label Row */}
      {(label || showPercentage || showCount) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-gray-700 font-medium">{label}</span>}
          <div className="flex items-center gap-3">
            {showPercentage && (
              <span className="text-gray-600">{Math.round(clampedPercentage)}%</span>
            )}
            {showCount && total && (
              <span className="text-gray-500 text-xs">
                {progress} / {total}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`
            ${themeColors[theme]} 
            transition-all duration-300 ease-out
            ${sizeClasses[size]}
          `}
          style={{ width: `${clampedPercentage}%` }}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Medical Aid Specific Context */}
      {theme === 'warning' && clampedPercentage < 100 && (
        <p className="text-xs text-status-pending flex items-center gap-1">
          <span>⏳</span>
          Awaiting medical aid settlement
        </p>
      )}
    </div>
  )
}

// ============================================================================
// LOADING OVERLAY - Production Ready
// ============================================================================

export function LoadingOverlay({
  isLoading,
  message = 'Loading...',
  subMessage,
  theme = 'primary',
  backdrop = true,
  fullScreen = false,
  timeout,
  onTimeout
}: LoadingOverlayProps) {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

  // Handle timeout
  useEffect(() => {
    if (!isLoading || !timeout) return

    const timer = setTimeout(() => {
      setShowTimeoutWarning(true)
      if (onTimeout) {
        onTimeout()
      }
    }, timeout)

    return () => clearTimeout(timer)
  }, [isLoading, timeout, onTimeout])

  if (!isLoading) return null

  const overlayContent = (
    <div className="flex flex-col items-center justify-center">
      {/* Spinner */}
      <LoadingSpinner size="lg" variant="spinner" theme={theme} />
      
      {/* Message */}
      <div className="mt-4 text-center">
        <p className="text-lg font-bold text-vp-primary mb-1">
          {message}
        </p>
        {subMessage && !showTimeoutWarning && (
          <p className="text-sm text-gray-600">{subMessage}</p>
        )}
      </div>

      {/* Timeout Warning */}
      {showTimeoutWarning && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-sm">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">This is taking longer than expected</p>
              <p className="text-xs">
                You can continue waiting or refresh the page. Your work is saved.
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs px-3 py-1.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      )}

      {/* Zimbabwe Clinic Context */}
      {!subMessage && !showTimeoutWarning && (
        <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
          <span>🏥</span>
          <span>VisionPlus - Zimbabwe Multi-Currency System</span>
        </div>
      )}
    </div>
  )

  // Full screen overlay
  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: backdrop ? 'rgba(0, 0, 0, 0.5)' : 'transparent' }}
        role="alert"
        aria-busy="true"
        aria-label={message}
      >
        <div className="vp-card max-w-md w-full mx-4">
          <div className="vp-card-body">
            {overlayContent}
          </div>
        </div>
      </div>
    )
  }

  // Inline overlay
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-lg"
      style={{ backgroundColor: backdrop ? 'rgba(255, 255, 255, 0.9)' : 'transparent' }}
      role="alert"
      aria-busy="true"
      aria-label={message}
    >
      <div className="p-6">
        {overlayContent}
      </div>
    </div>
  )
}

// ============================================================================
// LOADING BUTTON - With State Management
// ============================================================================

interface LoadingButtonProps {
  isLoading: boolean
  children: ReactNode
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'
  size?: LoadingSize
  className?: string
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

export function LoadingButton({
  isLoading,
  children,
  loadingText = 'Processing...',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  fullWidth = false
}: LoadingButtonProps) {
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  }

  const variantClasses = {
    primary: 'bg-vp-primary text-white hover:bg-vp-primary/90',
    secondary: 'bg-vp-secondary text-white hover:bg-vp-secondary/90',
    success: 'bg-status-cleared text-white hover:bg-status-cleared/90',
    warning: 'bg-status-pending text-gray-900 hover:bg-status-pending/90',
    danger: 'bg-status-error text-white hover:bg-status-error/90',
    outline: 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-md
        font-medium
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {isLoading && (
        <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <LoadingSpinner 
            size={size === 'xl' ? 'md' : size === 'lg' ? 'sm' : 'xs'} 
            variant="spinner" 
            theme={variant === 'outline' ? 'primary' : variant}
          />
        </span>
      )}
      
      <span className={isLoading ? 'opacity-0' : ''}>
        {children}
      </span>
      
      {isLoading && loadingText && (
        <span className="sr-only">{loadingText}</span>
      )}
    </button>
  )
}

// ============================================================================
// LOADING PROVIDER - Context for global loading state
// ============================================================================

interface LoadingContextType {
  isLoading: boolean
  startLoading: (key: string, message?: string) => void
  stopLoading: (key: string) => void
  setMessage: (key: string, message: string) => void
}

const LoadingContext = React.createContext<LoadingContextType | undefined>(undefined)

interface LoadingProviderProps {
  children: ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, { isLoading: boolean; message?: string }>>({})

  const isLoading = Object.values(loadingStates).some(state => state.isLoading)

  const startLoading = useCallback((key: string, message?: string) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: { isLoading: true, message }
    }))
  }, [])

  const stopLoading = useCallback((key: string) => {
    setLoadingStates(prev => {
      const newState = { ...prev }
      delete newState[key]
      return newState
    })
  }, [])

  const setMessage = useCallback((key: string, message: string) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: { ...prev[key], message }
    }))
  }, [])

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading, setMessage }}>
      {children}
      <LoadingOverlay 
        isLoading={isLoading} 
        message={Object.values(loadingStates).find(s => s.isLoading)?.message || 'Loading...'}
        fullScreen
        backdrop
        timeout={30000}
      />
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider')
  }
  return context
}

// ============================================================================
// LAZY LOADER - For route-based code splitting
// ============================================================================

interface LazyLoaderProps {
  children: ReactNode
  fallback?: ReactNode
  delay?: number
}

export function LazyLoader({ children, fallback, delay = 300 }: LazyLoaderProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  if (!isReady) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="min-h-[200px] flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading module..." />
      </div>
    )
  }

  return <>{children}</>
}

// ============================================================================
// EXPORT ALL LOADERS
// ============================================================================

export default {
  LoadingSpinner,
  SkeletonLoader,
  ProgressLoader,
  LoadingOverlay,
  LoadingButton,
  LoadingProvider,
  useLoading,
  LazyLoader
}