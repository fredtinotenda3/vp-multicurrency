// components/system/KeyboardShortcuts.tsx
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================================
// TYPES - Production Grade, Zimbabwe Clinic Optimized
// ============================================================================

type ShortcutScope = 
  | 'global' 
  | 'order' 
  | 'payment' 
  | 'medical_aid' 
  | 'receipt' 
  | 'dashboard'
  | 'admin'

type ShortcutCategory = 
  | 'navigation' 
  | 'transaction' 
  | 'medical' 
  | 'currency' 
  | 'receipt' 
  | 'system' 
  | 'admin'

interface KeyboardShortcut {
  readonly id: string
  readonly key: string
  readonly keyCode?: number
  readonly description: string
  readonly action: () => void
  readonly ctrl?: boolean
  readonly shift?: boolean
  readonly alt?: boolean
  readonly meta?: boolean
  readonly scope: ShortcutScope
  readonly category: ShortcutCategory
  readonly enabled: boolean
  readonly hidden?: boolean
  readonly group?: string
  readonly order?: number
  readonly ariaLabel?: string
}

interface ShortcutGroup {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly shortcuts: KeyboardShortcut[]
}

interface KeyboardShortcutsProps {
  enabled?: boolean
  showHelpOnStart?: boolean
  scope?: ShortcutScope
  onShortcut?: (shortcut: KeyboardShortcut) => void
}

// ============================================================================
// ZIMBABWE CLINIC SHORTCUTS - Production Ready
// ============================================================================

