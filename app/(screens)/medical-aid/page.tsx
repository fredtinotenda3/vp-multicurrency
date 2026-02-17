// app/(screens)/medical-aid/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { LoadingOverlay } from '@/components/system/LoadingStates'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import { CurrencyAmountValidator } from '@/components/validation/FormValidator'
import { useMedicalAidCache, MedicalAidCache } from '@/lib/offline/MedicalAidCache'

// ============================================================================
// TYPES - Explicit, immutable, self-documenting, dual currency support
// ============================================================================

type Currency = 'USD' | 'ZWG'
type MedicalAidStatus = 'pending' | 'submitted' | 'under_review' | 'awarded' | 'partially_paid' | 'cleared' | 'rejected'
type TimelineEventType = 'claim_submitted' | 'award_received' | 'shortfall_paid' | 'medical_aid_paid' | 'follow_up' | 'rejection' | 'appeal'

// Zimbabwe medical aid providers - complete list from actual market
const MEDICAL_AID_PROVIDERS = [
  { id: 'cimas', name: 'Cimas', code: 'CIM', color: 'red', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'first_mutual', name: 'First Mutual', code: 'FMH', color: 'blue', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'psmas', name: 'PSMAS', code: 'PSM', color: 'green', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'liberty', name: 'Liberty Health', code: 'LIB', color: 'purple', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'alliance', name: 'Alliance Health', code: 'ALL', color: 'pink', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'altfin', name: 'Altfin', code: 'ALT', color: 'yellow', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'bonvie', name: 'BonVie', code: 'BON', color: 'indigo', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'cellmed', name: 'Cellmed', code: 'CEL', color: 'teal', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'corporate_24', name: 'Corporate 24', code: 'C24', color: 'gray', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'eternal_peace', name: 'Eternal Peace', code: 'EPH', color: 'amber', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'fbc', name: 'FBC Health', code: 'FBC', color: 'orange', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'flimas', name: 'Flimas', code: 'FLI', color: 'cyan', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'generation_health', name: 'Generation Health', code: 'GEN', color: 'emerald', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'grainmed', name: 'Grainmed', code: 'GRN', color: 'lime', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'healthmed', name: 'Healthmed', code: 'HLT', color: 'rose', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'heritage', name: 'Heritage', code: 'HER', color: 'fuchsia', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'hmmas', name: 'Hmmas', code: 'HMM', color: 'violet', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'maisha', name: 'Maisha', code: 'MAI', color: 'slate', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'masca', name: 'Masca', code: 'MAS', color: 'stone', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'minerva', name: 'Minerva', code: 'MIN', color: 'zinc', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'northern', name: 'Northern', code: 'NOR', color: 'neutral', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'oakfin', name: 'Oakfin', code: 'OAK', color: 'amber', settlementDays: 60, supportsUSD: true, supportsZWG: true },
  { id: 'old_mutual', name: 'Old Mutual', code: 'OMH', color: 'blue', settlementDays: 30, supportsUSD: true, supportsZWG: true },
  { id: 'prohealth', name: 'ProHealth', code: 'PRO', color: 'green', settlementDays: 45, supportsUSD: true, supportsZWG: true },
  { id: 'varichem', name: 'Varichem', code: 'VAR', color: 'red', settlementDays: 60, supportsUSD: true, supportsZWG: true }
] as const

interface MedicalAidClaim {
  readonly id: string
  readonly claimNumber: string
  readonly patientId: string
  readonly patientName: string
  readonly providerId: string
  readonly providerName: string
  readonly memberNumber: string
  readonly orderId: string
  
  // Currency amounts with explicit locking
  readonly orderTotal: {
    readonly USD: number
    readonly ZWG: number
    readonly exchangeRate: number
    readonly rateLockedAt: Date
    readonly rateSource: 'reserve_bank' | 'manual' | 'clinic_rate'
  }
  
  // Award with original currency tracking
  readonly award: {
    readonly currency: Currency  // Original award currency
    readonly amount: number      // Amount in original currency
    readonly USD: number
    readonly ZWG: number
    readonly awardedAt?: Date
    readonly awardedBy?: string
    readonly reference?: string
  }
  
  // Shortfall with original currency tracking
  readonly shortfall: {
    readonly currency: Currency  // Original shortfall currency
    readonly amount: number      // Amount in original currency
    readonly USD: number
    readonly ZWG: number
    readonly paidAt?: Date
    readonly paymentMethod?: string
    readonly receiptNumber?: string
  }
  
  readonly status: MedicalAidStatus
  readonly rejectionReason?: string
  
  // Audit trail
  readonly createdAt: Date
  readonly createdBy: string
  readonly lastModifiedAt: Date
  readonly lastModifiedBy: string
  
  // Documents
  readonly documents: Array<{
    id: string
    name: string
    uploadedAt: Date
    type: 'invoice' | 'prescription' | 'claim_form' | 'receipt'
  }>
}

interface TimelineEvent {
  readonly id: string
  readonly claimId: string
  readonly type: TimelineEventType
  readonly occurredAt: Date
  readonly title: string
  readonly description: string
  readonly metadata?: {
    readonly amount?: number
    readonly currency?: Currency
    readonly amountUSD?: number
    readonly amountZWG?: number
    readonly reference?: string
    readonly userId?: string
    readonly userName?: string
  }
}

// ============================================================================
// STATUS PROGRESS COMPONENT - Visual workflow tracking with dates
// ============================================================================

interface StatusProgressProps {
  currentStatus: MedicalAidStatus
  className?: string
  showLabels?: boolean
  showDates?: boolean
  dates?: {
    submitted?: Date
    awarded?: Date
    shortfallPaid?: Date
    cleared?: Date
  }
}

