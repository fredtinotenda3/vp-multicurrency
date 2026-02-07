import CurrencyTestDashboard from '@/components/CurrencyTestDashboard'
import QuickNavigation from '@/components/QuickNavigation'
import SystemStatus from '@/components/SystemStatus'

export default function Home() {
  return (
    <div className="min-h-screen bg-vp-background">
      {/* Header */}
      <header className="vp-header">
        <div className="vp-header-content">
          <div className="vp-logo">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-vp-primary font-bold text-xl">VP</span>
            </div>
            <span className="vp-logo-text">VisionPlus</span>
            <span className="text-sm bg-vp-secondary px-2 py-1 rounded">
              Multi-Currency System
            </span>
          </div>
          
          <div className="vp-user-info">
            <div className="text-right">
              <div className="font-bold">Link Opticians</div>
              <div className="text-sm">Reception: Fred Stanley</div>
            </div>
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="vp-main-layout">
        {/* Sidebar */}
        <aside className="vp-sidebar">
          <nav>
            <ul className="vp-sidebar-nav">
              <li className="vp-sidebar-item active">
                <a href="#" className="vp-sidebar-link">
                  <span>🏠</span> Dashboard
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>👨‍⚕️</span> Patients
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>💰</span> Billing & Payments
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>🏥</span> Medical Aid
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>👓</span> Dispensing
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>📊</span> Reports
                </a>
              </li>
              <li className="vp-sidebar-item">
                <a href="#" className="vp-sidebar-link">
                  <span>⚙️</span> Settings
                </a>
              </li>
            </ul>
          </nav>
          
          {/* Exchange Rate Info */}
          <div className="mt-8 mx-4 p-4 bg-vp-primary/10 rounded-lg">
            <div className="text-sm text-vp-primary font-bold mb-2">
              Today&apos;s Exchange Rate
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-vp-primary">
                  1 USD
                </div>
                <div className="text-sm text-gray-600">
                  = 32.5 ZWL
                </div>
              </div>
              <span className="text-xs bg-vp-accent text-gray-800 px-2 py-1 rounded">
                Live
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Last updated: 10:45 AM
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="vp-content">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-vp-primary">
              Multi-Currency Test Dashboard
            </h1>
            <p className="text-gray-600">
              Test the new multi-currency features for Zimbabwe Link Opticians
            </p>
          </div>

          {/* System Status */}
          <SystemStatus />

          {/* Quick Navigation */}
          <QuickNavigation />

          {/* Currency Test Dashboard */}
          <CurrencyTestDashboard />

          {/* Test Panels */}
          <div className="vp-grid vp-grid-2 gap-6 mt-8">
            {/* Order Creation Test */}
            <div className="vp-card">
              <div className="vp-card-header">
                Order Creation Test
              </div>
              <div className="vp-card-body">
                <div className="vp-form-group">
                  <label className="vp-form-label">Select Currency</label>
                  <div className="flex gap-4">
                    <button className="vp-btn currency-usd flex items-center gap-2">
                      <span>USD</span>
                      <span className="text-xs">$</span>
                    </button>
                    <button className="vp-btn currency-zwl flex items-center gap-2">
                      <span>ZWL</span>
                      <span className="text-xs">ZW$</span>
                    </button>
                  </div>
                </div>
                
                <div className="exchange-rate-display exchange-rate-locked">
                  <div className="exchange-rate-label">Locked Exchange Rate</div>
                  <div className="exchange-rate-value">1 USD = 1,250 ZWL</div>
                  <div className="text-sm text-currency-locked flex items-center gap-2">
                    <span>🔒</span> Rate locked for this transaction
                  </div>
                </div>
                
                <div className="vp-alert vp-alert-warning">
                  <strong>Warning:</strong> Once locked, exchange rate cannot be changed for this transaction
                </div>
              </div>
            </div>

            {/* Payment Test */}
            <div className="vp-card">
              <div className="vp-card-header">
                Payment Processing Test
              </div>
              <div className="vp-card-body">
                <div className="vp-form-group">
                  <label className="vp-form-label">Payment Amount</label>
                  <div className="flex items-center gap-2">
                    <select className="vp-form-control w-24">
                      <option value="USD">USD</option>
                      <option value="ZWL">ZWL</option>
                    </select>
                    <input 
                      type="number" 
                      className="vp-form-control flex-1"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>
                
                <div className="vp-form-group">
                  <div className="summary-row">
                    <span className="text-gray-600">Equivalent in ZWL:</span>
                    <span className="font-bold text-currency-zwl">31,250 ZWL</span>
                  </div>
                  <div className="summary-row">
                    <span className="text-gray-600">Equivalent in USD:</span>
                    <span className="font-bold text-currency-usd">25.00 USD</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button className="vp-btn vp-btn-primary flex-1">
                    Cash Payment
                  </button>
                  <button className="vp-btn vp-btn-secondary flex-1">
                    Medical Aid
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Medical Aid Test */}
          <div className="vp-card mt-8">
            <div className="vp-card-header">
              Medical Aid Claim Test
            </div>
            <div className="vp-card-body">
              <div className="vp-grid vp-grid-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-600">Awarded Amount</div>
                  <div className="text-2xl font-bold text-currency-usd">150.00 USD</div>
                  <div className="text-sm text-gray-500">(187,500 ZWL)</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-600">Shortfall</div>
                  <div className="text-2xl font-bold text-status-partial">45.00 USD</div>
                  <div className="text-sm text-gray-500">(56,250 ZWL)</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-600">Outstanding</div>
                  <div className="text-2xl font-bold text-status-pending">45.00 USD</div>
                  <div className="text-sm text-gray-500">Patient to pay</div>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="font-bold text-vp-primary mb-4">Claim Timeline</h3>
                <div className="vp-timeline">
                  <div className="vp-timeline-item completed">
                    <div className="vp-timeline-date">2024-01-15 09:30</div>
                    <div className="vp-timeline-title">Claim Submitted</div>
                    <div className="vp-timeline-description">To CIMAS Medical Aid</div>
                  </div>
                  <div className="vp-timeline-item active">
                    <div className="vp-timeline-date">2024-01-20 14:15</div>
                    <div className="vp-timeline-title">Award Received</div>
                    <div className="vp-timeline-description">150.00 USD awarded</div>
                  </div>
                  <div className="vp-timeline-item pending">
                    <div className="vp-timeline-date">Pending</div>
                    <div className="vp-timeline-title">Shortfall Payment</div>
                    <div className="vp-timeline-description">Patient to pay 45.00 USD</div>
                  </div>
                  <div className="vp-timeline-item">
                    <div className="vp-timeline-date">Pending</div>
                    <div className="vp-timeline-title">Medical Aid Payment</div>
                    <div className="vp-timeline-description">Awaiting remittance</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Summary Test */}
          <div className="vp-card mt-8">
            <div className="vp-card-header">
              Transaction Summary / Receipt View
            </div>
            <div className="vp-card-body">
              <div className="transaction-summary">
                <div className="summary-row">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono">TX-2024-001-5678</span>
                </div>
                <div className="summary-row">
                  <span className="text-gray-600">Date & Time:</span>
                  <span>2024-01-20 10:30:45</span>
                </div>
                <div className="summary-row">
                  <span className="text-gray-600">Cashier:</span>
                  <span>John Moyo (Reception)</span>
                </div>
                
                <div className="my-4 border-t pt-4">
                  <div className="summary-row">
                    <span className="text-gray-600">Original Amount:</span>
                    <span className="flex items-center gap-2">
                      <span className="currency-badge currency-usd">USD</span>
                      <span className="font-bold">195.00</span>
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="text-gray-600">Exchange Rate:</span>
                    <span className="flex items-center gap-2">
                      <span className="currency-badge currency-locked">1 USD = 1,250 ZWL</span>
                      <span className="text-xs text-currency-locked">🔒 Locked</span>
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="text-gray-600">Converted Total:</span>
                    <span className="flex items-center gap-2">
                      <span className="currency-badge currency-zwl">ZWL</span>
                      <span className="font-bold">243,750</span>
                    </span>
                  </div>
                </div>
                
                <div className="summary-row summary-total">
                  <span className="text-lg text-vp-primary">Total Amount:</span>
                  <span className="text-lg font-bold text-vp-primary">
                    195.00 USD / 243,750 ZWL
                  </span>
                </div>
                
                <div className="mt-6 flex justify-between">
                  <button className="vp-btn vp-btn-outline print-hide">
                    📄 Print Receipt
                  </button>
                  <button className="vp-btn vp-btn-primary">
                    ✅ Complete Transaction
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="vp-footer bg-vp-primary text-white py-4 mt-8">
        <div className="vp-container">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold">VisionPlus v2.1</div>
              <div className="text-sm">Multi-Currency System for Zimbabwe Clinics</div>
            </div>
            <div className="text-right text-sm">
              <div>© 2024 VisionPlus. All rights reserved.</div>
              <div>Exchange Rate Source: Reserve Bank of Zimbabwe</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}