const ZIMBABWE_SHORTCUTS: readonly KeyboardShortcut[] = [
  // ==========================================================================
  // NAVIGATION SHORTCUTS (F-keys) - Common in Zimbabwe clinics
  // ==========================================================================
  {
    id: 'nav_dashboard',
    key: 'F1',
    keyCode: 112,
    description: 'Dashboard',
    action: () => window.location.href = '/',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 1,
    ariaLabel: 'Go to Dashboard'
  },
  {
    id: 'nav_new_order',
    key: 'F2',
    keyCode: 113,
    description: 'New Order',
    action: () => window.location.href = '/order/create',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 2,
    ariaLabel: 'Create New Order'
  },
  {
    id: 'nav_payment',
    key: 'F3',
    keyCode: 114,
    description: 'Process Payment',
    action: () => window.location.href = '/payment',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 3,
    ariaLabel: 'Process Payment'
  },
  {
    id: 'nav_medical_aid',
    key: 'F4',
    keyCode: 115,
    description: 'Medical Aid',
    action: () => window.location.href = '/medical-aid',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 4,
    ariaLabel: 'Medical Aid Claims'
  },
  {
    id: 'nav_receipt',
    key: 'F5',
    keyCode: 116,
    description: 'Receipts',
    action: () => window.location.href = '/receipt',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 5,
    ariaLabel: 'View Receipts'
  },
  {
    id: 'nav_reports',
    key: 'F6',
    keyCode: 117,
    description: 'Reports',
    action: () => window.location.href = '/reports',
    scope: 'global',
    category: 'navigation',
    enabled: true,
    group: 'Navigation',
    order: 6,
    ariaLabel: 'View Reports'
  },

  // ==========================================================================
  // TRANSACTION SHORTCUTS (Ctrl + Key)
  // ==========================================================================
  {
    id: 'transaction_lock_rate',
    key: 'l',
    description: 'Lock Exchange Rate',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:lock-rate')),
    ctrl: true,
    scope: 'order',
    category: 'currency',
    enabled: true,
    group: 'Transaction',
    order: 10,
    ariaLabel: 'Lock Exchange Rate'
  },
  {
    id: 'transaction_add_payment',
    key: 'p',
    description: 'Add Payment',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:add-payment')),
    ctrl: true,
    scope: 'payment',
    category: 'transaction',
    enabled: true,
    group: 'Transaction',
    order: 11,
    ariaLabel: 'Add Payment'
  },
  {
    id: 'transaction_remove_payment',
    key: 'r',
    description: 'Remove Last Payment',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:remove-payment')),
    ctrl: true,
    scope: 'payment',
    category: 'transaction',
    enabled: true,
    group: 'Transaction',
    order: 12,
    ariaLabel: 'Remove Last Payment'
  },
  {
    id: 'transaction_complete',
    key: 'c',
    description: 'Complete Transaction',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:complete-transaction')),
    ctrl: true,
    scope: 'payment',
    category: 'transaction',
    enabled: true,
    group: 'Transaction',
    order: 13,
    ariaLabel: 'Complete Transaction'
  },
  {
    id: 'transaction_cancel',
    key: 'x',
    description: 'Cancel Transaction',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:cancel-transaction')),
    ctrl: true,
    shift: true,
    scope: 'payment',
    category: 'transaction',
    enabled: true,
    group: 'Transaction',
    order: 14,
    ariaLabel: 'Cancel Transaction'
  },

  // ==========================================================================
  // CURRENCY SHORTCUTS - Zimbabwe Specific
  // ==========================================================================
  {
    id: 'currency_toggle',
    key: 'u',
    description: 'Toggle USD/ZWG',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:toggle-currency')),
    ctrl: true,
    scope: 'global',
    category: 'currency',
    enabled: true,
    group: 'Currency',
    order: 20,
    ariaLabel: 'Toggle between USD and ZWG'
  },
  {
    id: 'currency_usd',
    key: 'd',
    description: 'Switch to USD',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-currency', { detail: 'USD' })),
    ctrl: true,
    shift: true,
    scope: 'global',
    category: 'currency',
    enabled: true,
    group: 'Currency',
    order: 21,
    ariaLabel: 'Switch to US Dollars'
  },
  {
    id: 'currency_ZWG',
    key: 'z',
    description: 'Switch to ZWG',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-currency', { detail: 'ZWG' })),
    ctrl: true,
    shift: true,
    scope: 'global',
    category: 'currency',
    enabled: true,
    group: 'Currency',
    order: 22,
    ariaLabel: 'Switch to Zimbabwe Dollars'
  },
  {
    id: 'currency_refresh_rate',
    key: 'r',
    description: 'Refresh RBZ Rate',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:refresh-rate')),
    ctrl: true,
    shift: true,
    scope: 'global',
    category: 'currency',
    enabled: true,
    group: 'Currency',
    order: 23,
    ariaLabel: 'Refresh Reserve Bank Rate'
  },

  // ==========================================================================
  // MEDICAL AID SHORTCUTS
  // ==========================================================================
  {
    id: 'medical_add_award',
    key: 'a',
    description: 'Add Medical Aid Award',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:add-award')),
    ctrl: true,
    scope: 'medical_aid',
    category: 'medical',
    enabled: true,
    group: 'Medical Aid',
    order: 30,
    ariaLabel: 'Add Medical Aid Award'
  },
  {
    id: 'medical_record_shortfall',
    key: 's',
    description: 'Record Shortfall',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:record-shortfall')),
    ctrl: true,
    scope: 'medical_aid',
    category: 'medical',
    enabled: true,
    group: 'Medical Aid',
    order: 31,
    ariaLabel: 'Record Shortfall Payment'
  },
  {
    id: 'medical_mark_settled',
    key: 't',
    description: 'Mark as Settled',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:mark-settled')),
    ctrl: true,
    scope: 'medical_aid',
    category: 'medical',
    enabled: true,
    group: 'Medical Aid',
    order: 32,
    ariaLabel: 'Mark Claim as Settled'
  },
  {
    id: 'medical_generate_claim',
    key: 'g',
    description: 'Generate Claim Form',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:generate-claim')),
    ctrl: true,
    scope: 'medical_aid',
    category: 'medical',
    enabled: true,
    group: 'Medical Aid',
    order: 33,
    ariaLabel: 'Generate Claim Form'
  },

  // ==========================================================================
  // RECEIPT SHORTCUTS
  // ==========================================================================
  {
    id: 'receipt_print',
    key: 'p',
    description: 'Print Receipt',
    action: () => window.print(),
    ctrl: true,
    scope: 'receipt',
    category: 'receipt',
    enabled: true,
    group: 'Receipt',
    order: 40,
    ariaLabel: 'Print Receipt'
  },
  {
    id: 'receipt_email',
    key: 'e',
    description: 'Email Receipt',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:email-receipt')),
    ctrl: true,
    scope: 'receipt',
    category: 'receipt',
    enabled: true,
    group: 'Receipt',
    order: 41,
    ariaLabel: 'Email Receipt'
  },
  {
    id: 'receipt_download',
    key: 'd',
    description: 'Download PDF',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:download-receipt')),
    ctrl: true,
    scope: 'receipt',
    category: 'receipt',
    enabled: true,
    group: 'Receipt',
    order: 42,
    ariaLabel: 'Download Receipt PDF'
  },

  // ==========================================================================
  // QUANTITY SHORTCUTS - Number Pad Quick Entry
  // ==========================================================================
  {
    id: 'quantity_1',
    key: '1',
    description: 'Set Quantity 1',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-quantity', { detail: 1 })),
    ctrl: true,
    scope: 'order',
    category: 'transaction',
    enabled: true,
    group: 'Quantity',
    order: 50,
    ariaLabel: 'Set quantity to 1'
  },
  {
    id: 'quantity_2',
    key: '2',
    description: 'Set Quantity 2',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-quantity', { detail: 2 })),
    ctrl: true,
    scope: 'order',
    category: 'transaction',
    enabled: true,
    group: 'Quantity',
    order: 51,
    ariaLabel: 'Set quantity to 2'
  },
  {
    id: 'quantity_3',
    key: '3',
    description: 'Set Quantity 3',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-quantity', { detail: 3 })),
    ctrl: true,
    scope: 'order',
    category: 'transaction',
    enabled: true,
    group: 'Quantity',
    order: 52,
    ariaLabel: 'Set quantity to 3'
  },
  {
    id: 'quantity_4',
    key: '4',
    description: 'Set Quantity 4',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-quantity', { detail: 4 })),
    ctrl: true,
    scope: 'order',
    category: 'transaction',
    enabled: true,
    group: 'Quantity',
    order: 53,
    ariaLabel: 'Set quantity to 4'
  },
  {
    id: 'quantity_5',
    key: '5',
    description: 'Set Quantity 5',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:set-quantity', { detail: 5 })),
    ctrl: true,
    scope: 'order',
    category: 'transaction',
    enabled: true,
    group: 'Quantity',
    order: 54,
    ariaLabel: 'Set quantity to 5'
  },

  // ==========================================================================
  // AMOUNT SHORTCUTS - Quick Cash Entry (Zimbabwe Denominations)
  // ==========================================================================
  {
    id: 'amount_10_usd',
    key: '1',
    description: '$10 USD',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 10, currency: 'USD' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 60,
    ariaLabel: 'Add $10 USD'
  },
  {
    id: 'amount_20_usd',
    key: '2',
    description: '$20 USD',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 20, currency: 'USD' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 61,
    ariaLabel: 'Add $20 USD'
  },
  {
    id: 'amount_50_usd',
    key: '3',
    description: '$50 USD',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 50, currency: 'USD' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 62,
    ariaLabel: 'Add $50 USD'
  },
  {
    id: 'amount_100_usd',
    key: '4',
    description: '$100 USD',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 100, currency: 'USD' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 63,
    ariaLabel: 'Add $100 USD'
  },
  {
    id: 'amount_50_ZWG',
    key: '5',
    description: '50 ZWG',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 50, currency: 'ZWG' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 64,
    ariaLabel: 'Add 50 ZWG'
  },
  {
    id: 'amount_100_ZWG',
    key: '6',
    description: '100 ZWG',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-amount', { detail: { amount: 100, currency: 'ZWG' } })),
    ctrl: true,
    alt: true,
    scope: 'payment',
    category: 'currency',
    enabled: true,
    group: 'Quick Amounts',
    order: 65,
    ariaLabel: 'Add 100 ZWG'
  },

  // ==========================================================================
  // SYSTEM SHORTCUTS
  // ==========================================================================
  {
    id: 'system_help',
    key: 'F1',
    keyCode: 112,
    description: 'Help',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:show-help')),
    shift: true,
    scope: 'global',
    category: 'system',
    enabled: true,
    group: 'System',
    order: 70,
    ariaLabel: 'Show Help'
  },
  {
    id: 'system_shortcuts',
    key: 'F12',
    keyCode: 123,
    description: 'Keyboard Shortcuts',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:toggle-shortcuts')),
    scope: 'global',
    category: 'system',
    enabled: true,
    group: 'System',
    order: 71,
    ariaLabel: 'Show Keyboard Shortcuts'
  },
  {
    id: 'system_search',
    key: 'k',
    description: 'Quick Search',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:quick-search')),
    ctrl: true,
    scope: 'global',
    category: 'system',
    enabled: true,
    group: 'System',
    order: 72,
    ariaLabel: 'Quick Search'
  },
  {
    id: 'system_focus_search',
    key: '/',
    description: 'Focus Search',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:focus-search')),
    scope: 'global',
    category: 'system',
    enabled: true,
    group: 'System',
    order: 73,
    ariaLabel: 'Focus Search Bar'
  },

  // ==========================================================================
  // ADMIN SHORTCUTS (Hidden from help)
  // ==========================================================================
  {
    id: 'admin_debug',
    key: 'd',
    description: 'Debug Mode',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:toggle-debug')),
    ctrl: true,
    shift: true,
    alt: true,
    scope: 'admin',
    category: 'admin',
    enabled: true,
    hidden: true,
    group: 'Admin',
    order: 100,
    ariaLabel: 'Toggle Debug Mode'
  },
  {
    id: 'admin_clear_cache',
    key: 'c',
    description: 'Clear Cache',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:clear-cache')),
    ctrl: true,
    shift: true,
    alt: true,
    scope: 'admin',
    category: 'admin',
    enabled: true,
    hidden: true,
    group: 'Admin',
    order: 101,
    ariaLabel: 'Clear Application Cache'
  },
  {
    id: 'admin_reset_state',
    key: 'r',
    description: 'Reset State',
    action: () => window.dispatchEvent(new CustomEvent('visionplus:reset-state')),
    ctrl: true,
    shift: true,
    alt: true,
    scope: 'admin',
    category: 'admin',
    enabled: true,
    hidden: true,
    group: 'Admin',
    order: 102,
    ariaLabel: 'Reset Application State'
  }
]

