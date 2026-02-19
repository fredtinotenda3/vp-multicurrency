// app/(screens)/order/create/page.tsx
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'

// ============================================================================
// TYPES - Simplified for clinic staff
// ============================================================================

type Currency = 'USD' | 'ZWL'
type MedicalAidProvider = 'cimas' | 'first_mutual' | 'psmas' | 'liberty' | 'old_mutual' | 'none'

interface PatientInfo {
  name: string
  phone: string
  medicalAidProvider?: MedicalAidProvider
  memberNumber?: string
}

interface OrderItem {
  id: string
  name: string
  priceUSD: number
  priceZWL: number
  quantity: number
}

// Simplified product catalog - just what reception needs
const PRODUCTS = [
  { id: 'frm-001', name: 'Ray-Ban Aviator', priceUSD: 120.00 },
  { id: 'frm-002', name: 'Oakley Holbrook', priceUSD: 95.00 },
  { id: 'frm-003', name: 'Gucci GG0061S', priceUSD: 180.00 },
  { id: 'frm-004', name: 'Polo Ralph Lauren', priceUSD: 85.00 },
  { id: 'lns-001', name: 'Single Vision Lenses', priceUSD: 45.00 },
  { id: 'lns-002', name: 'Progressive Lenses', priceUSD: 180.00 },
  { id: 'lns-003', name: 'Bifocal Lenses', priceUSD: 95.00 },
  { id: 'acc-001', name: 'Anti-Reflective Coating', priceUSD: 35.00 },
  { id: 'acc-002', name: 'Blue Light Blocking', priceUSD: 45.00 },
  { id: 'acc-003', name: 'Scratch Resistant', priceUSD: 25.00 },
  { id: 'srv-001', name: 'Eye Examination', priceUSD: 50.00 },
]

const MEDICAL_AID_PROVIDERS = [
  { id: 'cimas', name: 'Cimas' },
  { id: 'first_mutual', name: 'First Mutual' },
  { id: 'psmas', name: 'PSMAS' },
  { id: 'liberty', name: 'Liberty' },
  { id: 'old_mutual', name: 'Old Mutual' },
]

// ============================================================================
// MAIN ORDER SCREEN - Simplified for clinic staff
// ============================================================================

