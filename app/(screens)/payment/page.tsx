// app/(screens)/payment/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import PaymentMethodGrid from '@/components/payment/PaymentMethodGrid'
import { useMedicalAidCache } from '@/lib/offline/MedicalAidCache'

// ============================================================================
// TYPES - Explicit, immutable, self-documenting
// ============================================================================

type Currency = 'USD' | 'ZWL'
type PaymentMethodType = 'cash' | 'medical_aid' | 'card' | 'mobile_money' | 'bank' | 'voucher'
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
type MedicalAidStatus = 'not_applied' | 'awarded' | 'shortfall_paid' | 'settled' | 'rejected'

// ============================================================================
// ZIMBABWE PAYMENT METHODS - Complete from VisionPlus
// ============================================================================

const PAYMENT_METHODS = [
  { id: 'cash_usd', name: 'Cash USD', currency: 'USD', type: 'cash', icon: '💵', color: 'bg-green-100', textColor: 'text-green-800', processingTime: 'immediate' },
  { id: 'cash_zwl', name: 'Cash ZWL', currency: 'ZWL', type: 'cash', icon: '💵', color: 'bg-blue-100', textColor: 'text-blue-800', processingTime: 'immediate' },
  { id: 'cimas', name: 'Cimas', currency: 'ZWL', type: 'medical_aid', icon: '🏥', color: 'bg-red-100', textColor: 'text-red-800', processingTime: '30_days' },
  { id: 'first_mutual', name: 'First Mutual', currency: 'ZWL', type: 'medical_aid', icon: '🏥', color: 'bg-red-100', textColor: 'text-red-800', processingTime: '45_days' },
  { id: 'psmas', name: 'PSMAS', currency: 'ZWL', type: 'medical_aid', icon: '🏥', color: 'bg-red-100', textColor: 'text-red-800', processingTime: '60_days' },
  { id: 'liberty', name: 'Liberty Health', currency: 'ZWL', type: 'medical_aid', icon: '🏥', color: 'bg-red-100', textColor: 'text-red-800', processingTime: '30_days' },
  { id: 'old_mutual', name: 'Old Mutual', currency: 'ZWL', type: 'medical_aid', icon: '🏥', color: 'bg-red-100', textColor: 'text-red-800', processingTime: '30_days' },
  { id: 'credit_card', name: 'Credit / Debit Card', currency: 'USD', type: 'card', icon: '💳', color: 'bg-purple-100', textColor: 'text-purple-800', processingTime: 'immediate' },
  { id: 'ecocash', name: 'Ecocash', currency: 'ZWL', type: 'mobile_money', icon: '📱', color: 'bg-teal-100', textColor: 'text-teal-800', processingTime: 'immediate' },
  { id: 'rtgs', name: 'RTGS', currency: 'ZWL', type: 'bank', icon: '🏦', color: 'bg-yellow-100', textColor: 'text-yellow-800', processingTime: '1_2_days' },
  { id: 'gift_voucher', name: 'Gift Voucher', currency: 'USD', type: 'voucher', icon: '🎫', color: 'bg-pink-100', textColor: 'text-pink-800', processingTime: 'immediate' }
] as const

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

const formatCurrency = (amount: number | undefined | null, currency: Currency): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return currency === 'USD' ? '$0.00' : 'ZWL 0.00'
  }
  try {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    }
    return `ZWL ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  } catch {
    return currency === 'USD' ? '$0.00' : 'ZWL 0.00'
  }
}

const formatTime = (date: Date | string | undefined | null): string => {
  if (!date) return '—'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return '—'
    return dateObj.toLocaleTimeString('en-ZW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return '—'
  }
}

const formatDate = (date: Date | string | undefined | null): string => {
  if (!date) return '—'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return '—'
    return dateObj.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

// ============================================================================
// MEDICAL AID WORKFLOW HOOK
// ============================================================================

interface MedicalAidAward {
  readonly id: string
  readonly providerId: string
  readonly providerName: string
  readonly memberNumber: string
  readonly memberName?: string
  readonly claimReference: string
  readonly awardedUSD: number
  readonly awardedZWL: number
  readonly awardedAt: Date
  readonly awardedBy: string
  readonly status: MedicalAidStatus
  readonly shortfallUSD: number
  readonly shortfallZWL: number
  readonly shortfallPaidAt?: Date
  readonly shortfallPaymentMethod?: string
  readonly shortfallReceiptNumber?: string
  readonly settledAt?: Date
  readonly settlementReference?: string
  readonly expectedSettlementDays: number
}

interface Payment {
  readonly id: string
  readonly paymentNumber: string
  readonly methodId: string
  readonly methodName: string
  readonly methodType: PaymentMethodType
  readonly currency: Currency
  readonly amount: number
  readonly equivalentUSD: number
  readonly equivalentZWL: number
  readonly timestamp: Date
  readonly reference?: string
  readonly status: PaymentStatus
  readonly capturedBy: string
  readonly terminalId?: string
}

interface Order {
  readonly id: string
  readonly patientName: string
  readonly patientId: string
  readonly patientPhone?: string
  readonly patientDateOfBirth?: string
  readonly medicalAidProvider?: string
  readonly memberNumber?: string
  readonly memberName?: string
  readonly subtotalUSD: number
  readonly subtotalZWL: number
  readonly taxUSD: number
  readonly taxZWL: number
  readonly totalUSD: number
  readonly totalZWL: number
  readonly exchangeRate: number
  readonly rateLockedAt: Date
  readonly rateSource: string
  readonly items: Array<{
    name: string
    quantity: number
    priceUSD: number
    priceZWL: number
    requiresPrescription?: boolean
  }>
}

function useMedicalAidPayment() {
  const [award, setAward] = useState<MedicalAidAward | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAward = useCallback((
    providerId: string,
    providerName: string,
    memberNumber: string,
    memberName: string | undefined,
    awardedUSD: number,
    exchangeRate: number,
    userId: string,
    userName: string
  ): { success: boolean; award?: MedicalAidAward; error?: string } => {
    if (awardedUSD <= 0) {
      return { success: false, error: 'Award amount must be greater than zero' }
    }

    const provider = PAYMENT_METHODS.find(p => p.id === providerId)
    const processingDays = provider?.processingTime === '30_days' ? 30 :
                          provider?.processingTime === '45_days' ? 45 :
                          provider?.processingTime === '60_days' ? 60 : 30

    const newAward: MedicalAidAward = {
      id: `MA-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      providerId,
      providerName,
      memberNumber,
      memberName,
      claimReference: `${providerId.toUpperCase()}-${Date.now().toString().slice(-8)}`,
      awardedUSD,
      awardedZWL: awardedUSD * exchangeRate,
      awardedAt: new Date(),
      awardedBy: userName,
      status: 'awarded',
      shortfallUSD: 0,
      shortfallZWL: 0,
      expectedSettlementDays: processingDays
    }

    setAward(newAward)
    return { success: true, award: newAward }
  }, [])

  const recordShortfallPayment = useCallback((
    awardId: string,
    shortfallUSD: number,
    exchangeRate: number,
    paymentMethod: string,
    receiptNumber: string,
    userId: string,
    userName: string
  ): { success: boolean; error?: string } => {
    if (!award || award.id !== awardId) {
      return { success: false, error: 'Award not found' }
    }
    if (shortfallUSD <= 0) {
      return { success: false, error: 'Shortfall amount must be greater than zero' }
    }
    if (award.shortfallPaidAt) {
      return { success: false, error: 'Shortfall already paid' }
    }

    const shortfallZWL = shortfallUSD * exchangeRate

    setAward({
      ...award,
      shortfallUSD,
      shortfallZWL,
      shortfallPaidAt: new Date(),
      shortfallPaymentMethod: paymentMethod,
      shortfallReceiptNumber: receiptNumber,
      status: 'shortfall_paid'
    })

    return { success: true }
  }, [award])

  const markAsSettled = useCallback((
    awardId: string,
    settlementReference: string,
    userId: string,
    userName: string
  ): { success: boolean; error?: string } => {
    if (!award || award.id !== awardId) {
      return { success: false, error: 'Award not found' }
    }
    if (award.status === 'settled') {
      return { success: false, error: 'Award already settled' }
    }
    setAward({
      ...award,
      status: 'settled',
      settledAt: new Date(),
      settlementReference
    })
    return { success: true }
  }, [award])

  const rejectAward = useCallback((
    awardId: string,
    reason: string,
    userId: string,
    userName: string
  ): { success: boolean; error?: string } => {
    if (!award || award.id !== awardId) {
      return { success: false, error: 'Award not found' }
    }
    setAward({
      ...award,
      status: 'rejected'
    })
    return { success: true }
  }, [award])

  const clearAward = useCallback(() => {
    setAward(null)
    setError(null)
  }, [])

  return {
    award,
    isProcessing,
    error,
    setError,
    createAward,
    recordShortfallPayment,
    markAsSettled,
    rejectAward,
    clearAward
  }
}

