// app/(screens)/receipt/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import ZimbabweCompliantReceipt from '@/components/receipt/ZimbabweCompliantReceipt'

// ============================================================================
// TYPES - For receipt data
// ============================================================================

interface BusinessInfo {
  legalName: string
  tradingName: string
  businessType: string
  registrationNumber: string
  vatNumber: string
  tinNumber: string
  vatCertificateNumber?: string
  address: {
    line1: string
    line2?: string
    city: string
    province: string
    country: string
    postalCode?: string
  }
  contact: {
    phone: string
    email: string
    website?: string
  }
  bankDetails?: {
    bankName: string
    branch: string
    accountName: string
    accountNumber: string
    branchCode: string
  }
}

// ============================================================================
// RECEIPT SCREEN - Zimbabwe ZIMRA Compliant
// ============================================================================

export default function ReceiptScreen() {
  const router = useRouter()
  const [transaction, setTransaction] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load transaction from session storage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('completed_transaction')
      
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('📦 Receipt screen - Loading transaction:', parsed)
        
        // Parse dates back to Date objects
        const transaction = {
          ...parsed,
          completedAt: parsed.completedAt ? new Date(parsed.completedAt) : new Date(),
          rateLockedAt: parsed.rateLockedAt ? new Date(parsed.rateLockedAt) : new Date(),
          order: parsed.order ? {
            ...parsed.order,
            rateLockedAt: parsed.order.rateLockedAt ? new Date(parsed.order.rateLockedAt) : new Date()
          } : null,
          payments: parsed.payments?.map((p: any) => ({
            ...p,
            timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
          })) || [],
          award: parsed.award ? {
            ...parsed.award,
            awardedAt: parsed.award.awardedAt ? new Date(parsed.award.awardedAt) : undefined
          } : null
        }
        setTransaction(transaction)
      } else {
        // Demo mode - show sample receipt
        setTransaction(getSampleTransaction())
      }
    } catch (err) {
      console.error('Failed to load transaction:', err)
      setError('Could not load receipt information')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const handleEmail = () => {
    // In production, this would open email client
    const subject = `Tax Invoice ${receiptNumber.fullNumber}`
    const body = `Please find attached tax invoice for ${transaction?.order?.patientName || 'Patient'}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const handleNewTransaction = () => {
    router.push('/order/create')
  }

  const handleBackToDashboard = () => {
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vp-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-vp-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Generating receipt...</p>
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
        <div className="vp-card max-w-md w-full">
          <div className="vp-card-header bg-status-error">
            Receipt Not Found
          </div>
          <div className="vp-card-body text-center">
            <div className="text-6xl mb-4" aria-hidden="true">
              🧾
            </div>
            <h2 className="text-xl font-bold text-vp-primary mb-2">
              No Receipt Available
            </h2>
            <p className="text-gray-600 mb-6">
              {error || 'The requested receipt could not be found or has expired.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleNewTransaction}
                className="vp-btn vp-btn-primary"
              >
                New Transaction
              </button>
              <button
                onClick={handleBackToDashboard}
                className="vp-btn vp-btn-outline"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ✅ Get order data
  const order = transaction.order || {}
  const payments = transaction.payments || []
  const award = transaction.award

  // ✅ Calculate totals if not provided
  const totalPaidUSD = payments.reduce((sum: number, p: any) => sum + (p.equivalentUSD || 0), 0) + (award?.awardedUSD || 0)
  const totalPaidZWL = payments.reduce((sum: number, p: any) => sum + (p.equivalentZWL || 0), 0) + (award?.awardedZWL || 0)
  
  const orderTotalUSD = order.totalUSD || transaction.totalUSD || 0
  const orderTotalZWL = order.totalZWL || transaction.totalZWL || 0
  
  const balanceUSD = orderTotalUSD - totalPaidUSD
  const balanceZWL = orderTotalZWL - totalPaidZWL

  // ✅ Format business info
  const businessInfo: BusinessInfo = {
    legalName: 'Link Opticians',
    tradingName: 'Link Opticians',
    businessType: 'Optometry Practice',
    registrationNumber: 'CR1234567',
    vatNumber: 'VAT123456789',
    tinNumber: '1012345678',
    address: {
      line1: '123 Main Street',
      city: 'Harare',
      province: 'Harare',
      country: 'Zimbabwe',
      postalCode: 'ZW-0001'
    },
    contact: {
      phone: '+263 242 123456',
      email: 'info@linkopticians.co.zw'
    },
    bankDetails: {
      bankName: 'CBZ Bank',
      branch: 'Harare Main',
      accountName: 'Link Opticians',
      accountNumber: '1234567890',
      branchCode: '1000'
    }
  }

  // ✅ Format receipt number
  const now = new Date()
  const receiptNumber = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    sequence: Math.floor(Math.random() * 1000000),
    fullNumber: `RCPT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    isValid: true
  }

  // ✅ Format patient info
  const patientInfo = {
    id: order.patientId || transaction.patientId || 'PT-2027',
    name: order.patientName || transaction.patientName || 'Patient',
    phone: order.patientPhone || transaction.patientPhone,
    address: transaction.patientAddress
  }

  // ✅ Format order info
  const orderInfo = {
    id: order.id || transaction.orderId || 'ORD-2024-001',
    date: transaction.completedAt || new Date()
  }

  // ✅ Format items from order
  const items = (order.items || []).map((item: any, index: number) => {
    const unitPriceUSD = item.priceUSD || item.unitPriceUSD || 0
    const unitPriceZWL = item.priceZWL || item.unitPriceZWL || 0
    const quantity = item.quantity || 1
    
    return {
      id: `ITEM-${index}`,
      sku: item.sku || `SKU-${index}`,
      description: item.name || item.description || 'Product',
      quantity: quantity,
      unitPriceUSD: unitPriceUSD,
      unitPriceZWL: unitPriceZWL,
      discountRate: item.discountRate,
      discountAmountUSD: item.discountAmountUSD,
      discountAmountZWL: item.discountAmountZWL,
      netPriceUSD: unitPriceUSD * quantity,
      netPriceZWL: unitPriceZWL * quantity,
      vatRate: 15,
      vatType: 'standard',
      vatAmountUSD: (unitPriceUSD * quantity) * 0.15,
      vatAmountZWL: (unitPriceZWL * quantity) * 0.15,
      totalUSD: (unitPriceUSD * quantity) * 1.15,
      totalZWL: (unitPriceZWL * quantity) * 1.15,
      isMedicalAid: false
    }
  })

  // ✅ Format payments
  const formattedPayments = payments.map((p: any, index: number) => ({
    id: p.id || `PAY-${index}`,
    paymentNumber: p.paymentNumber || `PAY-${now.getFullYear()}-${String(index + 1).padStart(4, '0')}`,
    method: p.methodName || p.method || 'Cash',
    methodCode: p.methodId || p.method,
    currency: p.currency || 'ZWL',
    amount: p.amount || 0,
    exchangeRate: transaction.exchangeRate || 1250,
    equivalentUSD: p.equivalentUSD || (p.currency === 'USD' ? p.amount : p.amount / (transaction.exchangeRate || 1250)),
    equivalentZWL: p.equivalentZWL || (p.currency === 'ZWL' ? p.amount : p.amount * (transaction.exchangeRate || 1250)),
    reference: p.reference,
    authorizedBy: p.capturedBy || transaction.cashier,
    timestamp: p.timestamp || transaction.completedAt || new Date()
  }))

  // ✅ Format medical aid info if present
  const medicalAidInfo = award ? {
    providerId: award.providerId || 'cimas',
    providerName: award.providerName || 'Cimas',
    providerCode: award.providerCode || 'CIM',
    memberNumber: award.memberNumber || order.memberNumber || 'CIM-123456',
    memberName: award.memberName || order.patientName,
    claimReference: award.claimReference || `CLAIM-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    awardedAmountUSD: award.awardedUSD || 0,
    awardedAmountZWL: award.awardedZWL || 0,
    shortfallAmountUSD: balanceUSD,
    shortfallAmountZWL: balanceZWL,
    settlementDays: award.expectedSettlementDays || 30,
    expectedSettlementDate: new Date(now.getTime() + (award.expectedSettlementDays || 30) * 24 * 60 * 60 * 1000)
  } : undefined

  // ✅ Format totals
  const totals = {
    subtotalUSD: items.reduce((sum: number, i: any) => sum + i.netPriceUSD, 0),
    subtotalZWL: items.reduce((sum: number, i: any) => sum + i.netPriceZWL, 0),
    discountUSD: 0,
    discountZWL: 0,
    vatUSD: items.reduce((sum: number, i: any) => sum + i.vatAmountUSD, 0),
    vatZWL: items.reduce((sum: number, i: any) => sum + i.vatAmountZWL, 0),
    totalUSD: orderTotalUSD,
    totalZWL: orderTotalZWL,
    amountPaidUSD: totalPaidUSD,
    amountPaidZWL: totalPaidZWL,
    balanceUSD: balanceUSD,
    balanceZWL: balanceZWL,
    itemCount: items.length,
    paymentCount: formattedPayments.length
  }

  // ✅ Format compliance info
  const compliance = {
    receiptNumber,
    vatNumber: businessInfo.vatNumber,
    tinNumber: businessInfo.tinNumber,
    businessRegistration: businessInfo.registrationNumber,
    taxPeriod: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    isVATRegistered: true,
    isSequential: true,
    isTaxInvoice: true,
    fiscalSignature: `VP-${receiptNumber.fullNumber}-${Date.now().toString(36).toUpperCase()}`
  }

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={false} />
      
      <div className="min-h-screen bg-vp-background print:bg-white">
        {/* Print Controls - Hidden when printing */}
        <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="vp-container py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-vp-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">VP</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-vp-primary">VisionPlus Receipt</h1>
                  <p className="text-sm text-gray-600">ZIMRA Compliant Tax Invoice</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEmail}
                  className="vp-btn vp-btn-outline flex items-center gap-2"
                  aria-label="Email receipt"
                >
                  <span aria-hidden="true">📧</span>
                  <span className="hidden sm:inline">Email</span>
                </button>
                
                <button
                  onClick={handlePrint}
                  className="vp-btn vp-btn-primary flex items-center gap-2"
                  aria-label="Print receipt"
                >
                  <span aria-hidden="true">🖨️</span>
                  <span className="hidden sm:inline">Print</span>
                </button>
                
                <button
                  onClick={handleNewTransaction}
                  className="vp-btn vp-btn-secondary flex items-center gap-2"
                  aria-label="New transaction"
                >
                  <span aria-hidden="true">➕</span>
                  <span className="hidden sm:inline">New</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="vp-container py-8 print:py-0">
          <ZimbabweCompliantReceipt
            // Business Information
            business={businessInfo}
            
            // Receipt Information
            receiptType="tax_invoice"
            receiptNumber={receiptNumber}
            receiptDate={transaction.completedAt || new Date()}
            cashierName={transaction.cashier || 'Fred Stanley'}
            cashierId="CSH-001"
            terminalId={transaction.terminal || 'TERM-001'}
            pointOfSaleId="POS-001"
            
            // Patient Information
            patient={patientInfo}
            
            // Order Information
            orderId={orderInfo.id}
            orderDate={orderInfo.date}
            
            // Currency Information
            baseCurrency="USD"
            transactionCurrency={transaction.transactionCurrency || 'ZWL'}
            exchangeRate={transaction.exchangeRate || 1250}
            rateLockedAt={transaction.rateLockedAt || new Date()}
            rateSource={transaction.rateSource || 'Reserve Bank of Zimbabwe'}
            
            // Transaction Details
            items={items}
            payments={formattedPayments}
            medicalAid={medicalAidInfo}
            
            // Totals
            totals={totals}
            
            // Compliance
            compliance={compliance}
            
            // UI Options
            showVATBreakdown={true}
            showBankDetails={true}
            showQRCode={true}
            showSignature={true}
          />
        </div>

        {/* Footer - Hidden when printing */}
        <div className="print:hidden bg-white border-t border-gray-200 mt-8 py-6">
          <div className="vp-container">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-currency-locked">🔒</span>
                <span>Exchange rate locked per transaction - ZIMRA compliant</span>
              </div>
              <div className="flex gap-6">
                <button
                  onClick={handleBackToDashboard}
                  className="text-vp-primary hover:text-vp-primary/80 font-medium"
                >
                  ← Dashboard
                </button>
                <button
                  onClick={handleNewTransaction}
                  className="text-vp-primary hover:text-vp-primary/80 font-medium"
                >
                  New Transaction →
                </button>
              </div>
            </div>
            
            {/* Keyboard Shortcuts */}
            <div className="mt-4 text-xs text-gray-400 border-t pt-4 flex flex-wrap gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-gray-600">Ctrl+P</kbd>
                <span>Print</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-gray-600">Esc</kbd>
                <span>Dashboard</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-gray-600">N</kbd>
                <span>New Transaction</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

// ============================================================================
// SAMPLE TRANSACTION - Demo Mode
// ============================================================================

function getSampleTransaction() {
  const now = new Date()
  const rateLockedAt = new Date(now)
  rateLockedAt.setHours(now.getHours() - 1)
  
  return {
    transactionId: 'TX-2024-001-5678',
    receiptNumber: `RCPT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    completedAt: now,
    cashier: 'Fred Stanley',
    terminal: 'TERM-001',
    
    order: {
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
      items: [
        { 
          name: 'Ray-Ban Aviator',
          description: 'Ray-Ban Aviator',
          quantity: 1, 
          priceUSD: 120, 
          priceZWL: 150000,
          unitPriceUSD: 120,
          unitPriceZWL: 150000
        },
        { 
          name: 'Progressive Lenses',
          description: 'Progressive Lenses',
          quantity: 1, 
          priceUSD: 130, 
          priceZWL: 162500,
          unitPriceUSD: 130,
          unitPriceZWL: 162500
        }
      ]
    },
    
    exchangeRate: 1250,
    transactionCurrency: 'ZWL',
    rateLockedAt,
    rateSource: 'Reserve Bank of Zimbabwe',
    
    payments: [
      { 
        id: 'PAY-001',
        paymentNumber: 'PAY-240201-0001',
        methodName: 'Cash USD',
        method: 'Cash USD',
        currency: 'USD', 
        amount: 100, 
        equivalentUSD: 100,
        equivalentZWL: 125000,
        reference: 'CASH-001',
        capturedBy: 'Fred Stanley',
        timestamp: new Date(now.getTime() - 30 * 60000)
      },
      { 
        id: 'PAY-002',
        paymentNumber: 'PAY-240201-0002',
        methodName: 'Ecocash',
        method: 'Ecocash',
        currency: 'ZWL', 
        amount: 234375, 
        equivalentUSD: 187.5,
        equivalentZWL: 234375,
        reference: 'ECO-789012',
        capturedBy: 'Fred Stanley',
        timestamp: new Date(now.getTime() - 15 * 60000)
      }
    ],
    
    award: {
      providerName: 'Cimas',
      providerId: 'cimas',
      memberNumber: 'CIM-789012',
      claimReference: 'CIM-2024-001-5678',
      awardedUSD: 210,
      awardedZWL: 262500,
      expectedSettlementDays: 30
    },
    
    totals: {
      totalPaidUSD: 287.5,
      totalPaidZWL: 359375,
      balanceUSD: 0,
      balanceZWL: 0,
      isPaidInFull: true
    }
  }
}