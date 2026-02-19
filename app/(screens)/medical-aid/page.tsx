// app/(screens)/medical-aid/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'

// ============================================================================
// TYPES - Simplified to 3 statuses only
// ============================================================================

type Currency = 'USD' | 'ZWL'
type ClaimStatus = 'pending' | 'awarded' | 'cleared'
type MedicalAidProvider = 'cimas' | 'first_mutual' | 'psmas' | 'liberty' | 'old_mutual'

interface MedicalAidClaim {
  id: string
  claimNumber: string
  patientName: string
  patientId: string
  providerId: MedicalAidProvider
  providerName: string
  memberNumber: string
  orderId: string
  orderTotalUSD: number
  orderTotalZWL: number
  exchangeRate: number
  
  // Award - simplified to single currency per claim
  awardAmount: number | null
  awardCurrency: Currency | null
  awardDate: Date | null
  
  // Shortfall - calculated from award
  shortfallAmount: number | null
  shortfallPaid: boolean
  shortfallPaidDate: Date | null
  
  // Status - only 3 options
  status: ClaimStatus
  
  // Dates
  submittedDate: Date
  clearedDate: Date | null
}

// Mock data - simplified
const MOCK_CLAIMS: MedicalAidClaim[] = [
  {
    id: 'clm-001',
    claimNumber: 'CIM-2401-001',
    patientName: 'Joyce Mwale',
    patientId: 'PT-001',
    providerId: 'cimas',
    providerName: 'Cimas',
    memberNumber: 'CIM-123456',
    orderId: 'ORD-1234',
    orderTotalUSD: 287.50,
    orderTotalZWL: 9343.75,
    exchangeRate: 32.50,
    awardAmount: null,
    awardCurrency: null,
    awardDate: null,
    shortfallAmount: null,
    shortfallPaid: false,
    shortfallPaidDate: null,
    status: 'pending',
    submittedDate: new Date('2024-01-15'),
    clearedDate: null
  },
  {
    id: 'clm-002',
    claimNumber: 'PSM-2401-045',
    patientName: 'Peter Dube',
    patientId: 'PT-002',
    providerId: 'psmas',
    providerName: 'PSMAS',
    memberNumber: 'PSM-789012',
    orderId: 'ORD-1235',
    orderTotalUSD: 350.00,
    orderTotalZWL: 11375.00,
    exchangeRate: 32.50,
    awardAmount: 210.00,
    awardCurrency: 'USD',
    awardDate: new Date('2024-01-20'),
    shortfallAmount: 140.00,
    shortfallPaid: false,
    shortfallPaidDate: null,
    status: 'awarded',
    submittedDate: new Date('2024-01-16'),
    clearedDate: null
  },
  {
    id: 'clm-003',
    claimNumber: 'FMH-2401-089',
    patientName: 'Thando Ndlovu',
    patientId: 'PT-003',
    providerId: 'first_mutual',
    providerName: 'First Mutual',
    memberNumber: 'FMH-345678',
    orderId: 'ORD-1236',
    orderTotalUSD: 180.00,
    orderTotalZWL: 5850.00,
    exchangeRate: 32.50,
    awardAmount: 180.00,
    awardCurrency: 'USD',
    awardDate: new Date('2024-01-18'),
    shortfallAmount: 0,
    shortfallPaid: true,
    shortfallPaidDate: new Date('2024-01-25'),
    status: 'cleared',
    submittedDate: new Date('2024-01-17'),
    clearedDate: new Date('2024-01-25')
  }
]

const PROVIDERS = [
  { id: 'all', name: 'All Providers' },
  { id: 'cimas', name: 'Cimas' },
  { id: 'first_mutual', name: 'First Mutual' },
  { id: 'psmas', name: 'PSMAS' },
  { id: 'liberty', name: 'Liberty' },
  { id: 'old_mutual', name: 'Old Mutual' }
]

// ============================================================================
// STATUS BADGE - Simple 3-state badge
// ============================================================================

