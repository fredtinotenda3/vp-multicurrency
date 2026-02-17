// app/(screens)/receipt/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
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
        // Demo mode - show sample receipt with updated rates
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

  // Get order data
  const order = transaction.order || {}
  const payments = transaction.payments || []
  const award = transaction.award

  // Calculate totals if not provided
  const totalPaidUSD = payments.reduce((sum: number, p: any) => sum + (p.equivalentUSD || 0), 0) + (award?.awardedUSD || 0)
  const totalPaidZWG = payments.reduce((sum: number, p: any) => sum + (p.equivalentZWG || 0), 0) + (award?.awardedZWG || 0)
  
  const orderTotalUSD = order.totalUSD || transaction.totalUSD || 0
  const orderTotalZWG = order.totalZWG || transaction.totalZWG || 0
  
  const balanceUSD = orderTotalUSD - totalPaidUSD
  const balanceZWG = orderTotalZWG - totalPaidZWG

  // Format business info
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

  // Format receipt number
  const now = new Date()
  const receiptNumber = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    sequence: Math.floor(Math.random() * 1000000),
    fullNumber: `RCPT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    isValid: true
  }

  // Format patient info
  const patientInfo = {
    id: order.patientId || transaction.patientId || 'PT-2027',
    name: order.patientName || transaction.patientName || 'Patient',
    phone: order.patientPhone || transaction.patientPhone,
    address: transaction.patientAddress
  }

  // Format order info
  const orderInfo = {
    id: order.id || transaction.orderId || 'ORD-2024-001',
    date: transaction.completedAt || new Date()
  }

  // Format items from order
  const items = (order.items || []).map((item: any, index: number) => {
    const unitPriceUSD = item.priceUSD || item.unitPriceUSD || 0
    const unitPriceZWG = item.priceZWG || item.unitPriceZWG || 0
    const quantity = item.quantity || 1
    
    return {
      id: `ITEM-${index}`,
      sku: item.sku || `SKU-${index}`,
      description: item.name || item.description || 'Product',
      quantity: quantity,
      unitPriceUSD: unitPriceUSD,
      unitPriceZWG: unitPriceZWG,
      discountRate: item.discountRate,
      discountAmountUSD: item.discountAmountUSD,
      discountAmountZWG: item.discountAmountZWG,
      netPriceUSD: unitPriceUSD * quantity,
      netPriceZWG: unitPriceZWG * quantity,
      vatRate: 15,
      vatType: 'standard',
      vatAmountUSD: (unitPriceUSD * quantity) * 0.15,
      vatAmountZWG: (unitPriceZWG * quantity) * 0.15,
      totalUSD: (unitPriceUSD * quantity) * 1.15,
      totalZWG: (unitPriceZWG * quantity) * 1.15,
      isMedicalAid: false
    }
  })

  // Format payments
  const formattedPayments = payments.map((p: any, index: number) => ({
    id: p.id || `PAY-${index}`,
    paymentNumber: p.paymentNumber || `PAY-${now.getFullYear()}-${String(index + 1).padStart(4, '0')}`,
    method: p.methodName || p.method || 'Cash',
    methodCode: p.methodId || p.method,
    currency: p.currency || 'ZWG',
    amount: p.amount || 0,
    exchangeRate: transaction.exchangeRate || 32.5,
    equivalentUSD: p.equivalentUSD || (p.currency === 'USD' ? p.amount : p.amount / (transaction.exchangeRate || 32.5)),
    equivalentZWG: p.equivalentZWG || (p.currency === 'ZWG' ? p.amount : p.amount * (transaction.exchangeRate || 32.5)),
    reference: p.reference,
    authorizedBy: p.capturedBy || transaction.cashier,
    timestamp: p.timestamp || transaction.completedAt || new Date()
  }))

  // Format medical aid info if present
  const medicalAidInfo = award ? {
    providerId: award.providerId || 'cimas',
    providerName: award.providerName || 'Cimas',
    providerCode: award.providerCode || 'CIM',
    memberNumber: award.memberNumber || order.memberNumber || 'CIM-123456',
    memberName: award.memberName || order.patientName,
    claimReference: award.claimReference || `CLAIM-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    awardedAmountUSD: award.awardedUSD || 0,
    awardedAmountZWG: award.awardedZWG || 0,
    shortfallAmountUSD: balanceUSD,
    shortfallAmountZWG: balanceZWG,
    settlementDays: award.expectedSettlementDays || 30,
    expectedSettlementDate: new Date(now.getTime() + (award.expectedSettlementDays || 30) * 24 * 60 * 60 * 1000)
  } : undefined

  // Format totals
  const totals = {
    subtotalUSD: items.reduce((sum: number, i: any) => sum + i.netPriceUSD, 0),
    subtotalZWG: items.reduce((sum: number, i: any) => sum + i.netPriceZWG, 0),
    discountUSD: 0,
    discountZWG: 0,
    vatUSD: items.reduce((sum: number, i: any) => sum + i.vatAmountUSD, 0),
    vatZWG: items.reduce((sum: number, i: any) => sum + i.vatAmountZWG, 0),
    totalUSD: orderTotalUSD,
    totalZWG: orderTotalZWG,
    amountPaidUSD: totalPaidUSD,
    amountPaidZWG: totalPaidZWG,
    balanceUSD: balanceUSD,
    balanceZWG: balanceZWG,
    itemCount: items.length,
    paymentCount: formattedPayments.length
  }

  // Format compliance info
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
        {/* Mobile Header - Hidden when printing */}
        <div className="print:hidden">
          <MobileHeader />
        </div>

        <div className="flex">
          {/* Sidebar - Hidden when printing */}
          <div className="print:hidden">
            <Sidebar />
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0" id="main-content">
            {/* Print Controls - Hidden when printing */}
            <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10">
              <div className="p-4 lg:p-6">
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
            <div className="p-4 lg:p-6 print:p-0">
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
                transactionCurrency={transaction.transactionCurrency || 'ZWG'}
                exchangeRate={transaction.exchangeRate || 32.5}
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
              <div className="p-4 lg:p-6">
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
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}

