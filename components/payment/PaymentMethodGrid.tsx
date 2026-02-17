// components/payment/PaymentMethodGrid.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ============================================================================
// TYPES - Explicit, immutable, production-grade
// ============================================================================

type Currency = 'USD' | 'ZWG'
type PaymentMethodType = 'cash' | 'medical_aid' | 'card' | 'mobile_money' | 'bank' | 'voucher' | 'credit'
type ProcessingTime = 'immediate' | '1_2_days' | '2_3_days' | '3_5_days' | '30_days' | '45_days' | '60_days'
type PopularityRank = 'high' | 'medium' | 'low'

interface PaymentMethod {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly currencies: Currency[]  // Changed from single currency to array
  readonly defaultCurrency?: Currency // Optional default
  readonly type: PaymentMethodType
  readonly icon: string
  readonly iconBg: string
  readonly iconColor: string
  readonly processingTime: ProcessingTime
  readonly processingFee?: number // percentage
  readonly minAmount?: number
  readonly maxAmount?: Record<Currency, number> // Per-currency limits
  readonly requiresReference: boolean
  readonly referenceLabel?: string
  readonly referencePlaceholder?: string
  readonly popularity: PopularityRank
  readonly isActive: boolean
  readonly isPreferred?: boolean
  readonly description?: string
  readonly providerId?: string // For medical aid grouping
  readonly providerCode?: string
  readonly settlementDays?: number
}

interface PaymentMethodCategory {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly description: string
  readonly methods: PaymentMethod[]
}

interface PaymentMethodGridProps {
  // Core Props
  selectedMethodId: string
  selectedCurrency?: Currency // New: track selected currency for the method
  onMethodSelect: (methodId: string, method: PaymentMethod, currency?: Currency) => void
  
  // Currency Context
  transactionCurrency: Currency
  onCurrencyChange?: (currency: Currency) => void
  
  // Filter State
  initialFilter?: 'all' | 'USD' | 'ZWG' | 'medical_aid' | 'cash' | 'card' | 'mobile' | 'bank' | 'voucher'
  showCurrencyToggle?: boolean
  showFilters?: boolean
  showSearch?: boolean
  showFavorites?: boolean
  showRecent?: boolean
  showCategories?: boolean
  
  // Medical Aid Specific
  patientMedicalAidProvider?: string
  patientMemberNumber?: string
  
  // UI State
  compact?: boolean
  disabled?: boolean
  className?: string
  
  // Events
  onFilterChange?: (filter: string) => void
  onFavoriteToggle?: (methodId: string, isFavorite: boolean) => void
}

