// components/accessibility/AccessibilityToolbar.tsx
'use client'

import { useState } from 'react'
import { useAccessibility } from './AccessibilityProvider'

export default function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    highContrast,
    fontSize,
    screenReader,
    reduceMotion,
    toggleHighContrast,
    increaseFontSize,
    decreaseFontSize,
    toggleScreenReader,
    toggleReduceMotion
  } = useAccessibility()

  const fontSizeLabel = fontSize === 'normal' ? 'A' : fontSize === 'large' ? 'A+' : 'A++'

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-40 w-12 h-12 bg-vp-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-vp-primary/90 transition-colors"
        aria-label="Accessibility settings"
        aria-expanded={isOpen}
      >
        <span className="text-xl">♿</span>
      </button>

      {/* Toolbar Panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-40 vp-card max-w-xs animate-slide-in-up">
          <div className="vp-card-header flex justify-between items-center">
            <span>Accessibility</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200"
              aria-label="Close accessibility settings"
            >
              ✕
            </button>
          </div>
          
          <div className="vp-card-body space-y-4">
            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">High Contrast</div>
                <div className="text-sm text-gray-600">Better visibility</div>
              </div>
              <button
                onClick={toggleHighContrast}
                className={`w-12 h-6 rounded-full transition-colors ${
                  highContrast ? 'bg-vp-primary' : 'bg-gray-300'
                }`}
                aria-label={highContrast ? 'Disable high contrast' : 'Enable high contrast'}
                aria-pressed={highContrast}
              >
                <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                  highContrast ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="font-medium">Font Size</div>
              <div className="flex items-center gap-4">
                <button
                  onClick={decreaseFontSize}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  disabled={fontSize === 'normal'}
                  aria-label="Decrease font size"
                >
                  <span className="text-lg">−</span>
                </button>
                <div className="flex-1 text-center font-bold">
                  {fontSizeLabel}
                </div>
                <button
                  onClick={increaseFontSize}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  disabled={fontSize === 'xlarge'}
                  aria-label="Increase font size"
                >
                  <span className="text-lg">+</span>
                </button>
              </div>
            </div>

            {/* Screen Reader */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Screen Reader</div>
                <div className="text-sm text-gray-600">Enhanced announcements</div>
              </div>
              <button
                onClick={toggleScreenReader}
                className={`w-12 h-6 rounded-full transition-colors ${
                  screenReader ? 'bg-vp-primary' : 'bg-gray-300'
                }`}
                aria-label={screenReader ? 'Disable screen reader' : 'Enable screen reader'}
                aria-pressed={screenReader}
              >
                <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                  screenReader ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Reduce Motion */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Reduce Motion</div>
                <div className="text-sm text-gray-600">Fewer animations</div>
              </div>
              <button
                onClick={toggleReduceMotion}
                className={`w-12 h-6 rounded-full transition-colors ${
                  reduceMotion ? 'bg-vp-primary' : 'bg-gray-300'
                }`}
                aria-label={reduceMotion ? 'Enable animations' : 'Reduce motion'}
                aria-pressed={reduceMotion}
              >
                <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                  reduceMotion ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="pt-4 border-t">
              <div className="font-medium mb-2">Keyboard Shortcuts</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• <kbd className="px-1 bg-gray-100 rounded">Tab</kbd> Navigate</div>
                <div>• <kbd className="px-1 bg-gray-100 rounded">Enter</kbd> Select</div>
                <div>• <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> Cancel</div>
              </div>
            </div>
          </div>
          
          <div className="vp-card-footer">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('main-content')?.focus()
              }}
              className="text-sm text-vp-secondary hover:text-vp-primary"
            >
              Skip to main content
            </a>
          </div>
        </div>
      )}
    </>
  )
}