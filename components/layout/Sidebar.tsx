// components/layout/Sidebar.tsx
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useNavigation } from '@/contexts/NavigationContext'

interface NavItem {
  name: string
  href: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'New Order', href: '/order/create', icon: '➕' },
  { name: 'Payments', href: '/payment', icon: '💰' },
  { name: 'Medical Aid', href: '/medical-aid', icon: '🏥' },
  { name: 'Receipts', href: '/receipt', icon: '🧾' }
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobileNavOpen, closeMobileNav } = useNavigation()

  const handleNavigation = (href: string) => {
    router.push(href)
    closeMobileNav()
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[280px] bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Main Navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-[73px] flex items-center px-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-vp-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">VP</span>
              </div>
              <span className="font-bold text-vp-primary text-lg">VisionPlus</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 py-6 overflow-y-auto">
            <ul className="space-y-1 px-3">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))

                return (
                  <li key={item.href}>
                    <button
                      onClick={() => handleNavigation(item.href)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-colors duration-200
                        ${isActive
                          ? 'bg-vp-primary text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="text-xl" aria-hidden="true">{item.icon}</span>
                      <span className="font-medium">{item.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200" />

            {/* Clinic Info */}
            <div className="px-6">
              <div className="p-4 bg-gradient-to-br from-currency-locked/10 to-transparent rounded-lg border border-currency-locked/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-currency-locked text-lg">🏥</span>
                  <span className="text-sm font-bold text-currency-locked">Link Opticians</span>
                </div>
                <div className="text-xs text-gray-600">
                  <div>Reception: Fred Stanley</div>
                  <div className="mt-1 text-[10px] text-gray-500">v2.1.0 • Zimbabwe</div>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}