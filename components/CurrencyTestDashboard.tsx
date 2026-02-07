'use client'

import { useState } from 'react'

export default function CurrencyTestDashboard() {
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'ZWL'>('USD')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('1250')
  const [isRateLocked, setIsRateLocked] = useState(false)

  const calculateEquivalent = () => {
    const numAmount = parseFloat(amount) || 0
    const numRate = parseFloat(rate) || 1250
    
    if (selectedCurrency === 'USD') {
      return (numAmount * numRate).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    } else {
      return (numAmount / numRate).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }
  }

  return (
    <div className="vp-card mb-6">
      <div className="vp-card-header">
        Currency Conversion Test
      </div>
      <div className="vp-card-body">
        <div className="vp-grid vp-grid-3 gap-6">
          {/* Currency Selection */}
          <div className="vp-form-group">
            <label className="vp-form-label">Transaction Currency</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCurrency('USD')}
                className={`vp-btn flex-1 flex items-center justify-center gap-2 ${
                  selectedCurrency === 'USD' 
                    ? 'currency-usd font-bold' 
                    : 'vp-btn-outline'
                }`}
              >
                <span>USD</span>
                <span className="text-xs">($)</span>
              </button>
              <button
                onClick={() => setSelectedCurrency('ZWL')}
                className={`vp-btn flex-1 flex items-center justify-center gap-2 ${
                  selectedCurrency === 'ZWL' 
                    ? 'currency-zwl font-bold' 
                    : 'vp-btn-outline'
                }`}
              >
                <span>ZWL</span>
                <span className="text-xs">(ZW$)</span>
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Base Currency: Clinic USD Account
            </div>
          </div>

          {/* Amount Input */}
          <div className="vp-form-group">
            <label className="vp-form-label">Amount in {selectedCurrency}</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="vp-form-control pl-12"
                placeholder="Enter amount"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <span className="font-bold">
                  {selectedCurrency === 'USD' ? '$' : 'ZW$'}
                </span>
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Enter the transaction amount
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="vp-form-group">
            <label className="vp-form-label">Exchange Rate</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="vp-form-control"
                disabled={isRateLocked}
                placeholder="Rate (ZWL per USD)"
              />
              <button
                onClick={() => setIsRateLocked(!isRateLocked)}
                className={`vp-btn px-4 ${
                  isRateLocked 
                    ? 'currency-locked' 
                    : 'vp-btn-outline'
                }`}
              >
                {isRateLocked ? '🔒' : '🔓'}
              </button>
            </div>
            <div className="mt-2 text-sm">
              {isRateLocked ? (
                <span className="text-currency-locked flex items-center gap-1">
                  <span>🔒</span> Rate locked for transaction
                </span>
              ) : (
                <span className="text-gray-600">Rate can be edited</span>
              )}
            </div>
          </div>
        </div>

        {/* Conversion Result */}
        {amount && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">Equivalent Amount</div>
              <div className="text-3xl font-bold text-vp-primary mb-2">
                {selectedCurrency === 'USD' ? (
                  <>
                    {calculateEquivalent()} <span className="text-currency-zwl">ZWL</span>
                  </>
                ) : (
                  <>
                    {calculateEquivalent()} <span className="text-currency-usd">USD</span>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500">
                1 USD = {parseFloat(rate).toLocaleString()} ZWL
              </div>
            </div>
          </div>
        )}

        {/* Test Controls */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setAmount('')
              setRate('1250')
              setIsRateLocked(false)
            }}
            className="vp-btn vp-btn-outline"
          >
            Reset Test
          </button>
          <button
            onClick={() => {
              setAmount('100')
              setRate('1250')
              setIsRateLocked(true)
            }}
            className="vp-btn vp-btn-primary"
          >
            Test with Sample Data
          </button>
        </div>
      </div>
    </div>
  )
}