const StatusProgress = ({ 
  currentStatus, 
  className = '',
  showLabels = true,
  showDates = true,
  dates = {}
}: StatusProgressProps) => {
  
  // Define the workflow steps in order - Pending → Submitted → Awarded → Partially Paid → Cleared
  const workflowSteps = [
    { 
      id: 'pending', 
      label: 'Pending', 
      description: 'Awaiting submission',
      icon: '⏳',
      color: 'gray'
    },
    { 
      id: 'submitted', 
      label: 'Submitted', 
      description: 'With provider',
      icon: '📤',
      color: 'blue'
    },
    { 
      id: 'awarded', 
      label: 'Awarded', 
      description: 'Claim approved',
      icon: '✅',
      color: 'green'
    },
    { 
      id: 'partially_paid', 
      label: 'Partially Paid', 
      description: 'Shortfall paid',
      icon: '💰',
      color: 'orange'
    },
    { 
      id: 'cleared', 
      label: 'Cleared', 
      description: 'Fully paid',
      icon: '✨',
      color: 'emerald'
    }
  ]

  // Find current step index
  const currentIndex = workflowSteps.findIndex(step => {
    if (currentStatus === 'under_review') return step.id === 'submitted'
    if (currentStatus === 'rejected') return step.id === 'submitted'
    return step.id === currentStatus
  })

  const getStepStatus = (stepId: string, index: number): 'complete' | 'current' | 'upcoming' | 'error' => {
    if (currentStatus === 'rejected' && stepId === 'submitted') {
      return 'error'
    }
    if (index < currentIndex) return 'complete'
    if (index === currentIndex) return 'current'
    return 'upcoming'
  }

  const getStepColor = (status: 'complete' | 'current' | 'upcoming' | 'error', baseColor: string): string => {
    if (status === 'error') return 'bg-red-500'
    
    const colorMap: Record<string, Record<string, string>> = {
      complete: {
        gray: 'bg-gray-500',
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        orange: 'bg-orange-500',
        emerald: 'bg-emerald-500'
      },
      current: {
        gray: 'bg-gray-600 ring-4 ring-gray-200',
        blue: 'bg-blue-600 ring-4 ring-blue-200',
        green: 'bg-green-600 ring-4 ring-green-200',
        orange: 'bg-orange-600 ring-4 ring-orange-200',
        emerald: 'bg-emerald-600 ring-4 ring-emerald-200'
      },
      upcoming: {
        gray: 'bg-gray-200',
        blue: 'bg-blue-200',
        green: 'bg-green-200',
        orange: 'bg-orange-200',
        emerald: 'bg-emerald-200'
      }
    }
    
    return colorMap[status]?.[baseColor] || colorMap.upcoming.gray
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStepDate = (stepId: string): string | null => {
    if (!showDates) return null
    
    switch (stepId) {
      case 'submitted':
        return dates.submitted ? formatDate(dates.submitted) : null
      case 'awarded':
        return dates.awarded ? formatDate(dates.awarded) : null
      case 'partially_paid':
        return dates.shortfallPaid ? formatDate(dates.shortfallPaid) : null
      case 'cleared':
        return dates.cleared ? formatDate(dates.cleared) : null
      default:
        return null
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Desktop Progress Bar - Hidden on mobile */}
      <div className="hidden sm:block relative pt-6 pb-8">
        <div className="flex justify-between items-start">
          {workflowSteps.map((step, index) => {
            const stepStatus = getStepStatus(step.id, index)
            const isLast = index === workflowSteps.length - 1
            const stepDate = getStepDate(step.id)
            
            return (
              <div key={step.id} className="flex-1 relative">
                {/* Connector Line */}
                {!isLast && (
                  <div 
                    className={`absolute top-3 left-1/2 w-full h-0.5 ${
                      index < currentIndex 
                        ? 'bg-gradient-to-r from-gray-500 to-gray-500' 
                        : 'bg-gray-200'
                    }`}
                    style={{ width: 'calc(100% - 2rem)', left: '1rem' }}
                    aria-hidden="true"
                  />
                )}
                
                <div className="relative flex flex-col items-center">
                  {/* Step Circle with Icon */}
                  <div 
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-white text-sm
                      ${getStepColor(stepStatus, step.color)}
                      transition-all duration-200
                      ${stepStatus === 'current' ? 'scale-110 shadow-lg' : ''}
                      ${stepStatus === 'error' ? 'animate-pulse' : ''}
                    `}
                    role="status"
                    aria-label={`${step.label}: ${
                      stepStatus === 'complete' ? 'Completed' : 
                      stepStatus === 'current' ? 'Current' : 
                      stepStatus === 'error' ? 'Error' : 'Pending'
                    }`}
                  >
                    {stepStatus === 'complete' ? (
                      <span aria-hidden="true">✓</span>
                    ) : stepStatus === 'error' ? (
                      <span aria-hidden="true">⚠️</span>
                    ) : (
                      <span aria-hidden="true">{step.icon}</span>
                    )}
                  </div>
                  
                  {/* Step Label */}
                  {showLabels && (
                    <div className="mt-2 text-center">
                      <div className={`
                        text-xs font-medium
                        ${stepStatus === 'current' ? 'text-vp-primary' : 
                          stepStatus === 'complete' ? 'text-gray-700' : 
                          stepStatus === 'error' ? 'text-red-600' : 'text-gray-500'}
                      `}>
                        {step.label}
                      </div>
                      <div className="text-[10px] text-gray-500 max-w-[80px] truncate">
                        {step.description}
                      </div>
                      
                      {/* Date Stamp */}
                      {stepDate && stepStatus !== 'upcoming' && (
                        <div className="mt-1.5 text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {stepDate}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile Vertical Timeline View */}
      <div className="sm:hidden space-y-3">
        {workflowSteps.map((step, index) => {
          const stepStatus = getStepStatus(step.id, index)
          const stepDate = getStepDate(step.id)
          
          // Only show completed, current, and upcoming with context
          if (stepStatus === 'upcoming' && index > currentIndex + 1) return null
          
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0
                ${getStepColor(stepStatus, step.color)}
                ${stepStatus === 'current' ? 'ring-2 ring-offset-2 ring-vp-primary' : ''}
              `}>
                {stepStatus === 'complete' ? '✓' : 
                 stepStatus === 'error' ? '⚠️' : step.icon}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className={`
                    text-sm font-medium
                    ${stepStatus === 'current' ? 'text-vp-primary' : 
                      stepStatus === 'complete' ? 'text-gray-700' : 'text-gray-500'}
                  `}>
                    {step.label}
                  </span>
                  {stepDate && (
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {stepDate}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          )
        })}
        
        {/* Rejected Status for Mobile */}
        {currentStatus === 'rejected' && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-600">❌</span>
              <span className="text-sm font-medium text-red-800">Claim Rejected</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Rejected Status Overlay for Desktop */}
      {currentStatus === 'rejected' && (
        <div className="hidden sm:block mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-bold">❌</span>
            <div>
              <span className="text-sm font-medium text-red-800">Claim Rejected</span>
              <span className="text-xs text-red-600 ml-2">Follow up with provider</span>
            </div>
          </div>
          {dates.submitted && (
            <p className="mt-1 text-xs text-gray-600 ml-7">
              Submitted: {formatDate(dates.submitted)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

interface StatusBadgeProps {
  status: MedicalAidStatus
  className?: string
}

const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const getStatusConfig = (status: MedicalAidStatus): {
    label: string
    color: string
    bgColor: string
    borderColor: string
    icon: string
  } => {
    const configs: Record<MedicalAidStatus, ReturnType<typeof getStatusConfig>> = {
      pending: {
        label: 'Pending',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        icon: '⏳'
      },
      submitted: {
        label: 'Submitted',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300',
        icon: '📤'
      },
      under_review: {
        label: 'Under Review',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300',
        icon: '🔍'
      },
      awarded: {
        label: 'Awarded',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        icon: '✅'
      },
      partially_paid: {
        label: 'Partially Paid',
        color: 'text-orange-700',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-300',
        icon: '💰'
      },
      cleared: {
        label: 'Cleared',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-300',
        icon: '✨'
      },
      rejected: {
        label: 'Rejected',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        icon: '❌'
      }
    }
    return configs[status] || configs.pending
  }

  const config = getStatusConfig(status)
  
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${config.bgColor} ${config.color} ${config.borderColor} border
        ${className}
      `}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

// ============================================================================
// TIMELINE EVENT COMPONENT - Updated for dual currency
// ============================================================================

interface TimelineEventItemProps {
  event: TimelineEvent
  isLast: boolean
}

const TimelineEventItem = ({ event, isLast }: TimelineEventItemProps) => {
  const getEventIcon = (type: TimelineEventType): string => {
    const icons: Record<TimelineEventType, string> = {
      claim_submitted: '📤',
      award_received: '✅',
      shortfall_paid: '💰',
      medical_aid_paid: '🏥',
      follow_up: '📞',
      rejection: '❌',
      appeal: '⚖️'
    }
    return icons[type] || '📌'
  }

  const getEventColor = (type: TimelineEventType): string => {
    const colors: Record<TimelineEventType, string> = {
      claim_submitted: 'bg-blue-500',
      award_received: 'bg-green-500',
      shortfall_paid: 'bg-orange-500',
      medical_aid_paid: 'bg-emerald-500',
      follow_up: 'bg-gray-500',
      rejection: 'bg-red-500',
      appeal: 'bg-purple-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: Currency): string => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return `ZWG ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  return (
    <li className="relative pb-8">
      {!isLast && (
        <span
          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
          aria-hidden="true"
        />
      )}
      
      <div className="relative flex gap-3">
        <div className="flex-shrink-0">
          <span
            className={`
              flex h-8 w-8 items-center justify-center rounded-full
              ${getEventColor(event.type)} text-white
            `}
            aria-hidden="true"
          >
            {getEventIcon(event.type)}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {event.title}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {event.description}
              </p>
              
              {event.metadata?.amount && event.metadata?.currency && (
                <p className="mt-1 text-sm font-medium">
                  <span className={event.metadata.currency === 'USD' ? 'text-currency-usd' : 'text-currency-ZWG'}>
                    {formatCurrency(event.metadata.amount, event.metadata.currency)}
                  </span>
                  {event.metadata.amountUSD && event.metadata.amountZWG && (
                    <span className="ml-2 text-xs text-gray-500">
                      (≈ {formatCurrency(event.metadata.amountUSD, 'USD')} / {formatCurrency(event.metadata.amountZWG, 'ZWG')})
                    </span>
                  )}
                </p>
              )}
              
              {event.metadata?.reference && (
                <p className="mt-1 text-xs text-gray-500 font-mono">
                  Ref: {event.metadata.reference}
                </p>
              )}
            </div>
            
            <div className="text-left sm:text-right text-xs text-gray-500 whitespace-nowrap">
              <time dateTime={event.occurredAt.toISOString()}>
                {formatDate(event.occurredAt)}
              </time>
              {event.metadata?.userName && (
                <p className="mt-0.5 text-gray-400">
                  by {event.metadata.userName}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

// ============================================================================
// CLAIM CARD COMPONENT - Updated for dual currency
// ============================================================================

interface ClaimCardProps {
  claim: MedicalAidClaim
  isSelected: boolean
  onSelect: (claim: MedicalAidClaim) => void
}

const ClaimCard = ({ claim, isSelected, onSelect }: ClaimCardProps) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-ZW', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency: Currency): string => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return `ZWG ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }
  
  return (
    <button
      onClick={() => onSelect(claim)}
      className={`
        w-full text-left p-4 border-b transition-all
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-vp-primary
        ${isSelected ? 'bg-vp-primary/5 border-l-4 border-l-vp-primary' : 'border-l-4 border-l-transparent'}
      `}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`Claim for ${claim.patientName}, Status: ${claim.status}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{claim.patientName}</h3>
          <p className="text-sm text-gray-600">{claim.providerName}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {claim.claimNumber}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Order:</span>
            <span className="font-mono">{claim.orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-medium">
              {formatCurrency(claim.orderTotal.USD, 'USD')}
            </span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Awarded:</span>
            <span className="font-medium text-currency-usd">
              {formatCurrency(claim.award.amount, claim.award.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Shortfall:</span>
            <span className="font-medium text-orange-600">
              {formatCurrency(claim.shortfall.amount, claim.shortfall.currency)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Currency badges */}
      <div className="mt-2 flex gap-2 text-[10px]">
        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
          Award: {claim.award.currency}
        </span>
        <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
          Shortfall: {claim.shortfall.currency}
        </span>
      </div>
      
      {/* Status date indicators */}
      <div className="mt-3 pt-2 border-t grid grid-cols-2 gap-2 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span>📅 Submitted:</span>
          <span className="font-mono">{formatDate(claim.createdAt)}</span>
        </div>
        {claim.award.awardedAt && (
          <div className="flex items-center gap-1">
            <span>✅ Awarded:</span>
            <span className="font-mono">{formatDate(claim.award.awardedAt)}</span>
          </div>
        )}
        {claim.shortfall.paidAt && (
          <div className="flex items-center gap-1">
            <span>💰 Paid:</span>
            <span className="font-mono">{formatDate(claim.shortfall.paidAt)}</span>
          </div>
        )}
      </div>
      
      {/* Exchange rate indicator - critical for audit */}
      <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
        <span className="currency-badge currency-locked px-1 py-0.5">🔒</span>
        <span>1 USD = {claim.orderTotal.exchangeRate} ZWG</span>
        <span className="ml-1">• {formatDate(claim.orderTotal.rateLockedAt)}</span>
      </div>
    </button>
  )
}

// ============================================================================
// CURRENCY AMOUNT DISPLAY COMPONENT - Helper for dual currency display
// ============================================================================

interface CurrencyAmountDisplayProps {
  amount: number
  currency: Currency
  showEquivalent?: boolean
  exchangeRate?: number
  className?: string
}

const CurrencyAmountDisplay = ({ 
  amount, 
  currency, 
  showEquivalent = true, 
  exchangeRate = 32.5,
  className = '' 
}: CurrencyAmountDisplayProps) => {
  const formatCurrency = (amt: number, curr: Currency): string => {
    if (curr === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amt)
    }
    return `ZWG ${amt.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const equivalentUSD = currency === 'USD' ? amount : amount / exchangeRate
  const equivalentZWG = currency === 'ZWG' ? amount : amount * exchangeRate

  return (
    <div className={className}>
      <div className="font-bold">
        <span className={currency === 'USD' ? 'text-currency-usd' : 'text-currency-ZWG'}>
          {formatCurrency(amount, currency)}
        </span>
      </div>
      {showEquivalent && (
        <div className="text-xs text-gray-500">
          <span className="text-currency-usd">{formatCurrency(equivalentUSD, 'USD')}</span>
          {' / '}
          <span className="text-currency-ZWG">{formatCurrency(equivalentZWG, 'ZWG')}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// CUSTOM HOOKS - Business logic separation, updated for dual currency
// ============================================================================

function useMedicalAidClaims() {
  const { 
    claims: cachedClaims, 
    isLoading, 
    recordAwardWithCurrency,
    recordShortfallPaymentWithCurrency,
    markClaimCleared: cacheMarkClaimCleared,
    refresh 
  } = useMedicalAidCache()
  
  const [claims, setClaims] = useState<MedicalAidClaim[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [error, setError] = useState<Error | null>(null)
  
  const medicalAidCache = MedicalAidCache.getInstance()

  const formatCurrency = (amount: number, currency: Currency): string => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return `ZWG ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  useEffect(() => {
    if (cachedClaims.length > 0) {
      const convertedClaims: MedicalAidClaim[] = cachedClaims.map(c => ({
        id: c.id,
        claimNumber: c.claimNumber,
        patientId: c.patientId,
        patientName: c.patientName,
        providerId: c.providerId,
        providerName: c.providerName,
        memberNumber: c.memberNumber,
        orderId: c.orderId,
        orderTotal: {
          USD: c.orderTotalUSD,
          ZWG: c.orderTotalZWG,
          exchangeRate: c.exchangeRate,
          rateLockedAt: c.rateLockedAt,
          rateSource: c.rateSource as any
        },
        award: {
          currency: c.awardCurrency || 'ZWG',
          amount: c.awardAmount || 0,
          USD: c.awardUSD,
          ZWG: c.awardZWG,
          awardedAt: c.awardAt,
          awardedBy: c.awardBy,
          reference: c.awardReference
        },
        shortfall: {
          currency: c.shortfallCurrency || 'ZWG',
          amount: c.shortfallAmount || 0,
          USD: c.shortfallUSD,
          ZWG: c.shortfallZWG,
          paidAt: c.shortfallPaidAt,
          paymentMethod: c.shortfallPaymentMethod,
          receiptNumber: c.shortfallReceiptNumber
        },
        status: c.status,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        lastModifiedAt: c.lastModifiedAt,
        lastModifiedBy: c.lastModifiedBy,
        documents: []
      }))
      
      setClaims(convertedClaims)
      
      const events: TimelineEvent[] = []
      
      convertedClaims.forEach(claim => {
        events.push({
          id: `EVT-${claim.id}-created`,
          claimId: claim.id,
          type: 'claim_submitted',
          occurredAt: claim.createdAt,
          title: 'Claim Created',
          description: `Claim created for ${claim.patientName}`,
          metadata: {
            userId: claim.createdBy,
            userName: claim.createdBy
          }
        })
        
        if (claim.award.awardedAt) {
          events.push({
            id: `EVT-${claim.id}-award`,
            claimId: claim.id,
            type: 'award_received',
            occurredAt: claim.award.awardedAt,
            title: 'Award Received',
            description: `${claim.providerName} awarded ${formatCurrency(claim.award.amount, claim.award.currency)}`,
            metadata: {
              amount: claim.award.amount,
              currency: claim.award.currency,
              amountUSD: claim.award.USD,
              amountZWG: claim.award.ZWG,
              reference: claim.award.reference,
              userId: claim.award.awardedBy,
              userName: claim.award.awardedBy
            }
          })
        }
        
        if (claim.shortfall.paidAt) {
          events.push({
            id: `EVT-${claim.id}-shortfall`,
            claimId: claim.id,
            type: 'shortfall_paid',
            occurredAt: claim.shortfall.paidAt,
            title: 'Shortfall Paid',
            description: `Patient paid ${formatCurrency(claim.shortfall.amount, claim.shortfall.currency)} via ${claim.shortfall.paymentMethod}`,
            metadata: {
              amount: claim.shortfall.amount,
              currency: claim.shortfall.currency,
              amountUSD: claim.shortfall.USD,
              amountZWG: claim.shortfall.ZWG,
              reference: claim.shortfall.receiptNumber,
              userName: claim.lastModifiedBy
            }
          })
        }
        
        const directPayments = medicalAidCache.getPaymentsByClaim(claim.id)
        directPayments.forEach(payment => {
          events.push({
            id: `EVT-${payment.id}`,
            claimId: claim.id,
            type: 'shortfall_paid',
            occurredAt: payment.paidAt,
            title: 'Medical Aid Payment',
            description: `Payment of ${formatCurrency(payment.amount, payment.currency)} received via ${payment.paymentMethod}`,
            metadata: {
              amount: payment.amount,
              currency: payment.currency,
              amountUSD: payment.amountUSD,
              amountZWG: payment.amountZWG,
              reference: payment.reference || payment.receiptNumber,
              userName: payment.capturedBy
            }
          })
        })
        
        if (claim.status === 'cleared') {
          events.push({
            id: `EVT-${claim.id}-cleared`,
            claimId: claim.id,
            type: 'medical_aid_paid',
            occurredAt: claim.lastModifiedAt,
            title: 'Claim Cleared',
            description: `Claim fully paid and closed`,
            metadata: {
              userName: claim.lastModifiedBy
            }
          })
        }
      })
      
      setTimelineEvents(events.sort((a, b) => 
        b.occurredAt.getTime() - a.occurredAt.getTime()
      ))
    }
  }, [cachedClaims])

  const validateAwardAmount = useCallback((
    awardAmount: number,
    awardCurrency: Currency,
    orderTotalUSD: number,
    orderTotalZWG: number,
    exchangeRate: number
  ): { isValid: boolean; error?: string } => {
    if (awardAmount < 0) {
      return { isValid: false, error: 'Award amount cannot be negative' }
    }
    
    // Convert award to USD for comparison with order total
    const awardUSD = awardCurrency === 'USD' ? awardAmount : awardAmount / exchangeRate
    const awardZWG = awardCurrency === 'ZWG' ? awardAmount : awardAmount * exchangeRate
    
    if (awardUSD > orderTotalUSD) {
      return { isValid: false, error: 'Award amount cannot exceed order total' }
    }
    
    if (awardUSD === 0) {
      return { isValid: false, error: 'Award amount must be greater than zero' }
    }
    
    const decimalPlaces = awardAmount.toString().split('.')[1]?.length || 0
    if (decimalPlaces > 2) {
      return { isValid: false, error: 'Amount cannot have more than 2 decimal places' }
    }
    
    return { isValid: true }
  }, [])

  const updateClaimAward = useCallback(async (
    claimId: string,
    awardAmount: number,
    awardCurrency: Currency,
    exchangeRate: number,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) {
      return { success: false, error: 'Claim not found' }
    }

    const validation = validateAwardAmount(
      awardAmount, 
      awardCurrency, 
      claim.orderTotal.USD, 
      claim.orderTotal.ZWG,
      exchangeRate
    )
    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    const result = await recordAwardWithCurrency(claimId, awardAmount, awardCurrency, exchangeRate, userName)
    
    if (result) {
      return { success: true }
    }
    return { success: false, error: 'Failed to update award' }
  }, [claims, validateAwardAmount, recordAwardWithCurrency])

  const markShortfallPaid = useCallback(async (
    claimId: string,
    shortfallAmount: number,
    shortfallCurrency: Currency,
    exchangeRate: number,
    paymentMethod: string,
    receiptNumber: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) {
      return { success: false, error: 'Claim not found' }
    }

    if (claim.shortfall.amount <= 0) {
      return { success: false, error: 'No shortfall amount to pay' }
    }

    if (claim.shortfall.paidAt) {
      return { success: false, error: 'Shortfall already paid' }
    }

    const result = await recordShortfallPaymentWithCurrency(
      claimId, 
      shortfallAmount, 
      shortfallCurrency, 
      exchangeRate,
      paymentMethod, 
      receiptNumber, 
      userName
    )
    
    if (result) {
      return { success: true }
    }
    return { success: false, error: 'Failed to record shortfall payment' }
  }, [claims, recordShortfallPaymentWithCurrency])

  const clearClaim = useCallback(async (
    claimId: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) {
      return { success: false, error: 'Claim not found' }
    }

    if (claim.status === 'cleared') {
      return { success: false, error: 'Claim already cleared' }
    }

    const result = await cacheMarkClaimCleared(claimId, userName)
    
    if (result) {
      return { success: true }
    }
    return { success: false, error: 'Failed to clear claim' }
  }, [claims, cacheMarkClaimCleared])

  return {
    claims,
    timelineEvents,
    isLoading,
    error,
    updateClaimAward,
    markShortfallPaid,
    markClaimCleared: clearClaim,
    validateAwardAmount,
    refresh
  }
}

// ============================================================================
// FORMATTING UTILITIES - Pure functions
// ============================================================================

const formatCurrency = (amount: number, currency: Currency): string => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }
  
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency: 'ZWG',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('ZWG', 'ZWG')
}

const formatDate = (date: Date, includeTime: boolean = true): string => {
  return date.toLocaleDateString('en-ZW', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  })
}

// ============================================================================
// MAIN COMPONENT - Updated for dual currency
// ============================================================================

export default function MedicalAidScreen() {
  const {
    claims,
    timelineEvents,
    isLoading,
    error,
    updateClaimAward,
    markShortfallPaid,
    markClaimCleared,
    validateAwardAmount
  } = useMedicalAidClaims()

  const [selectedClaim, setSelectedClaim] = useState<MedicalAidClaim | null>(null)
  const [filters, setFilters] = useState({
    status: 'all' as MedicalAidStatus | 'all',
    provider: 'all',
    dateFrom: '',
    dateTo: '',
    currency: 'all' as 'all' | 'USD' | 'ZWG' // New currency filter
  })
  const [awardInput, setAwardInput] = useState<string>('')
  const [awardCurrency, setAwardCurrency] = useState<Currency>('ZWG') // New award currency selector
  const [awardError, setAwardError] = useState<string | null>(null)
  const [showShortfallPaymentModal, setShowShortfallPaymentModal] = useState(false)
  const [showClearedModal, setShowClearedModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [shortfallCurrency, setShortfallCurrency] = useState<Currency>('ZWG') // New shortfall currency selector
  const [shortfallAmount, setShortfallAmount] = useState<string>('')

  // Set initial selected claim
  useEffect(() => {
    if (claims.length > 0 && !selectedClaim) {
      setSelectedClaim(claims[0])
    }
  }, [claims, selectedClaim])

  // Reset award input when selected claim changes
  useEffect(() => {
    if (selectedClaim) {
      setAwardInput(selectedClaim.award.amount.toString())
      setAwardCurrency(selectedClaim.award.currency)
      setAwardError(null)
    }
  }, [selectedClaim])

  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      if (filters.status !== 'all' && claim.status !== filters.status) return false
      if (filters.provider !== 'all' && claim.providerId !== filters.provider) return false
      if (filters.dateFrom && claim.createdAt < new Date(filters.dateFrom)) return false
      if (filters.dateTo && claim.createdAt > new Date(filters.dateTo)) return false
      if (filters.currency !== 'all' && claim.award.currency !== filters.currency) return false
      return true
    })
  }, [claims, filters])

  const claimTimeline = useMemo(() => {
    if (!selectedClaim) return []
    return timelineEvents
      .filter(event => event.claimId === selectedClaim.id)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
  }, [timelineEvents, selectedClaim])

  const handleAwardChange = useCallback((value: string) => {
    setAwardInput(value)
    
    if (!selectedClaim) return
    
    const amount = parseFloat(value)
    if (isNaN(amount)) {
      setAwardError('Please enter a valid amount')
      return
    }
    
    const validation = validateAwardAmount(
      amount, 
      awardCurrency, 
      selectedClaim.orderTotal.USD, 
      selectedClaim.orderTotal.ZWG,
      selectedClaim.orderTotal.exchangeRate
    )
    setAwardError(validation.error || null)
  }, [selectedClaim, awardCurrency, validateAwardAmount])

  const handleUpdateAward = useCallback(async () => {
    if (!selectedClaim || awardError || !awardInput) return
    
    const amount = parseFloat(awardInput)
    if (isNaN(amount)) return
    
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const result = updateClaimAward(
      selectedClaim.id,
      amount,
      awardCurrency,
      selectedClaim.orderTotal.exchangeRate,
      'current-user',
      'Fred Stanley'
    )
    
    if (!result.success) {
      setAwardError(result.error || 'Failed to update award')
    }
    
    setIsProcessing(false)
  }, [selectedClaim, awardInput, awardCurrency, awardError, updateClaimAward])

  const handleMarkShortfallPaid = useCallback(async (paymentMethod: string, receiptNumber: string) => {
    if (!selectedClaim) return
    
    const amount = parseFloat(shortfallAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid shortfall amount')
      return
    }
    
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const result = markShortfallPaid(
      selectedClaim.id,
      amount,
      shortfallCurrency,
      selectedClaim.orderTotal.exchangeRate,
      paymentMethod,
      receiptNumber,
      'current-user',
      'Fred Stanley'
    )
    
    if (!result.success) {
      console.error(result.error)
    }
    
    setShowShortfallPaymentModal(false)
    setIsProcessing(false)
  }, [selectedClaim, shortfallAmount, shortfallCurrency, markShortfallPaid])

  const handleMarkCleared = useCallback(async () => {
    if (!selectedClaim) return
    
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const result = markClaimCleared(
      selectedClaim.id,
      'current-user',
      'Fred Stanley'
    )
    
    if (!result.success) {
      console.error(result.error)
    }
    
    setShowClearedModal(false)
    setIsProcessing(false)
  }, [selectedClaim, markClaimCleared])

  if (error) {
    return (
      <div className="min-h-screen bg-vp-background flex items-center justify-center p-6">
        <div className="vp-card max-w-md">
          <div className="vp-card-header bg-status-error">
            System Error
          </div>
          <div className="vp-card-body text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-vp-primary mb-2">
              Unable to Load Medical Aid Claims
            </h2>
            <p className="text-gray-600 mb-4">
              {error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="vp-btn vp-btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <LoadingOverlay isLoading={isLoading || isProcessing} message="Processing..." />
      
      <div className="min-h-screen bg-vp-background">
        {/* Mobile Header */}
        <MobileHeader />

        <div className="flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 min-w-0" id="main-content">
            <div className="p-4 lg:p-6">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-vp-primary">
                  Medical Aid Claims Management
                </h1>
                <p className="text-gray-600">
                  Track awards, shortfalls, and payments from medical aid providers
                </p>
              </div>

              {/* Filters */}
              <section className="vp-card mb-6" aria-label="Claim Filters">
                <div className="vp-card-body">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label htmlFor="status-filter" className="vp-form-label">
                        Status
                      </label>
                      <select
                        id="status-filter"
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          status: e.target.value as MedicalAidStatus | 'all'
                        }))}
                        className="vp-form-control"
                        aria-label="Filter by claim status"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="awarded">Awarded</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="cleared">Cleared</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="provider-filter" className="vp-form-label">
                        Provider
                      </label>
                      <select
                        id="provider-filter"
                        value={filters.provider}
                        onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                        className="vp-form-control"
                        aria-label="Filter by medical aid provider"
                      >
                        <option value="all">All Providers</option>
                        {MEDICAL_AID_PROVIDERS.map(provider => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="currency-filter" className="vp-form-label">
                        Award Currency
                      </label>
                      <select
                        id="currency-filter"
                        value={filters.currency}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          currency: e.target.value as 'all' | 'USD' | 'ZWG'
                        }))}
                        className="vp-form-control"
                        aria-label="Filter by award currency"
                      >
                        <option value="all">All Currencies</option>
                        <option value="USD">USD Only</option>
                        <option value="ZWG">ZWG Only</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="date-from" className="vp-form-label">
                        From Date
                      </label>
                      <input
                        id="date-from"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="vp-form-control"
                        aria-label="Filter claims from date"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="date-to" className="vp-form-label">
                        To Date
                      </label>
                      <input
                        id="date-to"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="vp-form-control"
                        aria-label="Filter claims to date"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Claims Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Claims List */}
                <section className="lg:col-span-1" aria-label="Claims List">
                  <div className="vp-card h-[calc(100vh-300px)] flex flex-col">
                    <div className="vp-card-header flex justify-between items-center">
                      <span>Active Claims</span>
                      <span className="text-sm bg-white/20 px-2 py-1 rounded">
                        {filteredClaims.length}
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                      {filteredClaims.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                          {filteredClaims.map(claim => (
                            <ClaimCard
                              key={claim.id}
                              claim={claim}
                              isSelected={selectedClaim?.id === claim.id}
                              onSelect={setSelectedClaim}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
                          <div className="text-5xl mb-4" aria-hidden="true">
                            🏥
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-1">
                            No claims found
                          </h3>
                          <p className="text-sm">
                            Try adjusting your filters or create a new claim
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Claim Details */}
                {selectedClaim ? (
                  <section className="lg:col-span-2 space-y-6" aria-label="Claim Details">
                    {/* Claim Summary Card */}
                    <div className="vp-card">
                      <div className="vp-card-header flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span>Claim: {selectedClaim.claimNumber}</span>
                          <StatusBadge status={selectedClaim.status} />
                        </div>
                        <div className="text-sm text-gray-200">
                          Last updated: {formatDate(selectedClaim.lastModifiedAt)}
                        </div>
                      </div>
                      
                      {/* STATUS PROGRESS INDICATOR */}
                      <div className="vp-card-body border-b border-gray-200 bg-gray-50/50">
                        <StatusProgress 
                          currentStatus={selectedClaim.status}
                          showLabels={true}
                          showDates={true}
                          dates={{
                            submitted: selectedClaim.createdAt,
                            awarded: selectedClaim.award.awardedAt,
                            shortfallPaid: selectedClaim.shortfall.paidAt,
                            cleared: selectedClaim.status === 'cleared' ? selectedClaim.lastModifiedAt : undefined
                          }}
                        />
                      </div>
                      
                      <div className="vp-card-body">
                        {/* Amount Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                              Order Total
                            </p>
                            <p className="text-xl font-bold text-vp-primary">
                              {formatCurrency(selectedClaim.orderTotal.USD, 'USD')}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(selectedClaim.orderTotal.ZWG, 'ZWG')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Rate: 1 USD = {selectedClaim.orderTotal.exchangeRate} ZWG
                            </p>
                          </div>
                          
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                              Awarded
                            </p>
                            <CurrencyAmountDisplay
                              amount={selectedClaim.award.amount}
                              currency={selectedClaim.award.currency}
                              exchangeRate={selectedClaim.orderTotal.exchangeRate}
                            />
                            {selectedClaim.award.awardedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(selectedClaim.award.awardedAt, false)}
                              </p>
                            )}
                          </div>
                          
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                              Shortfall
                            </p>
                            <CurrencyAmountDisplay
                              amount={selectedClaim.shortfall.amount}
                              currency={selectedClaim.shortfall.currency}
                              exchangeRate={selectedClaim.orderTotal.exchangeRate}
                              className="text-orange-600"
                            />
                            {selectedClaim.shortfall.paidAt ? (
                              <p className="text-xs text-green-600 mt-1">
                                Paid {formatDate(selectedClaim.shortfall.paidAt, false)}
                              </p>
                            ) : (
                              <p className="text-xs text-orange-600 mt-1">
                                Awaiting payment
                              </p>
                            )}
                          </div>
                          
                          <div className={`p-4 rounded-lg border ${
                            selectedClaim.status === 'cleared'
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}>
                            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                              Status
                            </p>
                            <p className="text-xl font-bold">
                              {selectedClaim.status === 'cleared' ? 'Cleared' : 
                               selectedClaim.status === 'partially_paid' ? 'Partial' : 
                               selectedClaim.status === 'awarded' ? 'Awarded' : 
                               selectedClaim.status === 'submitted' ? 'Submitted' : 'Pending'}
                            </p>
                            {selectedClaim.status === 'cleared' && (
                              <p className="text-xs text-emerald-600 mt-1">
                                Fully paid
                              </p>
                            )}
                            {selectedClaim.status === 'partially_paid' && (
                              <p className="text-xs text-orange-600 mt-1">
                                Shortfall paid
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Patient & Provider Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div>
                            <label className="vp-form-label text-xs">
                              Patient Information
                            </label>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <p className="font-medium">{selectedClaim.patientName}</p>
                              <p className="text-sm text-gray-600">
                                ID: {selectedClaim.patientId}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <label className="vp-form-label text-xs">
                              Medical Aid Information
                            </label>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <p className="font-medium">{selectedClaim.providerName}</p>
                              <p className="text-sm text-gray-600">
                                Member: {selectedClaim.memberNumber}
                              </p>
                              <p className="text-xs text-gray-500 font-mono mt-1">
                                Claim Ref: {selectedClaim.claimNumber}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Award Adjustment - Only if not paid/cleared */}
                        {selectedClaim.status !== 'cleared' && selectedClaim.status !== 'partially_paid' && (
                          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <label htmlFor="award-amount" className="vp-form-label">
                                Adjust Award Amount
                              </label>
                              <span className="text-xs text-gray-500">
                                Rate: 1 USD = {selectedClaim.orderTotal.exchangeRate} ZWG
                              </span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1">
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input
                                      id="award-amount"
                                      type="number"
                                      value={awardInput}
                                      onChange={(e) => handleAwardChange(e.target.value)}
                                      className={`vp-form-control pl-10 ${
                                        awardError ? 'border-status-error focus:border-status-error' : ''
                                      }`}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                      disabled={isProcessing}
                                      aria-invalid={!!awardError}
                                      aria-describedby={awardError ? 'award-error' : undefined}
                                    />
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                      <span className={awardCurrency === 'USD' ? 'text-currency-usd' : 'text-currency-ZWG'}>
                                        {awardCurrency === 'USD' ? '$' : 'ZW$'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setAwardCurrency('USD')}
                                      className={`
                                        px-3 py-2 rounded-md text-xs font-medium transition-all
                                        ${awardCurrency === 'USD'
                                          ? 'bg-currency-usd text-white'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }
                                      `}
                                    >
                                      USD
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAwardCurrency('ZWG')}
                                      className={`
                                        px-3 py-2 rounded-md text-xs font-medium transition-all
                                        ${awardCurrency === 'ZWG'
                                          ? 'bg-currency-ZWG text-white'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }
                                      `}
                                    >
                                      ZWG
                                    </button>
                                  </div>
                                </div>
                                
                                {awardError && (
                                  <p id="award-error" className="mt-1 text-sm text-status-error">
                                    {awardError}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullAmount = awardCurrency === 'USD' 
                                      ? selectedClaim.orderTotal.USD 
                                      : selectedClaim.orderTotal.ZWG
                                    setAwardInput(fullAmount.toString())
                                  }}
                                  className="vp-btn vp-btn-outline whitespace-nowrap"
                                  disabled={isProcessing}
                                >
                                  Full Award
                                </button>
                                <button
                                  type="button"
                                  onClick={handleUpdateAward}
                                  className="vp-btn vp-btn-primary whitespace-nowrap"
                                  disabled={!awardInput || !!awardError || isProcessing}
                                >
                                  Update Award
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[50, 100, 150, 200, 250].map(amount => {
                                const displayAmount = awardCurrency === 'USD' 
                                  ? amount 
                                  : amount * selectedClaim.orderTotal.exchangeRate
                                return (
                                  <button
                                    key={amount}
                                    type="button"
                                    onClick={() => handleAwardChange(displayAmount.toFixed(2))}
                                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                                    disabled={isProcessing}
                                  >
                                    {awardCurrency === 'USD' ? `$${amount}` : `ZW${Math.round(displayAmount)}`}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons - Based on Status */}
                        <div className="flex flex-wrap gap-3">
                          {selectedClaim.status === 'awarded' && !selectedClaim.shortfall.paidAt && (
                            <button
                              type="button"
                              onClick={() => {
                                setShortfallAmount(selectedClaim.shortfall.amount.toString())
                                setShortfallCurrency(selectedClaim.shortfall.currency)
                                setShowShortfallPaymentModal(true)
                              }}
                              className="vp-btn vp-btn-warning flex items-center gap-2"
                              disabled={isProcessing}
                            >
                              <span aria-hidden="true">💰</span>
                              Record Shortfall Payment
                            </button>
                          )}
                          
                          {selectedClaim.status === 'partially_paid' && (
                            <button
                              type="button"
                              onClick={() => setShowClearedModal(true)}
                              className="vp-btn vp-btn-success flex items-center gap-2"
                              disabled={isProcessing}
                            >
                              <span aria-hidden="true">✅</span>
                              Mark as Fully Paid
                            </button>
                          )}
                          
                          <button
                            type="button"
                            className="vp-btn vp-btn-outline flex items-center gap-2"
                          >
                            <span aria-hidden="true">📄</span>
                            Generate Claim Form
                          </button>
                          
                          <button
                            type="button"
                            className="vp-btn vp-btn-outline flex items-center gap-2"
                          >
                            <span aria-hidden="true">📧</span>
                            Send Reminder
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="vp-card">
                      <div className="vp-card-header">
                        Claim Timeline
                      </div>
                      
                      <div className="vp-card-body">
                        {claimTimeline.length > 0 ? (
                          <ul className="flow-root">
                            {claimTimeline.map((event, index) => (
                              <TimelineEventItem
                                key={event.id}
                                event={event}
                                isLast={index === claimTimeline.length - 1}
                              />
                            ))}
                          </ul>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <p className="text-sm">No timeline events recorded</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="lg:col-span-2 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="text-6xl mb-4" aria-hidden="true">
                        🏥
                      </div>
                      <h2 className="text-xl font-medium text-gray-700 mb-2">
                        Select a claim to view details
                      </h2>
                      <p className="text-sm">
                        Choose a claim from the list to view its details, adjust awards,
                        and track payment status.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Shortfall Payment Modal - Updated for dual currency */}
        {showShortfallPaymentModal && selectedClaim && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortfall-modal-title"
          >
            <div className="vp-card max-w-md w-full">
              <div className="vp-card-header flex justify-between items-center">
                <h2 id="shortfall-modal-title" className="text-lg font-semibold">
                  Record Shortfall Payment
                </h2>
                <button
                  onClick={() => setShowShortfallPaymentModal(false)}
                  className="text-white hover:text-gray-200"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const paymentMethod = formData.get('paymentMethod') as string
                  const receiptNumber = formData.get('receiptNumber') as string
                  handleMarkShortfallPaid(paymentMethod, receiptNumber)
                }}
              >
                <div className="vp-card-body space-y-4">
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800 mb-1">
                      Shortfall Amount
                    </p>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={shortfallAmount}
                          onChange={(e) => setShortfallAmount(e.target.value)}
                          className="vp-form-control pl-10"
                          placeholder="0.00"
                          min="0.01"
                          step="0.01"
                          required
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <span className={shortfallCurrency === 'USD' ? 'text-currency-usd' : 'text-currency-ZWG'}>
                            {shortfallCurrency === 'USD' ? '$' : 'ZW$'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setShortfallCurrency('USD')}
                          className={`
                            px-3 py-2 rounded-md text-xs font-medium transition-all
                            ${shortfallCurrency === 'USD'
                              ? 'bg-currency-usd text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }
                          `}
                        >
                          USD
                        </button>
                        <button
                          type="button"
                          onClick={() => setShortfallCurrency('ZWG')}
                          className={`
                            px-3 py-2 rounded-md text-xs font-medium transition-all
                            ${shortfallCurrency === 'ZWG'
                              ? 'bg-currency-ZWG text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }
                          `}
                        >
                          ZWG
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      ≈ {formatCurrency(
                        shortfallCurrency === 'USD' 
                          ? parseFloat(shortfallAmount) * selectedClaim.orderTotal.exchangeRate
                          : parseFloat(shortfallAmount) / selectedClaim.orderTotal.exchangeRate,
                        shortfallCurrency === 'USD' ? 'ZWG' : 'USD'
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="payment-method" className="vp-form-label">
                      Payment Method
                    </label>
                    <select
                      id="payment-method"
                      name="paymentMethod"
                      className="vp-form-control"
                      required
                    >
                      <option value="">Select payment method</option>
                      <option value="Cash USD">Cash USD</option>
                      <option value="Cash ZWG">Cash ZWG</option>
                      <option value="Ecocash">Ecocash</option>
                      <option value="RTGS">RTGS</option>
                      <option value="Credit Card">Credit/Debit Card</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="receipt-number" className="vp-form-label">
                      Receipt Number
                    </label>
                    <input
                      id="receipt-number"
                      name="receiptNumber"
                      type="text"
                      className="vp-form-control"
                      placeholder="e.g., RCPT-123456"
                      required
                    />
                  </div>
                </div>
                
                <div className="vp-card-footer flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowShortfallPaymentModal(false)}
                    className="vp-btn vp-btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="vp-btn vp-btn-success"
                    disabled={isProcessing || !shortfallAmount || parseFloat(shortfallAmount) <= 0}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Clear Claim Modal */}
        {showClearedModal && selectedClaim && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cleared-modal-title"
          >
            <div className="vp-card max-w-md w-full">
              <div className="vp-card-header flex justify-between items-center">
                <h2 id="cleared-modal-title" className="text-lg font-semibold">
                  Confirm Payment Received
                </h2>
                <button
                  onClick={() => setShowClearedModal(false)}
                  className="text-white hover:text-gray-200"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>
              
              <div className="vp-card-body space-y-4">
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-800 mb-1">
                    Medical Aid Payment
                  </p>
                  <CurrencyAmountDisplay
                    amount={selectedClaim.award.amount}
                    currency={selectedClaim.award.currency}
                    exchangeRate={selectedClaim.orderTotal.exchangeRate}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Provider: {selectedClaim.providerName}
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">
                  Mark this claim as fully paid? This will close the claim and update the status to "Cleared".
                </p>
              </div>
              
              <div className="vp-card-footer flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearedModal(false)}
                  className="vp-btn vp-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMarkCleared}
                  className="vp-btn vp-btn-success"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}