// ============================================================================
// ZIMBABWE PAYMENT METHODS - COMPLETE, DEDUPLICATED, PRODUCTION READY
// ============================================================================

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  // ==========================================================================
  // CASH METHODS
  // ==========================================================================
  {
    id: 'cash_usd',
    code: 'CASH-USD',
    name: 'Cash USD',
    currencies: ['USD'],
    defaultCurrency: 'USD',
    type: 'cash',
    icon: '💵',
    iconBg: 'bg-gradient-to-br from-green-50 to-green-100',
    iconColor: 'text-green-700',
    processingTime: 'immediate',
    processingFee: 0,
    minAmount: 0.01,
    maxAmount: {
      USD: 10000,
      ZWG: 0 // Not applicable
    },
    requiresReference: false,
    popularity: 'high',
    isActive: true,
    isPreferred: true,
    description: 'US Dollar cash payment'
  },
  {
    id: 'cash_ZWG',
    code: 'CASH-ZWG',
    name: 'Cash ZWG',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'cash',
    icon: '💵',
    iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    iconColor: 'text-blue-700',
    processingTime: 'immediate',
    processingFee: 0,
    minAmount: 0.01,
    maxAmount: {
      USD: 0, // Not applicable
      ZWG: 10000000
    },
    requiresReference: false,
    popularity: 'high',
    isActive: true,
    isPreferred: true,
    description: 'Zimbabwe Dollar cash payment'
  },

  // ==========================================================================
  // MEDICAL AID PROVIDERS - NOW WITH DUAL CURRENCY SUPPORT
  // ==========================================================================
  {
    id: 'cimas',
    code: 'CIM',
    name: 'Cimas',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG', // Default to ZWG for traditional claims
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-red-50 to-red-100',
    iconColor: 'text-red-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., CIM-123456',
    popularity: 'high',
    isActive: true,
    isPreferred: true,
    providerId: 'cimas',
    providerCode: 'CIM',
    description: 'Cimas Medical Aid Society - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'first_mutual',
    code: 'FMH',
    name: 'First Mutual',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    iconColor: 'text-blue-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., FMH-789012',
    popularity: 'high',
    isActive: true,
    providerId: 'first_mutual',
    providerCode: 'FMH',
    description: 'First Mutual Health - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'psmas',
    code: 'PSM',
    name: 'PSMAS',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-green-50 to-green-100',
    iconColor: 'text-green-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., PSM-345678',
    popularity: 'high',
    isActive: true,
    providerId: 'psmas',
    providerCode: 'PSM',
    description: 'Public Service Medical Aid Society - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'liberty',
    code: 'LIB',
    name: 'Liberty Health',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-purple-50 to-purple-100',
    iconColor: 'text-purple-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., LIB-901234',
    popularity: 'high',
    isActive: true,
    providerId: 'liberty',
    providerCode: 'LIB',
    description: 'Liberty Health Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'alliance',
    code: 'ALL',
    name: 'Alliance Health',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-pink-50 to-pink-100',
    iconColor: 'text-pink-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., ALL-567890',
    popularity: 'medium',
    isActive: true,
    providerId: 'alliance',
    providerCode: 'ALL',
    description: 'Alliance Health Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'altfin',
    code: 'ALT',
    name: 'Altfin',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    iconColor: 'text-yellow-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., ALT-123456',
    popularity: 'medium',
    isActive: true,
    providerId: 'altfin',
    providerCode: 'ALT',
    description: 'Altfin Health Fund - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'bonvie',
    code: 'BON',
    name: 'BonVie',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    iconColor: 'text-indigo-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., BON-789012',
    popularity: 'medium',
    isActive: true,
    providerId: 'bonvie',
    providerCode: 'BON',
    description: 'BonVie Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'cellmed',
    code: 'CEL',
    name: 'Cellmed',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-teal-50 to-teal-100',
    iconColor: 'text-teal-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., CEL-345678',
    popularity: 'medium',
    isActive: true,
    providerId: 'cellmed',
    providerCode: 'CEL',
    description: 'Cellmed Health Fund - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'corporate_24',
    code: 'C24',
    name: 'Corporate 24',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    iconColor: 'text-gray-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., C24-901234',
    popularity: 'medium',
    isActive: true,
    providerId: 'corporate_24',
    providerCode: 'C24',
    description: 'Corporate 24 Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'eternal_peace',
    code: 'EPH',
    name: 'Eternal Peace',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100',
    iconColor: 'text-amber-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., EPH-567890',
    popularity: 'low',
    isActive: true,
    providerId: 'eternal_peace',
    providerCode: 'EPH',
    description: 'Eternal Peace Health - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'fbc',
    code: 'FBC',
    name: 'FBC Health',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-orange-50 to-orange-100',
    iconColor: 'text-orange-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., FBC-123456',
    popularity: 'medium',
    isActive: true,
    providerId: 'fbc',
    providerCode: 'FBC',
    description: 'FBC Health Fund - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'flimas',
    code: 'FLI',
    name: 'Flimas',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
    iconColor: 'text-cyan-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., FLI-789012',
    popularity: 'low',
    isActive: true,
    providerId: 'flimas',
    providerCode: 'FLI',
    description: 'Flimas Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'generation_health',
    code: 'GEN',
    name: 'Generation Health',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
    iconColor: 'text-emerald-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., GEN-345678',
    popularity: 'medium',
    isActive: true,
    providerId: 'generation_health',
    providerCode: 'GEN',
    description: 'Generation Health Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'grainmed',
    code: 'GRN',
    name: 'Grainmed',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-lime-50 to-lime-100',
    iconColor: 'text-lime-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., GRN-901234',
    popularity: 'low',
    isActive: true,
    providerId: 'grainmed',
    providerCode: 'GRN',
    description: 'Grainmed Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'healthmed',
    code: 'HLT',
    name: 'Healthmed',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-rose-50 to-rose-100',
    iconColor: 'text-rose-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., HLT-567890',
    popularity: 'medium',
    isActive: true,
    providerId: 'healthmed',
    providerCode: 'HLT',
    description: 'Healthmed Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'heritage',
    code: 'HER',
    name: 'Heritage',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-fuchsia-50 to-fuchsia-100',
    iconColor: 'text-fuchsia-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., HER-123456',
    popularity: 'low',
    isActive: true,
    providerId: 'heritage',
    providerCode: 'HER',
    description: 'Heritage Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'hmmas',
    code: 'HMM',
    name: 'Hmmas',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-violet-50 to-violet-100',
    iconColor: 'text-violet-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., HMM-789012',
    popularity: 'low',
    isActive: true,
    providerId: 'hmmas',
    providerCode: 'HMM',
    description: 'Hmmas Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'maisha',
    code: 'MAI',
    name: 'Maisha',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-slate-50 to-slate-100',
    iconColor: 'text-slate-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., MAI-345678',
    popularity: 'medium',
    isActive: true,
    providerId: 'maisha',
    providerCode: 'MAI',
    description: 'Maisha Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'masca',
    code: 'MAS',
    name: 'Masca',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-stone-50 to-stone-100',
    iconColor: 'text-stone-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., MAS-901234',
    popularity: 'low',
    isActive: true,
    providerId: 'masca',
    providerCode: 'MAS',
    description: 'Masca Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'minerva',
    code: 'MIN',
    name: 'Minerva',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-zinc-50 to-zinc-100',
    iconColor: 'text-zinc-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., MIN-567890',
    popularity: 'low',
    isActive: true,
    providerId: 'minerva',
    providerCode: 'MIN',
    description: 'Minerva Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'northern',
    code: 'NOR',
    name: 'Northern',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-neutral-50 to-neutral-100',
    iconColor: 'text-neutral-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., NOR-123456',
    popularity: 'low',
    isActive: true,
    providerId: 'northern',
    providerCode: 'NOR',
    description: 'Northern Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'oakfin',
    code: 'OAK',
    name: 'Oakfin',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100',
    iconColor: 'text-amber-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., OAK-789012',
    popularity: 'low',
    isActive: true,
    providerId: 'oakfin',
    providerCode: 'OAK',
    description: 'Oakfin Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'old_mutual',
    code: 'OMH',
    name: 'Old Mutual',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    iconColor: 'text-blue-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., OMH-345678',
    popularity: 'high',
    isActive: true,
    providerId: 'old_mutual',
    providerCode: 'OMH',
    description: 'Old Mutual Health - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'prohealth',
    code: 'PRO',
    name: 'ProHealth',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-green-50 to-green-100',
    iconColor: 'text-green-700',
    processingTime: '45_days',
    settlementDays: 45,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., PRO-901234',
    popularity: 'medium',
    isActive: true,
    providerId: 'prohealth',
    providerCode: 'PRO',
    description: 'ProHealth Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'varichem',
    code: 'VAR',
    name: 'Varichem',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-red-50 to-red-100',
    iconColor: 'text-red-700',
    processingTime: '60_days',
    settlementDays: 60,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., VAR-567890',
    popularity: 'low',
    isActive: true,
    providerId: 'varichem',
    providerCode: 'VAR',
    description: 'Varichem Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },
  {
    id: 'emf',
    code: 'EMF',
    name: 'EMF',
    currencies: ['USD', 'ZWG'], // Now supports both currencies
    defaultCurrency: 'ZWG',
    type: 'medical_aid',
    icon: '🏥',
    iconBg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    iconColor: 'text-gray-700',
    processingTime: '30_days',
    settlementDays: 30,
    requiresReference: true,
    referenceLabel: 'Member Number',
    referencePlaceholder: 'e.g., EMF-123456',
    popularity: 'low',
    isActive: true,
    providerId: 'emf',
    providerCode: 'EMF',
    description: 'EMF Medical Aid - Supports USD and ZWG claims',
    maxAmount: {
      USD: 10000,
      ZWG: 10000000
    }
  },

  // ==========================================================================
  // CARD & DIGITAL PAYMENTS
  // ==========================================================================
  {
    id: 'credit_card',
    code: 'CARD-CC',
    name: 'Credit / Debit Card',
    currencies: ['USD'],
    defaultCurrency: 'USD',
    type: 'card',
    icon: '💳',
    iconBg: 'bg-gradient-to-br from-purple-50 to-purple-100',
    iconColor: 'text-purple-700',
    processingTime: 'immediate',
    processingFee: 2.5,
    minAmount: 1.00,
    maxAmount: {
      USD: 5000,
      ZWG: 0
    },
    requiresReference: true,
    referenceLabel: 'Authorization Code',
    referencePlaceholder: 'Last 4 digits or auth code',
    popularity: 'high',
    isActive: true,
    description: 'Credit/Debit card payment (Visa, Mastercard)'
  },
  {
    id: 'ecocash',
    code: 'ECO',
    name: 'Ecocash',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'mobile_money',
    icon: '📱',
    iconBg: 'bg-gradient-to-br from-teal-50 to-teal-100',
    iconColor: 'text-teal-700',
    processingTime: 'immediate',
    processingFee: 1.5,
    minAmount: 1.00,
    maxAmount: {
      USD: 0,
      ZWG: 50000
    },
    requiresReference: true,
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g., ECO-123456789',
    popularity: 'high',
    isActive: true,
    isPreferred: true,
    description: 'Ecocash mobile money payment'
  },
  {
    id: 'onemoney',
    code: 'ONE',
    name: 'OneMoney',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'mobile_money',
    icon: '📱',
    iconBg: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
    iconColor: 'text-cyan-700',
    processingTime: 'immediate',
    processingFee: 1.5,
    minAmount: 1.00,
    maxAmount: {
      USD: 0,
      ZWG: 50000
    },
    requiresReference: true,
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g., ONE-123456789',
    popularity: 'medium',
    isActive: true,
    description: 'OneMoney mobile money payment'
  },
  {
    id: 'telecash',
    code: 'TEL',
    name: 'Telecash',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'mobile_money',
    icon: '📱',
    iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    iconColor: 'text-blue-700',
    processingTime: 'immediate',
    processingFee: 1.5,
    minAmount: 1.00,
    maxAmount: {
      USD: 0,
      ZWG: 50000
    },
    requiresReference: true,
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g., TEL-123456789',
    popularity: 'medium',
    isActive: true,
    description: 'Telecash mobile money payment'
  },

  // ==========================================================================
  // BANK TRANSFERS
  // ==========================================================================
  {
    id: 'rtgs',
    code: 'RTGS',
    name: 'RTGS Transfer',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'bank',
    icon: '🏦',
    iconBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    iconColor: 'text-yellow-700',
    processingTime: '1_2_days',
    processingFee: 0,
    minAmount: 100.00,
    maxAmount: {
      USD: 0,
      ZWG: 10000000
    },
    requiresReference: true,
    referenceLabel: 'RTGS Reference',
    referencePlaceholder: 'e.g., RTGS-123456',
    popularity: 'high',
    isActive: true,
    description: 'Real Time Gross Settlement transfer'
  },
  {
    id: 'cheque',
    code: 'CHQ',
    name: 'Cheque',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'bank',
    icon: '📄',
    iconBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    iconColor: 'text-yellow-700',
    processingTime: '3_5_days',
    processingFee: 0,
    minAmount: 100.00,
    maxAmount: {
      USD: 0,
      ZWG: 5000000
    },
    requiresReference: true,
    referenceLabel: 'Cheque Number',
    referencePlaceholder: 'e.g., CHQ-001234',
    popularity: 'medium',
    isActive: true,
    description: 'Bank cheque payment'
  },
  {
    id: 'direct_debit',
    code: 'DD',
    name: 'Direct Debit',
    currencies: ['ZWG'],
    defaultCurrency: 'ZWG',
    type: 'bank',
    icon: '🏦',
    iconBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    iconColor: 'text-yellow-700',
    processingTime: '2_3_days',
    processingFee: 0,
    minAmount: 50.00,
    maxAmount: {
      USD: 0,
      ZWG: 5000000
    },
    requiresReference: true,
    referenceLabel: 'Debit Order Ref',
    referencePlaceholder: 'e.g., DD-123456',
    popularity: 'medium',
    isActive: true,
    description: 'Direct debit from bank account'
  },

  // ==========================================================================
  // VOUCHERS & CREDIT
  // ==========================================================================
  {
    id: 'gift_voucher',
    code: 'GV',
    name: 'Gift Voucher',
    currencies: ['USD'],
    defaultCurrency: 'USD',
    type: 'voucher',
    icon: '🎫',
    iconBg: 'bg-gradient-to-br from-pink-50 to-pink-100',
    iconColor: 'text-pink-700',
    processingTime: 'immediate',
    processingFee: 0,
    minAmount: 5.00,
    maxAmount: {
      USD: 500,
      ZWG: 0
    },
    requiresReference: true,
    referenceLabel: 'Voucher Code',
    referencePlaceholder: 'e.g., GIFT-123456',
    popularity: 'medium',
    isActive: true,
    description: 'VisionPlus gift voucher'
  },
  {
    id: 'store_credit',
    code: 'CREDIT',
    name: 'Store Credit',
    currencies: ['USD'],
    defaultCurrency: 'USD',
    type: 'credit',
    icon: '🏷️',
    iconBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    iconColor: 'text-indigo-700',
    processingTime: 'immediate',
    processingFee: 0,
    minAmount: 0.01,
    maxAmount: {
      USD: 10000,
      ZWG: 0
    },
    requiresReference: true,
    referenceLabel: 'Credit Note #',
    referencePlaceholder: 'e.g., CN-123456',
    popularity: 'medium',
    isActive: true,
    description: 'Store credit / refund balance'
  }
] as const

