// components/layout/MobileHeader.tsx
'use client'

import { useNavigation } from '@/contexts/NavigationContext'
import { usePathname } from 'next/navigation'

const NAV_ITEMS: Record<string, { name: string; icon: string }> = {
  '/': { name: 'Dashboard', icon: '🏠' },
  '/order/create': { name: 'New Order', icon: '➕' },
  '/payment': { name: 'Payments', icon: '💰' },
  '/medical-aid': { name: 'Medical Aid', icon: '🏥' },
  '/receipt': { name: 'Receipts', icon: '🧾' }
}

export default function MobileHeader() {
  const { toggleMobileNav } = useNavigation()
  const pathname = usePathname()
  
  const currentPage = NAV_ITEMS[pathname] || { name: 'VisionPlus', icon: '👁️' }

  return (
    <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 h-16">
        {/* Menu Button */}
        <button
          onClick={toggleMobileNav}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Open menu"
          aria-expanded="false"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Current Page */}
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{currentPage.icon}</span>
          <span className="font-bold text-vp-primary">{currentPage.name}</span>
        </div>

        {/* Clinic Initial */}
        <div className="w-10 h-10 bg-vp-primary rounded-lg flex items-center justify-center text-white font-bold">
          L
        </div>
      </div>
    </header>
  )
}