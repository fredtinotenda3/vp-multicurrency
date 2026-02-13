// components/QuickNavigation.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { OfflineManager } from '@/lib/offline/OfflineManager'

// ============================================================================
// TYPES - Production Grade, Role-Based Access Control
// ============================================================================

type UserRole = 'reception' | 'optometrist' | 'admin' | 'manager' | 'cashier'
type ClinicModule = 'orders' | 'payments' | 'medical_aid' | 'receipts' | 'reports' | 'dispensing' | 'inventory' | 'admin'
type PermissionLevel = 'view' | 'create' | 'edit' | 'delete' | 'approve'

interface QuickAction {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly href: string
  readonly module: ClinicModule
  readonly permissions: PermissionLevel[]
  readonly roles: UserRole[]
  readonly shortcut?: string
  readonly shortcutKey?: string
  readonly color: string
  readonly borderColor: string
  readonly bgColor: string
  readonly hoverColor: string
  readonly requiresOnline: boolean
  readonly requiresRateLocked?: boolean
  readonly badge?: string
  readonly badgeColor?: string
  readonly order: number
  readonly isActive: boolean
}

interface QuickNavigationProps {
  userRole?: UserRole
  className?: string
  compact?: boolean
  showShortcuts?: boolean
  maxActions?: number
  onActionClick?: (action: QuickAction) => void
}