// ============================================================================
// SHORTCUT GROUPS - Organized Display
// ============================================================================

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    icon: '🧭',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Navigation' && !s.hidden)
  },
  {
    id: 'transaction',
    name: 'Transaction',
    icon: '💰',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Transaction' && !s.hidden)
  },
  {
    id: 'currency',
    name: 'Currency',
    icon: '💱',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Currency' && !s.hidden)
  },
  {
    id: 'medical_aid',
    name: 'Medical Aid',
    icon: '🏥',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Medical Aid' && !s.hidden)
  },
  {
    id: 'receipt',
    name: 'Receipt',
    icon: '🧾',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Receipt' && !s.hidden)
  },
  {
    id: 'quantity',
    name: 'Quantity',
    icon: '🔢',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Quantity' && !s.hidden)
  },
  {
    id: 'quick_amounts',
    name: 'Quick Amounts',
    icon: '⚡',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Quick Amounts' && !s.hidden)
  },
  {
    id: 'system',
    name: 'System',
    icon: '⚙️',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'System' && !s.hidden)
  },
  {
    id: 'admin',
    name: 'Admin',
    icon: '🔧',
    shortcuts: ZIMBABWE_SHORTCUTS.filter(s => s.group === 'Admin')
  }
]

// ============================================================================
// SHORTCUT DETECTION UTILITIES
// ============================================================================

