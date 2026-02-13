// components/accessibility/AccessibilityProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AccessibilityContextType {
  highContrast: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
  screenReader: boolean
  reduceMotion: boolean
  toggleHighContrast: () => void
  increaseFontSize: () => void
  decreaseFontSize: () => void
  toggleScreenReader: () => void
  toggleReduceMotion: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal')
  const [screenReader, setScreenReader] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const savedHighContrast = localStorage.getItem('visionplus_highContrast') === 'true'
    const savedFontSize = localStorage.getItem('visionplus_fontSize') as 'normal' | 'large' | 'xlarge'
    const savedScreenReader = localStorage.getItem('visionplus_screenReader') === 'true'
    const savedReduceMotion = localStorage.getItem('visionplus_reduceMotion') === 'true'

    setHighContrast(savedHighContrast)
    if (savedFontSize) setFontSize(savedFontSize)
    setScreenReader(savedScreenReader)
    setReduceMotion(savedReduceMotion)
  }, [])

  // Apply accessibility styles
  useEffect(() => {
    const root = document.documentElement
    
    // High Contrast
    if (highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
    
    // Font Size
    root.style.fontSize = fontSize === 'normal' ? '14px' : fontSize === 'large' ? '16px' : '18px'
    
    // Reduce Motion
    if (reduceMotion) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }
    
    // Screen Reader
    if (screenReader) {
      document.body.setAttribute('aria-live', 'polite')
    } else {
      document.body.removeAttribute('aria-live')
    }
    
    // Save preferences
    localStorage.setItem('visionplus_highContrast', highContrast.toString())
    localStorage.setItem('visionplus_fontSize', fontSize)
    localStorage.setItem('visionplus_screenReader', screenReader.toString())
    localStorage.setItem('visionplus_reduceMotion', reduceMotion.toString())
  }, [highContrast, fontSize, screenReader, reduceMotion])

  const toggleHighContrast = () => setHighContrast(!highContrast)
  
  const increaseFontSize = () => {
    if (fontSize === 'normal') setFontSize('large')
    else if (fontSize === 'large') setFontSize('xlarge')
  }
  
  const decreaseFontSize = () => {
    if (fontSize === 'xlarge') setFontSize('large')
    else if (fontSize === 'large') setFontSize('normal')
  }
  
  const toggleScreenReader = () => setScreenReader(!screenReader)
  const toggleReduceMotion = () => setReduceMotion(!reduceMotion)

  return (
    <AccessibilityContext.Provider value={{
      highContrast,
      fontSize,
      screenReader,
      reduceMotion,
      toggleHighContrast,
      increaseFontSize,
      decreaseFontSize,
      toggleScreenReader,
      toggleReduceMotion
    }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}