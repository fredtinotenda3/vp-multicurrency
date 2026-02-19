// app/(screens)/payment/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import PaymentMethodGrid from '@/components/payment/PaymentMethodGrid'

// ============================================================================
// TYPES - Add medical_aid
// ============================================================================

type Currency = 'USD' | 'ZWL'
type PaymentMethod = 'cash' | 'ecocash' | 'card' | 'rtgs' | 'medical_aid' | 'other'  // ✅ Added medical_aid

interface Order {
  patient: { 
    name: string; 
    phone: string;
    medicalAidProvider?: string;
    memberNumber?: string;
  }
  currency: Currency
  exchangeRate: number
  items: any[]
  totals: { totalUSD: number; totalZWL: number }
  orderId: string
}

interface Payment {
  id: string
  method: PaymentMethod
  methodName: string
  currency: Currency
  amount: number
  amountUSD: number
  amountZWL: number
  reference?: string
  timestamp: Date
}

interface MedicalAidAward {
  providerId: string
  providerName: string
  memberNumber: string
  awardAmount: number
  awardCurrency: Currency
  claimReference: string
}

// ============================================================================
// MAIN PAYMENT SCREEN - WITH MEDICAL AID INTEGRATION
// ============================================================================

export default function PaymentScreen() {
  const router = useRouter()
  
  // State
  const [order, setOrder] = useState<Order | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [medicalAidAward, setMedicalAidAward] = useState<MedicalAidAward | null>(null)
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  const [selectedMethodCurrency, setSelectedMethodCurrency] = useState<Currency | undefined>()
  const [reference, setReference] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAwardModal, setShowAwardModal] = useState(false)
  
  // Load order from previous screen
  useEffect(() => {
    const savedOrder = sessionStorage.getItem('current_order')
    if (savedOrder) {
      const parsed = JSON.parse(savedOrder)
      setOrder(parsed)
      setPaymentCurrency(parsed.currency)
    } else {
      // Demo mode with medical aid
      setOrder({
        patient: { 
          name: 'Joyce Mwale', 
          phone: '+263 77 123 4567',
          medicalAidProvider: 'cimas',
          memberNumber: 'CIM-123456'
        },
        currency: 'USD',
        exchangeRate: 32.50,
        items: [],
        totals: { totalUSD: 287.50, totalZWL: 9343.75 },
        orderId: 'ORD-1234'
      })
    }
  }, [])

  // Check if patient has medical aid
  const hasMedicalAid = useMemo(() => {
    return order?.patient?.medicalAidProvider && order?.patient?.memberNumber
  }, [order])

  // Calculate remaining balance
  const remainingBalance = useMemo(() => {
    if (!order) return { usd: 0, zwl: 0 }
    
    const paidUSD = payments.reduce((sum, p) => sum + p.amountUSD, 0) + (medicalAidAward?.awardAmount || 0)
    const paidZWL = payments.reduce((sum, p) => sum + p.amountZWL, 0) + (
      medicalAidAward?.awardCurrency === 'USD' 
        ? (medicalAidAward.awardAmount * order.exchangeRate) 
        : (medicalAidAward?.awardAmount || 0)
    )
    
    return {
      usd: order.totals.totalUSD - paidUSD,
      zwl: order.totals.totalZWL - paidZWL
    }
  }, [order, payments, medicalAidAward])

  // Check if order is fully paid
  const isFullyPaid = useMemo(() => {
    return remainingBalance.usd <= 0.01 && remainingBalance.zwl <= 0.01
  }, [remainingBalance])

  // Calculate equivalent amount
  const equivalentAmount = useMemo(() => {
    if (!order || !amount) return null
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount)) return null
    
    if (paymentCurrency === 'USD') {
      return { value: numAmount * order.exchangeRate, currency: 'ZWL' }
    } else {
      return { value: numAmount / order.exchangeRate, currency: 'USD' }
    }
  }, [amount, paymentCurrency, order])

  // Validate amount
  const isValidAmount = useMemo(() => {
    if (!order || !amount) return false
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return false
    
    if (paymentCurrency === 'USD') {
      return numAmount <= remainingBalance.usd + 0.01
    } else {
      return numAmount <= remainingBalance.zwl + 0.01
    }
  }, [amount, paymentCurrency, remainingBalance])

  // Handle method select from PaymentMethodGrid
  const handleMethodSelect = (methodId: string, method: any, currency?: Currency) => {
    setSelectedMethodId(methodId)
    setSelectedMethodCurrency(currency)
    
    // Map grid method to our simplified type
    if (methodId.includes('cash')) {
      setSelectedMethod('cash')
    } else if (methodId.includes('ecocash')) {
      setSelectedMethod('ecocash')
    } else if (methodId.includes('card')) {
      setSelectedMethod('card')
    } else if (methodId.includes('rtgs')) {
      setSelectedMethod('rtgs')
    } else if (methodId.includes('cimas') || 
               methodId.includes('first_mutual') || 
               methodId.includes('psmas') ||
               methodId.includes('liberty') ||
               methodId.includes('old_mutual')) {
      setSelectedMethod('medical_aid')
      
      // If medical aid is selected and patient has medical aid, show award modal
      if (hasMedicalAid && !medicalAidAward) {
        setShowAwardModal(true)
      }
    } else {
      setSelectedMethod('other')
    }
  }

  // Handle medical aid award
  const handleMedicalAidAward = (awardAmount: number, awardCurrency: Currency) => {
    if (!order || !order.patient.medicalAidProvider) return
    
    const provider = getProviderName(order.patient.medicalAidProvider)
    
    setMedicalAidAward({
      providerId: order.patient.medicalAidProvider,
      providerName: provider,
      memberNumber: order.patient.memberNumber || '',
      awardAmount,
      awardCurrency,
      claimReference: `${order.patient.medicalAidProvider.toUpperCase()}-${Date.now().toString().slice(-6)}`
    })
    
    setShowAwardModal(false)
    setSelectedMethodId('')
    setSelectedMethod(null)
  }

  // Handle add payment
  const handleAddPayment = () => {
    if (!order || !selectedMethod || !isValidAmount) return
    
    const numAmount = parseFloat(amount)
    
    let amountUSD: number, amountZWL: number
    if (paymentCurrency === 'USD') {
      amountUSD = numAmount
      amountZWL = numAmount * order.exchangeRate
    } else {
      amountZWL = numAmount
      amountUSD = numAmount / order.exchangeRate
    }
    
    let methodName = ''
    switch (selectedMethod) {
      case 'cash': methodName = paymentCurrency === 'USD' ? 'Cash USD' : 'Cash ZWL'; break
      case 'ecocash': methodName = 'Ecocash'; break
      case 'card': methodName = 'Card'; break
      case 'rtgs': methodName = 'RTGS'; break
      case 'medical_aid': 
        methodName = getProviderName(order.patient.medicalAidProvider || '')
        break
      default: methodName = 'Other'
    }
    
    const newPayment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      method: selectedMethod,
      methodName,
      currency: paymentCurrency,
      amount: numAmount,
      amountUSD,
      amountZWL,
      reference: reference || undefined,
      timestamp: new Date()
    }
    
    setPayments([...payments, newPayment])
    setAmount('')
    setReference('')
    setSelectedMethod(null)
    setSelectedMethodId('')
    setSelectedMethodCurrency(undefined)
    
    // ✅ IF MEDICAL AID PAYMENT, SAVE TO SESSION STORAGE
    if (selectedMethod === 'medical_aid') {
      const medicalAidData = {
        id: `clm-${Date.now()}`,
        claimNumber: `${order.patient.medicalAidProvider?.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        patientName: order.patient.name,
        patientId: `PT-${Date.now().toString().slice(-4)}`,
        providerId: order.patient.medicalAidProvider,
        providerName: methodName,
        memberNumber: order.patient.memberNumber,
        orderId: order.orderId,
        orderTotalUSD: order.totals.totalUSD,
        orderTotalZWL: order.totals.totalZWL,
        exchangeRate: order.exchangeRate,
        rateLockedAt: new Date().toISOString(),
        awardAmount: amountUSD,
        awardCurrency: paymentCurrency,
        awardDate: new Date().toISOString(),
        shortfallAmount: order.totals.totalUSD - amountUSD,
        shortfallPaid: false,
        status: 'awarded',
        submittedDate: new Date().toISOString()
      }
      
      sessionStorage.setItem('new_medical_aid_claim', JSON.stringify(medicalAidData))
      console.log('✅ Saved medical aid claim to sessionStorage')
    }
  }

  const handleRemovePayment = (paymentId: string) => {
    setPayments(payments.filter(p => p.id !== paymentId))
  }

  const handleRemoveAward = () => {
    setMedicalAidAward(null)
  }

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString())
  }

  const handleCompletePayment = () => {
    setIsProcessing(true)
    
    // Save completed transaction
    sessionStorage.setItem('completed_transaction', JSON.stringify({
      order,
      payments,
      medicalAidAward,
      completedAt: new Date().toISOString()
    }))
    
    setIsProcessing(false)
    
    alert('Payment completed successfully!')
    router.push('/')
  }

  const getProviderName = (providerId: string): string => {
    const providers: Record<string, string> = {
      'cimas': 'Cimas',
      'first_mutual': 'First Mutual',
      'psmas': 'PSMAS',
      'liberty': 'Liberty',
      'old_mutual': 'Old Mutual'
    }
    return providers[providerId] || providerId
  }

  const formatCurrency = (amount: number, curr: Currency) => {
    if (curr === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return `ZWL ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return '💵'
      case 'ecocash': return '📱'
      case 'card': return '💳'
      case 'rtgs': return '🏦'
      case 'medical_aid': return '🏥'
      case 'other': return '🔄'
    }
  }

  const getPaymentMethodName = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return 'Cash'
      case 'ecocash': return 'Ecocash'
      case 'card': return 'Card'
      case 'rtgs': return 'RTGS'
      case 'medical_aid': return 'Medical Aid'
      case 'other': return 'Other'
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={isProcessing} message="Processing payment..." />
      
      <div className="min-h-screen bg-gray-50">
        <MobileHeader />
        
        <div className="flex">
          <Sidebar />
          
          <main className="flex-1 p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              
              {/* ORDER SUMMARY */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-gray-500">Order #{order.orderId}</div>
                      <div className="font-medium text-lg">{order.patient.name}</div>
                      <div className="text-sm text-gray-600">{order.patient.phone}</div>
                      {order.patient.medicalAidProvider && (
                        <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block">
                          {getProviderName(order.patient.medicalAidProvider)} · {order.patient.memberNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(order.totals.totalUSD, 'USD')}
                      </div>
                      <div className="text-blue-600">
                        {formatCurrency(order.totals.totalZWL, 'ZWL')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Locked: 1 USD = {order.exchangeRate.toFixed(2)} ZWL
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* MEDICAL AID AWARD DISPLAY */}
              {medicalAidAward && (
                <div className="bg-white rounded-lg shadow-sm border border-green-200 mb-4">
                  <div className="p-4 border-b bg-green-50 flex justify-between items-center">
                    <h2 className="font-semibold text-green-800 flex items-center gap-2">
                      <span>🏥</span> Medical Aid Award
                    </h2>
                    <button
                      onClick={handleRemoveAward}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{medicalAidAward.providerName}</div>
                        <div className="text-sm text-gray-600">Member: {medicalAidAward.memberNumber}</div>
                        <div className="text-xs text-gray-500 mt-1">Claim: {medicalAidAward.claimReference}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(medicalAidAward.awardAmount, medicalAidAward.awardCurrency)}
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ {formatCurrency(
                            medicalAidAward.awardCurrency === 'USD'
                              ? medicalAidAward.awardAmount * order.exchangeRate
                              : medicalAidAward.awardAmount / order.exchangeRate,
                            medicalAidAward.awardCurrency === 'USD' ? 'ZWL' : 'USD'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* PAYMENT METHOD GRID */}
              <div className="mb-4">
                <PaymentMethodGrid
                  selectedMethodId={selectedMethodId}
                  selectedCurrency={selectedMethodCurrency}
                  onMethodSelect={handleMethodSelect}
                  transactionCurrency={paymentCurrency}
                  onCurrencyChange={setPaymentCurrency}
                  patientMedicalAidProvider={order.patient.medicalAidProvider}
                  patientMemberNumber={order.patient.memberNumber}
                  disabled={isProcessing || !!medicalAidAward}
                />
              </div>
              
              {/* PAYMENT SECTION */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="font-semibold text-gray-800">Add Payment</h2>
                </div>
                
                <div className="p-4 space-y-4">
                  
                  {/* Payment Currency Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Currency
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPaymentCurrency('USD')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                          paymentCurrency === 'USD'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setPaymentCurrency('ZWL')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                          paymentCurrency === 'ZWL'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        ZWL
                      </button>
                    </div>
                  </div>
                  
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`0.00 ${paymentCurrency}`}
                      className={`w-full px-4 py-3 text-2xl border rounded-lg focus:outline-none focus:ring-2 ${
                        amount && !isValidAmount
                          ? 'border-red-300 focus:ring-red-500 bg-red-50'
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      step="0.01"
                      min="0.01"
                      max={paymentCurrency === 'USD' ? remainingBalance.usd : remainingBalance.zwl}
                    />
                    
                    {equivalentAmount && (
                      <div className="mt-1 text-sm text-gray-600">
                        = {formatCurrency(equivalentAmount.value, equivalentAmount.currency as Currency)}
                      </div>
                    )}
                    
                    {amount && !isValidAmount && (
                      <div className="mt-1 text-sm text-red-600">
                        Amount exceeds remaining balance
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Amount Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Amounts
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[10, 20, 50, 100, 200, 500].map(val => {
                        const displayVal = paymentCurrency === 'USD' 
                          ? val 
                          : val * order.exchangeRate
                        
                        return (
                          <button
                            key={val}
                            onClick={() => handleQuickAmount(displayVal)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                          >
                            {paymentCurrency === 'USD' ? `$${val}` : `${Math.round(displayVal)} ZWL`}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Reference Field (optional) */}
                  {selectedMethod && selectedMethod !== 'cash' && selectedMethod !== 'medical_aid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference (optional)
                      </label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Transaction ID, receipt #, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  {/* Add Payment Button */}
                  <button
                    onClick={handleAddPayment}
                    disabled={!amount || !selectedMethod || !isValidAmount}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ADD PAYMENT
                  </button>
                </div>
              </div>
              
              {/* PAYMENTS RECEIVED */}
              {payments.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                  <div className="p-4 border-b bg-gray-50">
                    <h2 className="font-semibold text-gray-800">Payments Received</h2>
                  </div>
                  
                  <div className="p-4">
                    <div className="space-y-2">
                      {payments.map(payment => (
                        <div key={payment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getPaymentMethodIcon(payment.method)}</span>
                            <div>
                              <div className="font-medium">
                                {payment.methodName}
                              </div>
                              {payment.reference && (
                                <div className="text-xs text-gray-500">Ref: {payment.reference}</div>
                              )}
                              <div className="text-xs text-gray-400">
                                {payment.timestamp.toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              {formatCurrency(payment.amount, payment.currency)}
                            </div>
                            <button
                              onClick={() => handleRemovePayment(payment.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* REMAINING BALANCE & COMPLETE BUTTON */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4">
                  <div className="text-center mb-4">
                    <div className="text-sm text-gray-500 uppercase tracking-wider">
                      Remaining Balance
                    </div>
                    <div className="text-3xl font-bold text-orange-600">
                      {formatCurrency(remainingBalance.usd, 'USD')}
                    </div>
                    <div className="text-xl text-blue-600">
                      {formatCurrency(remainingBalance.zwl, 'ZWL')}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleCompletePayment}
                    disabled={!isFullyPaid}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                      isFullyPaid
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isFullyPaid ? 'COMPLETE PAYMENT' : `Balance due: ${formatCurrency(remainingBalance.usd, 'USD')}`}
                  </button>
                </div>
              </div>
              
            </div>
          </main>
        </div>
      </div>
      
      {/* Medical Aid Award Modal */}
      {showAwardModal && order && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg">Medical Aid Award</h2>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm text-gray-500">Provider</div>
                <div className="font-medium">
                  {getProviderName(order.patient.medicalAidProvider || '')}
                </div>
                <div className="text-xs text-gray-500">Member: {order.patient.memberNumber}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Award Currency</label>
                <div className="flex gap-2">
                  {(['USD', 'ZWL'] as Currency[]).map(curr => (
                    <button
                      key={curr}
                      onClick={() => {
                        const amount = curr === 'USD' ? 100 : 100 * order.exchangeRate
                        handleMedicalAidAward(amount, curr)
                      }}
                      className={`flex-1 py-3 rounded-lg font-bold ${
                        curr === 'USD' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAwardModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}