const isInputElement = (element: EventTarget | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) return false
  
  const tagName = element.tagName.toLowerCase()
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
  const isContentEditable = element.isContentEditable
  const isRoleTextbox = element.getAttribute('role') === 'textbox'
  
  return isInput || isContentEditable || isRoleTextbox
}

const formatShortcutKey = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = []
  
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.meta) parts.push('⌘')
  
  // Format special keys
  let key = shortcut.key
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toUpperCase()
  
  parts.push(key)
  return parts.join(' + ')
}

// ============================================================================
// SHORTCUT INDICATOR COMPONENT
// ============================================================================

interface ShortcutIndicatorProps {
  shortcut: KeyboardShortcut
  className?: string
}

const ShortcutIndicator = ({ shortcut, className = '' }: ShortcutIndicatorProps) => {
  const formattedKey = formatShortcutKey(shortcut)
  
  return (
    <kbd className={`
      inline-flex items-center gap-0.5 px-1.5 py-0.5
      bg-gray-100 border border-gray-300 rounded
      text-xs font-mono text-gray-700 shadow-sm
      ${className}
    `}>
      {formattedKey.split(' + ').map((part, i, arr) => (
        <span key={i}>
          <span className="font-bold">{part}</span>
          {i < arr.length - 1 && <span className="mx-0.5 text-gray-400">+</span>}
        </span>
      ))}
    </kbd>
  )
}

