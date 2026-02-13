// components/payment/NumberPadInput.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ============================================================================
// TYPES - Production Grade, Zimbabwe Currency Specific
// ============================================================================

type Currency = 'USD' | 'ZWL'
type NumberPadLayout = 'standard' | 'compact' | 'full'
type InputMode = 'currency' | 'quantity' | 'percentage' | 'rate'

interface NumberPadInputProps {
  // Core Props
  value: string
  onChange: (value: string, numericValue: number) => void
  currency: Currency
  
  // Validation
  min?: number
  max?: number
  step?: number
  maxDecimalPlaces?: number
  allowNegative?: boolean
  
  // Zimbabwe Specific
  enforceZWLMax?: boolean // ZWL has lower max due to denominations
  enforceUSDMin?: boolean // USD has minimum cash amounts
  
  // UI Configuration
  layout?: NumberPadLayout
  inputMode?: InputMode
  showDisplay?: boolean
  showQuickAmounts?: boolean
  showActionButtons?: boolean
  className?: string
  displayClassName?: string
  
  // Quick Amounts
  quickAmounts?: number[]
  customQuickAmounts?: Array<{ label: string; value: number }>
  
  // State
  disabled?: boolean
  readOnly?: boolean
  error?: string
  warning?: string
  
  // Events
  onBlur?: () => void
  onFocus?: () => void
  onMaxClick?: () => void
  onClearClick?: () => void
  
  // Accessibility
  ariaLabel?: string
  ariaDescribedBy?: string
}

interface NumberPadButtonProps {
  value: string
  label?: string
  onClick: (value: string) => void
  className?: string
  disabled?: boolean
  variant?: 'number' | 'action' | 'special'
  size?: 'sm' | 'md' | 'lg'
}

// ============================================================================
// ZIMBABWE CURRENCY CONSTANTS
// ============================================================================

const ZIMBABWE_CURRENCY_LIMITS = {
  USD: {
    min: 0.01,
    max: 10000,
    defaultStep: 0.01,
    quickAmounts: [5, 10, 20, 50, 100],
    denominations: [1, 5, 10, 20, 50, 100],
    maxDecimalPlaces: 2
  },
  ZWL: {
    min: 0.01,
    max: 10000000,
    defaultStep: 0.01,
    quickAmounts: [50, 100, 200, 500, 1000],
    denominations: [1, 2, 5, 10, 20, 50, 100],
    maxDecimalPlaces: 2
  }
} as const

const QUICK_AMOUNT_PRESETS = {
  USD: [5, 10, 20, 50, 100],
  ZWL: [50, 100, 200, 500, 1000]
} as const

// ============================================================================
// NUMBER PAD BUTTON COMPONENT
// ============================================================================

