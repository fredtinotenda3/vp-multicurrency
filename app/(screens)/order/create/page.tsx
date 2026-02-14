// app/(screens)/order/create/page.tsx
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import { ZimbabwePhoneValidator, MedicalAidMemberValidator } from '@/components/validation/FormValidator'

// ============================================================================
// TYPES - Explicit, immutable, self-documenting
// ============================================================================

type Currency = 'USD' | 'ZWL'
type RateSource = 'reserve_bank' | 'manual' | 'clinic_rate'
type OrderStatus = 'draft' | 'pending_payment' | 'completed' | 'cancelled'

interface ExchangeRate {
  readonly rate: number
  readonly source: RateSource
  readonly lastUpdated: Date
  readonly validUntil: Date
  readonly isLive: boolean
}

interface Product {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly category: 'frames' | 'lenses' | 'coatings' | 'contacts' | 'solutions' | 'services'
  readonly basePriceUSD: number
  readonly isTaxable: boolean
  readonly taxRate: number // 15% for Zimbabwe
  readonly requiresPrescription: boolean
  readonly stockLevel?: number
}

interface OrderItem {
  readonly id: string
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly category: string
  readonly quantity: number
  readonly unitPriceUSD: number
  readonly unitPriceZWL: number
  readonly totalPriceUSD: number
  readonly totalPriceZWL: number
  readonly taxUSD: number
  readonly taxZWL: number
  readonly requiresPrescription: boolean
}

interface PatientInfo {
  readonly id?: string
  readonly name: string
  readonly dateOfBirth?: string
  readonly phone: string
  readonly email?: string
  readonly medicalAidProvider?: string
  readonly memberNumber?: string
  readonly memberName?: string
}

// ============================================================================
// FORMATTING UTILITIES - FIXED for date handling
// ============================================================================

const formatDate = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }
    return dateObj.toLocaleTimeString('en-ZW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    console.error('Date formatting error:', error)
    return '—'
  }
}

const formatShortDate = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }
    return dateObj.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch (error) {
    console.error('Date formatting error:', error)
    return '—'
  }
}