// ============================================================================
// ZIMBABWE CLINIC QUICK ACTIONS - Role Based, Production Ready
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  // ==========================================================================
  // RECEPTION & CASHIER ACTIONS
  // ==========================================================================
  {
    id: 'new_order',
    title: 'New Order',
    description: 'Create multi-currency order',
    icon: '➕',
    href: '/order/create',
    module: 'orders',
    permissions: ['create'],
    roles: ['reception', 'cashier', 'manager', 'admin'],
    shortcut: 'F2',
    shortcutKey: 'F2',
    color: 'text-currency-usd',
    borderColor: 'border-currency-usd',
    bgColor: 'bg-currency-usd/5',
    hoverColor: 'hover:bg-currency-usd/10',
    requiresOnline: false, // Works offline
    order: 1,
    isActive: true
  },
  {
    id: 'process_payment',
    title: 'Process Payment',
    description: 'Cash, card, mobile money',
    icon: '💰',
    href: '/payment',
    module: 'payments',
    permissions: ['create'],
    roles: ['reception', 'cashier', 'manager', 'admin'],
    shortcut: 'F3',
    shortcutKey: 'F3',
    color: 'text-currency-zwl',
    borderColor: 'border-currency-zwl',
    bgColor: 'bg-currency-zwl/5',
    hoverColor: 'hover:bg-currency-zwl/10',
    requiresOnline: false, // Works offline
    requiresRateLocked: true,
    order: 2,
    isActive: true
  },
  {
    id: 'medical_aid',
    title: 'Medical Aid',
    description: 'Process claims & awards',
    icon: '🏥',
    href: '/medical-aid',
    module: 'medical_aid',
    permissions: ['view', 'create', 'edit'],
    roles: ['reception', 'manager', 'admin'],
    shortcut: 'F4',
    shortcutKey: 'F4',
    color: 'text-medical-awarded',
    borderColor: 'border-medical-awarded',
    bgColor: 'bg-medical-awarded/5',
    hoverColor: 'hover:bg-medical-awarded/10',
    requiresOnline: false, // Works offline
    badge: 'Claims',
    badgeColor: 'bg-medical-awarded/20 text-medical-awarded',
    order: 3,
    isActive: true
  },
  {
    id: 'view_receipts',
    title: 'Receipts',
    description: 'View & print ZIMRA receipts',
    icon: '🧾',
    href: '/receipt',
    module: 'receipts',
    permissions: ['view'],
    roles: ['reception', 'cashier', 'manager', 'admin'],
    shortcut: 'F5',
    shortcutKey: 'F5',
    color: 'text-currency-locked',
    borderColor: 'border-currency-locked',
    bgColor: 'bg-currency-locked/5',
    hoverColor: 'hover:bg-currency-locked/10',
    requiresOnline: false, // Works offline
    order: 4,
    isActive: true
  },

  // ==========================================================================
  // OPTOMETRIST & CLINICAL ACTIONS
  // ==========================================================================
  {
    id: 'dispensing',
    title: 'Dispensing',
    description: 'Fulfill prescriptions',
    icon: '👓',
    href: '/dispensing',
    module: 'dispensing',
    permissions: ['create', 'edit'],
    roles: ['optometrist', 'manager', 'admin'],
    color: 'text-vp-secondary',
    borderColor: 'border-vp-secondary',
    bgColor: 'bg-vp-secondary/5',
    hoverColor: 'hover:bg-vp-secondary/10',
    requiresOnline: true,
    order: 10,
    isActive: true
  },
  {
    id: 'inventory_check',
    title: 'Inventory',
    description: 'Check stock levels',
    icon: '📦',
    href: '/inventory',
    module: 'inventory',
    permissions: ['view'],
    roles: ['optometrist', 'manager', 'admin'],
    color: 'text-vp-accent',
    borderColor: 'border-vp-accent',
    bgColor: 'bg-vp-accent/5',
    hoverColor: 'hover:bg-vp-accent/10',
    requiresOnline: true,
    order: 11,
    isActive: true
  },

  // ==========================================================================
  // MANAGER & ADMIN ACTIONS
  // ==========================================================================
  {
    id: 'daily_report',
    title: 'Daily Report',
    description: 'View multi-currency reports',
    icon: '📊',
    href: '/reports/daily',
    module: 'reports',
    permissions: ['view'],
    roles: ['manager', 'admin'],
    shortcut: 'F6',
    shortcutKey: 'F6',
    color: 'text-status-cleared',
    borderColor: 'border-status-cleared',
    bgColor: 'bg-status-cleared/5',
    hoverColor: 'hover:bg-status-cleared/10',
    requiresOnline: true,
    badge: 'Today',
    badgeColor: 'bg-status-cleared/20 text-status-cleared',
    order: 20,
    isActive: true
  },
  {
    id: 'exchange_rates',
    title: 'Exchange Rates',
    description: 'Update RBZ/Clinic rates',
    icon: '💱',
    href: '/settings/rates',
    module: 'admin',
    permissions: ['edit'],
    roles: ['manager', 'admin'],
    color: 'text-currency-locked',
    borderColor: 'border-currency-locked',
    bgColor: 'bg-currency-locked/5',
    hoverColor: 'hover:bg-currency-locked/10',
    requiresOnline: true,
    badge: 'RBZ',
    badgeColor: 'bg-currency-locked/20 text-currency-locked',
    order: 21,
    isActive: true
  },
  {
    id: 'user_management',
    title: 'Users',
    description: 'Manage staff access',
    icon: '👥',
    href: '/admin/users',
    module: 'admin',
    permissions: ['create', 'edit', 'delete'],
    roles: ['admin'],
    color: 'text-status-info',
    borderColor: 'border-status-info',
    bgColor: 'bg-status-info/5',
    hoverColor: 'hover:bg-status-info/10',
    requiresOnline: true,
    order: 22,
    isActive: true
  },
  {
    id: 'audit_log',
    title: 'Audit Log',
    description: 'View transaction history',
    icon: '📋',
    href: '/admin/audit',
    module: 'admin',
    permissions: ['view'],
    roles: ['manager', 'admin'],
    color: 'text-status-partial',
    borderColor: 'border-status-partial',
    bgColor: 'bg-status-partial/5',
    hoverColor: 'hover:bg-status-partial/10',
    requiresOnline: true,
    order: 23,
    isActive: true
  },

  // ==========================================================================
  // ZIMBABWE SPECIFIC ACTIONS
  // ==========================================================================
  {
    id: 'zimra_reports',
    title: 'ZIMRA Reports',
    description: 'VAT & tax submissions',
    icon: '📄',
    href: '/reports/zimra',
    module: 'reports',
    permissions: ['view'],
    roles: ['manager', 'admin'],
    color: 'text-status-error',
    borderColor: 'border-status-error',
    bgColor: 'bg-status-error/5',
    hoverColor: 'hover:bg-status-error/10',
    requiresOnline: true,
    badge: 'VAT',
    badgeColor: 'bg-status-error/20 text-status-error',
    order: 30,
    isActive: true
  },
  {
    id: 'offline_queue',
    title: 'Offline Queue',
    description: 'Pending sync items',
    icon: '📶',
    href: '/system/offline',
    module: 'admin',
    permissions: ['view'],
    roles: ['manager', 'admin'],
    color: 'text-status-warning',
    borderColor: 'border-status-warning',
    bgColor: 'bg-status-warning/5',
    hoverColor: 'hover:bg-status-warning/10',
    requiresOnline: false,
    badge: 'Sync',
    badgeColor: 'bg-status-warning/20 text-status-warning',
    order: 31,
    isActive: true
  }
]