const NumberPadButton = ({
  value,
  label,
  onClick,
  className = '',
  disabled = false,
  variant = 'number',
  size = 'md'
}: NumberPadButtonProps) => {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-16 h-16 text-xl'
  }

  const variantClasses = {
    number: 'bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-900',
    action: 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 text-gray-700 font-medium',
    special: 'bg-vp-primary/10 hover:bg-vp-primary/20 active:bg-vp-primary/30 border border-vp-primary/30 text-vp-primary font-bold'
  }

  const handleClick = () => {
    onClick(value)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-lg
        flex items-center justify-center
        transition-all duration-150
        font-mono
        focus:outline-none focus:ring-2 focus:ring-vp-secondary focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white
        ${className}
      `}
      aria-label={label || `Enter ${value}`}
    >
      {label || value}
    </button>
  )
}

// ============================================================================
// MAIN NUMBER PAD INPUT COMPONENT
// ============================================================================

export default function NumberPadInput({
  // Core Props
  value,
  onChange,
  currency,
  
  // Validation
  min,
  max,
  step = 0.01,
  maxDecimalPlaces = 2,
  allowNegative = false,
  
  // Zimbabwe Specific
  enforceZWLMax = true,
  enforceUSDMin = true,
  
  // UI Configuration
  layout = 'standard',
  inputMode = 'currency',
  showDisplay = true,
  showQuickAmounts = true,
  showActionButtons = true,
  className = '',
  displayClassName = '',
  
  // Quick Amounts
  quickAmounts,
  customQuickAmounts,
  
  // State
  disabled = false,
  readOnly = false,
  error,
  warning,
  
  // Events
  onBlur,
  onFocus,
  onMaxClick,
  onClearClick,
  
  // Accessibility
  ariaLabel,
  ariaDescribedBy
}: NumberPadInputProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [inputValue, setInputValue] = useState<string>(value || '0')
  const [isFocused, setIsFocused] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastValidValue = useRef<string>('0')

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const numericValue = useMemo(() => {
    const num = parseFloat(inputValue)
    return isNaN(num) ? 0 : num
  }, [inputValue])

  const isValid = useMemo(() => {
    if (disabled || readOnly) return true
    
    const num = numericValue
    const minValue = min ?? (currency === 'USD' ? ZIMBABWE_CURRENCY_LIMITS.USD.min : ZIMBABWE_CURRENCY_LIMITS.ZWL.min)
    const maxValue = max ?? (currency === 'USD' ? ZIMBABWE_CURRENCY_LIMITS.USD.max : ZIMBABWE_CURRENCY_LIMITS.ZWL.max)
    
    if (num < minValue) return false
    if (num > maxValue) return false
    
    const decimalPlaces = inputValue.split('.')[1]?.length || 0
    if (decimalPlaces > maxDecimalPlaces) return false
    
    return true
  }, [numericValue, inputValue, min, max, currency, maxDecimalPlaces, disabled, readOnly])

  const displayValue = useMemo(() => {
    if (inputValue === '' || inputValue === '-') return '0'
    
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: maxDecimalPlaces
      }).format(numericValue)
    } catch {
      return inputValue
    }
  }, [inputValue, numericValue, maxDecimalPlaces])

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validateInput = useCallback((newValue: string): { isValid: boolean; value: string; error?: string } => {
    // Empty value
    if (newValue === '' || newValue === '-') {
      return { isValid: true, value: '0' }
    }

    // Check for invalid characters
    if (!/^-?\d*\.?\d*$/.test(newValue)) {
      return { isValid: false, value: lastValidValue.current, error: 'Invalid characters' }
    }

    const num = parseFloat(newValue)
    if (isNaN(num)) {
      return { isValid: false, value: lastValidValue.current, error: 'Invalid number' }
    }

    // Check negative
    if (!allowNegative && num < 0) {
      return { isValid: false, value: lastValidValue.current, error: 'Negative amounts not allowed' }
    }

    // Check decimal places
    const decimalPlaces = newValue.split('.')[1]?.length || 0
    if (decimalPlaces > maxDecimalPlaces) {
      return { 
        isValid: false, 
        value: newValue.slice(0, newValue.length - 1), 
        error: `Maximum ${maxDecimalPlaces} decimal places` 
      }
    }

    // Check min/max
    const minValue = min ?? (currency === 'USD' ? ZIMBABWE_CURRENCY_LIMITS.USD.min : ZIMBABWE_CURRENCY_LIMITS.ZWL.min)
    const maxValue = max ?? (currency === 'USD' ? ZIMBABWE_CURRENCY_LIMITS.USD.max : ZIMBABWE_CURRENCY_LIMITS.ZWL.max)
    
    if (num < minValue) {
      return { 
        isValid: false, 
        value: minValue.toString(), 
        error: `Minimum amount is ${formatCurrency(minValue, currency)}` 
      }
    }
    
    if (num > maxValue) {
      return { 
        isValid: false, 
        value: maxValue.toString(), 
        error: `Maximum amount is ${formatCurrency(maxValue, currency)}` 
      }
    }

    return { isValid: true, value: newValue }
  }, [allowNegative, maxDecimalPlaces, min, max, currency])

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleNumberClick = useCallback((num: string) => {
    if (disabled || readOnly) return

    let newValue = inputValue
    
    // Handle decimal point
    if (num === '.') {
      if (!newValue.includes('.')) {
        newValue = newValue === '' || newValue === '0' ? '0.' : newValue + '.'
      }
    } 
    // Handle backspace
    else if (num === '⌫') {
      newValue = newValue.slice(0, -1)
      if (newValue === '' || newValue === '-') {
        newValue = '0'
      }
    }
    // Handle clear
    else if (num === 'C') {
      newValue = '0'
      onClearClick?.()
    }
    // Handle numbers
    else {
      if (newValue === '0' && num !== '.') {
        newValue = num
      } else {
        newValue += num
      }
    }

    // Validate
    const validation = validateInput(newValue)
    
    // Update history
    if (validation.value !== inputValue) {
      setHistory(prev => [...prev, inputValue].slice(-10))
      setHistoryIndex(-1)
    }

    setInputValue(validation.value)
    lastValidValue.current = validation.isValid ? validation.value : lastValidValue.current
    
    // Call onChange with numeric value
    const numericValue = parseFloat(validation.value)
    onChange(validation.value, isNaN(numericValue) ? 0 : numericValue)
  }, [inputValue, disabled, readOnly, validateInput, onChange, onClearClick])

  const handleMax = useCallback(() => {
    if (disabled || readOnly) return
    
    const maxValue = max ?? (currency === 'USD' ? ZIMBABWE_CURRENCY_LIMITS.USD.max : ZIMBABWE_CURRENCY_LIMITS.ZWL.max)
    const maxValueStr = maxValue.toString()
    
    setInputValue(maxValueStr)
    lastValidValue.current = maxValueStr
    onChange(maxValueStr, maxValue)
    onMaxClick?.()
  }, [disabled, readOnly, max, currency, onChange, onMaxClick])

  const handleUndo = useCallback(() => {
    if (history.length > 0 && historyIndex === -1) {
      const lastValue = history[history.length - 1]
      setHistory(prev => prev.slice(0, -1))
      setInputValue(lastValue)
      lastValidValue.current = lastValue
      onChange(lastValue, parseFloat(lastValue))
    }
  }, [history, historyIndex, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled || readOnly) return

    const key = e.key
    
    // Number keys
    if (/^[0-9]$/.test(key)) {
      e.preventDefault()
      handleNumberClick(key)
    }
    
    // Decimal point
    else if (key === '.') {
      e.preventDefault()
      handleNumberClick('.')
    }
    
    // Backspace
    else if (key === 'Backspace') {
      e.preventDefault()
      handleNumberClick('⌫')
    }
    
    // Enter/Return
    else if (key === 'Enter' || key === 'Return') {
      e.preventDefault()
      onBlur?.()
    }
    
    // Escape
    else if (key === 'Escape') {
      e.preventDefault()
      handleNumberClick('C')
    }
    
    // Undo (Ctrl+Z)
    else if (key === 'z' && e.ctrlKey) {
      e.preventDefault()
      handleUndo()
    }
    
    // Max (Ctrl+M)
    else if (key === 'm' && e.ctrlKey) {
      e.preventDefault()
      handleMax()
    }
  }, [disabled, readOnly, handleNumberClick, handleUndo, handleMax, onBlur])

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Sync with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '0')
    }
  }, [value])

  // Keyboard listeners
  useEffect(() => {
    if (isFocused) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFocused, handleKeyDown])

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const formatCurrency = (amount: number, currency: Currency): string => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    }
    
    return `ZWL ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const quickAmountItems = useMemo(() => {
    if (customQuickAmounts) return customQuickAmounts
    
    const amounts = quickAmounts || (currency === 'USD' 
      ? ZIMBABWE_CURRENCY_LIMITS.USD.quickAmounts 
      : ZIMBABWE_CURRENCY_LIMITS.ZWL.quickAmounts)
    
    return amounts.map(amount => ({
      label: currency === 'USD' ? `$${amount}` : `ZW$${amount}`,
      value: amount
    }))
  }, [currency, quickAmounts, customQuickAmounts])

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Display */}
      {showDisplay && (
        <div className="relative">
          <div
            className={`
              w-full px-4 py-3
              bg-white border-2 rounded-lg
              text-right text-2xl font-bold font-mono
              transition-colors duration-200
              ${error ? 'border-status-error bg-red-50' : 
                warning ? 'border-status-pending bg-amber-50' :
                isValid ? 'border-currency-locked' :
                currency === 'USD' ? 'border-currency-usd' : 'border-currency-zwl'
              }
              ${disabled ? 'bg-gray-100 text-gray-500' : ''}
              ${isFocused ? 'ring-2 ring-vp-secondary ring-offset-2' : ''}
              ${displayClassName}
            `}
            onClick={() => inputRef.current?.focus()}
            role="textbox"
            tabIndex={disabled ? -1 : 0}
            onFocus={() => {
              setIsFocused(true)
              onFocus?.()
            }}
            onBlur={() => {
              setIsFocused(false)
              onBlur?.()
            }}
            aria-label={ariaLabel || `Amount in ${currency}`}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
          >
            {displayValue}
          </div>
          
          {/* Currency Badge */}
          <div className={`
            absolute right-3 top-1/2 transform -translate-y-1/2
            px-2 py-1 rounded-full text-xs font-bold
            ${currency === 'USD' 
              ? 'bg-currency-usd/20 text-currency-usd border border-currency-usd/30' 
              : 'bg-currency-zwl/20 text-currency-zwl border border-currency-zwl/30'
            }
          `}>
            {currency}
          </div>

          {/* Error/Warning Message */}
          {(error || warning) && (
            <div className={`
              absolute -bottom-6 left-0 text-xs
              ${error ? 'text-status-error' : 'text-status-pending'}
            `}>
              {error || warning}
            </div>
          )}
        </div>
      )}

      {/* Hidden Input for Screen Readers */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={() => {}}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Number Pad Grid */}
      <div className={`
        grid gap-2
        ${layout === 'compact' ? 'grid-cols-3 w-48' : 'grid-cols-3'}
        mx-auto
      `}>
        {/* Row 1: 7 8 9 */}
        <NumberPadButton value="7" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="8" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="9" onClick={handleNumberClick} disabled={disabled} />
        
        {/* Row 2: 4 5 6 */}
        <NumberPadButton value="4" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="5" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="6" onClick={handleNumberClick} disabled={disabled} />
        
        {/* Row 3: 1 2 3 */}
        <NumberPadButton value="1" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="2" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="3" onClick={handleNumberClick} disabled={disabled} />
        
        {/* Row 4: 0 . ⌫ */}
        <NumberPadButton value="0" onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton value="." onClick={handleNumberClick} disabled={disabled} />
        <NumberPadButton 
          value="⌫" 
          label="Backspace" 
          onClick={handleNumberClick} 
          variant="action"
          disabled={disabled}
        />
      </div>

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="grid grid-cols-2 gap-2">
          <NumberPadButton
            value="C"
            label="Clear"
            onClick={handleNumberClick}
            variant="action"
            size="lg"
            className="bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
            disabled={disabled}
          />
          <NumberPadButton
            value="MAX"
            label="Maximum Amount"
            onClick={handleMax}
            variant="special"
            size="lg"
            disabled={disabled || numericValue >= (max ?? ZIMBABWE_CURRENCY_LIMITS[currency].max)}
          />
        </div>
      )}

      {/* Quick Amount Buttons */}
      {showQuickAmounts && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>Quick Amounts</span>
            <span className="text-[10px] text-gray-400">
              {currency === 'USD' ? 'US Dollars' : 'Zimbabwe Dollars'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickAmountItems.map(({ label, value: amount }) => {
              const amountValue = amount
              const isDisabled = disabled || amountValue > (max ?? ZIMBABWE_CURRENCY_LIMITS[currency].max)
              
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleNumberClick(amountValue.toString())}
                  disabled={isDisabled}
                  className={`
                    px-3 py-1.5 text-sm rounded-lg border transition-all
                    ${currency === 'USD'
                      ? 'border-currency-usd/30 text-currency-usd hover:bg-currency-usd/10'
                      : 'border-currency-zwl/30 text-currency-zwl hover:bg-currency-zwl/10'
                    }
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-vp-secondary
                  `}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Zimbabwe Specific Denominations */}
      {inputMode === 'currency' && showQuickAmounts && (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
            <span>💵</span>
            <span>Common denominations</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {ZIMBABWE_CURRENCY_LIMITS[currency].denominations.map(denom => {
              const isDisabled = disabled || denom > (max ?? ZIMBABWE_CURRENCY_LIMITS[currency].max)
              
              return (
                <button
                  key={denom}
                  type="button"
                  onClick={() => handleNumberClick(denom.toString())}
                  disabled={isDisabled}
                  className={`
                    px-2 py-1 text-xs rounded border
                    ${currency === 'USD'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  {currency === 'USD' ? `$${denom}` : `${denom} ZWL`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Input Help Text */}
      <div className="text-[10px] text-gray-400 flex flex-wrap gap-3">
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-gray-100 border rounded">0-9</kbd>
          <span>Numbers</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-gray-100 border rounded">.</kbd>
          <span>Decimal</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-gray-100 border rounded">⌫</kbd>
          <span>Backspace</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-gray-100 border rounded">Ctrl+M</kbd>
          <span>Max</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 bg-gray-100 border rounded">Esc</kbd>
          <span>Clear</span>
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// CURRENCY NUMBER PAD - Zimbabwe Specific Preset
// ============================================================================

interface CurrencyNumberPadProps {
  value: string
  onChange: (value: string, numericValue: number) => void
  currency: Currency
  maxAmount?: number
  className?: string
  disabled?: boolean
  error?: string
}

export function CurrencyNumberPad({
  value,
  onChange,
  currency,
  maxAmount,
  className = '',
  disabled = false,
  error
}: CurrencyNumberPadProps) {
  const limits = ZIMBABWE_CURRENCY_LIMITS[currency]
  
  return (
    <NumberPadInput
      value={value}
      onChange={onChange}
      currency={currency}
      min={limits.min}
      max={maxAmount ?? limits.max}
      step={limits.defaultStep}
      maxDecimalPlaces={limits.maxDecimalPlaces}
      layout="standard"
      showQuickAmounts={true}
      showActionButtons={true}
      className={className}
      disabled={disabled}
      error={error}
      ariaLabel={`Amount in ${currency}`}
    />
  )
}

// ============================================================================
// QUANTITY NUMBER PAD - For Order Items
// ============================================================================

interface QuantityNumberPadProps {
  value: string
  onChange: (value: string, numericValue: number) => void
  maxQuantity?: number
  className?: string
  disabled?: boolean
}

export function QuantityNumberPad({
  value,
  onChange,
  maxQuantity = 99,
  className = '',
  disabled = false
}: QuantityNumberPadProps) {
  return (
    <NumberPadInput
      value={value}
      onChange={onChange}
      currency="USD" // Currency doesn't matter for quantity
      min={1}
      max={maxQuantity}
      step={1}
      maxDecimalPlaces={0}
      allowNegative={false}
      layout="compact"
      inputMode="quantity"
      showQuickAmounts={true}
      showActionButtons={true}
      quickAmounts={[1, 2, 3, 4, 5]}
      className={className}
      disabled={disabled}
      ariaLabel="Quantity"
    />
  )
}

// ============================================================================
// EXCHANGE RATE NUMBER PAD - For Manual Rate Entry
// ============================================================================

interface ExchangeRateNumberPadProps {
  value: string
  onChange: (value: string, numericValue: number) => void
  className?: string
  disabled?: boolean
  error?: string
}

export function ExchangeRateNumberPad({
  value,
  onChange,
  className = '',
  disabled = false,
  error
}: ExchangeRateNumberPadProps) {
  return (
    <NumberPadInput
      value={value}
      onChange={onChange}
      currency="ZWL" // Rates are always ZWL per USD
      min={100}
      max={10000}
      step={1}
      maxDecimalPlaces={2}
      allowNegative={false}
      layout="standard"
      inputMode="rate"
      showQuickAmounts={true}
      showActionButtons={true}
      quickAmounts={[1200, 1250, 1300, 1350, 1400]}
      customQuickAmounts={[
        { label: 'RBZ', value: 1250 },
        { label: 'Interbank', value: 1225 },
        { label: 'Parallel', value: 1312.50 }
      ]}
      className={className}
      disabled={disabled}
      error={error}
      ariaLabel="Exchange rate (ZWL per USD)"
    />
  )
}

// ============================================================================
// EXPORT COMPONENTS
// ============================================================================

export { 
  NumberPadButton,
  ZIMBABWE_CURRENCY_LIMITS,
  QUICK_AMOUNT_PRESETS
}