// ============================================================================
// PAYMENT PROCESSING HOOK
// ============================================================================

function usePaymentProcessing() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentCounter, setPaymentCounter] = useState(1)

  const generatePaymentNumber = useCallback((): string => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const sequence = String(paymentCounter).padStart(4, '0')
    setPaymentCounter(prev => prev + 1)
    return `PAY-${year}${month}${day}-${sequence}`
  }, [paymentCounter])

  const addPayment = useCallback((
    methodId: string,
    methodName: string,
    methodType: PaymentMethodType,
    currency: Currency,
    amount: number,
    exchangeRate: number,
    reference: string | undefined,
    userId: string,
    terminalId?: string
  ): Payment => {
    const equivalentUSD = currency === 'USD' ? amount : amount / exchangeRate
    const equivalentZWL = currency === 'ZWL' ? amount : amount * exchangeRate

    const newPayment: Payment = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      paymentNumber: generatePaymentNumber(),
      methodId,
      methodName,
      methodType,
      currency,
      amount,
      equivalentUSD,
      equivalentZWL,
      timestamp: new Date(),
      reference,
      status: 'completed',
      capturedBy: userId,
      terminalId
    }

    setPayments(prev => [...prev, newPayment])
    return newPayment
  }, [generatePaymentNumber])

  const removePayment = useCallback((paymentId: string) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId))
  }, [])

  const clearPayments = useCallback(() => {
    setPayments([])
    setPaymentCounter(1)
  }, [])

  const calculateTotals = useCallback((exchangeRate: number) => {
    const totalPaidUSD = payments.reduce((sum, p) => sum + (p.equivalentUSD || 0), 0)
    const totalPaidZWL = payments.reduce((sum, p) => sum + (p.equivalentZWL || 0), 0)
    return {
      totalPaidUSD,
      totalPaidZWL,
      paymentCount: payments.length,
      paymentMethods: [...new Set(payments.map(p => p.methodName))],
      paymentsByCurrency: {
        USD: payments.filter(p => p.currency === 'USD').reduce((sum, p) => sum + (p.amount || 0), 0),
        ZWL: payments.filter(p => p.currency === 'ZWL').reduce((sum, p) => sum + (p.amount || 0), 0)
      }
    }
  }, [payments])

  return {
    payments,
    addPayment,
    removePayment,
    clearPayments,
    calculateTotals
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

interface MedicalAidAwardCardProps {
  award: MedicalAidAward
  orderTotalUSD: number
  orderTotalZWL: number
  exchangeRate: number
  onRecordShortfall: (awardId: string) => void
  onMarkSettled: (awardId: string) => void
  onReject: (awardId: string) => void
  disabled?: boolean
}

const MedicalAidAwardCard = ({
  award,
  orderTotalUSD,
  orderTotalZWL,
  exchangeRate,
  onRecordShortfall,
  onMarkSettled,
  onReject,
  disabled = false
}: MedicalAidAwardCardProps) => {
  const shortfallUSD = orderTotalUSD - award.awardedUSD
  const shortfallZWL = orderTotalZWL - award.awardedZWL
  const shortfallPaid = award.shortfallPaidAt !== undefined

  const getStatusBadge = () => {
    switch (award.status) {
      case 'awarded':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Awarded</span>
      case 'shortfall_paid':
        return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">Shortfall Paid</span>
      case 'settled':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Settled</span>
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Rejected</span>
      default:
        return null
    }
  }

  const expectedSettlementDate = new Date(award.awardedAt)
  expectedSettlementDate.setDate(expectedSettlementDate.getDate() + award.expectedSettlementDays)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-xl">🏥</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">{award.providerName}</h3>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-gray-600">
                Member: {award.memberNumber} {award.memberName && `(${award.memberName})`}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                Claim: {award.claimReference}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Awarded by</div>
            <div className="font-medium">{award.awardedBy}</div>
            <div className="text-xs text-gray-500">{formatDate(award.awardedAt)}</div>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Order Total</div>
          <div className="text-lg font-bold text-vp-primary">
            {formatCurrency(orderTotalUSD, 'USD')}
          </div>
          <div className="text-xs text-gray-500">
            {formatCurrency(orderTotalZWL, 'ZWL')}
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Awarded</div>
          <div className="text-lg font-bold text-currency-usd">
            {formatCurrency(award.awardedUSD, 'USD')}
          </div>
          <div className="text-xs text-gray-500">
            {formatCurrency(award.awardedZWL, 'ZWL')}
          </div>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Shortfall</div>
          <div className="text-lg font-bold text-orange-600">
            {formatCurrency(shortfallUSD, 'USD')}
          </div>
          <div className="text-xs text-gray-500">
            {formatCurrency(shortfallZWL, 'ZWL')}
          </div>
          {award.shortfallPaidAt && (
            <div className="mt-1 text-xs text-green-600">
              Paid {formatDate(award.shortfallPaidAt)}
            </div>
          )}
        </div>
        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Settlement</div>
          <div className="text-sm font-medium">
            {award.settledAt ? (
              <span className="text-green-600">Paid {formatDate(award.settledAt)}</span>
            ) : (
              <>
                <div>Expected by</div>
                <div className="font-bold">{formatDate(expectedSettlementDate)}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-3">
        {award.status === 'awarded' && shortfallUSD > 0 && !award.shortfallPaidAt && (
          <button
            type="button"
            onClick={() => onRecordShortfall(award.id)}
            className="vp-btn vp-btn-warning flex items-center gap-2"
            disabled={disabled}
          >
            <span>💰</span>
            Record Shortfall Payment
          </button>
        )}
        {award.status === 'shortfall_paid' && (
          <button
            type="button"
            onClick={() => onMarkSettled(award.id)}
            className="vp-btn vp-btn-success flex items-center gap-2"
            disabled={disabled}
          >
            <span>✅</span>
            Mark as Settled
          </button>
        )}
        {award.status === 'awarded' && (
          <button
            type="button"
            onClick={() => onReject(award.id)}
            className="vp-btn vp-btn-outline text-status-error border-status-error hover:bg-red-50"
            disabled={disabled}
          >
            Reject Award
          </button>
        )}
      </div>
    </div>
  )
}

interface MedicalAidAwardFormProps {
  orderTotalUSD: number
  exchangeRate: number
  onSubmit: (providerId: string, memberNumber: string, memberName: string | undefined, awardedUSD: number) => void
  onCancel: () => void
  isProcessing?: boolean
}

const MedicalAidAwardForm = ({
  orderTotalUSD,
  exchangeRate,
  onSubmit,
  onCancel,
  isProcessing = false
}: MedicalAidAwardFormProps) => {
  const [providerId, setProviderId] = useState('')
  const [memberNumber, setMemberNumber] = useState('')
  const [memberName, setMemberName] = useState('')
  const [awardedUSD, setAwardedUSD] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const medicalAidProviders = PAYMENT_METHODS.filter(p => p.type === 'medical_aid')

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!providerId) newErrors.provider = 'Please select a medical aid provider'
    if (!memberNumber.trim()) newErrors.memberNumber = 'Member number is required'
    const amount = parseFloat(awardedUSD)
    if (!awardedUSD || isNaN(amount)) newErrors.awarded = 'Award amount is required'
    else if (amount <= 0) newErrors.awarded = 'Award amount must be greater than zero'
    else if (amount > orderTotalUSD) newErrors.awarded = 'Award amount cannot exceed order total'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(
        providerId,
        memberNumber.trim(),
        memberName.trim() || undefined,
        parseFloat(awardedUSD)
      )
    }
  }

  const selectedProvider = medicalAidProviders.find(p => p.id === providerId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="provider" className="vp-form-label">
            Medical Aid Provider <span className="text-status-error">*</span>
          </label>
          <select
            id="provider"
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value)
              setErrors({})
            }}
            className={`vp-form-control ${errors.provider ? 'border-status-error' : ''}`}
            disabled={isProcessing}
          >
            <option value="">Select provider...</option>
            {medicalAidProviders.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          {errors.provider && <p className="mt-1 text-sm text-status-error">{errors.provider}</p>}
        </div>
        <div>
          <label htmlFor="memberNumber" className="vp-form-label">
            Member Number <span className="text-status-error">*</span>
          </label>
          <input
            id="memberNumber"
            type="text"
            value={memberNumber}
            onChange={(e) => {
              setMemberNumber(e.target.value)
              setErrors({})
            }}
            className={`vp-form-control ${errors.memberNumber ? 'border-status-error' : ''}`}
            placeholder="e.g., CIM-123456"
            disabled={isProcessing}
          />
          {errors.memberNumber && <p className="mt-1 text-sm text-status-error">{errors.memberNumber}</p>}
        </div>
        <div>
          <label htmlFor="memberName" className="vp-form-label">
            Member Name (if different)
          </label>
          <input
            id="memberName"
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            className="vp-form-control"
            placeholder="Full name on medical aid"
            disabled={isProcessing}
          />
        </div>
        <div>
          <label htmlFor="awardedAmount" className="vp-form-label">
            Awarded Amount (USD) <span className="text-status-error">*</span>
          </label>
          <div className="relative">
            <input
              id="awardedAmount"
              type="number"
              value={awardedUSD}
              onChange={(e) => {
                setAwardedUSD(e.target.value)
                setErrors({})
              }}
              className={`vp-form-control pl-10 ${errors.awarded ? 'border-status-error' : ''}`}
              placeholder="0.00"
              min="0.01"
              max={orderTotalUSD}
              step="0.01"
              disabled={isProcessing}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-currency-usd">$</div>
          </div>
          {errors.awarded && <p className="mt-1 text-sm text-status-error">{errors.awarded}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="vp-btn vp-btn-outline" disabled={isProcessing}>
          Cancel
        </button>
        <button type="submit" className="vp-btn vp-btn-primary" disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Set Award'}
        </button>
      </div>
    </form>
  )
}

