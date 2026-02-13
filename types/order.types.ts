// ============================================================================
// SHARED ORDER TYPES - Single source of truth for order data structure
// Used by both order creation and payment screens
// ============================================================================

export type Currency = 'USD' | 'ZWL'
export type RateSource = 'reserve_bank' | 'manual' | 'clinic_rate'
export type OrderStatus = 'draft' | 'pending_payment' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type MedicalAidStatus = 'not_applied' | 'awarded' | 'shortfall_paid' | 'settled' | 'rejected'

// ============================================================================
// PATIENT DOMAIN
// ============================================================================

export interface PatientInfo {
  readonly id?: string
  readonly name: string
  readonly dateOfBirth?: string
  readonly phone: string
  readonly email?: string
  readonly medicalAidProvider?: string
  readonly memberNumber?: string
  readonly memberName?: string
}

// ============================================================================
// PRODUCT DOMAIN
// ============================================================================

export interface Product {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly category: 'frames' | 'lenses' | 'coatings' | 'contacts' | 'solutions' | 'services'
  readonly basePriceUSD: number
  readonly isTaxable: boolean
  readonly taxRate: number
  readonly requiresPrescription: boolean
  readonly stockLevel?: number
}

export interface OrderItem {
  readonly id: string
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly category: string
  readonly quantity: number
  readonly unitPriceUSD: number
  readonly unitPriceZWL: number
  readonly totalPriceUSD: number
  readonly totalPriceZWL: number
  readonly taxUSD: number
  readonly taxZWL: number
  readonly requiresPrescription: boolean
}

// ============================================================================
// EXCHANGE RATE DOMAIN
// ============================================================================

export interface ExchangeRate {
  readonly rate: number
  readonly source: RateSource
  readonly lastUpdated: Date
  readonly validUntil: Date
  readonly isLive: boolean
}

// ============================================================================
// ORDER DOMAIN - COMPLETE ORDER AGGREGATE
// ============================================================================

export interface OrderTotals {
  readonly subtotalUSD: number
  readonly subtotalZWL: number
  readonly taxUSD: number
  readonly taxZWL: number
  readonly totalUSD: number
  readonly totalZWL: number
  readonly itemCount: number
  readonly uniqueItems: number
}

export interface Order {
  readonly id: string
  readonly orderId: string
  
  // Patient Information - COMPLETE
  readonly patientInfo: PatientInfo
  readonly patientName: string
  readonly patientId: string
  readonly patientPhone: string
  readonly patientEmail?: string
  readonly dateOfBirth?: string
  readonly medicalAidProvider?: string
  readonly memberNumber?: string
  readonly memberName?: string
  
  // Order Items
  readonly items: ReadonlyArray<OrderItem>
  
  // Exchange Rate
  readonly exchangeRate: number
  readonly rateLockedAt: Date
  readonly rateSource: RateSource
  readonly isRateLocked: boolean
  
  // Financial Totals
  readonly subtotalUSD: number
  readonly subtotalZWL: number
  readonly taxUSD: number
  readonly taxZWL: number
  readonly totalUSD: number
  readonly totalZWL: number
  
  // Metadata
  readonly createdAt: Date
  readonly status: OrderStatus
  readonly transactionCurrency?: Currency
}

// ============================================================================
// SERIALIZATION - For sessionStorage persistence
// ============================================================================

export interface SerializedOrder extends Omit<Order, 
  'rateLockedAt' | 
  'createdAt' | 
  'lastUpdated' | 
  'validUntil' | 
  'patientInfo' | 
  'items'
> {
  readonly rateLockedAt: string
  readonly createdAt: string
  readonly patientInfo: Omit<PatientInfo, 'dateOfBirth'> & { dateOfBirth?: string }
  readonly items: ReadonlyArray<Omit<OrderItem, 'id'> & { id: string }>
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') return false
  
  const order = value as Partial<Order>
  return (
    typeof order.id === 'string' &&
    typeof order.orderId === 'string' &&
    typeof order.patientName === 'string' &&
    typeof order.patientId === 'string' &&
    typeof order.totalUSD === 'number' &&
    Array.isArray(order.items)
  )
}

export function isValidOrderForPayment(order: Partial<Order>): boolean {
  const requiredFields: (keyof Order)[] = [
    'id',
    'patientName',
    'patientId',
    'totalUSD',
    'totalZWL',
    'exchangeRate',
    'items'
  ]
  
  return requiredFields.every(field => 
    order[field] !== undefined && 
    order[field] !== null &&
    (typeof order[field] === 'string' ? (order[field] as string).trim() !== '' : true)
  )
}