const formatCurrency = (amount: number, currency: 'USD' | 'ZWL'): string => {
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

// ============================================================================
// CONSTANTS - Zimbabwe VisionPlus Product Catalog
// ============================================================================

const PRODUCT_CATALOG: Product[] = [
  // Frames
  { id: 'FRM-001', sku: 'RAY-AVI-001', name: 'Ray-Ban Aviator', category: 'frames', basePriceUSD: 120.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 15 },
  { id: 'FRM-002', sku: 'OAK-HLB-002', name: 'Oakley Holbrook', category: 'frames', basePriceUSD: 95.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 8 },
  { id: 'FRM-003', sku: 'GUCC-001', name: 'Gucci GG0061S', category: 'frames', basePriceUSD: 180.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 3 },
  { id: 'FRM-004', sku: 'POLO-002', name: 'Polo Ralph Lauren', category: 'frames', basePriceUSD: 85.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 12 },
  { id: 'FRM-005', sku: 'TOMF-003', name: 'Tom Ford FT5366', category: 'frames', basePriceUSD: 210.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 2 },
  
  // Lenses
  { id: 'LNS-001', sku: 'SV-CR39', name: 'Single Vision CR-39', category: 'lenses', basePriceUSD: 45.00, isTaxable: true, taxRate: 15, requiresPrescription: true },
  { id: 'LNS-002', sku: 'SV-PC', name: 'Single Vision Polycarbonate', category: 'lenses', basePriceUSD: 65.00, isTaxable: true, taxRate: 15, requiresPrescription: true },
  { id: 'LNS-003', sku: 'PROG-HI', name: 'Progressive High Index', category: 'lenses', basePriceUSD: 180.00, isTaxable: true, taxRate: 15, requiresPrescription: true },
  { id: 'LNS-004', sku: 'BI-160', name: 'Bifocal 160', category: 'lenses', basePriceUSD: 95.00, isTaxable: true, taxRate: 15, requiresPrescription: true },
  { id: 'LNS-005', sku: 'TRIFOCAL', name: 'Trifocal', category: 'lenses', basePriceUSD: 130.00, isTaxable: true, taxRate: 15, requiresPrescription: true },
  
  // Coatings & Add-ons
  { id: 'CTN-001', sku: 'AR-COAT', name: 'Anti-Reflective Coating', category: 'coatings', basePriceUSD: 35.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'CTN-002', sku: 'BLUE-BLK', name: 'Blue Light Blocking', category: 'coatings', basePriceUSD: 45.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'CTN-003', sku: 'PHOTO', name: 'Photochromic', category: 'coatings', basePriceUSD: 75.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'CTN-004', sku: 'SCR-RES', name: 'Scratch Resistant', category: 'coatings', basePriceUSD: 25.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'CTN-005', sku: 'UV-PRO', name: 'UV Protection', category: 'coatings', basePriceUSD: 20.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  
  // Contact Lenses
  { id: 'CTL-001', sku: 'ACUVUE-DAILY', name: 'Acuvue Daily (30 pack)', category: 'contacts', basePriceUSD: 55.00, isTaxable: true, taxRate: 15, requiresPrescription: true, stockLevel: 20 },
  { id: 'CTL-002', sku: 'BIO-MONTHLY', name: 'Biofinity Monthly (6 pack)', category: 'contacts', basePriceUSD: 65.00, isTaxable: true, taxRate: 15, requiresPrescription: true, stockLevel: 15 },
  
  // Solutions
  { id: 'SOL-001', sku: 'RENU-MPS', name: 'ReNu Multi-Purpose Solution', category: 'solutions', basePriceUSD: 12.00, isTaxable: true, taxRate: 15, requiresPrescription: false, stockLevel: 45 },
  
  // Services
  { id: 'SRV-001', sku: 'EYE-EXAM', name: 'Comprehensive Eye Examination', category: 'services', basePriceUSD: 50.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'SRV-002', sku: 'CL-FITTING', name: 'Contact Lens Fitting', category: 'services', basePriceUSD: 75.00, isTaxable: true, taxRate: 15, requiresPrescription: false },
  { id: 'SRV-003', sku: 'FRAME-REPAIR', name: 'Frame Repair', category: 'services', basePriceUSD: 25.00, isTaxable: true, taxRate: 15, requiresPrescription: false }
]

const ZIMBABWE_VAT_RATE = 15 // 15% VAT as per ZIMRA

// Zimbabwe Medical Aid Providers - Complete list
const MEDICAL_AID_PROVIDERS = [
  { id: 'Cimas', name: 'Cimas' },
  { id: 'First Mutual', name: 'First Mutual' },
  { id: 'PSMAS', name: 'PSMAS' },
  { id: 'Liberty', name: 'Liberty Health' },
  { id: 'Alliance', name: 'Alliance' },
  { id: 'Altfin', name: 'Altfin' },
  { id: 'Cellmed', name: 'Cellmed' },
  { id: 'Old Mutual', name: 'Old Mutual' }
] as const

// ============================================================================
// EXCHANGE RATE HOOK - Simulated live rates
// ============================================================================

function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate>({
    rate: 32.5, // Changed from 1250 to 32.5
    source: 'reserve_bank',
    lastUpdated: new Date(),
    validUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    isLive: true
  })

  const [isRateLocked, setIsRateLocked] = useState(false)
  const [lockedRate, setLockedRate] = useState<number | null>(null)
  const [lockedAt, setLockedAt] = useState<Date | null>(null)

  // Simulate live rate updates (in production, this would be WebSocket)
  useEffect(() => {
    if (isRateLocked) return

    const interval = setInterval(() => {
      setExchangeRate(prev => ({
        ...prev,
        rate: prev.rate + (Math.random() > 0.5 ? 0.1 : -0.1), // Smaller fluctuations
        lastUpdated: new Date(),
        validUntil: new Date(Date.now() + 30 * 60 * 1000)
      }))
    }, 30000)

    return () => clearInterval(interval)
  }, [isRateLocked])

  const lockRate = useCallback((rate?: number) => {
    const rateToLock = rate ?? exchangeRate.rate
    
    setLockedRate(rateToLock)
    setLockedAt(new Date())
    setIsRateLocked(true)
    
    setExchangeRate(prev => ({
      ...prev,
      rate: rateToLock,
      source: rate ? 'manual' : prev.source,
      isLive: false
    }))

    window.dispatchEvent(new CustomEvent('visionplus:rate-locked', { 
      detail: { rate: rateToLock, lockedAt: new Date() }
    }))
  }, [exchangeRate.rate])

  const unlockRate = useCallback(() => {
    setIsRateLocked(false)
    setLockedRate(null)
    setLockedAt(null)
    window.dispatchEvent(new CustomEvent('visionplus:rate-unlocked'))
  }, [])

  return {
    currentRate: exchangeRate,
    isRateLocked,
    lockedRate,
    lockedAt,
    lockRate,
    unlockRate
  }
}

// ============================================================================
// ORDER MANAGEMENT HOOK
// ============================================================================

function useOrderCreation() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    phone: '',
    email: '',
    medicalAidProvider: '',
    memberNumber: '',
    memberName: ''
  })
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('draft')
  const [orderId, setOrderId] = useState<string | null>(null)

  const addItem = useCallback((product: Product, quantity: number, exchangeRate: number) => {
    const unitPriceZWL = product.basePriceUSD * exchangeRate
    const totalPriceUSD = product.basePriceUSD * quantity
    const totalPriceZWL = unitPriceZWL * quantity
    const taxUSD = product.isTaxable ? totalPriceUSD * (product.taxRate / 100) : 0
    const taxZWL = product.isTaxable ? totalPriceZWL * (product.taxRate / 100) : 0

    const newItem: OrderItem = {
      id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      quantity,
      unitPriceUSD: product.basePriceUSD,
      unitPriceZWL,
      totalPriceUSD,
      totalPriceZWL,
      taxUSD,
      taxZWL,
      requiresPrescription: product.requiresPrescription
    }

    setOrderItems(prev => [...prev, newItem])
    return newItem
  }, [])

  const updateQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId)
      return
    }

    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const totalPriceUSD = item.unitPriceUSD * newQuantity
        const totalPriceZWL = item.unitPriceZWL * newQuantity
        const taxUSD = totalPriceUSD * (ZIMBABWE_VAT_RATE / 100)
        const taxZWL = totalPriceZWL * (ZIMBABWE_VAT_RATE / 100)

        return {
          ...item,
          quantity: newQuantity,
          totalPriceUSD,
          totalPriceZWL,
          taxUSD,
          taxZWL
        }
      }
      return item
    }))
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId))
  }, [])

  const clearOrder = useCallback(() => {
    setOrderItems([])
    setPatientInfo({
      name: '',
      phone: '',
      email: '',
      medicalAidProvider: '',
      memberNumber: '',
      memberName: ''
    })
    setOrderStatus('draft')
    setOrderId(null)
  }, [])

  const calculateTotals = useCallback((exchangeRate: number) => {
    const subtotalUSD = orderItems.reduce((sum, item) => sum + item.totalPriceUSD, 0)
    const subtotalZWL = orderItems.reduce((sum, item) => sum + item.totalPriceZWL, 0)
    
    const taxUSD = orderItems.reduce((sum, item) => sum + item.taxUSD, 0)
    const taxZWL = orderItems.reduce((sum, item) => sum + item.taxZWL, 0)
    
    const totalUSD = subtotalUSD + taxUSD
    const totalZWL = subtotalZWL + taxZWL

    return {
      subtotalUSD,
      subtotalZWL,
      taxUSD,
      taxZWL,
      totalUSD,
      totalZWL,
      itemCount: orderItems.length,
      uniqueItems: orderItems.length
    }
  }, [orderItems])

  const validateOrder = useCallback((
    isRateLocked: boolean,
    patientInfo: PatientInfo,
    items: OrderItem[]
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!isRateLocked) {
      errors.push('Exchange rate must be locked before creating order')
    }

    if (items.length === 0) {
      errors.push('At least one item is required')
    }

    if (!patientInfo.name?.trim()) {
      errors.push('Patient name is required')
    }

    if (!patientInfo.phone?.trim()) {
      errors.push('Patient phone number is required')
    }

    const phoneRegex = /^(\+263|0)[1-9]{1}[0-9]{8}$/
    if (patientInfo.phone?.trim() && !phoneRegex.test(patientInfo.phone.trim())) {
      errors.push('Phone number must be in Zimbabwe format: +263 XXX XXX XXX or 0XX XXX XXXX')
    }

    const prescriptionItems = items.filter(item => item.requiresPrescription)
    if (prescriptionItems.length > 0 && !patientInfo.dateOfBirth) {
      errors.push('Date of birth is required for prescription items')
    }

    if (patientInfo.medicalAidProvider && !patientInfo.memberNumber?.trim()) {
      errors.push('Member number is required when medical aid provider is selected')
    }

    if (patientInfo.memberNumber?.trim()) {
      const memberRegex = /^[A-Z]{3,4}-[0-9]{6,10}$/
      if (!memberRegex.test(patientInfo.memberNumber.trim())) {
        errors.push('Member number must be in format: XXX-123456 (e.g., CIM-123456)')
      }
    }

    return { isValid: errors.length === 0, errors }
  }, [])

  const createOrder = useCallback((
    exchangeRate: number,
    rateLockedAt: Date,
    rateSource: RateSource
  ) => {
    const newOrderId = `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    setOrderId(newOrderId)
    setOrderStatus('pending_payment')
    
    return {
      orderId: newOrderId,
      patientInfo,
      items: orderItems,
      exchangeRate,
      rateLockedAt,
      rateSource,
      totals: calculateTotals(exchangeRate),
      createdAt: new Date(),
      status: 'pending_payment'
    }
  }, [orderItems, patientInfo, calculateTotals])

  return {
    orderItems,
    patientInfo,
    orderStatus,
    orderId,
    setPatientInfo,
    addItem,
    updateQuantity,
    removeItem,
    clearOrder,
    calculateTotals,
    validateOrder,
    createOrder
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

interface ExchangeRateDisplayProps {
  rate: ExchangeRate
  isLocked: boolean
  lockedAt: Date | null
  onLockRate: (rate?: number) => void
  onUnlockRate: () => void
  transactionCurrency: Currency
  onCurrencyChange: (currency: Currency) => void
  disabled?: boolean
}

const ExchangeRateDisplay = ({
  rate,
  isLocked,
  lockedAt,
  onLockRate,
  onUnlockRate,
  transactionCurrency,
  onCurrencyChange,
  disabled = false
}: ExchangeRateDisplayProps) => {
  const [manualRate, setManualRate] = useState<string>(rate.rate.toString())
  const [showManualEntry, setShowManualEntry] = useState(false)

  const handleLockManual = () => {
    const parsedRate = parseFloat(manualRate)
    if (!isNaN(parsedRate) && parsedRate > 0) {
      onLockRate(parsedRate)
      setShowManualEntry(false)
    }
  }

  return (
    <div className={`vp-card mb-6 ${isLocked ? 'border-l-4 border-l-currency-locked' : ''}`}>
      <div className="vp-card-header flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span>Exchange Rate</span>
          {isLocked && (
            <span className="bg-currency-locked/20 text-white px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              <span>🔒</span>
              <span>LOCKED</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCurrencyChange('USD')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              transactionCurrency === 'USD'
                ? 'bg-currency-usd text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            disabled={isLocked || disabled}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => onCurrencyChange('ZWL')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              transactionCurrency === 'ZWL'
                ? 'bg-currency-zwl text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            disabled={isLocked || disabled}
          >
            ZWL
          </button>
        </div>
      </div>
      
      <div className="vp-card-body">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Current Rate</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-vp-primary">
                1 USD = {rate.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ZWL
              </span>
              {rate.isLive && !isLocked && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>Source: {
                rate.source === 'reserve_bank' ? 'Reserve Bank of Zimbabwe' :
                rate.source === 'manual' ? 'Manual Entry' : 'Clinic Rate'
              }</span>
              <span>•</span>
              <span>Updated: {formatDate(rate.lastUpdated)}</span>
              {rate.validUntil && (
                <>
                  <span>•</span>
                  <span>Valid until: {formatDate(rate.validUntil)}</span>
                </>
              )}
            </div>
          </div>
          
          {!isLocked ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {!showManualEntry ? (
                <>
                  <button
                    type="button"
                    onClick={() => onLockRate()}
                    className="vp-btn vp-btn-primary flex items-center gap-2"
                    disabled={disabled}
                  >
                    <span>🔒</span>
                    Lock Live Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(true)}
                    className="vp-btn vp-btn-outline"
                    disabled={disabled}
                  >
                    Manual Entry
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={manualRate}
                      onChange={(e) => setManualRate(e.target.value)}
                      className="vp-form-control w-40 pl-12"
                      placeholder="Rate"
                      min="1"
                      max="1000"
                      step="0.01"
                      autoFocus
                      disabled={disabled}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                      1 USD =
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLockManual}
                    className="vp-btn vp-btn-primary"
                    disabled={disabled || !manualRate || parseFloat(manualRate) <= 0}
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="vp-btn vp-btn-outline"
                    disabled={disabled}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-currency-locked/10 p-4 rounded-lg border border-currency-locked/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-currency-locked">🔒</span>
                <span className="font-medium text-currency-locked">Rate Locked</span>
              </div>
              <div className="text-sm">
                <span className="font-bold">1 USD = {rate.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ZWL</span>
                {lockedAt && (
                  <span className="text-gray-600 ml-2">
                    locked at {formatDate(lockedAt)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onUnlockRate}
                className="mt-2 text-xs text-currency-locked hover:text-currency-locked/80 underline"
                disabled={disabled}
              >
                Unlock Rate (requires confirmation)
              </button>
            </div>
          )}
        </div>
        
        {!isLocked && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-3">Conversion Preview</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xs text-gray-500">$10 USD</div>
                <div className="font-medium text-currency-zwl">
                  {(10 * rate.rate).toFixed(2)} ZWL
                </div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xs text-gray-500">$50 USD</div>
                <div className="font-medium text-currency-zwl">
                  {(50 * rate.rate).toFixed(2)} ZWL
                </div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xs text-gray-500">1,000 ZWL</div>
                <div className="font-medium text-currency-usd">
                  ${(1000 / rate.rate).toFixed(2)} USD
                </div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xs text-gray-500">5,000 ZWL</div>
                <div className="font-medium text-currency-usd">
                  ${(5000 / rate.rate).toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// PRODUCT SELECTOR COMPONENT - MOBILE FRIENDLY
// ============================================================================

interface ProductSelectorProps {
  onAddItem: (product: Product, quantity: number) => void
  exchangeRate: number
  disabled?: boolean
}

const ProductSelector = ({ onAddItem, exchangeRate, disabled = false }: ProductSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  const categories = [
    { id: 'all', name: 'All Products', icon: '📦' },
    { id: 'frames', name: 'Frames', icon: '👓' },
    { id: 'lenses', name: 'Lenses', icon: '🔍' },
    { id: 'contacts', name: 'Contacts', icon: '💧' },
    { id: 'solutions', name: 'Solutions', icon: '🧴' },
    { id: 'services', name: 'Services', icon: '🩺' }
  ]

  const filteredProducts = useMemo(() => {
    return PRODUCT_CATALOG.filter(product => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false
      if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !product.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [selectedCategory, searchTerm])

  const selectedProduct = useMemo(() => {
    return PRODUCT_CATALOG.find(p => p.id === selectedProductId)
  }, [selectedProductId])

  const handleAdd = () => {
    if (selectedProduct) {
      onAddItem(selectedProduct, quantity)
      setSelectedProductId('')
      setQuantity(1)
      setShowProductDropdown(false)
    }
  }

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId)
    setShowProductDropdown(false)
  }

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header">
        Add Products & Services
      </div>
      
      <div className="vp-card-body">
        {/* Category Tabs - Scrollable on mobile */}
        <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors touch-manipulation ${
                selectedCategory === category.id
                  ? 'bg-vp-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={disabled}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Search and Selection - Mobile Optimized */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div>
            <label className="vp-form-label">Search Products</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="vp-form-control"
              placeholder="Search by name or SKU..."
              disabled={disabled}
            />
          </div>
          
          {/* Product Selection - Mobile Friendly Dropdown */}
          <div>
            <label className="vp-form-label">Select Product</label>
            
            {/* Custom dropdown button - works on mobile */}
            <button
              type="button"
              onClick={() => setShowProductDropdown(!showProductDropdown)}
              className="vp-form-control text-left flex justify-between items-center"
              disabled={disabled || filteredProducts.length === 0}
            >
              <span className={selectedProduct ? 'text-gray-900' : 'text-gray-400'}>
                {selectedProduct ? selectedProduct.name : 'Choose a product...'}
              </span>
              <span className="text-gray-500">{showProductDropdown ? '▲' : '▼'}</span>
            </button>
            
            {/* Dropdown options */}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-lg">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 touch-manipulation"
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-currency-usd">{formatCurrency(product.basePriceUSD, 'USD')}</span>
                      {product.stockLevel !== undefined && (
                        <span className="text-gray-500">Stock: {product.stockLevel}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{product.sku}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quantity and Add - Only shown when product selected */}
        {selectedProduct && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="vp-form-label">Quantity</label>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-3 border rounded-l-lg bg-white hover:bg-gray-50 touch-manipulation"
                    disabled={disabled}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="vp-form-control text-center rounded-none border-x-0"
                    min="1"
                    max={selectedProduct.stockLevel || 99}
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-3 border rounded-r-lg bg-white hover:bg-gray-50 touch-manipulation"
                    disabled={disabled || (selectedProduct.stockLevel !== undefined && quantity >= selectedProduct.stockLevel)}
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <label className="vp-form-label">Price</label>
                <div className="space-y-1 p-3 bg-white rounded-lg border">
                  <div className="text-currency-usd font-medium">
                    {formatCurrency(selectedProduct.basePriceUSD * quantity, 'USD')}
                  </div>
                  <div className="text-sm text-currency-zwl">
                    {formatCurrency(selectedProduct.basePriceUSD * exchangeRate * quantity, 'ZWL')}
                  </div>
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleAdd}
              className="vp-btn vp-btn-secondary w-full mt-4 py-3 flex items-center justify-center gap-2 touch-manipulation"
              disabled={disabled || !selectedProductId}
            >
              <span>➕</span>
              Add to Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface OrderItemsTableProps {
  items: OrderItem[]
  exchangeRate: number
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemoveItem: (itemId: string) => void
  disabled?: boolean
}

const OrderItemsTable = ({
  items,
  exchangeRate,
  onUpdateQuantity,
  onRemoveItem,
  disabled = false
}: OrderItemsTableProps) => {
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      frames: '👓',
      lenses: '🔍',
      coatings: '✨',
      contacts: '💧',
      solutions: '🧴',
      services: '🩺'
    }
    return icons[category] || '📦'
  }

  if (items.length === 0) {
    return (
      <div className="vp-card mb-6">
        <div className="vp-card-body">
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-4" aria-hidden="true">
              🛒
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No items in order
            </h3>
            <p className="text-sm">
              Add products or services using the selector above
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header flex justify-between items-center">
        <span>Order Items</span>
        <span className="text-sm bg-white/20 px-2 py-1 rounded">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="vp-card-body p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total (USD)
                </th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total (ZWL)
                </th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">
                        {getCategoryIcon(item.category)}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {item.category}
                        </div>
                        {item.requiresPrescription && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                            Prescription Required
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs font-mono text-gray-600">
                    {item.sku}
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium text-currency-usd">
                      {formatCurrency(item.unitPriceUSD, 'USD')}
                    </div>
                    <div className="text-xs text-currency-zwl">
                      {formatCurrency(item.unitPriceZWL, 'ZWL')}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={disabled || item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={disabled}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-right font-medium text-currency-usd">
                    {formatCurrency(item.totalPriceUSD, 'USD')}
                  </td>
                  <td className="p-3 text-right font-medium text-currency-zwl">
                    {formatCurrency(item.totalPriceZWL, 'ZWL')}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-status-error hover:text-red-700 text-sm"
                      disabled={disabled}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface PatientInfoFormProps {
  patientInfo: PatientInfo
  onChange: (info: PatientInfo) => void
  disabled?: boolean
  hasPrescriptionItems: boolean
}

const PatientInfoForm = ({ 
  patientInfo, 
  onChange, 
  disabled = false,
  hasPrescriptionItems 
}: PatientInfoFormProps) => {
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  const handleChange = (field: keyof PatientInfo, value: string) => {
    onChange({ ...patientInfo, [field]: value })
    if (field === 'phone') setPhoneError(null)
    if (field === 'memberNumber') setMemberError(null)
  }

  const validatePhone = () => {
    if (patientInfo.phone) {
      const phoneRegex = /^(\+263|0)[1-9]{1}[0-9]{8}$/
      if (!phoneRegex.test(patientInfo.phone.trim())) {
        setPhoneError('Phone number must be in Zimbabwe format: +263 XXX XXX XXX or 0XX XXX XXXX')
        return false
      }
    }
    return true
  }

  const validateMemberNumber = () => {
    if (patientInfo.memberNumber) {
      const memberRegex = /^[A-Z]{3,4}-[0-9]{6,10}$/
      if (!memberRegex.test(patientInfo.memberNumber.trim())) {
        setMemberError('Member number must be in format: XXX-123456 (e.g., CIM-123456)')
        return false
      }
    }
    return true
  }

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header">
        Patient Information
        {hasPrescriptionItems && (
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
            Prescription Required
          </span>
        )}
      </div>
      
      <div className="vp-card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="patient-name" className="vp-form-label">
              Patient Name <span className="text-status-error">*</span>
            </label>
            <input
              id="patient-name"
              type="text"
              value={patientInfo.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="vp-form-control"
              placeholder="Enter full name"
              required
              disabled={disabled}
            />
            {!patientInfo.name?.trim() && patientInfo.name !== '' && (
              <p className="mt-1 text-xs text-status-error">Patient name is required</p>
            )}
          </div>
          
          <div>
            <label htmlFor="patient-dob" className="vp-form-label">
              Date of Birth {hasPrescriptionItems && <span className="text-status-error">*</span>}
            </label>
            <input
              id="patient-dob"
              type="date"
              value={patientInfo.dateOfBirth || ''}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              className={`vp-form-control ${hasPrescriptionItems && !patientInfo.dateOfBirth ? 'border-status-pending' : ''}`}
              disabled={disabled}
            />
            {hasPrescriptionItems && !patientInfo.dateOfBirth && (
              <p className="mt-1 text-xs text-status-pending">Required for prescription items</p>
            )}
          </div>
          
          <div>
            <label htmlFor="patient-phone" className="vp-form-label">
              Phone Number <span className="text-status-error">*</span>
            </label>
            <input
              id="patient-phone"
              type="tel"
              value={patientInfo.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              onBlur={validatePhone}
              className={`vp-form-control ${phoneError ? 'border-status-error' : ''}`}
              placeholder="+263 XXX XXX XXX"
              required
              disabled={disabled}
            />
            {phoneError && (
              <p className="mt-1 text-xs text-status-error">{phoneError}</p>
            )}
            {!patientInfo.phone?.trim() && patientInfo.phone !== '' && (
              <p className="mt-1 text-xs text-status-error">Phone number is required</p>
            )}
          </div>
          
          <div>
            <label htmlFor="patient-email" className="vp-form-label">
              Email Address
            </label>
            <input
              id="patient-email"
              type="email"
              value={patientInfo.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="vp-form-control"
              placeholder="patient@example.com"
              disabled={disabled}
            />
          </div>
          
          <div>
            <label htmlFor="medical-aid-provider" className="vp-form-label">
              Medical Aid Provider
            </label>
            <select
              id="medical-aid-provider"
              value={patientInfo.medicalAidProvider || ''}
              onChange={(e) => {
                handleChange('medicalAidProvider', e.target.value)
                if (!e.target.value) {
                  handleChange('memberNumber', '')
                  handleChange('memberName', '')
                }
              }}
              className="vp-form-control"
              disabled={disabled}
            >
              <option value="">No Medical Aid (Cash Patient)</option>
              {MEDICAL_AID_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="member-number" className="vp-form-label">
              Member Number {patientInfo.medicalAidProvider && <span className="text-status-error">*</span>}
            </label>
            <input
              id="member-number"
              type="text"
              value={patientInfo.memberNumber || ''}
              onChange={(e) => handleChange('memberNumber', e.target.value)}
              onBlur={validateMemberNumber}
              className={`vp-form-control ${memberError ? 'border-status-error' : ''}`}
              placeholder="e.g., CIM-123456"
              disabled={disabled || !patientInfo.medicalAidProvider}
            />
            {memberError && (
              <p className="mt-1 text-xs text-status-error">{memberError}</p>
            )}
            {patientInfo.medicalAidProvider && !patientInfo.memberNumber?.trim() && (
              <p className="mt-1 text-xs text-status-pending">Member number is required</p>
            )}
          </div>
          
          <div>
            <label htmlFor="member-name" className="vp-form-label">
              Member Name (if different)
            </label>
            <input
              id="member-name"
              type="text"
              value={patientInfo.memberName || ''}
              onChange={(e) => handleChange('memberName', e.target.value)}
              className="vp-form-control"
              placeholder="Full name on medical aid"
              disabled={disabled || !patientInfo.medicalAidProvider}
            />
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
          <div>
            <span className="text-status-error">*</span> Required fields
          </div>
          {hasPrescriptionItems && (
            <span className="flex items-center gap-1 text-status-info">
              <span>ℹ️</span>
              Prescription items require date of birth
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface OrderSummaryProps {
  totals: ReturnType<typeof useOrderCreation>['calculateTotals']
  exchangeRate: number
  transactionCurrency: Currency
  isRateLocked: boolean
  lockedRate: number | null
  lockedAt: Date | null
  itemCount: number
  isPaymentEnabled: boolean
  disabledReason: string
}

const OrderSummary = ({
  totals,
  exchangeRate,
  transactionCurrency,
  isRateLocked,
  lockedRate,
  lockedAt,
  itemCount,
  isPaymentEnabled,
  disabledReason
}: OrderSummaryProps) => {
  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A'
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) return 'N/A'
      return dateObj.toLocaleTimeString('en-ZW', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'N/A'
    }
  }

  return (
    <div className="vp-card">
      <div className="vp-card-header">
        Order Summary
      </div>
      
      <div className="vp-card-body">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="currency-badge currency-usd px-2 py-1 text-xs">
                USD
              </span>
              <span className="text-xs text-gray-600">Base Clinic Currency</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(totals.subtotalUSD, 'USD')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT (15%):</span>
                <span className="font-medium">{formatCurrency(totals.taxUSD, 'USD')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-3 mt-3">
                <span>Total USD:</span>
                <span className="text-currency-usd">{formatCurrency(totals.totalUSD, 'USD')}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`currency-badge ${
                transactionCurrency === 'USD' ? 'currency-usd' : 'currency-zwl'
              } px-2 py-1 text-xs`}>
                {transactionCurrency}
              </span>
              <span className="text-xs text-gray-600">Transaction Currency</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  {formatCurrency(
                    transactionCurrency === 'USD' ? totals.subtotalUSD : totals.subtotalZWL,
                    transactionCurrency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT (15%):</span>
                <span className="font-medium">
                  {formatCurrency(
                    transactionCurrency === 'USD' ? totals.taxUSD : totals.taxZWL,
                    transactionCurrency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-3 mt-3">
                <span>Total {transactionCurrency}:</span>
                <span className={
                  transactionCurrency === 'USD' ? 'text-currency-usd' : 'text-currency-zwl'
                }>
                  {formatCurrency(
                    transactionCurrency === 'USD' ? totals.totalUSD : totals.totalZWL,
                    transactionCurrency
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {isRateLocked && lockedRate && (
          <div className="mt-6 p-4 bg-currency-locked/10 rounded-lg border border-currency-locked/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-currency-locked">🔒</span>
              <span className="font-medium text-currency-locked">Exchange Rate Locked</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 text-xs">Rate:</span>
                <div className="font-medium">1 USD = {lockedRate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ZWL</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Locked at:</span>
                <div className="font-medium">{lockedAt ? formatDate(lockedAt) : 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Items:</span>
                <div className="font-medium">{itemCount}</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Status:</span>
                <div className="font-medium text-currency-locked">Ready for payment</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Payment Readiness</span>
            {isPaymentEnabled ? (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1">
                <span>✅</span>
                Ready to proceed
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center gap-1">
                <span>⚠️</span>
                Missing requirements
              </span>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              {isRateLocked ? (
                <span className="text-green-600">✅</span>
              ) : (
                <span className="text-gray-400">⬜</span>
              )}
              <span className={isRateLocked ? 'text-gray-700' : 'text-gray-500'}>
                Exchange rate locked
              </span>
            </div>
            <div className="flex items-center gap-2">
              {itemCount > 0 ? (
                <span className="text-green-600">✅</span>
              ) : (
                <span className="text-gray-400">⬜</span>
              )}
              <span className={itemCount > 0 ? 'text-gray-700' : 'text-gray-500'}>
                At least one item in order
              </span>
            </div>
            <div className="flex items-center gap-2">
              {totals.totalUSD > 0 ? (
                <span className="text-green-600">✅</span>
              ) : (
                <span className="text-gray-400">⬜</span>
              )}
              <span className={totals.totalUSD > 0 ? 'text-gray-700' : 'text-gray-500'}>
                Order total greater than zero
              </span>
            </div>
          </div>
        </div>
        
        {!isRateLocked && itemCount > 0 && (
          <div className="mt-6 vp-alert vp-alert-warning">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <strong className="block mb-1">Rate Not Locked</strong>
                <p className="text-sm">
                  You must lock the exchange rate before proceeding to payment. 
                  This ensures all transactions use the same rate for audit compliance.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {!isPaymentEnabled && disabledReason && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <span>ℹ️</span>
              <div>
                <span className="font-medium">Cannot proceed:</span> {disabledReason}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT - FIXED
// ============================================================================

export default function OrderCreationScreen() {
  const router = useRouter()
  
  const {
    currentRate,
    isRateLocked,
    lockedRate,
    lockedAt,
    lockRate,
    unlockRate
  } = useExchangeRate()
  
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>('ZWL')
  
  const {
    orderItems,
    patientInfo,
    orderStatus,
    orderId,
    setPatientInfo,
    addItem,
    updateQuantity,
    removeItem,
    clearOrder,
    calculateTotals,
    validateOrder,
    createOrder
  } = useOrderCreation()
  
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)

  const totals = useMemo(() => 
    calculateTotals(currentRate.rate),
    [calculateTotals, currentRate.rate]
  )

  const hasPrescriptionItems = useMemo(() => {
    return orderItems.some(item => item.requiresPrescription)
  }, [orderItems])

  const isPaymentEnabled = useMemo(() => {
    if (!isRateLocked) return false
    if (orderItems.length === 0) return false
    if (totals.totalUSD <= 0) return false
    if (!patientInfo.name?.trim()) return false
    if (!patientInfo.phone?.trim()) return false
    if (patientInfo.medicalAidProvider && !patientInfo.memberNumber?.trim()) return false
    if (hasPrescriptionItems && !patientInfo.dateOfBirth) return false
    return true
  }, [isRateLocked, orderItems.length, totals.totalUSD, patientInfo, hasPrescriptionItems])

  const getDisabledReason = useCallback((): string => {
    if (!isRateLocked) return 'Exchange rate must be locked first'
    if (orderItems.length === 0) return 'Add at least one item to the order'
    if (totals.totalUSD <= 0) return 'Order total must be greater than zero'
    if (!patientInfo.name?.trim()) return 'Patient name is required'
    if (!patientInfo.phone?.trim()) return 'Patient phone number is required'
    if (patientInfo.medicalAidProvider && !patientInfo.memberNumber?.trim()) 
      return 'Member number is required for medical aid patients'
    if (hasPrescriptionItems && !patientInfo.dateOfBirth) 
      return 'Date of birth is required for prescription items'
    return 'Complete all required fields'
  }, [isRateLocked, orderItems.length, totals.totalUSD, patientInfo, hasPrescriptionItems])

  const handleAddItem = useCallback((product: Product, quantity: number) => {
    addItem(product, quantity, currentRate.rate)
  }, [addItem, currentRate.rate])

  // ==========================================================================
  // ✅ FIXED: Proceed to Payment - FLATTENS totals correctly
  // ==========================================================================
  const handleProceedToPayment = useCallback(() => {
    const validation = validateOrder(isRateLocked, patientInfo, orderItems)
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      const firstError = document.querySelector('.vp-alert-error, .vp-card.border-status-error')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setIsProcessing(true)
    
    const order = createOrder(
      currentRate.rate,
      lockedAt || new Date(),
      currentRate.source
    )
    
    // ✅ CRITICAL FIX: Calculate totals fresh
    const calculatedTotals = calculateTotals(currentRate.rate)
    
    console.log('📦 ORDER CREATION - Saving order:', {
      patientName: patientInfo.name,
      itemCount: orderItems.length,
      totalUSD: calculatedTotals.totalUSD,
      totalZWL: calculatedTotals.totalZWL
    })

    // ✅ FIX: Flatten the order object - NO NESTED totals!
    const orderData = {
      // Order identification
      id: order.orderId,
      
      // Patient information - FLAT, not nested
      patientId: patientInfo.id || `PT-${Date.now().toString().slice(-4)}`,
      patientName: patientInfo.name,
      patientPhone: patientInfo.phone,
      patientEmail: patientInfo.email,
      patientDateOfBirth: patientInfo.dateOfBirth,
      medicalAidProvider: patientInfo.medicalAidProvider,
      memberNumber: patientInfo.memberNumber,
      memberName: patientInfo.memberName,
      
      // ✅ CRITICAL: FLATTEN TOTALS - NOT NESTED!
      subtotalUSD: calculatedTotals.subtotalUSD,
      subtotalZWL: calculatedTotals.subtotalZWL,
      taxUSD: calculatedTotals.taxUSD,
      taxZWL: calculatedTotals.taxZWL,
      totalUSD: calculatedTotals.totalUSD,
      totalZWL: calculatedTotals.totalZWL,
      
      // Order items
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        priceUSD: item.unitPriceUSD,
        priceZWL: item.unitPriceZWL,
        requiresPrescription: item.requiresPrescription
      })),
      
      // Exchange rate info
      exchangeRate: currentRate.rate,
      rateLockedAt: lockedAt?.toISOString() || new Date().toISOString(),
      rateSource: currentRate.source,
      isRateLocked,
      
      // Transaction settings
      transactionCurrency,
      
      // Metadata
      createdAt: new Date().toISOString(),
      status: 'pending_payment'
    }
    
    // Save to sessionStorage
    sessionStorage.setItem('current_order', JSON.stringify(orderData))
    
    // ✅ Verify it was saved correctly
    const savedCheck = sessionStorage.getItem('current_order')
    console.log('✅ Order saved to sessionStorage:', savedCheck ? 'Success' : 'Failed')
    
    setIsProcessing(false)
    router.push('/payment')
  }, [
    validateOrder,
    isRateLocked,
    patientInfo,
    orderItems,
    createOrder,
    calculateTotals,
    currentRate.rate,
    currentRate.source,
    lockedAt,
    transactionCurrency,
    router
  ])

  const handleCancel = useCallback(() => {
    if (orderItems.length > 0 || patientInfo.name || patientInfo.phone) {
      setShowConfirmCancel(true)
    } else {
      router.push('/')
    }
  }, [orderItems.length, patientInfo.name, patientInfo.phone, router])

  const handleConfirmCancel = useCallback(() => {
    clearOrder()
    setShowConfirmCancel(false)
    router.push('/')
  }, [clearOrder, router])

  const handleUnlockRate = useCallback(() => {
    if (window.confirm('Are you sure you want to unlock the rate? This will require re-locking before payment.')) {
      unlockRate()
    }
  }, [unlockRate])

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={isProcessing} message="Creating Order..." />
      
      <div className="min-h-screen bg-vp-background">
        {/* Mobile Header */}
        <MobileHeader />

        <div className="flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 min-w-0" id="main-content">
            <div className="p-4 lg:p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-vp-primary">
                  Create New Order
                </h1>
                <p className="text-gray-600">
                  Select products, set currency, and lock exchange rate
                </p>
              </div>

              {validationErrors.length > 0 && (
                <div className="vp-card mb-6 border-status-error" role="alert">
                  <div className="vp-card-header bg-status-error text-white">
                    Cannot Proceed to Payment
                  </div>
                  <div className="vp-card-body">
                    <ul className="list-disc list-inside space-y-1 text-status-error">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <PatientInfoForm
                patientInfo={patientInfo}
                onChange={setPatientInfo}
                disabled={isProcessing}
                hasPrescriptionItems={hasPrescriptionItems}
              />

              <ExchangeRateDisplay
                rate={currentRate}
                isLocked={isRateLocked}
                lockedAt={lockedAt}
                onLockRate={lockRate}
                onUnlockRate={handleUnlockRate}
                transactionCurrency={transactionCurrency}
                onCurrencyChange={setTransactionCurrency}
                disabled={isProcessing}
              />

              <ProductSelector
                onAddItem={handleAddItem}
                exchangeRate={currentRate.rate}
                disabled={isProcessing || isRateLocked}
              />

              <OrderItemsTable
                items={orderItems}
                exchangeRate={currentRate.rate}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                disabled={isProcessing}
              />

              <OrderSummary
                totals={totals}
                exchangeRate={currentRate.rate}
                transactionCurrency={transactionCurrency}
                isRateLocked={isRateLocked}
                lockedRate={lockedRate}
                lockedAt={lockedAt}
                itemCount={orderItems.length}
                isPaymentEnabled={isPaymentEnabled}
                disabledReason={getDisabledReason()}
              />

              <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="vp-btn vp-btn-outline px-6 order-2 sm:order-1"
                  disabled={isProcessing}
                >
                  Cancel Order
                </button>
                
                <div className="flex gap-3 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={clearOrder}
                    className="vp-btn vp-btn-outline px-6"
                    disabled={isProcessing || (orderItems.length === 0 && !patientInfo.name && !patientInfo.phone)}
                  >
                    Clear All
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className={`
                      vp-btn px-8 flex items-center gap-2 transition-all duration-200
                      ${isPaymentEnabled && !isProcessing
                        ? 'vp-btn-primary hover:shadow-lg hover:scale-105' 
                        : 'vp-btn-outline opacity-60 cursor-not-allowed bg-gray-100'
                      }
                    `}
                    disabled={!isPaymentEnabled || isProcessing}
                    aria-disabled={!isPaymentEnabled || isProcessing}
                    title={!isPaymentEnabled ? getDisabledReason() : 'Proceed to payment'}
                  >
                    <span aria-hidden="true">→</span>
                    Proceed to Payment
                  </button>
                </div>
              </div>
              
              {!isPaymentEnabled && !validationErrors.length && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 text-lg">ℹ️</span>
                    <div className="text-blue-800">
                      <p className="font-medium mb-1">Complete the following to proceed:</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {!isRateLocked && <li>Lock the exchange rate</li>}
                        {orderItems.length === 0 && <li>Add at least one item to the order</li>}
                        {!patientInfo.name?.trim() && <li>Enter patient name</li>}
                        {!patientInfo.phone?.trim() && <li>Enter patient phone number</li>}
                        {patientInfo.medicalAidProvider && !patientInfo.memberNumber?.trim() && 
                          <li>Enter medical aid member number</li>}
                        {hasPrescriptionItems && !patientInfo.dateOfBirth && 
                          <li>Enter date of birth (required for prescription items)</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {showConfirmCancel && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="vp-card max-w-md w-full">
              <div className="vp-card-header bg-status-error">
                <h2 id="cancel-modal-title" className="text-lg font-semibold">
                  Cancel Order
                </h2>
              </div>
              
              <div className="vp-card-body">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to cancel this order? All items and patient information will be lost.
                </p>
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmCancel(false)}
                    className="vp-btn vp-btn-outline"
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    className="vp-btn vp-btn-danger"
                  >
                    Yes, Cancel Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}