// ============================================================================
// ROLE PERMISSION UTILITIES
// ============================================================================

const getActionsByRole = (role: UserRole, isOnline: boolean): QuickAction[] => {
  return QUICK_ACTIONS
    .filter(action => 
      action.roles.includes(role) && 
      action.isActive &&
      (!action.requiresOnline || isOnline)
    )
    .sort((a, b) => a.order - b.order)
}

// ============================================================================
// QUICK ACTION CARD COMPONENT
// ============================================================================

interface QuickActionCardProps {
  action: QuickAction
  onClick: (action: QuickAction) => void
  compact?: boolean
  disabled?: boolean
  showShortcut?: boolean
}

const QuickActionCard = ({ 
  action, 
  onClick, 
  compact = false, 
  disabled = false,
  showShortcut = true 
}: QuickActionCardProps) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      key={action.id}
      onClick={() => onClick(action)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-200 text-left
        ${action.borderColor}
        ${action.bgColor}
        ${action.hoverColor}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}
        ${compact ? 'p-3' : 'p-4'}
        focus:outline-none focus:ring-2 focus:ring-vp-secondary focus:ring-offset-2
      `}
      aria-label={`${action.title} - ${action.description}`}
      aria-describedby={action.shortcut ? `shortcut-${action.id}` : undefined}
    >
      {/* Badge */}
      {action.badge && (
        <span className={`
          absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium
          ${action.badgeColor}
        `}>
          {action.badge}
        </span>
      )}

      {/* Icon and Title */}
      <div className="flex items-center gap-3 mb-2">
        <span className={`
          text-2xl transition-transform duration-200
          ${isHovered ? 'scale-110' : ''}
          ${action.color}
        `}>
          {action.icon}
        </span>
        <span className={`
          font-bold text-vp-primary
          ${compact ? 'text-sm' : 'text-base'}
        `}>
          {action.title}
        </span>
      </div>

      {/* Description */}
      <p className={`
        text-gray-600
        ${compact ? 'text-xs' : 'text-sm'}
      `}>
        {action.description}
      </p>

      {/* Keyboard Shortcut */}
      {showShortcut && action.shortcut && (
        <div 
          id={`shortcut-${action.id}`}
          className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-mono"
        >
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">
            {action.shortcut}
          </kbd>
        </div>
      )}
    </button>
  )
}

// ============================================================================
// MAIN QUICK NAVIGATION COMPONENT
// ============================================================================

export default function QuickNavigation({
  userRole = 'reception',
  className = '',
  compact = false,
  showShortcuts = true,
  maxActions = 8,
  onActionClick
}: QuickNavigationProps) {
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [rateLocked, setRateLocked] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const offlineManager = OfflineManager.getInstance()

  // Get online status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Get offline queue status
  useEffect(() => {
    const updatePendingCount = () => {
      const state = offlineManager.getState()
      setPendingCount(state.pendingCount)
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000)

    window.addEventListener('visionplus:offline-state', updatePendingCount)

    return () => {
      clearInterval(interval)
      window.removeEventListener('visionplus:offline-state', updatePendingCount)
    }
  }, [])

  // Get current path
  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  // Check if rate is locked (for payment actions)
  useEffect(() => {
    const checkRateLocked = () => {
      const hasLockedRate = sessionStorage.getItem('current_order') !== null
      setRateLocked(hasLockedRate)
    }

    checkRateLocked()
    window.addEventListener('visionplus:rate-locked', checkRateLocked)
    window.addEventListener('visionplus:rate-unlocked', checkRateLocked)

    return () => {
      window.removeEventListener('visionplus:rate-locked', checkRateLocked)
      window.removeEventListener('visionplus:rate-unlocked', checkRateLocked)
    }
  }, [])

  // Get actions based on role and online status
  const availableActions = useMemo(() => {
    return getActionsByRole(userRole, isOnline)
      .filter(action => {
        // Don't show current page
        if (action.href === currentPath) return false
        
        // Check rate lock requirement
        if (action.requiresRateLocked && !rateLocked) return false
        
        return true
      })
      .slice(0, maxActions)
  }, [userRole, isOnline, currentPath, rateLocked, maxActions])

  // Update offline queue badge
  const actionsWithBadges = useMemo(() => {
    return availableActions.map(action => {
      if (action.id === 'offline_queue' && pendingCount > 0) {
        return {
          ...action,
          badge: `${pendingCount} pending`
        }
      }
      return action
    })
  }, [availableActions, pendingCount])

  // Handle action click
  const handleActionClick = useCallback((action: QuickAction) => {
    // Call callback if provided
    if (onActionClick) {
      onActionClick(action)
    }

    // Check if action requires rate lock
    if (action.requiresRateLocked && !rateLocked) {
      alert('Please create an order and lock the exchange rate first')
      return
    }

    // Navigate
    router.push(action.href)
  }, [router, rateLocked, onActionClick])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return
      }

      const action = QUICK_ACTIONS.find(a => a.shortcutKey === e.key)
      if (action && action.roles.includes(userRole)) {
        e.preventDefault()
        handleActionClick(action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [userRole, handleActionClick])

  // If no actions available, don't render
  if (actionsWithBadges.length === 0) {
    return null
  }

  return (
    <div className={`vp-card mb-6 ${className}`}>
      {/* Header */}
      <div className="vp-card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold">Quick Actions</span>
            {!isOnline && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                Offline Mode
              </span>
            )}
          </div>
          
          {/* Role Badge */}
          <span className="text-xs bg-white/20 px-2 py-1 rounded capitalize">
            {userRole}
          </span>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="vp-card-body">
        <div className={`
          grid gap-4
          ${compact 
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' 
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }
        `}>
          {actionsWithBadges.map(action => (
            <QuickActionCard
              key={action.id}
              action={action}
              onClick={handleActionClick}
              compact={compact}
              disabled={!isOnline && action.requiresOnline}
              showShortcut={showShortcuts}
            />
          ))}
        </div>

        {/* View All Link */}
        {availableActions.length >= maxActions && (
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/menu')}
              className="text-sm text-vp-secondary hover:text-vp-primary transition-colors"
            >
              View all actions →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// QUICK NAVIGATION PROVIDER - For child components
// ============================================================================

interface QuickNavigationProviderProps {
  children: React.ReactNode
  userRole?: UserRole
}

export function QuickNavigationProvider({
  children,
  userRole = 'reception'
}: QuickNavigationProviderProps) {
  return (
    <>
      <QuickNavigation userRole={userRole} />
      {children}
    </>
  )
}

// ============================================================================
// USE QUICK ACTIONS HOOK
// ============================================================================

export function useQuickActions(role?: UserRole) {
  const [isOnline, setIsOnline] = useState(true)
  const [currentPath, setCurrentPath] = useState('')
  const [rateLocked, setRateLocked] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setCurrentPath(window.location.pathname)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getActions = useCallback((userRole: UserRole = 'reception') => {
    return getActionsByRole(userRole, isOnline)
      .filter(action => action.href !== currentPath)
  }, [isOnline, currentPath])

  const executeAction = useCallback((action: QuickAction) => {
    if (action.requiresRateLocked && !rateLocked) {
      alert('Please create an order and lock the exchange rate first')
      return false
    }
    
    router.push(action.href)
    return true
  }, [router, rateLocked])

  return {
    getActions,
    executeAction,
    isOnline,
    currentPath
  }
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export { 
  QUICK_ACTIONS,
  getActionsByRole,
  QuickActionCard
}

export type { 
  QuickAction,
  UserRole,
  ClinicModule,
  PermissionLevel 
}