const StatusBadge = ({ status }: { status: ClaimStatus }) => {
  const config = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: '●', label: 'Pending' },
    awarded: { bg: 'bg-blue-100', text: 'text-blue-800', dot: '●', label: 'Awarded' },
    cleared: { bg: 'bg-green-100', text: 'text-green-800', dot: '✓', label: 'Cleared' }
  }
  
  const style = config[status]
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span>{style.dot}</span>
      {style.label}
    </span>
  )
}

// ============================================================================
// TIMELINE - Simple 3-step
// ============================================================================

interface TimelineProps {
  submittedDate: Date | null
  awardedDate: Date | null
  paidDate: Date | null
  currentStatus: ClaimStatus
}

const Timeline = ({ submittedDate, awardedDate, paidDate, currentStatus }: TimelineProps) => {
  const steps = [
    { key: 'submitted', label: 'Submitted', date: submittedDate, status: 'completed' as const },
    { key: 'awarded', label: 'Awarded', date: awardedDate, status: 
        currentStatus === 'pending' ? 'upcoming' : 
        currentStatus === 'awarded' ? 'current' : 
        currentStatus === 'cleared' ? 'completed' : 'upcoming' 
    },
    { key: 'paid', label: 'Paid', date: paidDate, status: 
        currentStatus === 'cleared' ? 'completed' : 
        currentStatus === 'awarded' && awardedDate ? 'upcoming' : 
        'upcoming' 
    }
  ]

  const formatDate = (date: Date | null) => {
    if (!date) return '—'
    return date.toLocaleDateString('en-ZW', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-start gap-3">
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0
            ${step.status === 'completed' ? 'bg-green-500 text-white' : 
              step.status === 'current' ? 'bg-blue-500 text-white ring-2 ring-blue-200' : 
              'bg-gray-200 text-gray-500'}
          `}>
            {step.status === 'completed' ? '✓' : index + 1}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{step.label}</div>
            <div className="text-xs text-gray-500">{formatDate(step.date)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// AWARD MODAL - Simple amount entry
// ============================================================================

interface AwardModalProps {
  claim: MedicalAidClaim
  onClose: () => void
  onSave: (amount: number, currency: Currency) => void
}

const AwardModal = ({ claim, onClose, onSave }: AwardModalProps) => {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      onSave(numAmount, currency)
      onClose()
    }
  }

  

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Record Medical Aid Award</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Patient</div>
            <div className="font-medium">{claim.patientName}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500 mb-1">Provider</div>
            <div className="font-medium">{claim.providerName}</div>
            <div className="text-xs text-gray-500">Member: {claim.memberNumber}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Award Currency</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  currency === 'USD' ? 'bg-green-600 text-white' : 'bg-gray-100'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setCurrency('ZWL')}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  currency === 'ZWL' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                ZWL
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Award Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-2xl"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              max={currency === 'USD' ? claim.orderTotalUSD : claim.orderTotalZWL}
              autoFocus
              required
            />
            {currency === 'USD' && (
              <div className="mt-1 text-sm text-gray-500">
                ≈ {formatCurrency(parseFloat(amount) * claim.exchangeRate, 'ZWL')}
              </div>
            )}
            {currency === 'ZWL' && (
              <div className="mt-1 text-sm text-gray-500">
                ≈ {formatCurrency(parseFloat(amount) / claim.exchangeRate, 'USD')}
              </div>
            )}
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Award
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// SHORTFALL MODAL - Simple payment recording
// ============================================================================

interface ShortfallModalProps {
  claim: MedicalAidClaim
  onClose: () => void
  onSave: () => void
}

const ShortfallModal = ({ claim, onClose, onSave }: ShortfallModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [receiptNumber, setReceiptNumber] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
    onClose()
  }

  const shortfallDisplay = claim.awardCurrency === 'USD'
    ? formatCurrency(claim.shortfallAmount || 0, 'USD')
    : formatCurrency(claim.shortfallAmount || 0, 'ZWL')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Record Shortfall Payment</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="text-sm text-orange-800 mb-1">Shortfall Amount</div>
            <div className="text-2xl font-bold text-orange-600">{shortfallDisplay}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="cash">Cash</option>
              <option value="ecocash">Ecocash</option>
              <option value="card">Card</option>
              <option value="rtgs">RTGS</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Receipt Number (optional)</label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., RCPT-001"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

const formatCurrency = (amount: number, currency: Currency) => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }
  return `ZWL ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

const formatDate = (date: Date | null) => {
  if (!date) return '—'
  return date.toLocaleDateString('en-ZW', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  })
}

// ============================================================================
// MAIN MEDICAL AID SCREEN
// ============================================================================

export default function MedicalAidScreen() {
  const [claims] = useState<MedicalAidClaim[]>(MOCK_CLAIMS)
  const [selectedClaim, setSelectedClaim] = useState<MedicalAidClaim | null>(MOCK_CLAIMS[0])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [showAwardModal, setShowAwardModal] = useState(false)
  const [showShortfallModal, setShowShortfallModal] = useState(false)

  // Filter claims
  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      if (statusFilter !== 'all' && claim.status !== statusFilter) return false
      if (providerFilter !== 'all' && claim.providerId !== providerFilter) return false
      return true
    })
  }, [claims, statusFilter, providerFilter])

  // Calculate shortfall display for selected claim
  const shortfallDisplay = useMemo(() => {
    if (!selectedClaim || !selectedClaim.shortfallAmount) return null
    
    const currency = selectedClaim.awardCurrency || 'USD'
    return formatCurrency(selectedClaim.shortfallAmount, currency)
  }, [selectedClaim])

  // Handlers
  const handleRecordAward = (amount: number, currency: Currency) => {
    // In a real app, this would update the database
    console.log('Recording award:', { amount, currency })
    alert(`Award recorded: ${formatCurrency(amount, currency)}`)
  }

  const handleRecordShortfall = () => {
    // In a real app, this would update the database
    alert('Shortfall payment recorded')
  }

  const handleMarkCleared = () => {
    // In a real app, this would update the database
    alert('Claim marked as cleared')
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <MobileHeader />
        
        <div className="flex">
          <Sidebar />
          
          <main className="flex-1 p-4 lg:p-6">
            <div className="max-w-6xl mx-auto">
              
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Medical Aid Claims</h1>
                <p className="text-gray-600">Track awards, shortfalls, and payments</p>
              </div>
              
              {/* Filters - Simple */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="awarded">Awarded</option>
                      <option value="cleared">Cleared</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider
                    </label>
                    <select
                      value={providerFilter}
                      onChange={(e) => setProviderFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Two-Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Claims List - Left Column */}
                <div className="md:col-span-1">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-300px)] overflow-y-auto">
                    <div className="p-4 border-b bg-gray-50 sticky top-0">
                      <h2 className="font-semibold text-gray-800">Claims ({filteredClaims.length})</h2>
                    </div>
                    
                    {filteredClaims.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <div className="text-4xl mb-2">📋</div>
                        <p>No claims found</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredClaims.map(claim => (
                          <button
                            key={claim.id}
                            onClick={() => setSelectedClaim(claim)}
                            className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
                              selectedClaim?.id === claim.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">{claim.patientName}</span>
                              <StatusBadge status={claim.status} />
                            </div>
                            <div className="text-sm text-gray-600">{claim.providerName}</div>
                            <div className="flex justify-between items-center mt-2 text-sm">
                              {claim.awardAmount ? (
                                <>
                                  <span className="text-green-600">
                                    {formatCurrency(claim.awardAmount, claim.awardCurrency || 'USD')}
                                  </span>
                                  <span className="text-orange-600">
                                    {claim.shortfallAmount && claim.shortfallAmount > 0
                                      ? formatCurrency(claim.shortfallAmount, claim.awardCurrency || 'USD')
                                      : '—'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">No award yet</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Claim Details - Right Column */}
                {selectedClaim ? (
                  <div className="md:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                      
                      {/* Claim Header */}
                      <div className="p-4 border-b bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h2 className="font-bold text-lg">{selectedClaim.patientName}</h2>
                            <p className="text-sm text-gray-600">
                              Member: {selectedClaim.memberNumber} · {selectedClaim.providerName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Claim Ref: {selectedClaim.claimNumber}
                            </p>
                          </div>
                          <StatusBadge status={selectedClaim.status} />
                        </div>
                      </div>
                      
                      {/* Amount Cards */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase">Order Total</div>
                          <div className="text-xl font-bold">
                            {formatCurrency(selectedClaim.orderTotalUSD, 'USD')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(selectedClaim.orderTotalZWL, 'ZWL')}
                          </div>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase">Awarded</div>
                          {selectedClaim.awardAmount ? (
                            <>
                              <div className="text-xl font-bold text-green-700">
                                {formatCurrency(selectedClaim.awardAmount, selectedClaim.awardCurrency || 'USD')}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {selectedClaim.awardDate && formatDate(selectedClaim.awardDate)}
                              </div>
                            </>
                          ) : (
                            <div className="text-xl font-bold text-gray-400">—</div>
                          )}
                        </div>
                        
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase">Shortfall</div>
                          {selectedClaim.shortfallAmount && selectedClaim.shortfallAmount > 0 ? (
                            <>
                              <div className="text-xl font-bold text-orange-600">
                                {shortfallDisplay}
                              </div>
                              {selectedClaim.shortfallPaid && (
                                <div className="text-xs text-green-600 mt-1">Paid</div>
                              )}
                            </>
                          ) : (
                            <div className="text-xl font-bold text-gray-400">—</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Timeline & Actions */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Timeline */}
                        <div>
                          <h3 className="font-medium text-gray-700 mb-3">Progress</h3>
                          <Timeline
                            submittedDate={selectedClaim.submittedDate}
                            awardedDate={selectedClaim.awardDate}
                            paidDate={selectedClaim.clearedDate}
                            currentStatus={selectedClaim.status}
                          />
                        </div>
                        
                        {/* Actions */}
                        <div>
                          <h3 className="font-medium text-gray-700 mb-3">Actions</h3>
                          
                          {selectedClaim.status === 'pending' && (
                            <button
                              onClick={() => setShowAwardModal(true)}
                              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 mb-2"
                            >
                              Record Award
                            </button>
                          )}
                          
                          {selectedClaim.status === 'awarded' && selectedClaim.shortfallAmount && selectedClaim.shortfallAmount > 0 && !selectedClaim.shortfallPaid && (
                            <button
                              onClick={() => setShowShortfallModal(true)}
                              className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 mb-2"
                            >
                              Record Shortfall Payment
                            </button>
                          )}
                          
                          {selectedClaim.status === 'awarded' && selectedClaim.shortfallAmount === 0 && (
                            <button
                              onClick={handleMarkCleared}
                              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 mb-2"
                            >
                              Mark as Cleared
                            </button>
                          )}
                          
                          {selectedClaim.status === 'cleared' && (
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                              <span className="text-green-700 font-medium">✓ Claim fully paid</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Order Reference */}
                      <div className="p-4 border-t bg-gray-50 text-xs text-gray-500">
                        Order #{selectedClaim.orderId} · Submitted {formatDate(selectedClaim.submittedDate)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-medium mb-2">Select a claim</h3>
                    <p>Choose a claim from the list to view details</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Modals */}
      {showAwardModal && selectedClaim && (
        <AwardModal
          claim={selectedClaim}
          onClose={() => setShowAwardModal(false)}
          onSave={handleRecordAward}
        />
      )}
      
      {showShortfallModal && selectedClaim && (
        <ShortfallModal
          claim={selectedClaim}
          onClose={() => setShowShortfallModal(false)}
          onSave={handleRecordShortfall}
        />
      )}
    </ErrorBoundary>
  )
}