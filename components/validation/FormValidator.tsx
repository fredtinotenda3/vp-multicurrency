// components/validation/FormValidator.tsx
'use client'

import { ReactNode, useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================================
// TYPES - Production Grade, Zimbabwe Currency Specific
// ============================================================================

type Currency = 'USD' | 'ZWG'
type ValidationSeverity = 'error' | 'warning' | 'info' | 'success'
type ValidationMode = 'onChange' | 'onBlur' | 'onSubmit' | 'debounced'
type FieldType = 'text' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'checkbox' | 'radio'

interface ValidationRule {
  // Core validation
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  email?: boolean
  phone?: boolean
  
  // Zimbabwe specific
  zimPhone?: boolean // Zimbabwe phone number format (+263...)
  zimNationalId?: boolean // Zimbabwe national ID format (xx-xxxxxx-x-xx)
  zimMemberNumber?: boolean // Medical aid member number format
  currency?: Currency // For currency-specific validation
  exchangeRate?: boolean // Special validation for exchange rates
  
  // Custom validation
  custom?: (value: any, context?: any) => boolean | Promise<boolean>
  message: string
  severity?: ValidationSeverity
  dependsOn?: string[] // Field dependencies
}

interface FieldValidation {
  field: string
  value: any
  errors: ValidationError[]
  warnings: ValidationError[]
  isValid: boolean
  isDirty: boolean
  isTouched: boolean
}

interface ValidationError {
  field: string
  rule: string
  message: string
  severity: ValidationSeverity
  timestamp: number
}

interface ValidationContext {
  [key: string]: any
}

interface FormValidatorProps {
  children: (props: FormValidatorRenderProps) => ReactNode
  validationRules: Record<string, ValidationRule[]>
  initialValues?: Record<string, any>
  context?: ValidationContext
  mode?: ValidationMode
  debounceMs?: number
  validateOnMount?: boolean
  showErrors?: 'all' | 'touched' | 'dirty'
}

interface FormValidatorRenderProps {
  values: Record<string, any>
  errors: Record<string, ValidationError[]>
  warnings: Record<string, ValidationError[]>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
  validateField: (field: string, value?: any) => Promise<void>
  validateAll: () => Promise<boolean>
  setFieldValue: (field: string, value: any) => void
  setFieldTouched: (field: string, touched?: boolean) => void
  reset: (values?: Record<string, any>) => void
  clearErrors: (field?: string) => void
}

// ============================================================================
// ZIMBABWE SPECIFIC VALIDATION PATTERNS
// ============================================================================

export const ZIMBABWE_VALIDATION_PATTERNS = {
  // Phone: +263 77 123 4567 or 0771234567
  PHONE: /^(\+263|0)[1-9]{1}[0-9]{8}$/,
  
  // National ID: 12-3456789-X-12
  NATIONAL_ID: /^[0-9]{2}-[0-9]{6,7}-[A-Z]-[0-9]{2}$/,
  
  // Medical Aid Member Number: CIM-123456, PSM-789012, etc.
  MEMBER_NUMBER: /^[A-Z]{3,4}-[0-9]{6,10}$/,
  
  // Passport: PA123456
  PASSPORT: /^[A-Z]{2}[0-9]{6,8}$/,
  
  // ZIMRA Tax Clearance: TCC-2024-123456
  TAX_CLEARANCE: /^TCC-\d{4}-\d{6}$/,
  
  // Business Registration: CR1234567
  BUSINESS_REG: /^CR\d{7}$/,
  
  // VAT Number: VAT123456789
  VAT_NUMBER: /^VAT\d{9}$/,
  
  // TIN Number: 1012345678
  TIN_NUMBER: /^\d{10}$/,
  
  // Postal Code: ZW-1234
  POSTAL_CODE: /^ZW-\d{4}$/
} as const

// ============================================================================
// ZIMBABWE CURRENCY VALIDATION
// ============================================================================

export const CURRENCY_LIMITS = {
  USD: {
    min: 0.01,
    max: 10000,
    maxDecimalPlaces: 2,
    pattern: /^\d+(\.\d{1,2})?$/
  },
  ZWG: {
    min: 0.01,
    max: 10000000,
    maxDecimalPlaces: 2,
    pattern: /^\d+(\.\d{1,2})?$/
  }
} as const

// ============================================================================
// EXCHANGE RATE VALIDATION (ZWG per USD) - Updated to 1-1000 range
// ============================================================================

export const EXCHANGE_RATE_LIMITS = {
  min: 1,    // 1 USD = 1 ZWG minimum
  max: 1000, // 1 USD = 1000 ZWG maximum
  maxDecimalPlaces: 2,
  pattern: /^\d+(\.\d{1,2})?$/
} as const

// ============================================================================
// VALIDATOR FUNCTIONS
// ============================================================================

export class Validators {
  // ==========================================================================
  // CORE VALIDATORS
  // ==========================================================================
  
  static required(value: any): boolean {
    if (value === undefined || value === null) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'number') return !isNaN(value)
    if (Array.isArray(value)) return value.length > 0
    if (value instanceof Date) return !isNaN(value.getTime())
    return true
  }

  static min(value: number, min: number): boolean {
    return !isNaN(value) && value >= min
  }

  static max(value: number, max: number): boolean {
    return !isNaN(value) && value <= max
  }

  static minLength(value: string, min: number): boolean {
    return value?.length >= min
  }

  static maxLength(value: string, max: number): boolean {
    return value?.length <= max
  }

  static pattern(value: string, pattern: RegExp): boolean {
    return pattern.test(value)
  }

  static email(value: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(value)
  }

  // ==========================================================================
  // ZIMBABWE SPECIFIC VALIDATORS
  // ==========================================================================
  
  static zimPhone(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.PHONE.test(value)
  }

  static zimNationalId(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.NATIONAL_ID.test(value)
  }

  static zimMemberNumber(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.MEMBER_NUMBER.test(value)
  }

  static zimPassport(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.PASSPORT.test(value)
  }

  static zimTaxClearance(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.TAX_CLEARANCE.test(value)
  }

  static zimBusinessReg(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.BUSINESS_REG.test(value)
  }

  static zimVatNumber(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.VAT_NUMBER.test(value)
  }

  static zimTinNumber(value: string): boolean {
    return ZIMBABWE_VALIDATION_PATTERNS.TIN_NUMBER.test(value)
  }

  // ==========================================================================
  // CURRENCY VALIDATORS
  // ==========================================================================
  
  static currency(value: number, currency: Currency): boolean {
    const limits = CURRENCY_LIMITS[currency]
    
    if (isNaN(value)) return false
    if (value < limits.min) return false
    if (value > limits.max) return false
    
    const decimalPlaces = value.toString().split('.')[1]?.length || 0
    return decimalPlaces <= limits.maxDecimalPlaces
  }

  static usd(value: number): boolean {
    return Validators.currency(value, 'USD')
  }

  static ZWG(value: number): boolean {
    return Validators.currency(value, 'ZWG')
  }

  static exchangeRate(value: number): boolean {
    if (isNaN(value)) return false
    if (value < EXCHANGE_RATE_LIMITS.min) return false
    if (value > EXCHANGE_RATE_LIMITS.max) return false
    
    const decimalPlaces = value.toString().split('.')[1]?.length || 0
    return decimalPlaces <= EXCHANGE_RATE_LIMITS.maxDecimalPlaces
  }

  // ==========================================================================
  // MEDICAL AID VALIDATORS
  // ==========================================================================
  
  static medicalAidProvider(value: string, providers: string[]): boolean {
    return providers.includes(value)
  }

  static medicalAidAward(amount: number, orderTotal: number): boolean {
    return amount > 0 && amount <= orderTotal
  }

  // ==========================================================================
  // DATE VALIDATORS
  // ==========================================================================
  
  static date(value: any): boolean {
    if (value instanceof Date) return !isNaN(value.getTime())
    if (typeof value === 'string') return !isNaN(new Date(value).getTime())
    return false
  }

  static dateInPast(value: Date): boolean {
    return value < new Date()
  }

  static dateInFuture(value: Date): boolean {
    return value > new Date()
  }

  static dateAfter(value: Date, after: Date): boolean {
    return value > after
  }

  static dateBefore(value: Date, before: Date): boolean {
    return value < before
  }

  static ageOver(value: Date, minAge: number): boolean {
    const age = new Date().getFullYear() - value.getFullYear()
    return age >= minAge
  }

  // ==========================================================================
  // UTILITY VALIDATORS
  // ==========================================================================
  
  static matches(value: string, matchValue: string): boolean {
    return value === matchValue
  }

  static url(value: string): boolean {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  static integer(value: number): boolean {
    return Number.isInteger(value)
  }

  static positive(value: number): boolean {
    return value > 0
  }

  static negative(value: number): boolean {
    return value < 0
  }

  static range(value: number, min: number, max: number): boolean {
    return value >= min && value <= max
  }
}

// ============================================================================
// MAIN FORM VALIDATOR COMPONENT
// ============================================================================

export default function FormValidator({
  children,
  validationRules,
  initialValues = {},
  context = {},
  mode = 'onChange',
  debounceMs = 300,
  validateOnMount = false,
  showErrors = 'touched'
}: FormValidatorProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [values, setValues] = useState<Record<string, any>>(initialValues)
  const [fieldStates, setFieldStates] = useState<Record<string, FieldValidation>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================
  
  const allErrors = useMemo(() => {
    return Object.values(fieldStates).reduce((acc, state) => {
      if (state.errors.length > 0) {
        acc[state.field] = state.errors
      }
      return acc
    }, {} as Record<string, ValidationError[]>)
  }, [fieldStates])

  const allWarnings = useMemo(() => {
    return Object.values(fieldStates).reduce((acc, state) => {
      if (state.warnings.length > 0) {
        acc[state.field] = state.warnings
      }
      return acc
    }, {} as Record<string, ValidationError[]>)
  }, [fieldStates])

  const isValid = useMemo(() => {
    return Object.values(fieldStates).every(state => state.isValid)
  }, [fieldStates])

  const isDirty = useMemo(() => {
    return Object.values(fieldStates).some(state => state.isDirty)
  }, [fieldStates])

  // ==========================================================================
  // VALIDATION ENGINE
  // ==========================================================================
  
  const validateField = useCallback(async (field: string, value?: any) => {
    const rules = validationRules[field]
    if (!rules) return

    const fieldValue = value !== undefined ? value : values[field]
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    for (const rule of rules) {
      // Check dependencies
      if (rule.dependsOn) {
        const dependenciesMet = rule.dependsOn.every(dep => 
          values[dep] !== undefined && values[dep] !== null && values[dep] !== ''
        )
        if (!dependenciesMet) continue
      }

      let isValid = true
      
      // Required validation
      if (rule.required) {
        isValid = Validators.required(fieldValue)
        if (!isValid) {
          errors.push({
            field,
            rule: 'required',
            message: rule.message || 'This field is required',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
          continue
        }
      }

      // Skip further validation if empty and not required
      if (!rule.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        continue
      }

      // Numeric validations
      if (rule.min !== undefined) {
        isValid = Validators.min(Number(fieldValue), rule.min)
        if (!isValid) {
          errors.push({
            field,
            rule: 'min',
            message: rule.message || `Minimum value is ${rule.min}`,
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      if (rule.max !== undefined) {
        isValid = Validators.max(Number(fieldValue), rule.max)
        if (!isValid) {
          errors.push({
            field,
            rule: 'max',
            message: rule.message || `Maximum value is ${rule.max}`,
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // String length validations
      if (rule.minLength !== undefined) {
        isValid = Validators.minLength(String(fieldValue), rule.minLength)
        if (!isValid) {
          errors.push({
            field,
            rule: 'minLength',
            message: rule.message || `Minimum length is ${rule.minLength}`,
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      if (rule.maxLength !== undefined) {
        isValid = Validators.maxLength(String(fieldValue), rule.maxLength)
        if (!isValid) {
          errors.push({
            field,
            rule: 'maxLength',
            message: rule.message || `Maximum length is ${rule.maxLength}`,
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Pattern validation
      if (rule.pattern) {
        isValid = Validators.pattern(String(fieldValue), rule.pattern)
        if (!isValid) {
          errors.push({
            field,
            rule: 'pattern',
            message: rule.message || 'Invalid format',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Email validation
      if (rule.email) {
        isValid = Validators.email(String(fieldValue))
        if (!isValid) {
          errors.push({
            field,
            rule: 'email',
            message: rule.message || 'Invalid email address',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Zimbabwe phone validation
      if (rule.zimPhone) {
        isValid = Validators.zimPhone(String(fieldValue))
        if (!isValid) {
          errors.push({
            field,
            rule: 'zimPhone',
            message: rule.message || 'Invalid Zimbabwe phone number',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Zimbabwe national ID validation
      if (rule.zimNationalId) {
        isValid = Validators.zimNationalId(String(fieldValue))
        if (!isValid) {
          errors.push({
            field,
            rule: 'zimNationalId',
            message: rule.message || 'Invalid Zimbabwe National ID',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Zimbabwe medical aid member number
      if (rule.zimMemberNumber) {
        isValid = Validators.zimMemberNumber(String(fieldValue))
        if (!isValid) {
          errors.push({
            field,
            rule: 'zimMemberNumber',
            message: rule.message || 'Invalid member number format (e.g., CIM-123456)',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Currency validation
      if (rule.currency) {
        isValid = Validators.currency(Number(fieldValue), rule.currency)
        if (!isValid) {
          errors.push({
            field,
            rule: 'currency',
            message: rule.message || `Invalid ${rule.currency} amount`,
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Exchange rate validation - Updated message
      if (rule.exchangeRate) {
        isValid = Validators.exchangeRate(Number(fieldValue))
        if (!isValid) {
          errors.push({
            field,
            rule: 'exchangeRate',
            message: rule.message || 'Invalid exchange rate (1-1,000 ZWG/USD)',
            severity: rule.severity || 'error',
            timestamp: Date.now()
          })
        }
      }

      // Custom validation
      if (rule.custom) {
        try {
          isValid = await rule.custom(fieldValue, { ...values, ...context })
          if (!isValid) {
            const error = {
              field,
              rule: 'custom',
              message: rule.message || 'Invalid value',
              severity: rule.severity || 'error',
              timestamp: Date.now()
            }
            if (rule.severity === 'warning') {
              warnings.push(error)
            } else {
              errors.push(error)
            }
          }
        } catch (error) {
          console.error(`Custom validation error for ${field}:`, error)
        }
      }
    }

    // Update field state
    setFieldStates(prev => ({
      ...prev,
      [field]: {
        field,
        value: fieldValue,
        errors,
        warnings,
        isValid: errors.length === 0,
        isDirty: prev[field]?.isDirty || value !== undefined,
        isTouched: prev[field]?.isTouched || false
      }
    }))
  }, [validationRules, values, context])

  const validateAll = useCallback(async (): Promise<boolean> => {
    const fields = Object.keys(validationRules)
    await Promise.all(fields.map(field => validateField(field)))
    return Object.values(fieldStates).every(state => state.errors.length === 0)
  }, [validationRules, validateField, fieldStates])

  // ==========================================================================
  // FIELD MANIPULATION
  // ==========================================================================
  
  const setFieldValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    
    // Debounced validation
    if (mode === 'debounced') {
      if (debounceTimer) clearTimeout(debounceTimer)
      const timer = setTimeout(() => {
        validateField(field, value)
      }, debounceMs)
      setDebounceTimer(timer)
    }
    
    // Immediate validation
    if (mode === 'onChange') {
      validateField(field, value)
    }
  }, [mode, debounceMs, validateField])

  const setFieldTouched = useCallback((field: string, touched: boolean = true) => {
    setFieldStates(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        isTouched: touched
      }
    }))
    
    // Validate on blur
    if (mode === 'onBlur' && touched) {
      validateField(field)
    }
  }, [mode, validateField])

  const reset = useCallback((values?: Record<string, any>) => {
    setValues(values || initialValues)
    setFieldStates({})
    setIsSubmitting(false)
  }, [initialValues])

  const clearErrors = useCallback((field?: string) => {
    if (field) {
      setFieldStates(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          errors: [],
          warnings: [],
          isValid: true
        }
      }))
    } else {
      const cleared = Object.entries(fieldStates).reduce((acc, [key, state]) => ({
        ...acc,
        [key]: {
          ...state,
          errors: [],
          warnings: [],
          isValid: true
        }
      }), {})
      setFieldStates(cleared)
    }
  }, [fieldStates])

  // ==========================================================================
  // EFFECTS
  // ==========================================================================
  
  // Validate on mount
  useEffect(() => {
    if (validateOnMount) {
      validateAll()
    }
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [debounceTimer])

  // ==========================================================================
  // RENDER PROPS
  // ==========================================================================
  
  const renderProps: FormValidatorRenderProps = {
    values,
    errors: allErrors,
    warnings: allWarnings,
    isValid,
    isDirty,
    isSubmitting,
    validateField,
    validateAll,
    setFieldValue,
    setFieldTouched,
    reset,
    clearErrors
  }

  return children(renderProps)
}

// ============================================================================
// FIELD VALIDATOR COMPONENT - Single field validation
// ============================================================================

interface FieldValidatorProps {
  field: string
  value: any
  rules: ValidationRule[]
  children: (errors: ValidationError[], warnings: ValidationError[], isValid: boolean) => ReactNode
  context?: ValidationContext
  showErrors?: boolean
}

export function FieldValidator({
  field,
  value,
  rules,
  children,
  context = {},
  showErrors = true
}: FieldValidatorProps) {
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [warnings, setWarnings] = useState<ValidationError[]>([])
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    const validate = async () => {
      const fieldErrors: ValidationError[] = []
      const fieldWarnings: ValidationError[] = []

      for (const rule of rules) {
        let ruleValid = true

        // Required
        if (rule.required) {
          ruleValid = Validators.required(value)
          if (!ruleValid) {
            fieldErrors.push({
              field,
              rule: 'required',
              message: rule.message || 'This field is required',
              severity: rule.severity || 'error',
              timestamp: Date.now()
            })
            continue
          }
        }

        // Skip further validation if empty and not required
        if (!rule.required && (value === undefined || value === null || value === '')) {
          continue
        }

        // Currency validation
        if (rule.currency) {
          ruleValid = Validators.currency(Number(value), rule.currency)
          if (!ruleValid) {
            fieldErrors.push({
              field,
              rule: 'currency',
              message: rule.message || `Invalid ${rule.currency} amount`,
              severity: rule.severity || 'error',
              timestamp: Date.now()
            })
          }
        }

        // Exchange rate validation
        if (rule.exchangeRate) {
          ruleValid = Validators.exchangeRate(Number(value))
          if (!ruleValid) {
            fieldErrors.push({
              field,
              rule: 'exchangeRate',
              message: rule.message || 'Invalid exchange rate (1-1,000 ZWG/USD)',
              severity: rule.severity || 'error',
              timestamp: Date.now()
            })
          }
        }

        // Zimbabwe phone
        if (rule.zimPhone) {
          ruleValid = Validators.zimPhone(String(value))
          if (!ruleValid) {
            fieldErrors.push({
              field,
              rule: 'zimPhone',
              message: rule.message || 'Invalid Zimbabwe phone number',
              severity: rule.severity || 'error',
              timestamp: Date.now()
            })
          }
        }

        // Zimbabwe member number
        if (rule.zimMemberNumber) {
          ruleValid = Validators.zimMemberNumber(String(value))
          if (!ruleValid) {
            fieldErrors.push({
              field,
              rule: 'zimMemberNumber',
              message: rule.message || 'Invalid member number format',
              severity: rule.severity || 'error',
              timestamp: Date.now()
            })
          }
        }

        // Custom validation
        if (rule.custom) {
          try {
            ruleValid = await rule.custom(value, context)
            if (!ruleValid) {
              const error = {
                field,
                rule: 'custom',
                message: rule.message || 'Invalid value',
                severity: rule.severity || 'error',
                timestamp: Date.now()
              }
              if (rule.severity === 'warning') {
                fieldWarnings.push(error)
              } else {
                fieldErrors.push(error)
              }
            }
          } catch (error) {
            console.error(`Custom validation error:`, error)
          }
        }
      }

      setErrors(fieldErrors)
      setWarnings(fieldWarnings)
      setIsValid(fieldErrors.length === 0)
    }

    validate()
  }, [field, value, rules, context])

  if (!showErrors) {
    return children([], [], isValid)
  }

  return children(errors, warnings, isValid)
}

// ============================================================================
// CURRENCY AMOUNT VALIDATOR - Zimbabwe Specific
// ============================================================================

interface CurrencyAmountValidatorProps {
  amount: number
  currency: Currency
  orderTotal?: number
  showErrors?: boolean
  children: (errors: ValidationError[], isValid: boolean) => ReactNode
}

export function CurrencyAmountValidator({
  amount,
  currency,
  orderTotal,
  showErrors = true,
  children
}: CurrencyAmountValidatorProps) {
  const rules: ValidationRule[] = [
    {
      required: true,
      message: 'Amount is required',
      severity: 'error'
    },
    {
      currency,
      message: `Invalid ${currency} amount`,
      severity: 'error'
    },
    {
      min: CURRENCY_LIMITS[currency].min,
      message: `Minimum amount is ${CURRENCY_LIMITS[currency].min} ${currency}`,
      severity: 'error'
    },
    {
      max: CURRENCY_LIMITS[currency].max,
      message: `Maximum amount is ${CURRENCY_LIMITS[currency].max} ${currency}`,
      severity: 'error'
    },
    {
      custom: (value: number) => {
        if (orderTotal && value > orderTotal) {
          return false
        }
        return true
      },
      message: `Amount cannot exceed order total of ${orderTotal} ${currency}`,
      severity: 'warning'
    }
  ]

  return (
    <FieldValidator
      field="amount"
      value={amount}
      rules={rules}
      showErrors={showErrors}
    >
      {(errors, warnings, isValid) => children([...errors, ...warnings], isValid)}
    </FieldValidator>
  )
}

// ============================================================================
// EXCHANGE RATE VALIDATOR - Zimbabwe Specific
// ============================================================================

interface ExchangeRateValidatorProps {
  rate: number
  showErrors?: boolean
  children: (errors: ValidationError[], isValid: boolean) => ReactNode
}

export function ExchangeRateValidator({
  rate,
  showErrors = true,
  children
}: ExchangeRateValidatorProps) {
  const rules: ValidationRule[] = [
    {
      required: true,
      message: 'Exchange rate is required',
      severity: 'error'
    },
    {
      exchangeRate: true,
      message: 'Invalid exchange rate (1-1,000 ZWG/USD)',
      severity: 'error'
    },
    {
      min: EXCHANGE_RATE_LIMITS.min,
      message: `Minimum rate is ${EXCHANGE_RATE_LIMITS.min} ZWG/USD`,
      severity: 'error'
    },
    {
      max: EXCHANGE_RATE_LIMITS.max,
      message: `Maximum rate is ${EXCHANGE_RATE_LIMITS.max} ZWG/USD`,
      severity: 'error'
    }
  ]

  return (
    <FieldValidator
      field="exchangeRate"
      value={rate}
      rules={rules}
      showErrors={showErrors}
    >
      {(errors, warnings, isValid) => children(errors, isValid)}
    </FieldValidator>
  )
}

// ============================================================================
// ZIMBABWE PHONE VALIDATOR
// ============================================================================

interface ZimbabwePhoneValidatorProps {
  phone: string
  showErrors?: boolean
  children: (errors: ValidationError[], isValid: boolean) => ReactNode
}

export function ZimbabwePhoneValidator({
  phone,
  showErrors = true,
  children
}: ZimbabwePhoneValidatorProps) {
  const rules: ValidationRule[] = [
    {
      required: true,
      message: 'Phone number is required',
      severity: 'error'
    },
    {
      zimPhone: true,
      message: 'Invalid Zimbabwe phone number (e.g., +263 77 123 4567)',
      severity: 'error'
    }
  ]

  return (
    <FieldValidator
      field="phone"
      value={phone}
      rules={rules}
      showErrors={showErrors}
    >
      {(errors, warnings, isValid) => children(errors, isValid)}
    </FieldValidator>
  )
}

// ============================================================================
// MEDICAL AID MEMBER VALIDATOR
// ============================================================================

interface MedicalAidMemberValidatorProps {
  memberNumber: string
  provider?: string
  showErrors?: boolean
  children: (errors: ValidationError[], isValid: boolean) => ReactNode
}

export function MedicalAidMemberValidator({
  memberNumber,
  provider,
  showErrors = true,
  children
}: MedicalAidMemberValidatorProps) {
  const rules: ValidationRule[] = [
    {
      required: true,
      message: 'Member number is required',
      severity: 'error'
    },
    {
      zimMemberNumber: true,
      message: 'Invalid member number format (e.g., CIM-123456)',
      severity: 'error'
    },
    {
      custom: (value: string) => {
        if (provider && !value.startsWith(provider.substring(0, 3).toUpperCase())) {
          return false
        }
        return true
      },
      message: `Member number should start with ${provider?.substring(0, 3).toUpperCase() || 'provider code'}`,
      severity: 'warning'
    }
  ]

  return (
    <FieldValidator
      field="memberNumber"
      value={memberNumber}
      rules={rules}
      context={{ provider }}
      showErrors={showErrors}
    >
      {(errors, warnings, isValid) => children(errors, isValid)}
    </FieldValidator>
  )
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export type {
  ValidationRule,
  ValidationError,
  ValidationContext,
  FormValidatorRenderProps,
  FieldValidation
}

export {
  Validators,
  ZIMBABWE_VALIDATION_PATTERNS,
  CURRENCY_LIMITS,
  EXCHANGE_RATE_LIMITS
}