// ============================================================================
// SAMPLE TRANSACTION - Demo Mode with updated rates
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
      subtotalZWG: 8125, // 250 * 32.5
      taxUSD: 37.5,
      taxZWG: 1218.75, // 37.5 * 32.5
      totalUSD: 287.5,
      totalZWG: 9343.75, // 287.5 * 32.5
      items: [
        { 
          name: 'Ray-Ban Aviator',
          description: 'Ray-Ban Aviator',
          quantity: 1, 
          priceUSD: 120, 
          priceZWG: 3900, // 120 * 32.5
          unitPriceUSD: 120,
          unitPriceZWG: 3900
        },
        { 
          name: 'Progressive Lenses',
          description: 'Progressive Lenses',
          quantity: 1, 
          priceUSD: 130, 
          priceZWG: 4225, // 130 * 32.5
          unitPriceUSD: 130,
          unitPriceZWG: 4225
        }
      ]
    },
    
    exchangeRate: 32.5,
    transactionCurrency: 'ZWG',
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
        equivalentZWG: 3250, // 100 * 32.5
        reference: 'CASH-001',
        capturedBy: 'Fred Stanley',
        timestamp: new Date(now.getTime() - 30 * 60000)
      },
      { 
        id: 'PAY-002',
        paymentNumber: 'PAY-240201-0002',
        methodName: 'Ecocash',
        method: 'Ecocash',
        currency: 'ZWG', 
        amount: 6093.75, // 187.5 * 32.5
        equivalentUSD: 187.5,
        equivalentZWG: 6093.75,
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
      awardedZWG: 6825, // 210 * 32.5
      expectedSettlementDays: 30
    },
    
    totals: {
      totalPaidUSD: 287.5,
      totalPaidZWG: 9343.75,
      balanceUSD: 0,
      balanceZWG: 0,
      isPaidInFull: true
    }
  }
}