// ============================================================================
// PAYMENT METHOD CATEGORIES
// ============================================================================

const PAYMENT_CATEGORIES: readonly PaymentMethodCategory[] = [
  {
    id: 'cash',
    name: 'Cash Payments',
    icon: '💵',
    description: 'Immediate cash payments',
    methods: PAYMENT_METHODS.filter(m => m.type === 'cash')
  },
  {
    id: 'medical_aid',
    name: 'Medical Aid',
    icon: '🏥',
    description: 'Medical aid society payments',
    methods: PAYMENT_METHODS.filter(m => m.type === 'medical_aid')
  },
  {
    id: 'card',
    name: 'Card Payments',
    icon: '💳',
    description: 'Credit and debit cards',
    methods: PAYMENT_METHODS.filter(m => m.type === 'card')
  },
  {
    id: 'mobile_money',
    name: 'Mobile Money',
    icon: '📱',
    description: 'Ecocash, OneMoney, Telecash',
    methods: PAYMENT_METHODS.filter(m => m.type === 'mobile_money')
  },
  {
    id: 'bank',
    name: 'Bank Transfers',
    icon: '🏦',
    description: 'RTGS, Cheque, Direct Debit',
    methods: PAYMENT_METHODS.filter(m => m.type === 'bank')
  },
  {
    id: 'voucher',
    name: 'Vouchers & Credit',
    icon: '🎫',
    description: 'Gift vouchers and store credit',
    methods: PAYMENT_METHODS.filter(m => m.type === 'voucher' || m.type === 'credit')
  }
] as const