// ============================================================================
// ✅ FIXED: PAYMENT FORM COMPONENT - No HTML5 validation errors
// ============================================================================

interface PaymentFormProps {
  selectedMethodId: string
  onMethodSelect: (methodId: string) => void
  transactionCurrency: Currency
  exchangeRate: number
  order: Order | null
  maxAmountUSD: number
  maxAmountZWL: number
  onPaymentSubmit: (amount: number, reference?: string) => void
  isProcessing?: boolean
}

const PaymentForm = ({
  selectedMethodId,
  onMethodSelect,
  transactionCurrency,
  exchangeRate,
  order,
  maxAmountUSD,
  maxAmountZWL,
  onPaymentSubmit,
  isProcessing = false
}: PaymentFormProps) => {
  const [amount, setAmount] = useState<string>('')
  const [reference, setReference] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedMethodId)
  const paymentCurrency = selectedMethod?.currency || transactionCurrency
  
  // ✅ FIX: Safe max amount calculation
  const safeMaxAmount = useMemo(() => {
    if (!order) return 0
    
    if (paymentCurrency === 'USD') {
      return typeof maxAmountUSD === 'number' && !isNaN(maxAmountUSD) && maxAmountUSD > 0 
        ? maxAmountUSD 
        : order.totalUSD
    } else {
      return typeof maxAmountZWL === 'number' && !isNaN(maxAmountZWL) && maxAmountZWL > 0 
        ? maxAmountZWL 
        : order.totalZWL
    }
  }, [paymentCurrency, maxAmountUSD, maxAmountZWL, order])

  // ✅ FIX: Validation with safe checks
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!amount || amount.trim() === '') {
      newErrors.amount = 'Please enter an amount'
      setErrors(newErrors)
      return false
    }

    const amountValue = parseFloat(amount)
    if (isNaN(amountValue)) {
      newErrors.amount = 'Please enter a valid number'
      setErrors(newErrors)
      return false
    }

    if (amountValue <= 0) {
      newErrors.amount = 'Amount must be greater than zero'
      setErrors(newErrors)
      return false
    }

    if (safeMaxAmount > 0 && amountValue > safeMaxAmount) {
      newErrors.amount = `Amount exceeds balance due of ${formatCurrency(safeMaxAmount, paymentCurrency)}`
      setErrors(newErrors)
      return false
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      const amountValue = parseFloat(amount)
      onPaymentSubmit(amountValue, reference.trim() || undefined)
      setAmount('')
      setReference('')
      setErrors({})
    }
  }

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString())
    setErrors({})
  }

  // ✅ FIX: Show loading state while order loads
  if (!order) {
    return (
      <div className="vp-card">
        <div className="vp-card-body text-center py-8">
          <div className="w-8 h-8 border-2 border-vp-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading order information...</p>
        </div>
      </div>
    )
  }

  // ✅ FIX: Only show "No Balance Due" when order is TRULY paid
  const hasBalanceDue = order.totalUSD > 0 && safeMaxAmount > 0

  if (!hasBalanceDue) {
    return (
      <div className="vp-card">
        <div className="vp-card-body text-center py-8">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            No Balance Due
          </h3>
          <p className="text-sm text-gray-500">
            This order is fully paid. Click "Complete Transaction" to finish.
          </p>
        </div>
      </div>
    )
  }

  if (!selectedMethod) {
    return (
      <div className="vp-card">
        <div className="vp-card-body text-center py-12">
          <div className="text-4xl mb-4">💳</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Select a Payment Method
          </h3>
          <p className="text-sm text-gray-500">
            Choose a payment method from the grid above to continue
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="vp-card">
      <div className="vp-card-header flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedMethod.color}`}>
          <span className={selectedMethod.textColor}>{selectedMethod.icon}</span>
        </div>
        <div>
          <span className="font-bold">{selectedMethod.name}</span>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
            selectedMethod.currency === 'USD' 
              ? 'bg-currency-usd/20 text-currency-usd' 
              : 'bg-currency-zwl/20 text-currency-zwl'
          }`}>
            {selectedMethod.currency}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="vp-card-body">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label htmlFor="payment-amount" className="vp-form-label">
                Payment Amount <span className="text-status-error">*</span>
              </label>
              <div className="relative">
                <input
                  id="payment-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setErrors({})
                  }}
                  className={`vp-form-control pl-16 pr-24 text-lg ${
                    errors.amount ? 'border-status-error' : ''
                  } ${paymentCurrency === 'USD' ? 'border-currency-usd' : 'border-currency-zwl'}`}
                  placeholder="0.00"
                  // ✅ CRITICAL FIX: Only set min/max if safeMaxAmount > 0
                  min={safeMaxAmount > 0 ? "0.01" : undefined}
                  max={safeMaxAmount > 0 ? safeMaxAmount : undefined}
                  step="0.01"
                  disabled={isProcessing}
                  autoFocus
                />
                <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  paymentCurrency === 'USD' ? 'text-currency-usd' : 'text-currency-zwl'
                }`}>
                  <span className="font-medium">{paymentCurrency === 'USD' ? '$' : 'ZW$'}</span>
                </div>
                
                {safeMaxAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(safeMaxAmount)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-vp-secondary hover:text-vp-primary font-medium"
                    disabled={isProcessing}
                  >
                    MAX
                  </button>
                )}
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-status-error">{errors.amount}</p>
              )}
              {safeMaxAmount > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Balance due: {formatCurrency(safeMaxAmount, paymentCurrency)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">Quick Amounts</label>
              <div className="flex flex-wrap gap-2">
                {[10, 20, 50, 100, 200].map(value => {
                  const displayValue = paymentCurrency === 'USD' ? value : value * exchangeRate
                  const isDisabled = displayValue > safeMaxAmount
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleQuickAmount(displayValue)}
                      disabled={isDisabled || isProcessing}
                      className={`
                        px-3 py-1.5 text-sm rounded-lg border transition-all
                        ${paymentCurrency === 'USD'
                          ? 'border-currency-usd/30 text-currency-usd hover:bg-currency-usd/10'
                          : 'border-currency-zwl/30 text-currency-zwl hover:bg-currency-zwl/10'
                        }
                        ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                      `}
                    >
                      {paymentCurrency === 'USD' ? `$${value}` : `ZW$${value}`}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Payment Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">{selectedMethod.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Currency:</span>
                <span className={`font-medium ${
                  paymentCurrency === 'USD' ? 'text-currency-usd' : 'text-currency-zwl'
                }`}>
                  {paymentCurrency}
                </span>
              </div>
              {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-bold">
                      {formatCurrency(parseFloat(amount), paymentCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">
                      Equivalent in {paymentCurrency === 'USD' ? 'ZWL' : 'USD'}:
                    </span>
                    <span className={`font-medium ${
                      paymentCurrency === 'USD' ? 'text-currency-zwl' : 'text-currency-usd'
                    }`}>
                      {paymentCurrency === 'USD' 
                        ? formatCurrency(parseFloat(amount) * exchangeRate, 'ZWL')
                        : formatCurrency(parseFloat(amount) / exchangeRate, 'USD')
                      }
                    </span>
                  </div>
                </>
              )}
              <div className="pt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span>💰</span>
                  <span>Balance after payment:</span>
                </div>
                <div className="mt-1 font-mono font-medium">
                  {formatCurrency(
                    Math.max(0, safeMaxAmount - (parseFloat(amount) || 0)), 
                    paymentCurrency
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="vp-btn vp-btn-primary px-8 py-3 flex items-center gap-2"
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          >
            <span>➕</span>
            {isProcessing ? 'Processing...' : 'Add Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// PAYMENT HISTORY COMPONENT
// ============================================================================

interface PaymentHistoryProps {
  payments: Payment[]
  exchangeRate: number
  onRemovePayment: (paymentId: string) => void
  disabled?: boolean
}

const PaymentHistory = ({
  payments,
  exchangeRate,
  onRemovePayment,
  disabled = false
}: PaymentHistoryProps) => {
  if (payments.length === 0) return null

  const totalUSD = payments.reduce((sum, p) => sum + (p.equivalentUSD || 0), 0)
  const totalZWL = payments.reduce((sum, p) => sum + (p.equivalentZWL || 0), 0)

  return (
    <div className="vp-card">
      <div className="vp-card-header flex justify-between items-center">
        <span>Payment History</span>
        <span className="text-sm bg-white/20 px-2 py-1 rounded">
          {payments.length} payment{payments.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="vp-card-body p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Payment #</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">USD Eq</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ZWL Eq</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map(payment => {
                const method = PAYMENT_METHODS.find(m => m.id === payment.methodId)
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-600">{formatTime(payment.timestamp)}</td>
                    <td className="p-3 text-xs font-mono text-gray-600">{payment.paymentNumber}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${method?.color}`}>
                          <span className="text-xs">{method?.icon}</span>
                        </div>
                        <span className="text-sm">{payment.methodName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`font-medium ${
                        payment.currency === 'USD' ? 'text-currency-usd' : 'text-currency-zwl'
                      }`}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                    </td>
                    <td className="p-3 text-right text-currency-usd">
                      {formatCurrency(payment.equivalentUSD, 'USD')}
                    </td>
                    <td className="p-3 text-right text-currency-zwl">
                      {formatCurrency(payment.equivalentZWL, 'ZWL')}
                    </td>
                    <td className="p-3 text-xs font-mono text-gray-600">
                      {payment.reference || '—'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemovePayment(payment.id)}
                        className="text-status-error hover:text-red-700 text-sm"
                        disabled={disabled}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={3} className="p-3 text-sm">Total Payments</td>
                <td className="p-3 text-right">{formatCurrency(totalZWL, 'ZWL')}</td>
                <td className="p-3 text-right text-currency-usd">{formatCurrency(totalUSD, 'USD')}</td>
                <td className="p-3 text-right text-currency-zwl">{formatCurrency(totalZWL, 'ZWL')}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// TRANSACTION SUMMARY COMPONENT
// ============================================================================

// ============================================================================
// TRANSACTION SUMMARY COMPONENT - FIXED
// - Separates Medical Aid AWARDS from Medical Aid PAYMENTS
// - Shows correct categorization of PSMAS/Ecocash/etc. payments
// ============================================================================

interface TransactionSummaryProps {
  order: Order
  payments: Payment[]
  award: MedicalAidAward | null
  exchangeRate: number
  transactionCurrency: Currency
  isRateLocked: boolean
  lockedAt: Date | null
  onComplete: () => void
  onCancel: () => void
  onSaveDraft: () => void
  isProcessing?: boolean
}

const TransactionSummary = ({
  order,
  payments,
  award,
  exchangeRate,
  transactionCurrency,
  isRateLocked,
  lockedAt,
  onComplete,
  onCancel,
  onSaveDraft,
  isProcessing = false
}: TransactionSummaryProps) => {
  
  // ✅ FIX 1: Separate Medical Aid AWARD (to be paid later)
  const awardAmountUSD = award?.awardedUSD || 0
  const awardAmountZWL = award?.awardedZWL || 0
  
  // ✅ FIX 2: Separate Medical Aid PAYMENTS (paid now via PSMAS, Cimas, Ecocash, etc.)
  const medicalAidPaymentsUSD = payments
    .filter(p => p.methodType === 'medical_aid')
    .reduce((sum, p) => sum + (p.equivalentUSD || 0), 0)
  
  const medicalAidPaymentsZWL = payments
    .filter(p => p.methodType === 'medical_aid')
    .reduce((sum, p) => sum + (p.equivalentZWL || 0), 0)
  
  // ✅ FIX 3: Cash, Card, Mobile Money, Bank, Voucher (non-medical aid)
  const cashPaymentsUSD = payments
    .filter(p => p.methodType !== 'medical_aid')
    .reduce((sum, p) => sum + (p.equivalentUSD || 0), 0)
  
  const cashPaymentsZWL = payments
    .filter(p => p.methodType !== 'medical_aid')
    .reduce((sum, p) => sum + (p.equivalentZWL || 0), 0)
  
  // ✅ Total paid = Award + Medical Aid Payments + Cash Payments
  const totalPaidUSD = awardAmountUSD + medicalAidPaymentsUSD + cashPaymentsUSD
  const totalPaidZWL = awardAmountZWL + medicalAidPaymentsZWL + cashPaymentsZWL
  
  // ✅ Balance calculations
  const balanceUSD = order.totalUSD - totalPaidUSD
  const balanceZWL = order.totalZWL - totalPaidZWL
  
  const isPaidInFull = balanceUSD <= 0.01 && balanceZWL <= 0.01
  const isOverpaid = balanceUSD < -0.01 || balanceZWL < -0.01

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

  // Get unique medical aid providers for display
  const medicalAidProviders = [...new Set(
    payments
      .filter(p => p.methodType === 'medical_aid')
      .map(p => p.methodName)
  )].join(', ')

  return (
    <div className="vp-card">
      <div className="vp-card-header">
        Transaction Summary
      </div>
      
      <div className="vp-card-body">
        {/* ======================================================================
            SUMMARY GRID - FIXED: 4 columns showing correct categorizations
            1. Order Total
            2. Medical Aid AWARD (pending settlement)
            3. Medical Aid PAYMENTS (paid now via medical aid)
            4. Cash & Card Payments (non-medical aid)
            5. Balance Due
           ====================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* 1️⃣ ORDER TOTAL - Unchanged */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
              Order Total
            </p>
            <p className="text-xl font-bold text-vp-primary">
              {formatCurrency(order.totalUSD, 'USD')}
            </p>
            <p className="text-sm text-gray-500">
              {formatCurrency(order.totalZWL, 'ZWL')}
            </p>
          </div>
          
          {/* 2️⃣ MEDICAL AID AWARD - Amount to be paid LATER by provider */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
              Medical Aid Award
            </p>
            <p className="text-xl font-bold text-currency-usd">
              {formatCurrency(awardAmountUSD, 'USD')}
            </p>
            <p className="text-sm text-gray-500">
              {formatCurrency(awardAmountZWL, 'ZWL')}
            </p>
            {award && (
              <p className="text-xs text-gray-500 mt-1">
                {award.providerName} • settles in {award.expectedSettlementDays} days
              </p>
            )}
            {!award && (
              <p className="text-xs text-gray-400 mt-1">
                No award recorded
              </p>
            )}
          </div>
          
          {/* 3️⃣ MEDICAL AID PAYMENTS - Paid NOW via PSMAS, Cimas, Ecocash, etc. */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
              Medical Aid Payments
            </p>
            <p className="text-xl font-bold text-currency-usd">
              {formatCurrency(medicalAidPaymentsUSD, 'USD')}
            </p>
            <p className="text-sm text-gray-500">
              {formatCurrency(medicalAidPaymentsZWL, 'ZWL')}
            </p>
            {medicalAidPaymentsUSD > 0 && (
              <p className="text-xs text-gray-500 mt-1 truncate" title={medicalAidProviders}>
                {medicalAidProviders || 'Medical aid payments'}
              </p>
            )}
            {medicalAidPaymentsUSD === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No medical aid payments
              </p>
            )}
          </div>
          
          {/* 4️⃣ CASH & CARD PAYMENTS - Non-medical aid (Cash, Card, Mobile Money, etc.) */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
              Cash & Card Payments
            </p>
            <p className="text-xl font-bold text-currency-usd">
              {formatCurrency(cashPaymentsUSD, 'USD')}
            </p>
            <p className="text-sm text-gray-500">
              {formatCurrency(cashPaymentsZWL, 'ZWL')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {payments.filter(p => p.methodType !== 'medical_aid').length} payment(s)
            </p>
          </div>
          
          {/* 5️⃣ BALANCE DUE - Spans 2 columns on mobile, 1 on desktop */}
          <div className={`lg:col-span-1 md:col-span-2 col-span-1 p-4 rounded-lg border ${
            isPaidInFull ? 'bg-emerald-50 border-emerald-200' :
            isOverpaid ? 'bg-yellow-50 border-yellow-200' :
            'bg-orange-50 border-orange-200'
          }`}>
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
              {isPaidInFull ? 'Paid in Full' : isOverpaid ? 'Overpayment' : 'Balance Due'}
            </p>
            <p className={`text-2xl font-bold ${
              isPaidInFull ? 'text-emerald-600' :
              isOverpaid ? 'text-yellow-600' :
              'text-orange-600'
            }`}>
              {formatCurrency(Math.abs(balanceZWL), transactionCurrency)}
            </p>
            <p className="text-sm text-gray-500">
              {formatCurrency(Math.abs(balanceUSD), 'USD')}
            </p>
            {isPaidInFull && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <span>✅</span>
                <span>Ready to complete</span>
              </p>
            )}
          </div>
        </div>

        {/* Exchange Rate Lock Info - Unchanged */}
        {isRateLocked && lockedAt && (
          <div className="mb-6 p-4 bg-currency-locked/10 rounded-lg border border-currency-locked/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-currency-locked">🔒</span>
              <span className="font-medium text-currency-locked">Exchange Rate Locked</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 text-xs">Rate:</span>
                <div className="font-medium">1 USD = {exchangeRate.toLocaleString()} ZWL</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Locked at:</span>
                <div className="font-medium">{formatDate(lockedAt)}</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Order:</span>
                <div className="font-medium">#{order.id}</div>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Patient:</span>
                <div className="font-medium">{order.patientName}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Unchanged */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="vp-btn vp-btn-outline px-6 order-2 sm:order-1"
            disabled={isProcessing}
          >
            Cancel Transaction
          </button>
          
          <div className="flex gap-3 order-1 sm:order-2">
            <button
              type="button"
              onClick={onSaveDraft}
              className="vp-btn vp-btn-outline px-6"
              disabled={isProcessing}
            >
              Save Draft
            </button>
            
            {isPaidInFull ? (
              <button
                type="button"
                onClick={onComplete}
                className="vp-btn vp-btn-success px-8 flex items-center gap-2"
                disabled={isProcessing}
              >
                <span>✅</span>
                Complete Transaction
              </button>
            ) : (
              <button
                type="button"
                className="vp-btn vp-btn-primary px-8 opacity-50 cursor-not-allowed"
                disabled={true}
              >
                Balance Due: {formatCurrency(balanceZWL, transactionCurrency)}
              </button>
            )}
          </div>
        </div>

        {/* Medical Aid Settlement Notice - Updated to reflect both awards AND payments */}
        {(award || medicalAidPaymentsUSD > 0) && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-blue-600">ℹ️</span>
              <div className="text-gray-700">
                {award && award.status !== 'settled' && award.status !== 'rejected' && (
                  <p className="mb-1">
                    <span className="font-medium">Medical Aid Award Pending:</span>{' '}
                    {award.providerName} award of {formatCurrency(award.awardedUSD, 'USD')} 
                    will be settled in approximately {award.expectedSettlementDays} days.
                  </p>
                )}
                {medicalAidPaymentsUSD > 0 && (
                  <p>
                    <span className="font-medium">Medical Aid Payments Received:</span>{' '}
                    {formatCurrency(medicalAidPaymentsUSD, 'USD')} paid via {medicalAidProviders}.
                    {award?.shortfallPaidAt && ' Shortfall has been paid.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// ============================================================================
// MAIN PAYMENT SCREEN COMPONENT - FIXED
// ============================================================================

export default function PaymentScreen() {
  const router = useRouter()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>('ZWL')
  const [exchangeRate, setExchangeRate] = useState(1250)
  const [isRateLocked, setIsRateLocked] = useState(false)
  const [lockedAt, setLockedAt] = useState<Date | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showMedicalAidForm, setShowMedicalAidForm] = useState(false)

   // ===== CUSTOM HOOKS - GROUPED TOGETHER =====
  
  const { award, createAward, recordShortfallPayment, markAsSettled, rejectAward, clearAward } = useMedicalAidPayment()
  const { payments, addPayment, removePayment, clearPayments, calculateTotals } = usePaymentProcessing()

    // >>> ADD THE CACHE HOOK HERE <<<
  const medicalAidCache = useMedicalAidCache()



  // ✅ FIX: Load order from sessionStorage with proper type casting
  useEffect(() => {
    try {
      const savedOrder = sessionStorage.getItem('current_order')
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder)
        console.log('📦 Payment screen - Loading order:', parsed)
        
        // Ensure all required fields exist
        const orderData: Order = {
          id: parsed.id || parsed.orderId || 'ORD-2024-001',
          patientName: parsed.patientName || 'Joyce Mwale',
          patientId: parsed.patientId || 'PT-2027',
          patientPhone: parsed.patientPhone || '',
          patientDateOfBirth: parsed.patientDateOfBirth,
          medicalAidProvider: parsed.medicalAidProvider,
          memberNumber: parsed.memberNumber,
          memberName: parsed.memberName,
          subtotalUSD: parsed.subtotalUSD || 25,
          subtotalZWL: parsed.subtotalZWL || 32.5,
          taxUSD: parsed.taxUSD || 37.5,
          taxZWL: parsed.taxZWL || 46875,
          totalUSD: parsed.totalUSD || 287.5,
          totalZWL: parsed.totalZWL || 359375,
          exchangeRate: parsed.exchangeRate || 1250,
          rateLockedAt: parsed.rateLockedAt ? new Date(parsed.rateLockedAt) : new Date(),
          rateSource: parsed.rateSource || 'reserve_bank',
          items: parsed.items || []
        }
        
        setOrder(orderData)
        setExchangeRate(orderData.exchangeRate)
        setIsRateLocked(parsed.isRateLocked || false)
        setLockedAt(orderData.rateLockedAt)
        setTransactionCurrency(parsed.transactionCurrency || 'ZWL')
      } else {
        // Demo mode - create sample order
        const demoOrder: Order = {
          id: 'ORD-2024-001',
          patientName: 'Joyce Mwale',
          patientId: 'PT-2027',
          patientPhone: '+263 77 123 4567',
          subtotalUSD: 250,
          subtotalZWL: 312500,
          taxUSD: 37.5,
          taxZWL: 46875,
          totalUSD: 287.5,
          totalZWL: 359375,
          exchangeRate: 1250,
          rateLockedAt: new Date(),
          rateSource: 'reserve_bank',
          items: [
            { name: 'Ray-Ban Aviator', quantity: 1, priceUSD: 120, priceZWL: 150000 },
            { name: 'Progressive Lenses', quantity: 1, priceUSD: 130, priceZWL: 162500 }
          ]
        }
        setOrder(demoOrder)
        setIsRateLocked(true)
        setLockedAt(new Date())
      }
    } catch (err) {
      console.error('Failed to load order:', err)
      setError('Failed to load order information')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ✅ FIX: Calculate totals with proper balance
  const totals = useMemo(() => {
    if (!order) return null
    
    const paymentTotals = calculateTotals(exchangeRate)
    const medicalAidUSD = award?.awardedUSD || 0
    const medicalAidZWL = award?.awardedZWL || 0
    
    const totalPaidUSD = paymentTotals.totalPaidUSD + medicalAidUSD
    const totalPaidZWL = paymentTotals.totalPaidZWL + medicalAidZWL
    
    const balanceUSD = order.totalUSD - totalPaidUSD
    const balanceZWL = order.totalZWL - totalPaidZWL
    
    console.log('💰 Payment screen - Totals:', {
      orderTotalUSD: order.totalUSD,
      totalPaidUSD,
      balanceUSD
    })
    
    return {
      ...paymentTotals,
      medicalAidUSD,
      medicalAidZWL,
      totalPaidUSD,
      totalPaidZWL,
      balanceUSD,
      balanceZWL,
      shortfallUSD: award ? order.totalUSD - award.awardedUSD : order.totalUSD,
      shortfallZWL: award ? order.totalZWL - award.awardedZWL : order.totalZWL,
      isPaidInFull: balanceUSD <= 0.01 && balanceZWL <= 0.01,
      isOverpaid: balanceUSD < -0.01 || balanceZWL < -0.01
    }
  }, [order, payments, award, exchangeRate, calculateTotals])

  // Handlers

// ============================================================================
// ✅ FIXED: Handle Add Payment - NOW RECORDS MEDICAL AID PAYMENTS TO CLAIMS
// ============================================================================
// ============================================================================
// ✅ FIXED: Handle Add Payment - MEDICAL AID PAYMENTS = AWARD
// ============================================================================
const handleAddPayment = useCallback(async (amount: number, reference?: string) => {
  if (!order || !selectedPaymentMethod) return
  
  setIsProcessing(true)
  const method = PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)
  if (!method) return
  
  // Add to payment history (always do this)
  const payment = addPayment(
    method.id, method.name, method.type, method.currency,
    amount, exchangeRate, reference, 'Fred Stanley', 'TERM-001'
  )
  
  // Calculate USD equivalent
  const amountUSD = method.currency === 'USD' 
    ? amount 
    : amount / exchangeRate
  
  const amountZWL = method.currency === 'ZWL' 
    ? amount 
    : amount * exchangeRate
  
  // ✅ CRITICAL FIX: Medical aid payment = AWARD (paid now)
  if (method.type === 'medical_aid') {
    try {
      console.log('🏥 Recording medical aid AWARD:', {
        provider: method.name,
        amountUSD,
        amountZWL
      })
      
      // Find or create claim
      let claim = null
      const claimsByOrder = await medicalAidCache.cache.getClaimsByOrder(order.id)
      if (claimsByOrder.length > 0) {
        claim = claimsByOrder[0]
      }
      
      if (!claim) {
        // Create new claim
        claim = await medicalAidCache.cache.createClaimFromOrder(
          {
            id: order.id,
            totalUSD: order.totalUSD,
            totalZWL: order.totalZWL,
            rateLockedAt: order.rateLockedAt,
            rateSource: order.rateSource,
            createdBy: 'Fred Stanley'
          },
          {
            patientId: order.patientId,
            patientName: order.patientName,
            medicalAidProvider: method.id,
            memberNumber: order.memberNumber || `MEM-${Date.now().toString().slice(-6)}`,
            memberName: order.memberName || order.patientName
          },
          exchangeRate
        )
      }
      
      // ✅ RECORD AS AWARD (not shortfall payment)
      if (claim) {
        await medicalAidCache.recordAward(
          claim.id,
          amountUSD,
          exchangeRate,
          'Fred Stanley'
        )
        console.log('✅ Medical aid AWARD recorded:', amountUSD)
      }
      
    } catch (error) {
      console.error('❌ Failed to record medical aid award:', error)
    }
  }
  
  setSelectedPaymentMethod('')
  setIsProcessing(false)
}, [order, selectedPaymentMethod, exchangeRate, addPayment, medicalAidCache])


  const handleMedicalAwardSubmit = useCallback((
    providerId: string, memberNumber: string, memberName: string | undefined, awardedUSD: number
  ) => {
    if (!order) return
    setIsProcessing(true)
    const provider = PAYMENT_METHODS.find(p => p.id === providerId)
    if (!provider) return
    const result = createAward(
      providerId, provider.name, memberNumber, memberName,
      awardedUSD, exchangeRate, 'current-user', 'Fred Stanley'
    )
    if (result.success) setShowMedicalAidForm(false)
    setIsProcessing(false)
  }, [order, exchangeRate, createAward])

  const handleRecordShortfall = useCallback((awardId: string) => {
    if (!order || !award) return
    const shortfallUSD = order.totalUSD - award.awardedUSD
    const receiptNumber = prompt('Enter receipt number:', `RCPT-${Date.now().toString().slice(-6)}`)
    if (!receiptNumber) return
    const paymentMethod = prompt('Enter payment method (Cash USD/Ecocash/etc):', 'Cash USD')
    if (!paymentMethod) return
    setIsProcessing(true)
    recordShortfallPayment(
      awardId, shortfallUSD, exchangeRate, paymentMethod, receiptNumber,
      'current-user', 'Fred Stanley'
    )
    setIsProcessing(false)
  }, [order, award, exchangeRate, recordShortfallPayment])

  const handleMarkSettled = useCallback((awardId: string) => {
    const reference = prompt('Enter settlement reference:', `SET-${Date.now().toString().slice(-6)}`)
    if (!reference) return
    setIsProcessing(true)
    markAsSettled(awardId, reference, 'current-user', 'Fred Stanley')
    setIsProcessing(false)
  }, [markAsSettled])

  const handleRejectAward = useCallback((awardId: string) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    setIsProcessing(true)
    rejectAward(awardId, reason, 'current-user', 'Fred Stanley')
    setIsProcessing(false)
  }, [rejectAward])

  const handleCompleteTransaction = useCallback(() => {
    if (!order || !totals) return
    setIsProcessing(true)
    sessionStorage.setItem('completed_transaction', JSON.stringify({
      order, payments, award, exchangeRate, transactionCurrency,
      completedAt: new Date(), cashier: 'Fred Stanley', terminal: 'TERM-001', totals
    }))
    setIsProcessing(false)
    router.push('/receipt')
  }, [order, payments, award, exchangeRate, transactionCurrency, totals, router])

  const handleCancel = useCallback(() => {
    if (window.confirm('Cancel this transaction? All payments and award information will be lost.')) {
      clearPayments()
      clearAward()
      router.push('/')
    }
  }, [clearPayments, clearAward, router])

  const handleSaveDraft = useCallback(() => {
    alert('Transaction saved as draft')
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vp-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-vp-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order information...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
        <div className="vp-card max-w-md">
          <div className="vp-card-header bg-status-error">Error Loading Payment</div>
          <div className="vp-card-body text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-vp-primary mb-2">Unable to Load Order</h2>
            <p className="text-gray-600 mb-4">{error || 'No order information found'}</p>
            <button onClick={() => router.push('/order/create')} className="vp-btn vp-btn-primary">
              Create New Order
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={isProcessing} message="Processing..." />
      
      <div className="min-h-screen bg-vp-background">
        <header className="vp-header">
          <div className="vp-header-content">
            <div className="vp-logo">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-vp-primary font-bold text-xl">VP</span>
              </div>
              <span className="vp-logo-text">VisionPlus</span>
              <span className="text-sm bg-vp-secondary px-2 py-1 rounded">Payment Processing</span>
            </div>
            <div className="vp-user-info">
              <div className="text-right">
                <div className="font-bold">Link Opticians</div>
                <div className="text-sm">Reception: Fred Stanley</div>
              </div>
              <div className="w-8 h-8 bg-white rounded-full" />
            </div>
          </div>
        </header>

        <div className="vp-main-layout">
          <aside className="vp-sidebar">
            <nav aria-label="Main Navigation">
              <ul className="vp-sidebar-nav">
                <li className="vp-sidebar-item"><a href="/" className="vp-sidebar-link"><span>🏠</span><span>Dashboard</span></a></li>
                <li className="vp-sidebar-item"><a href="/order/create" className="vp-sidebar-link"><span>➕</span><span>New Order</span></a></li>
                <li className="vp-sidebar-item active"><a href="#" className="vp-sidebar-link"><span>💰</span><span>Payments</span></a></li>
                <li className="vp-sidebar-item"><a href="/medical-aid" className="vp-sidebar-link"><span>🏥</span><span>Medical Aid</span></a></li>
                <li className="vp-sidebar-item"><a href="/receipt" className="vp-sidebar-link"><span>🧾</span><span>Receipts</span></a></li>
                <li className="vp-sidebar-item"><a href="#" className="vp-sidebar-link"><span>📊</span><span>Reports</span></a></li>
              </ul>
            </nav>
          </aside>

          <main className="vp-content" id="main-content">
            <div className="vp-card mb-6">
              <div className="vp-card-body">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-vp-primary">Order #{order.id}</h2>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{order.patientName}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      <span>Patient ID: {order.patientId}</span>
                      {order.patientPhone && <span className="ml-3">📞 {order.patientPhone}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-vp-primary">{formatCurrency(order.totalUSD, 'USD')}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(order.totalZWL, 'ZWL')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-vp-primary flex items-center gap-2"><span>🏥</span>Medical Aid</h2>
                {!award && !showMedicalAidForm && (
                  <button type="button" onClick={() => setShowMedicalAidForm(true)} className="vp-btn vp-btn-outline flex items-center gap-2">
                    <span>➕</span> Add Medical Aid Award
                  </button>
                )}
              </div>
              
              {showMedicalAidForm && (
                <div className="vp-card mb-4">
                  <div className="vp-card-header">New Medical Aid Award</div>
                  <div className="vp-card-body">
                    <MedicalAidAwardForm
                      orderTotalUSD={order.totalUSD}
                      exchangeRate={exchangeRate}
                      onSubmit={handleMedicalAwardSubmit}
                      onCancel={() => setShowMedicalAidForm(false)}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              )}
              
              {award && (
                <MedicalAidAwardCard
                  award={award}
                  orderTotalUSD={order.totalUSD}
                  orderTotalZWL={order.totalZWL}
                  exchangeRate={exchangeRate}
                  onRecordShortfall={handleRecordShortfall}
                  onMarkSettled={handleMarkSettled}
                  onReject={handleRejectAward}
                  disabled={isProcessing}
                />
              )}
            </div>

            <div className="mb-6">
              <PaymentMethodGrid
                selectedMethod={selectedPaymentMethod}
                onMethodSelect={setSelectedPaymentMethod}
                transactionCurrency={transactionCurrency}
                onCurrencyChange={setTransactionCurrency}
                disabled={isProcessing}
              />
            </div>

            {/* ✅ FIXED: Payment Form with order prop and proper maxAmounts */}
            {selectedPaymentMethod && totals && (
              <div className="mb-6">
                <PaymentForm
                  selectedMethodId={selectedPaymentMethod}
                  onMethodSelect={setSelectedPaymentMethod}
                  transactionCurrency={transactionCurrency}
                  exchangeRate={exchangeRate}
                  order={order}
                  maxAmountUSD={totals.balanceUSD}
                  maxAmountZWL={totals.balanceZWL}
                  onPaymentSubmit={handleAddPayment}
                  isProcessing={isProcessing}
                />
              </div>
            )}

            <PaymentHistory
              payments={payments}
              exchangeRate={exchangeRate}
              onRemovePayment={removePayment}
              disabled={isProcessing}
            />

            {totals && (
              <TransactionSummary
                order={order}
                payments={payments}
                award={award}
                exchangeRate={exchangeRate}
                transactionCurrency={transactionCurrency}
                isRateLocked={isRateLocked}
                lockedAt={lockedAt}
                onComplete={handleCompleteTransaction}
                onCancel={handleCancel}
                onSaveDraft={handleSaveDraft}
                isProcessing={isProcessing}
              />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}