export default function OrderScreen() {
  const router = useRouter()
  
  // State
  const [currency, setCurrency] = useState<Currency>('USD')
  const [exchangeRate, setExchangeRate] = useState(32.50) // Fixed rate for demo
  const [isRateLocked, setIsRateLocked] = useState(false)
  const [patient, setPatient] = useState<PatientInfo>({ name: '', phone: '' })
  const [items, setItems] = useState<OrderItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return PRODUCTS
    return PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  // Calculate totals
  const totals = useMemo(() => {
    const subtotalUSD = items.reduce((sum, item) => sum + (item.priceUSD * item.quantity), 0)
    const subtotalZWL = items.reduce((sum, item) => sum + (item.priceZWL * item.quantity), 0)
    
    return {
      subtotalUSD,
      subtotalZWL,
      totalUSD: subtotalUSD,
      totalZWL: subtotalZWL,
      itemCount: items.length
    }
  }, [items])

  // Handlers
  const handleLockRate = () => {
    setIsRateLocked(true)
  }

  const handleAddItem = () => {
    if (!selectedProduct) return
    
    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: selectedProduct.name,
      priceUSD: selectedProduct.priceUSD,
      priceZWL: selectedProduct.priceUSD * exchangeRate,
      quantity
    }
    
    setItems([...items, newItem])
    setSelectedProduct(null)
    setQuantity(1)
  }

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      setItems(items.filter(i => i.id !== itemId))
      return
    }
    
    setItems(items.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ))
  }

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId))
  }

  const handleProceedToPayment = () => {
    // Basic validation
    if (!patient.name.trim()) {
      alert('Please enter patient name')
      return
    }
    if (!patient.phone.trim()) {
      alert('Please enter phone number')
      return
    }
    if (!isRateLocked) {
      alert('Please lock exchange rate first')
      return
    }
    if (items.length === 0) {
      alert('Please add at least one item')
      return
    }

    setIsProcessing(true)
    
    // Save order to session
    sessionStorage.setItem('current_order', JSON.stringify({
      patient,
      currency,
      exchangeRate,
      items,
      totals,
      orderId: `ORD-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString()
    }))
    
    setIsProcessing(false)
    router.push('/payment')
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

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={isProcessing} message="Creating order..." />
      
      <div className="min-h-screen bg-gray-50">
        <MobileHeader />
        
        <div className="flex">
          <Sidebar />
          
          <main className="flex-1 p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              
              {/* PATIENT INFORMATION - Simplified */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="font-semibold text-gray-800">Patient Information</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Patient Name
                      </label>
                      <input
                        type="text"
                        value={patient.name}
                        onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={patient.phone}
                        onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+263 77 123 4567"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Medical Aid Provider
                      </label>
                      <select
                        value={patient.medicalAidProvider || 'none'}
                        onChange={(e) => {
                          const value = e.target.value as MedicalAidProvider | 'none'
                          setPatient({ 
                            ...patient, 
                            medicalAidProvider: value === 'none' ? undefined : value,
                            memberNumber: value === 'none' ? undefined : patient.memberNumber
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None (Cash Patient)</option>
                        {MEDICAL_AID_PROVIDERS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {patient.medicalAidProvider && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Member Number
                        </label>
                        <input
                          type="text"
                          value={patient.memberNumber || ''}
                          onChange={(e) => setPatient({ ...patient, memberNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., CIM-123456"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* CURRENCY SECTION - Simplified */}
              <div className={`bg-white rounded-lg shadow-sm border-2 mb-4 transition-colors ${
                isRateLocked ? 'border-purple-500' : 'border-gray-200'
              }`}>
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <h2 className="font-semibold text-gray-800">Transaction Currency</h2>
                  {isRateLocked && (
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      <span>🔒</span> Rate Locked
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Currency Toggle - Large, clear buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => !isRateLocked && setCurrency('USD')}
                        disabled={isRateLocked}
                        className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
                          currency === 'USD'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${isRateLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => !isRateLocked && setCurrency('ZWL')}
                        disabled={isRateLocked}
                        className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
                          currency === 'ZWL'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${isRateLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        ZWL
                      </button>
                    </div>
                    
                    {/* Exchange Rate Display */}
                    <div className="text-center md:text-right">
                      <div className="text-sm text-gray-500">Exchange Rate</div>
                      <div className="text-2xl font-bold text-gray-800">
                        1 USD = {exchangeRate.toFixed(2)} ZWL
                      </div>
                    </div>
                    
                    {/* Lock Button */}
                    {!isRateLocked ? (
                      <button
                        onClick={handleLockRate}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <span>🔒</span> Lock Rate
                      </button>
                    ) : (
                      <div className="text-purple-600 font-medium flex items-center gap-2 justify-end">
                        <span>🔒</span> Rate locked for this transaction
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* ADD ITEMS - Simplified product selection */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="font-semibold text-gray-800">Add Items</h2>
                </div>
                <div className="p-4">
                  
                  {/* Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search products..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Product Grid - Simple cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4 max-h-64 overflow-y-auto p-1">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          selectedProduct?.id === product.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="text-green-600 font-bold mt-1">
                          {formatCurrency(product.priceUSD, 'USD')}
                        </div>
                        {isRateLocked && (
                          <div className="text-xs text-gray-500">
                            ≈ {formatCurrency(product.priceUSD * exchangeRate, 'ZWL')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Selected Product & Quantity */}
                  {selectedProduct && (
                    <div className="border-t pt-4 mt-2">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                          <div className="font-medium">{selectedProduct.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(selectedProduct.priceUSD, 'USD')}
                            {isRateLocked && ` · ${formatCurrency(selectedProduct.priceUSD * exchangeRate, 'ZWL')}`}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-gray-300 rounded-md">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="px-3 py-1 hover:bg-gray-100 text-lg"
                            >
                              −
                            </button>
                            <span className="w-12 text-center">{quantity}</span>
                            <button
                              onClick={() => setQuantity(quantity + 1)}
                              className="px-3 py-1 hover:bg-gray-100 text-lg"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            onClick={handleAddItem}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Add to Order
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* ORDER SUMMARY - Clean totals */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <h2 className="font-semibold text-gray-800">Order Summary</h2>
                  {items.length > 0 && (
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                {items.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-4xl mb-2">🛒</div>
                    <p>No items added yet</p>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Items List */}
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              {formatCurrency(item.priceUSD, 'USD')} × {item.quantity}
                            </div>
                          </div>
                          <div className="text-right mr-4">
                            <div className="font-bold">
                              {formatCurrency(item.priceUSD * item.quantity, 'USD')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(item.priceZWL * item.quantity, 'ZWL')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-200"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-200"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="ml-2 text-red-500 hover:text-red-700 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Totals - Prominent display */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <div className="text-right">
                          <div>{formatCurrency(totals.subtotalUSD, 'USD')}</div>
                          <div className="text-xs">{formatCurrency(totals.subtotalZWL, 'ZWL')}</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-xl font-bold pt-2 border-t">
                        <span>TOTAL</span>
                        <div className="text-right">
                          <div className="text-green-600">{formatCurrency(totals.totalUSD, 'USD')}</div>
                          <div className="text-sm text-blue-600">{formatCurrency(totals.totalZWL, 'ZWL')}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Proceed Button */}
                    <button
                      onClick={handleProceedToPayment}
                      className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors"
                    >
                      PROCEED TO PAYMENT
                    </button>
                  </div>
                )}
              </div>
              
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}