// ============================================================================
// SHORTCUT HELP MODAL COMPONENT
// ============================================================================

interface ShortcutHelpModalProps {
  isOpen: boolean
  onClose: () => void
  scope?: ShortcutScope
}

const ShortcutHelpModal = ({ isOpen, onClose, scope = 'global' }: ShortcutHelpModalProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const modalRef = useRef<HTMLDivElement>(null)

  // Filter shortcuts based on scope, search, and group
  const filteredGroups = useMemo(() => {
    return SHORTCUT_GROUPS
      .map(group => ({
        ...group,
        shortcuts: group.shortcuts.filter(shortcut => {
          // Filter by scope
          if (scope !== 'admin' && shortcut.scope === 'admin') return false
          if (scope !== 'global' && shortcut.scope !== 'global' && shortcut.scope !== scope) return false
          
          // Filter by search
          if (searchTerm) {
            const term = searchTerm.toLowerCase()
            return shortcut.description.toLowerCase().includes(term) ||
                   formatShortcutKey(shortcut).toLowerCase().includes(term)
          }
          
          return true
        })
      }))
      .filter(group => {
        if (selectedGroup !== 'all' && group.id !== selectedGroup) return false
        return group.shortcuts.length > 0
      })
  }, [scope, searchTerm, selectedGroup])

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    modalRef.current?.focus()

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="vp-card max-w-4xl w-full max-h-[80vh] overflow-hidden focus:outline-none"
      >
        {/* Header */}
        <div className="vp-card-header flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">⌨️</span>
            <h2 id="shortcut-help-title" className="text-lg font-bold">
              Keyboard Shortcuts
            </h2>
            {scope !== 'global' && (
              <span className="bg-white/20 px-2 py-1 rounded text-sm">
                {scope.replace('_', ' ').toUpperCase()} Mode
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
            aria-label="Close shortcuts"
          >
            ✕
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search shortcuts..."
                className="w-full px-4 py-2 pl-10 text-sm border rounded-lg bg-white"
                aria-label="Search shortcuts"
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg bg-white"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {SHORTCUT_GROUPS.filter(g => 
                scope !== 'admin' ? g.id !== 'admin' : true
              ).map(group => (
                <option key={group.id} value={group.id}>
                  {group.icon} {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Shortcuts Grid */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
          {filteredGroups.length > 0 ? (
            <div className="space-y-6">
              {filteredGroups.map(group => (
                <div key={group.id}>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-lg">{group.icon}</span>
                    {group.name}
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      ({group.shortcuts.length})
                    </span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.shortcuts
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map(shortcut => (
                        <div
                          key={shortcut.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-sm text-gray-700">
                            {shortcut.description}
                          </span>
                          <ShortcutIndicator 
                            shortcut={shortcut} 
                            className="ml-2 flex-shrink-0"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3" aria-hidden="true">
                🔍
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                No shortcuts found
              </p>
              <p className="text-xs">
                Try adjusting your search or filter
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="vp-card-footer bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ShortcutIndicator shortcut={{ key: 'F12' } as KeyboardShortcut} />
                <span>Show shortcuts</span>
              </span>
              <span className="flex items-center gap-1">
                <ShortcutIndicator shortcut={{ key: 'Escape' } as KeyboardShortcut} />
                <span>Close</span>
              </span>
            </div>
            <p className="text-gray-400">
              {ZIMBABWE_SHORTCUTS.filter(s => !s.hidden).length} shortcuts available
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN KEYBOARD SHORTCUTS COMPONENT
// ============================================================================

export default function KeyboardShortcuts({
  enabled = true,
  showHelpOnStart = false,
  scope = 'global',
  onShortcut
}: KeyboardShortcutsProps) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(showHelpOnStart)
  const [lastShortcut, setLastShortcut] = useState<string | null>(null)
  const [activeScope, setActiveScope] = useState<ShortcutScope>(scope)
  const shortcutTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update scope based on current route
  useEffect(() => {
    const path = window.location.pathname
    
    if (path.includes('/order/create')) {
      setActiveScope('order')
    } else if (path.includes('/payment')) {
      setActiveScope('payment')
    } else if (path.includes('/medical-aid')) {
      setActiveScope('medical_aid')
    } else if (path.includes('/receipt')) {
      setActiveScope('receipt')
    } else if (path === '/' || path === '') {
      setActiveScope('dashboard')
    } else {
      setActiveScope('global')
    }
  }, [])

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (isInputElement(e.target)) {
        return
      }

      // Check each shortcut
      for (const shortcut of ZIMBABWE_SHORTCUTS) {
        if (!shortcut.enabled) continue
        
        // Skip admin shortcuts unless in admin scope
        if (shortcut.scope === 'admin' && activeScope !== 'admin') continue
        
        // Check if scope matches
        if (shortcut.scope !== 'global' && shortcut.scope !== activeScope) continue

        // Check key match
        const keyMatch = shortcut.key === e.key || 
                        (shortcut.keyCode && shortcut.keyCode === e.keyCode)

        if (!keyMatch) continue

        // Check modifier keys
        const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === e.ctrlKey
        const shiftMatch = shortcut.shift === undefined || shortcut.shift === e.shiftKey
        const altMatch = shortcut.alt === undefined || shortcut.alt === e.altKey
        const metaMatch = shortcut.meta === undefined || shortcut.meta === e.metaKey

        if (ctrlMatch && shiftMatch && altMatch && metaMatch) {
          e.preventDefault()
          
          // Execute shortcut action
          shortcut.action()
          
          // Show feedback
          setLastShortcut(formatShortcutKey(shortcut))
          if (shortcutTimeoutRef.current) {
            clearTimeout(shortcutTimeoutRef.current)
          }
          shortcutTimeoutRef.current = setTimeout(() => {
            setLastShortcut(null)
          }, 2000)

          // Call onShortcut callback
          onShortcut?.(shortcut)

          // Special handling for help shortcut
          if (shortcut.id === 'system_shortcuts') {
            setShowHelp(prev => !prev)
          }
          if (shortcut.id === 'system_help' && shortcut.shift) {
            setShowHelp(prev => !prev)
          }

          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, activeScope, onShortcut])

  // Listen for toggle events
  useEffect(() => {
    const handleToggleShortcuts = () => setShowHelp(prev => !prev)
    const handleShowHelp = () => setShowHelp(true)

    window.addEventListener('visionplus:toggle-shortcuts', handleToggleShortcuts)
    window.addEventListener('visionplus:show-help', handleShowHelp)

    return () => {
      window.removeEventListener('visionplus:toggle-shortcuts', handleToggleShortcuts)
      window.removeEventListener('visionplus:show-help', handleShowHelp)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* Shortcut Indicator Toast */}
      {lastShortcut && (
        <div
          className="fixed bottom-20 right-4 z-40 bg-vp-primary text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in-up"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⌨️</span>
            <span className="text-sm font-medium">
              Used: <kbd className="px-1.5 py-0.5 bg-white/20 rounded font-mono">
                {lastShortcut}
              </kbd>
            </span>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <ShortcutHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        scope={activeScope}
      />

      {/* Hidden shortcut hint for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {activeScope !== 'global' && `Currently in ${activeScope} mode. `}
        Press F12 to view keyboard shortcuts.
      </div>
    </>
  )
}

// ============================================================================
// SHORTCUT HOOK - For components to register actions
// ============================================================================

export function useShortcut(
  shortcutId: string,
  action: () => void,
  deps: any[] = []
) {
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      action()
    }

    window.addEventListener(`visionplus:${shortcutId}`, handler as EventListener)
    return () => window.removeEventListener(`visionplus:${shortcutId}`, handler as EventListener)
  }, [shortcutId, action, ...deps])
}

// ============================================================================
// SHORTCUT PROVIDER - For child components to access shortcuts
// ============================================================================

interface ShortcutProviderProps {
  children: React.ReactNode
  scope?: ShortcutScope
}

export function ShortcutProvider({ children, scope = 'global' }: ShortcutProviderProps) {
  return (
    <>
      <KeyboardShortcuts scope={scope} />
      {children}
    </>
  )
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export { 
  ZIMBABWE_SHORTCUTS,
  SHORTCUT_GROUPS,
  formatShortcutKey,
  ShortcutIndicator,
  ShortcutHelpModal
}

export type { 
  KeyboardShortcut,
  ShortcutScope,
  ShortcutCategory,
  ShortcutGroup
}