// ============================================================================
// FILTER OPTIONS
// ============================================================================

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Methods', icon: '📋' },
  { id: 'USD', label: 'USD Only', icon: '$' },
  { id: 'ZWG', label: 'ZWG Only', icon: 'ZW$' },
  { id: 'medical_aid', label: 'Medical Aid', icon: '🏥' },
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'mobile', label: 'Mobile', icon: '📱' },
  { id: 'bank', label: 'Bank', icon: '🏦' },
  { id: 'voucher', label: 'Vouchers', icon: '🎫' }
] as const

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PaymentMethodGrid({
  // Core Props
  selectedMethodId,
  selectedCurrency,
  onMethodSelect,
  
  // Currency Context
  transactionCurrency,
  onCurrencyChange,
  
  // Filter State
  initialFilter = 'all',
  showCurrencyToggle = true,
  showFilters = true,
  showSearch = true,
  showFavorites = false,
  showRecent = false,
  showCategories = true,
  
  // Medical Aid Specific
  patientMedicalAidProvider,
  patientMemberNumber,
  
  // UI State
  compact = false,
  disabled = false,
  className = '',
  
  // Events
  onFilterChange,
  onFavoriteToggle
}: PaymentMethodGridProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>(() => {
    // Load favorites from localStorage
    try {
      const saved = localStorage.getItem('visionplus_favorite_payment_methods')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [recentMethods, setRecentMethods] = useState<string[]>(() => {
    // Load recent methods from localStorage
    try {
      const saved = localStorage.getItem('visionplus_recent_payment_methods')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null)
  const [showAllMedicalAid, setShowAllMedicalAid] = useState(false)
  const [methodCurrency, setMethodCurrency] = useState<Record<string, Currency>>({})

  // ==========================================================================
  // DERIVED STATE & FILTERING
  // ==========================================================================

  // Get unique medical aid providers (no duplicates)
  const medicalAidMethods = useMemo(() => {
    return PAYMENT_METHODS
      .filter(m => m.type === 'medical_aid' && m.isActive)
      .sort((a, b) => {
        // Sort by popularity first, then name
        if (a.popularity === 'high' && b.popularity !== 'high') return -1
        if (a.popularity !== 'high' && b.popularity === 'high') return 1
        if (a.popularity === 'medium' && b.popularity === 'low') return -1
        if (a.popularity === 'low' && b.popularity === 'medium') return 1
        return a.name.localeCompare(b.name)
      })
  }, [])

  // Filtered methods based on active filter and search
  const filteredMethods = useMemo(() => {
    let methods = PAYMENT_METHODS.filter(m => m.isActive)

    // Apply currency filter
    if (activeFilter === 'USD') {
      methods = methods.filter(m => m.currencies.includes('USD'))
    } else if (activeFilter === 'ZWG') {
      methods = methods.filter(m => m.currencies.includes('ZWG'))
    } else if (activeFilter === 'medical_aid') {
      methods = showAllMedicalAid 
        ? medicalAidMethods 
        : medicalAidMethods.slice(0, 8) // Show top 8 by default
    } else if (activeFilter === 'cash') {
      methods = methods.filter(m => m.type === 'cash')
    } else if (activeFilter === 'card') {
      methods = methods.filter(m => m.type === 'card')
    } else if (activeFilter === 'mobile') {
      methods = methods.filter(m => m.type === 'mobile_money')
    } else if (activeFilter === 'bank') {
      methods = methods.filter(m => m.type === 'bank')
    } else if (activeFilter === 'voucher') {
      methods = methods.filter(m => m.type === 'voucher' || m.type === 'credit')
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      methods = methods.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.code.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query) ||
        m.providerCode?.toLowerCase().includes(query)
      )
    }

    // Apply favorites filter if active
    if (activeFilter === 'favorites' && showFavorites) {
      methods = methods.filter(m => favorites.includes(m.id))
    }

    // Apply recent filter if active
    if (activeFilter === 'recent' && showRecent) {
      methods = methods.filter(m => recentMethods.includes(m.id))
    }

    return methods
  }, [activeFilter, searchQuery, medicalAidMethods, showAllMedicalAid, favorites, recentMethods, showFavorites, showRecent])

  // Group methods by first letter for alphabetical display
  const groupedMethods = useMemo(() => {
    if (activeFilter === 'medical_aid' || activeFilter === 'cash' || activeFilter === 'card' || 
        activeFilter === 'mobile' || activeFilter === 'bank' || activeFilter === 'voucher') {
      // For type filters, don't group alphabetically
      return null
    }

    return filteredMethods.reduce((groups, method) => {
      const firstLetter = method.name.charAt(0).toUpperCase()
      if (!groups[firstLetter]) {
        groups[firstLetter] = []
      }
      groups[firstLetter].push(method)
      return groups
    }, {} as Record<string, PaymentMethod[]>)
  }, [filteredMethods, activeFilter])

  // Sort letters alphabetically
  const sortedLetters = useMemo(() => {
    return groupedMethods ? Object.keys(groupedMethods).sort() : []
  }, [groupedMethods])

  // Get category-based groups
  const categoryGroups = useMemo(() => {
    if (activeFilter !== 'all') return null

    return PAYMENT_CATEGORIES.map(category => ({
      ...category,
      methods: category.methods.filter(m => 
        m.isActive && 
        (searchQuery ? m.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
      )
    })).filter(c => c.methods.length > 0)
  }, [activeFilter, searchQuery])

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleMethodSelect = useCallback((method: PaymentMethod, currency?: Currency) => {
    if (disabled) return
    
    const selectedCurrency = currency || method.defaultCurrency || method.currencies[0]
    
    // Store selected currency for this method
    setMethodCurrency(prev => ({
      ...prev,
      [method.id]: selectedCurrency
    }))
    
    // Update recent methods
    setRecentMethods(prev => {
      const updated = [method.id, ...prev.filter(id => id !== method.id)].slice(0, 5)
      try {
        localStorage.setItem('visionplus_recent_payment_methods', JSON.stringify(updated))
      } catch {}
      return updated
    })
    
    // Auto-switch transaction currency if needed (for non-medical aid methods)
    if (method.type !== 'medical_aid' && onCurrencyChange && selectedCurrency !== transactionCurrency) {
      onCurrencyChange(selectedCurrency)
    }
    
    onMethodSelect(method.id, method, selectedCurrency)
  }, [disabled, onCurrencyChange, transactionCurrency, onMethodSelect])

  const handleCurrencySelect = useCallback((method: PaymentMethod, currency: Currency, e: React.MouseEvent) => {
    e.stopPropagation()
    setMethodCurrency(prev => ({
      ...prev,
      [method.id]: currency
    }))
  }, [])

  const handleFavoriteToggle = useCallback((methodId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    setFavorites(prev => {
      const isFavorite = prev.includes(methodId)
      const updated = isFavorite
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
      
      try {
        localStorage.setItem('visionplus_favorite_payment_methods', JSON.stringify(updated))
      } catch {}
      
      onFavoriteToggle?.(methodId, !isFavorite)
      return updated
    })
  }, [onFavoriteToggle])

  const handleFilterChange = useCallback((filterId: string) => {
    setActiveFilter(filterId)
    setShowAllMedicalAid(false) // Reset medical aid expansion
    onFilterChange?.(filterId)
  }, [onFilterChange])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const getProcessingTimeLabel = (time: ProcessingTime): string => {
    const labels: Record<ProcessingTime, string> = {
      immediate: 'Immediate',
      '1_2_days': '1-2 days',
      '2_3_days': '2-3 days',
      '3_5_days': '3-5 days',
      '30_days': '30 days',
      '45_days': '45 days',
      '60_days': '60 days'
    }
    return labels[time] || time
  }

  const renderMethodCard = (method: PaymentMethod) => {
    const isSelected = selectedMethodId === method.id
    const isFavorite = favorites.includes(method.id)
    const isHovered = hoveredMethod === method.id
    const isMedicalAid = method.type === 'medical_aid'
    const isPatientProvider = isMedicalAid && patientMedicalAidProvider === method.providerId
    
    // Determine which currency to show as selected
    const currentMethodCurrency = methodCurrency[method.id] || method.defaultCurrency || method.currencies[0]
    const showCurrencySelector = method.currencies.length > 1

    return (
      <button
        key={method.id}
        type="button"
        onClick={() => handleMethodSelect(method)}
        onMouseEnter={() => setHoveredMethod(method.id)}
        onMouseLeave={() => setHoveredMethod(null)}
        className={`
          relative w-full text-left transition-all
          ${compact ? 'p-2' : 'p-3'}
          rounded-lg border
          ${isSelected
            ? currentMethodCurrency === 'USD'
              ? 'border-currency-usd bg-currency-usd/5 ring-2 ring-currency-usd/20'
              : currentMethodCurrency === 'ZWG'
                ? 'border-currency-ZWG bg-currency-ZWG/5 ring-2 ring-currency-ZWG/20'
                : 'border-vp-primary bg-vp-primary/5 ring-2 ring-vp-primary/20'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${isPatientProvider ? 'ring-2 ring-green-400 ring-offset-1' : ''}
          transition-all duration-200
          ${className}
        `}
        disabled={disabled}
        aria-label={`${method.name} - ${method.currencies.join('/')} - ${getProcessingTimeLabel(method.processingTime)}`}
        aria-pressed={isSelected}
      >
        {/* Favorite Star */}
        {showFavorites && (
          <button
            type="button"
            onClick={(e) => handleFavoriteToggle(method.id, e)}
            className={`
              absolute top-1 right-1 p-1 rounded-full
              ${isFavorite ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-400'}
              transition-colors
            `}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}

        {/* Patient's Provider Badge */}
        {isPatientProvider && (
          <div className="absolute -top-1 -left-1">
            <span className="flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 text-white text-xs items-center justify-center">
                ✓
              </span>
            </span>
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`
            ${compact ? 'w-8 h-8' : 'w-10 h-10'}
            rounded-full flex items-center justify-center flex-shrink-0
            ${method.iconBg}
            ${isHovered || isSelected ? 'scale-110' : ''}
            transition-transform duration-200
          `}>
            <span className={`${compact ? 'text-lg' : 'text-xl'} ${method.iconColor}`}>
              {method.icon}
            </span>
          </div>

          {/* Method Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`
                font-medium truncate
                ${compact ? 'text-sm' : 'text-base'}
                ${isSelected ? 'text-vp-primary' : 'text-gray-900'}
              `}>
                {method.name}
              </span>
            </div>

            {/* Method Details */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
              {method.processingTime !== 'immediate' && (
                <span className="flex items-center gap-1">
                  <span>⏱️</span>
                  {getProcessingTimeLabel(method.processingTime)}
                </span>
              )}
              
              {method.processingFee !== undefined && method.processingFee > 0 && (
                <span className="flex items-center gap-1">
                  <span>💰</span>
                  {method.processingFee}% fee
                </span>
              )}
              
              {method.type === 'medical_aid' && method.settlementDays && (
                <span className="flex items-center gap-1">
                  <span>📅</span>
                  Settles in {method.settlementDays} days
                </span>
              )}
            </div>

            {/* Currency Selector - For methods with multiple currencies */}
            {showCurrencySelector && (
              <div className="mt-2 flex gap-1">
                {method.currencies.map(currency => (
                  <button
                    key={currency}
                    onClick={(e) => handleCurrencySelect(method, currency, e)}
                    className={`
                      px-2 py-0.5 text-xs rounded-full font-medium transition-colors
                      ${currentMethodCurrency === currency
                        ? currency === 'USD'
                          ? 'bg-currency-usd text-white'
                          : 'bg-currency-ZWG text-white'
                        : currency === 'USD'
                          ? 'bg-currency-usd/20 text-currency-usd hover:bg-currency-usd/30'
                          : 'bg-currency-ZWG/20 text-currency-ZWG hover:bg-currency-ZWG/30'
                      }
                    `}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            )}

            {/* Description (shown on hover/select) */}
            {(isHovered || isSelected) && method.description && !compact && (
              <p className="mt-1 text-xs text-gray-600 line-clamp-1">
                {method.description}
              </p>
            )}

            {/* Reference Label (for medical aid) */}
            {method.requiresReference && method.referenceLabel && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                <span>🔑</span>
                <span>{method.referenceLabel} required</span>
              </div>
            )}
          </div>

          {/* Selected Checkmark */}
          {isSelected && (
            <div className={`
              flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
              ${currentMethodCurrency === 'USD' ? 'bg-currency-usd' : 
                currentMethodCurrency === 'ZWG' ? 'bg-currency-ZWG' : 'bg-vp-primary'}
              text-white
            `}>
              ✓
            </div>
          )}
        </div>
      </button>
    )
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`vp-card ${className}`}>
      {/* Header */}
      <div className="vp-card-header">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span>Payment Methods</span>
            {filteredMethods.length > 0 && (
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
                {filteredMethods.length} available
              </span>
            )}
          </div>

          {/* Currency Toggle */}
          {showCurrencyToggle && onCurrencyChange && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => onCurrencyChange('USD')}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${transactionCurrency === 'USD'
                    ? 'bg-currency-usd text-white shadow'
                    : 'text-gray-600 hover:bg-gray-200'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                disabled={disabled}
                aria-label="Show USD payment methods"
                aria-pressed={transactionCurrency === 'USD'}
              >
                <span className="flex items-center gap-1">
                  <span>$</span>
                  <span>USD</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onCurrencyChange('ZWG')}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${transactionCurrency === 'ZWG'
                    ? 'bg-currency-ZWG text-white shadow'
                    : 'text-gray-600 hover:bg-gray-200'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                disabled={disabled}
                aria-label="Show ZWG payment methods"
                aria-pressed={transactionCurrency === 'ZWG'}
              >
                <span className="flex items-center gap-1">
                  <span>ZW$</span>
                  <span>ZWG</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="vp-card-body p-0">
        {/* Filter Bar */}
        {showFilters && (
          <div className="p-4 border-b bg-gray-50">
            <div className="flex flex-wrap gap-2 mb-3">
              {FILTER_OPTIONS.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterChange(filter.id)}
                  className={`
                    px-3 py-1.5 text-xs rounded-full flex items-center gap-1
                    transition-all
                    ${activeFilter === filter.id
                      ? filter.id === 'USD'
                        ? 'bg-currency-usd text-white'
                        : filter.id === 'ZWG'
                          ? 'bg-currency-ZWG text-white'
                          : filter.id === 'medical_aid'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : filter.id === 'cash'
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : filter.id === 'card'
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : filter.id === 'mobile'
                                  ? 'bg-teal-100 text-teal-800 border-teal-300'
                                  : filter.id === 'bank'
                                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                    : filter.id === 'voucher'
                                      ? 'bg-pink-100 text-pink-800 border-pink-300'
                                      : 'bg-vp-primary text-white'
                      : 'bg-white text-gray-700 border hover:bg-gray-50'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  disabled={disabled}
                  aria-label={`Filter by ${filter.label}`}
                  aria-pressed={activeFilter === filter.id}
                >
                  <span>{filter.icon}</span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

            {/* Search Bar */}
            {showSearch && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, code, or provider..."
                  className="w-full px-4 py-2 text-sm border rounded-lg bg-white pl-10"
                  disabled={disabled}
                  aria-label="Search payment methods"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Methods Grid */}
        <div className={`
          ${compact ? 'max-h-[400px]' : 'max-h-[600px]'}
          overflow-y-auto p-4
        `}>
          {/* Category-based view (for 'all' filter) */}
          {activeFilter === 'all' && categoryGroups && showCategories ? (
            <div className="space-y-6">
              {categoryGroups.map(category => (
                <div key={category.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{category.icon}</span>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <span className="text-xs text-gray-500">
                      {category.methods.length} methods
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {category.methods.map(renderMethodCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Alphabetical grouping (for non-filtered views) */}
              {groupedMethods && sortedLetters.length > 0 ? (
                <div className="space-y-6">
                  {sortedLetters.map(letter => (
                    <div key={letter}>
                      <div className="text-xs font-bold text-gray-500 mb-2 px-2">
                        {letter}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {groupedMethods[letter].map(renderMethodCard)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Grid layout for filtered views */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredMethods.map(renderMethodCard)}
                </div>
              )}
            </>
          )}

          {/* Medical Aid "Show More" Button */}
          {activeFilter === 'medical_aid' && !showAllMedicalAid && medicalAidMethods.length > 8 && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowAllMedicalAid(true)}
                className="vp-btn vp-btn-outline text-sm"
                disabled={disabled}
              >
                Show All {medicalAidMethods.length} Medical Aid Providers
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredMethods.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-4" aria-hidden="true">
                {searchQuery ? '🔍' : '💳'}
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {searchQuery ? 'No matching methods' : 'No payment methods available'}
              </h3>
              <p className="text-sm">
                {searchQuery 
                  ? 'Try adjusting your search or filter'
                  : 'Check back later or contact support'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="mt-4 vp-btn vp-btn-outline text-sm"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Selected Method Details */}
        {selectedMethodId && (
          <div className="border-t bg-gray-50 p-4">
            {(() => {
              const method = PAYMENT_METHODS.find(m => m.id === selectedMethodId)
              if (!method) return null
              
              const currentMethodCurrency = methodCurrency[method.id] || method.defaultCurrency || method.currencies[0]
              
              return (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      ${method.iconBg}
                    `}>
                      <span className={`text-2xl ${method.iconColor}`}>
                        {method.icon}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {method.name}
                        {method.providerCode && (
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                            {method.providerCode}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex flex-wrap items-center gap-3 mt-1">
                        <span className={`
                          px-2 py-0.5 rounded-full text-xs font-medium
                          ${currentMethodCurrency === 'USD'
                            ? 'bg-currency-usd/20 text-currency-usd'
                            : currentMethodCurrency === 'ZWG'
                              ? 'bg-currency-ZWG/20 text-currency-ZWG'
                              : 'bg-gray-200 text-gray-700'
                          }
                        `}>
                          {method.currencies.join(' / ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>⏱️</span>
                          {getProcessingTimeLabel(method.processingTime)}
                        </span>
                        {method.processingFee !== undefined && method.processingFee > 0 && (
                          <span className="flex items-center gap-1">
                            <span>💰</span>
                            {method.processingFee}% fee
                          </span>
                        )}
                      </div>
                      {method.description && (
                        <p className="mt-2 text-xs text-gray-500 max-w-md">
                          {method.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {showFavorites && (
                    <button
                      type="button"
                      onClick={(e) => handleFavoriteToggle(method.id, e)}
                      className={`
                        vp-btn vp-btn-outline text-sm flex items-center gap-2
                        ${favorites.includes(method.id) ? 'text-yellow-600' : ''}
                      `}
                    >
                      {favorites.includes(method.id) ? '★' : '☆'}
                      {favorites.includes(method.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}