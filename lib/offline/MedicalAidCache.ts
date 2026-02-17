// lib/offline/MedicalAidCache.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// TYPES - Production Grade, Immutable, Dual Currency Support
// ============================================================================

type Currency = 'USD' | 'ZWG'
type MedicalAidStatus = 'pending' | 'submitted' | 'under_review' | 'awarded' | 'partially_paid' | 'cleared' | 'rejected'
type MedicalAidPaymentType = 'award' | 'shortfall' | 'direct_payment' | 'settlement'

interface MedicalAidClaim {
  readonly id: string
  readonly claimNumber: string
  readonly patientId: string
  readonly patientName: string
  readonly providerId: string
  readonly providerName: string
  readonly memberNumber: string
  readonly memberName?: string
  readonly orderId: string
  readonly orderTotalUSD: number
  readonly orderTotalZWG: number
  readonly exchangeRate: number
  readonly rateLockedAt: Date
  readonly rateSource: string
  
  // Award - Now tracks original currency
  readonly awardCurrency: Currency  // New: track which currency the award was made in
  readonly awardAmount: number       // New: amount in awardCurrency
  readonly awardUSD: number          // Always stored for consistency
  readonly awardZWG: number          // Always stored for consistency
  readonly awardAt?: Date
  readonly awardBy?: string
  readonly awardReference?: string
  
  // Shortfall - Now tracks original currency
  readonly shortfallCurrency: Currency  // New: track which currency the shortfall is in
  readonly shortfallAmount: number       // New: amount in shortfallCurrency
  readonly shortfallUSD: number
  readonly shortfallZWG: number
  readonly shortfallPaidAt?: Date
  readonly shortfallPaymentMethod?: string
  readonly shortfallReceiptNumber?: string
  
  // Direct Payments - Now track per-payment currency
  readonly directPayments: MedicalAidDirectPayment[]
  
  readonly status: MedicalAidStatus
  readonly rejectionReason?: string
  readonly createdAt: Date
  readonly createdBy: string
  readonly lastModifiedAt: Date
  readonly lastModifiedBy: string
}

interface MedicalAidDirectPayment {
  readonly id: string
  readonly claimId: string
  readonly paymentNumber: string
  readonly currency: Currency  // New: track payment currency
  readonly amount: number       // New: amount in currency
  readonly amountUSD: number
  readonly amountZWG: number
  readonly paymentMethod: string
  readonly reference?: string
  readonly receiptNumber?: string
  readonly paidAt: Date
  readonly capturedBy: string
  readonly terminalId?: string
  readonly notes?: string
  readonly synced: boolean
}

interface MedicalAidPaymentRecord {
  readonly id: string
  readonly claimId: string
  readonly orderId: string
  readonly patientId: string
  readonly patientName: string
  readonly providerId: string
  readonly providerName: string
  readonly memberNumber: string
  readonly paymentType: MedicalAidPaymentType
  readonly currency: Currency  // New: track payment currency
  readonly amount: number       // New: amount in currency
  readonly amountUSD: number
  readonly amountZWG: number
  readonly exchangeRate: number
  readonly paymentMethod: string
  readonly reference?: string
  readonly receiptNumber?: string
  readonly paidAt: Date
  readonly capturedBy: string
  readonly terminalId?: string
  readonly synced: boolean
}

interface MedicalAidCacheStats {
  readonly totalClaims: number
  readonly totalPayments: number
  readonly totalAwards: number
  readonly pendingSync: number
  readonly lastSync: Date | null
}

// ============================================================================
// INDEXEDDB STORAGE FOR MEDICAL AID DATA - UPDATED FOR DUAL CURRENCY
// ============================================================================

class MedicalAidStorage {
  private dbName = 'VisionPlusMedicalAidDB'
  private version = 2  // Incremented version for schema change
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('MedicalAidDB initialization failed:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion
        
        // Handle upgrade from version 1 to 2
        if (oldVersion < 2) {
          // Delete old stores if upgrading
          if (db.objectStoreNames.contains('claims')) {
            db.deleteObjectStore('claims')
          }
          if (db.objectStoreNames.contains('payments')) {
            db.deleteObjectStore('payments')
          }
          if (db.objectStoreNames.contains('timeline')) {
            db.deleteObjectStore('timeline')
          }
        }
        
        if (!db.objectStoreNames.contains('claims')) {
          const claimStore = db.createObjectStore('claims', { keyPath: 'id' })
          claimStore.createIndex('patientId', 'patientId', { unique: false })
          claimStore.createIndex('providerId', 'providerId', { unique: false })
          claimStore.createIndex('memberNumber', 'memberNumber', { unique: false })
          claimStore.createIndex('orderId', 'orderId', { unique: false })
          claimStore.createIndex('status', 'status', { unique: false })
          claimStore.createIndex('createdAt', 'createdAt', { unique: false })
          claimStore.createIndex('awardCurrency', 'awardCurrency', { unique: false }) // New index
        }

        if (!db.objectStoreNames.contains('payments')) {
          const paymentStore = db.createObjectStore('payments', { keyPath: 'id' })
          paymentStore.createIndex('claimId', 'claimId', { unique: false })
          paymentStore.createIndex('orderId', 'orderId', { unique: false })
          paymentStore.createIndex('patientId', 'patientId', { unique: false })
          paymentStore.createIndex('providerId', 'providerId', { unique: false })
          paymentStore.createIndex('paymentType', 'paymentType', { unique: false })
          paymentStore.createIndex('paidAt', 'paidAt', { unique: false })
          paymentStore.createIndex('synced', 'synced', { unique: false })
          paymentStore.createIndex('currency', 'currency', { unique: false }) // New index
        }

        if (!db.objectStoreNames.contains('timeline')) {
          const timelineStore = db.createObjectStore('timeline', { keyPath: 'id' })
          timelineStore.createIndex('claimId', 'claimId', { unique: false })
          timelineStore.createIndex('occurredAt', 'occurredAt', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  async saveClaim(claim: MedicalAidClaim): Promise<boolean> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readwrite')
        const store = transaction.objectStore('claims')
        const request = store.put(claim)

        request.onerror = () => reject(false)
        request.onsuccess = () => resolve(true)
      })
    } catch {
      return false
    }
  }

  async getClaim(claimId: string): Promise<MedicalAidClaim | null> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readonly')
        const store = transaction.objectStore('claims')
        const request = store.get(claimId)

        request.onerror = () => reject(null)
        request.onsuccess = () => resolve(request.result || null)
      })
    } catch {
      return null
    }
  }

  async getClaimsByPatient(patientId: string): Promise<MedicalAidClaim[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readonly')
        const store = transaction.objectStore('claims')
        const index = store.index('patientId')
        const request = index.getAll(patientId)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async getClaimsByOrder(orderId: string): Promise<MedicalAidClaim[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readonly')
        const store = transaction.objectStore('claims')
        const index = store.index('orderId')
        const request = index.getAll(orderId)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async getClaimsByAwardCurrency(currency: Currency): Promise<MedicalAidClaim[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readonly')
        const store = transaction.objectStore('claims')
        const index = store.index('awardCurrency')
        const request = index.getAll(currency)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async savePayment(payment: MedicalAidDirectPayment): Promise<boolean> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['payments'], 'readwrite')
        const store = transaction.objectStore('payments')
        const request = store.put(payment)

        request.onerror = () => reject(false)
        request.onsuccess = () => resolve(true)
      })
    } catch {
      return false
    }
  }

  async getPaymentsByClaim(claimId: string): Promise<MedicalAidDirectPayment[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['payments'], 'readonly')
        const store = transaction.objectStore('payments')
        const index = store.index('claimId')
        const request = index.getAll(claimId)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async getPaymentsByCurrency(currency: Currency): Promise<MedicalAidDirectPayment[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['payments'], 'readonly')
        const store = transaction.objectStore('payments')
        const index = store.index('currency')
        const request = index.getAll(currency)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async updateClaimStatus(claimId: string, status: MedicalAidStatus, modifiedBy: string): Promise<boolean> {
    try {
      const claim = await this.getClaim(claimId)
      if (!claim) return false

      const updatedClaim: MedicalAidClaim = {
        ...claim,
        status,
        lastModifiedAt: new Date(),
        lastModifiedBy: modifiedBy
      }

      return this.saveClaim(updatedClaim)
    } catch {
      return false
    }
  }

  async getAllClaims(): Promise<MedicalAidClaim[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['claims'], 'readonly')
        const store = transaction.objectStore('claims')
        const request = store.getAll()

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async getUnsyncedPayments(): Promise<MedicalAidDirectPayment[]> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['payments'], 'readonly')
        const store = transaction.objectStore('payments')
        const index = store.index('synced')
        const request = index.getAll(false)

        request.onerror = () => reject([])
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch {
      return []
    }
  }

  async markPaymentSynced(paymentId: string): Promise<boolean> {
    try {
      const db = await this.init()
      const transaction = db.transaction(['payments'], 'readwrite')
      const store = transaction.objectStore('payments')
      
      return new Promise((resolve, reject) => {
        const getRequest = store.get(paymentId)
        
        getRequest.onerror = () => reject(false)
        getRequest.onsuccess = () => {
          const payment = getRequest.result
          if (payment) {
            payment.synced = true
            const putRequest = store.put(payment)
            putRequest.onerror = () => reject(false)
            putRequest.onsuccess = () => resolve(true)
          } else {
            resolve(false)
          }
        }
      })
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.init()
      const transaction = db.transaction(['claims', 'payments', 'timeline'], 'readwrite')
      transaction.objectStore('claims').clear()
      transaction.objectStore('payments').clear()
      transaction.objectStore('timeline').clear()
    } catch (error) {
      console.error('Failed to clear MedicalAidDB:', error)
    }
  }
}

// ============================================================================
// MEDICAL AID CACHE - Singleton, Updated for Dual Currency
// ============================================================================

export class MedicalAidCache {
  private static instance: MedicalAidCache
  private storage: MedicalAidStorage
  private claims: Map<string, MedicalAidClaim> = new Map()
  private payments: Map<string, MedicalAidDirectPayment> = new Map()
  private subscribers: Set<(claims: MedicalAidClaim[]) => void> = new Set()

  private constructor() {
    this.storage = new MedicalAidStorage()
    this.loadFromStorage()
  }

  static getInstance(): MedicalAidCache {
    if (!MedicalAidCache.instance) {
      MedicalAidCache.instance = new MedicalAidCache()
    }
    return MedicalAidCache.instance
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const claims = await this.storage.getAllClaims()
      claims.forEach(claim => {
        this.claims.set(claim.id, claim)
      })
      
      for (const claim of claims) {
        const payments = await this.storage.getPaymentsByClaim(claim.id)
        payments.forEach(payment => {
          this.payments.set(payment.id, payment)
        })
      }
      
      this.notifySubscribers()
    } catch (error) {
      console.error('Failed to load medical aid data from storage:', error)
    }
  }

  async createClaimFromOrder(
    order: any,
    patientInfo: any,
    exchangeRate: number
  ): Promise<MedicalAidClaim> {
    const claimId = `CLM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    const now = new Date()
    
    const claim: MedicalAidClaim = {
      id: claimId,
      claimNumber: `${patientInfo.medicalAidProvider?.toUpperCase() || 'MED'}-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      patientId: patientInfo.patientId || `PT-${Date.now().toString().slice(-4)}`,
      patientName: patientInfo.patientName,
      providerId: patientInfo.medicalAidProvider?.toLowerCase() || 'unknown',
      providerName: this.getProviderName(patientInfo.medicalAidProvider) || 'Unknown Provider',
      memberNumber: patientInfo.memberNumber || '',
      memberName: patientInfo.memberName,
      orderId: order.id,
      orderTotalUSD: order.totalUSD,
      orderTotalZWG: order.totalZWG,
      exchangeRate,
      rateLockedAt: order.rateLockedAt ? new Date(order.rateLockedAt) : new Date(),
      rateSource: order.rateSource || 'reserve_bank',
      
      // Initialize with no award
      awardCurrency: 'ZWG', // Default to ZWG
      awardAmount: 0,
      awardUSD: 0,
      awardZWG: 0,
      awardAt: undefined,
      awardBy: undefined,
      awardReference: undefined,
      
      // Shortfall is full amount initially (in ZWG by default)
      shortfallCurrency: 'ZWG',
      shortfallAmount: order.totalZWG,
      shortfallUSD: order.totalUSD,
      shortfallZWG: order.totalZWG,
      shortfallPaidAt: undefined,
      shortfallPaymentMethod: undefined,
      shortfallReceiptNumber: undefined,
      
      directPayments: [],
      status: 'pending',
      createdAt: now,
      createdBy: order.createdBy || 'system',
      lastModifiedAt: now,
      lastModifiedBy: order.createdBy || 'system'
    }

    this.claims.set(claim.id, claim)
    await this.storage.saveClaim(claim)
    this.notifySubscribers()
    
    return claim
  }

  async recordAward(
    claimId: string,
    awardUSD: number,  // Keep USD as base for consistency
    exchangeRate: number,
    awardedBy: string
  ): Promise<MedicalAidClaim | null> {
    const claim = this.claims.get(claimId)
    if (!claim) return null

    const awardZWG = awardUSD * exchangeRate
    
    // Determine award currency based on what was used
    // This would be passed from the UI - for now default to ZWG
    const awardCurrency: Currency = 'ZWG' // In production, this would come from the UI
    const awardAmount = awardCurrency === 'USD' ? awardUSD : awardZWG

    const shortfallUSD = claim.orderTotalUSD - awardUSD
    const shortfallZWG = claim.orderTotalZWG - awardZWG
    
    // Shortfall currency defaults to same as award currency
    const shortfallCurrency = awardCurrency
    const shortfallAmount = shortfallCurrency === 'USD' ? shortfallUSD : shortfallZWG

    const updatedClaim: MedicalAidClaim = {
      ...claim,
      awardCurrency,
      awardAmount,
      awardUSD,
      awardZWG,
      awardAt: new Date(),
      awardBy: awardedBy,
      awardReference: `AWARD-${Date.now().toString().slice(-6)}`,
      
      shortfallCurrency,
      shortfallAmount,
      shortfallUSD,
      shortfallZWG,
      
      status: awardUSD > 0 ? 'awarded' : claim.status,
      lastModifiedAt: new Date(),
      lastModifiedBy: awardedBy
    }

    this.claims.set(claimId, updatedClaim)
    await this.storage.saveClaim(updatedClaim)
    this.notifySubscribers()
    
    return updatedClaim
  }

  // New method: record award with explicit currency
  async recordAwardWithCurrency(
    claimId: string,
    awardAmount: number,
    awardCurrency: Currency,
    exchangeRate: number,
    awardedBy: string
  ): Promise<MedicalAidClaim | null> {
    const claim = this.claims.get(claimId)
    if (!claim) return null

    // Calculate both USD and ZWG equivalents
    const awardUSD = awardCurrency === 'USD' ? awardAmount : awardAmount / exchangeRate
    const awardZWG = awardCurrency === 'ZWG' ? awardAmount : awardAmount * exchangeRate

    const shortfallUSD = claim.orderTotalUSD - awardUSD
    const shortfallZWG = claim.orderTotalZWG - awardZWG
    
    // Shortfall currency defaults to same as award currency
    const shortfallCurrency = awardCurrency
    const shortfallAmount = shortfallCurrency === 'USD' ? shortfallUSD : shortfallZWG

    const updatedClaim: MedicalAidClaim = {
      ...claim,
      awardCurrency,
      awardAmount,
      awardUSD,
      awardZWG,
      awardAt: new Date(),
      awardBy: awardedBy,
      awardReference: `AWARD-${Date.now().toString().slice(-6)}`,
      
      shortfallCurrency,
      shortfallAmount,
      shortfallUSD,
      shortfallZWG,
      
      status: awardUSD > 0 ? 'awarded' : claim.status,
      lastModifiedAt: new Date(),
      lastModifiedBy: awardedBy
    }

    this.claims.set(claimId, updatedClaim)
    await this.storage.saveClaim(updatedClaim)
    this.notifySubscribers()
    
    return updatedClaim
  }

  async recordMedicalAidPayment(
    orderId: string,
    patientInfo: {
      patientId: string
      patientName: string
      medicalAidProvider?: string
      memberNumber?: string
      memberName?: string
    },
    paymentDetails: {
      amount: number
      currency: Currency  // New: track payment currency
      amountUSD: number
      amountZWG: number
      paymentMethod: string
      reference?: string
      receiptNumber?: string
      capturedBy: string
      terminalId?: string
      notes?: string
    }
  ): Promise<{ claim: MedicalAidClaim | null; payment: MedicalAidDirectPayment | null }> {
    
    let claim: MedicalAidClaim | null = null
    
    const claimsByOrder = await this.storage.getClaimsByOrder(orderId)
    if (claimsByOrder.length > 0) {
      claim = claimsByOrder[0]
    }
    
    if (!claim && patientInfo.medicalAidProvider && patientInfo.memberNumber) {
      const claimsByPatient = await this.storage.getClaimsByPatient(patientInfo.patientId)
      claim = claimsByPatient.find(c => 
        c.providerId === patientInfo.medicalAidProvider?.toLowerCase() &&
        c.memberNumber === patientInfo.memberNumber &&
        c.status !== 'cleared' &&
        c.status !== 'rejected'
      ) || null
    }

    if (!claim) {
      // Create a new claim with appropriate totals based on payment currency
      const mockOrder = {
        id: orderId,
        totalUSD: paymentDetails.amountUSD,
        totalZWG: paymentDetails.amountZWG,
        rateLockedAt: new Date(),
        rateSource: 'reserve_bank',
        createdBy: paymentDetails.capturedBy
      }
      
      claim = await this.createClaimFromOrder(
        mockOrder,
        {
          patientId: patientInfo.patientId,
          patientName: patientInfo.patientName,
          medicalAidProvider: patientInfo.medicalAidProvider,
          memberNumber: patientInfo.memberNumber,
          memberName: patientInfo.memberName
        },
        paymentDetails.amountZWG / paymentDetails.amountUSD
      )
    }

    const payment: MedicalAidDirectPayment = {
      id: `MAPAY-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      claimId: claim.id,
      paymentNumber: `MAPAY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      currency: paymentDetails.currency,
      amount: paymentDetails.amount,
      amountUSD: paymentDetails.amountUSD,
      amountZWG: paymentDetails.amountZWG,
      paymentMethod: paymentDetails.paymentMethod,
      reference: paymentDetails.reference,
      receiptNumber: paymentDetails.receiptNumber,
      paidAt: new Date(),
      capturedBy: paymentDetails.capturedBy,
      terminalId: paymentDetails.terminalId,
      notes: paymentDetails.notes,
      synced: false
    }

    // Update claim shortfall based on payment
    const remainingShortfallUSD = claim.shortfallUSD - paymentDetails.amountUSD
    const remainingShortfallZWG = claim.shortfallZWG - paymentDetails.amountZWG
    
    const updatedClaim: MedicalAidClaim = {
      ...claim,
      directPayments: [...claim.directPayments, payment],
      shortfallUSD: remainingShortfallUSD,
      shortfallZWG: remainingShortfallZWG,
      
      // Update shortfall amount in original currency
      shortfallAmount: claim.shortfallCurrency === 'USD' 
        ? remainingShortfallUSD 
        : remainingShortfallZWG,
      
      shortfallPaidAt: remainingShortfallUSD <= 0.01 ? new Date() : claim.shortfallPaidAt,
      shortfallPaymentMethod: remainingShortfallUSD <= 0.01
        ? paymentDetails.paymentMethod
        : claim.shortfallPaymentMethod,
      shortfallReceiptNumber: remainingShortfallUSD <= 0.01
        ? paymentDetails.receiptNumber
        : claim.shortfallReceiptNumber,
      
      status: remainingShortfallUSD <= 0.01 ? 'partially_paid' : claim.status,
      lastModifiedAt: new Date(),
      lastModifiedBy: paymentDetails.capturedBy
    }

    this.claims.set(claim.id, updatedClaim)
    this.payments.set(payment.id, payment)
    
    await this.storage.saveClaim(updatedClaim)
    await this.storage.savePayment(payment)
    
    this.notifySubscribers()
    
    return { claim: updatedClaim, payment }
  }

  async recordShortfallPayment(
    claimId: string,
    paymentMethod: string,
    receiptNumber: string,
    capturedBy: string
  ): Promise<MedicalAidClaim | null> {
    const claim = this.claims.get(claimId)
    if (!claim) return null

    // This assumes shortfall is paid in the same currency as the shortfall
    // For multi-currency support, we need a more sophisticated approach
    const shortfallCurrency = claim.shortfallCurrency
    const shortfallAmount = claim.shortfallAmount

    const updatedClaim: MedicalAidClaim = {
      ...claim,
      shortfallPaidAt: new Date(),
      shortfallPaymentMethod: paymentMethod,
      shortfallReceiptNumber: receiptNumber,
      status: 'partially_paid',
      lastModifiedAt: new Date(),
      lastModifiedBy: capturedBy
    }

    this.claims.set(claimId, updatedClaim)
    await this.storage.saveClaim(updatedClaim)
    this.notifySubscribers()
    
    return updatedClaim
  }

  // New method: record shortfall with explicit currency
  async recordShortfallPaymentWithCurrency(
    claimId: string,
    shortfallAmount: number,
    shortfallCurrency: Currency,
    exchangeRate: number,
    paymentMethod: string,
    receiptNumber: string,
    capturedBy: string
  ): Promise<MedicalAidClaim | null> {
    const claim = this.claims.get(claimId)
    if (!claim) return null

    // Calculate USD and ZWG equivalents
    const shortfallUSD = shortfallCurrency === 'USD' ? shortfallAmount : shortfallAmount / exchangeRate
    const shortfallZWG = shortfallCurrency === 'ZWG' ? shortfallAmount : shortfallAmount * exchangeRate

    const updatedClaim: MedicalAidClaim = {
      ...claim,
      shortfallCurrency,
      shortfallAmount,
      shortfallUSD: claim.shortfallUSD - shortfallUSD,
      shortfallZWG: claim.shortfallZWG - shortfallZWG,
      shortfallPaidAt: new Date(),
      shortfallPaymentMethod: paymentMethod,
      shortfallReceiptNumber: receiptNumber,
      status: 'partially_paid',
      lastModifiedAt: new Date(),
      lastModifiedBy: capturedBy
    }

    this.claims.set(claimId, updatedClaim)
    await this.storage.saveClaim(updatedClaim)
    this.notifySubscribers()
    
    return updatedClaim
  }

  async markClaimCleared(
    claimId: string,
    clearedBy: string
  ): Promise<MedicalAidClaim | null> {
    const claim = this.claims.get(claimId)
    if (!claim) return null

    const updatedClaim: MedicalAidClaim = {
      ...claim,
      status: 'cleared',
      lastModifiedAt: new Date(),
      lastModifiedBy: clearedBy
    }

    this.claims.set(claimId, updatedClaim)
    await this.storage.saveClaim(updatedClaim)
    this.notifySubscribers()
    
    return updatedClaim
  }

  getAllClaims(): MedicalAidClaim[] {
    return Array.from(this.claims.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  getClaim(claimId: string): MedicalAidClaim | null {
    return this.claims.get(claimId) || null
  }

  getClaimsByPatient(patientId: string): MedicalAidClaim[] {
    return this.getAllClaims()
      .filter(c => c.patientId === patientId)
  }

  getClaimsByProvider(providerId: string): MedicalAidClaim[] {
    return this.getAllClaims()
      .filter(c => c.providerId === providerId)
  }

  getClaimsByStatus(status: MedicalAidStatus): MedicalAidClaim[] {
    return this.getAllClaims()
      .filter(c => c.status === status)
  }

  getClaimsByOrder(orderId: string): MedicalAidClaim[] {
    return this.getAllClaims()
      .filter(c => c.orderId === orderId)
  }

  // New method: get claims by award currency
  getClaimsByAwardCurrency(currency: Currency): MedicalAidClaim[] {
    return this.getAllClaims()
      .filter(c => c.awardCurrency === currency && c.awardAmount > 0)
  }

  getPaymentsByClaim(claimId: string): MedicalAidDirectPayment[] {
    const claim = this.claims.get(claimId)
    return claim?.directPayments || []
  }

  // New method: get payments by currency
  getPaymentsByCurrency(currency: Currency): MedicalAidDirectPayment[] {
    return Array.from(this.payments.values())
      .filter(p => p.currency === currency)
  }

  subscribe(callback: (claims: MedicalAidClaim[]) => void): () => void {
    this.subscribers.add(callback)
    callback(this.getAllClaims())
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers(): void {
    const claims = this.getAllClaims()
    this.subscribers.forEach(callback => {
      try {
        callback(claims)
      } catch (error) {
        console.error('Subscriber callback error:', error)
      }
    })
  }

  private getProviderName(providerId?: string): string | undefined {
    const providerMap: Record<string, string> = {
      'cimas': 'Cimas',
      'first_mutual': 'First Mutual',
      'psmas': 'PSMAS',
      'liberty': 'Liberty Health',
      'old_mutual': 'Old Mutual',
      'alliance': 'Alliance',
      'altfin': 'Altfin',
      'cellmed': 'Cellmed',
      'bonvie': 'BonVie',
      'corporate_24': 'Corporate 24',
      'eternal_peace': 'Eternal Peace',
      'fbc': 'FBC Health',
      'flimas': 'Flimas',
      'generation_health': 'Generation Health',
      'grainmed': 'Grainmed',
      'healthmed': 'Healthmed',
      'heritage': 'Heritage',
      'hmmas': 'Hmmas',
      'maisha': 'Maisha',
      'masca': 'Masca',
      'minerva': 'Minerva',
      'northern': 'Northern',
      'oakfin': 'Oakfin',
      'prohealth': 'ProHealth',
      'varichem': 'Varichem',
      'emf': 'EMF'
    }
    return providerId ? providerMap[providerId.toLowerCase()] : undefined
  }

  getStats(): MedicalAidCacheStats {
    const claims = this.getAllClaims()
    const payments = Array.from(this.payments.values())
    
    return {
      totalClaims: claims.length,
      totalPayments: payments.length,
      totalAwards: claims.filter(c => c.awardUSD > 0).length,
      pendingSync: payments.filter(p => !p.synced).length,
      lastSync: null
    }
  }

  // New method: get currency distribution stats
  getCurrencyStats(): { usdAwards: number; zwgAwards: number; usdPayments: number; zwgPayments: number } {
    const claims = this.getAllClaims()
    const payments = Array.from(this.payments.values())
    
    return {
      usdAwards: claims.filter(c => c.awardCurrency === 'USD').length,
      zwgAwards: claims.filter(c => c.awardCurrency === 'ZWG').length,
      usdPayments: payments.filter(p => p.currency === 'USD').length,
      zwgPayments: payments.filter(p => p.currency === 'ZWG').length
    }
  }

  async clear(): Promise<void> {
    this.claims.clear()
    this.payments.clear()
    await this.storage.clear()
    this.notifySubscribers()
  }
}

// ============================================================================
// REACT HOOK - Updated for Dual Currency
// ============================================================================

export function useMedicalAidCache() {
  const [claims, setClaims] = useState<MedicalAidClaim[]>([])
  const [stats, setStats] = useState<MedicalAidCacheStats | null>(null)
  const [currencyStats, setCurrencyStats] = useState<{ usdAwards: number; zwgAwards: number; usdPayments: number; zwgPayments: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const cache = MedicalAidCache.getInstance()

  useEffect(() => {
    setIsLoading(true)
    
    const unsubscribe = cache.subscribe((updatedClaims) => {
      setClaims(updatedClaims)
      setStats(cache.getStats())
      setCurrencyStats(cache.getCurrencyStats())
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const recordMedicalAidPayment = useCallback(async (
    orderId: string,
    patientInfo: any,
    paymentDetails: any
  ) => {
    return await cache.recordMedicalAidPayment(orderId, patientInfo, paymentDetails)
  }, [])

  const recordAward = useCallback(async (
    claimId: string,
    awardUSD: number,
    exchangeRate: number,
    awardedBy: string
  ) => {
    return await cache.recordAward(claimId, awardUSD, exchangeRate, awardedBy)
  }, [])

  // New method: record award with currency
  const recordAwardWithCurrency = useCallback(async (
    claimId: string,
    awardAmount: number,
    awardCurrency: Currency,
    exchangeRate: number,
    awardedBy: string
  ) => {
    return await cache.recordAwardWithCurrency(claimId, awardAmount, awardCurrency, exchangeRate, awardedBy)
  }, [])

  const recordShortfallPayment = useCallback(async (
    claimId: string,
    paymentMethod: string,
    receiptNumber: string,
    capturedBy: string
  ) => {
    return await cache.recordShortfallPayment(claimId, paymentMethod, receiptNumber, capturedBy)
  }, [])

  // New method: record shortfall with currency
  const recordShortfallPaymentWithCurrency = useCallback(async (
    claimId: string,
    shortfallAmount: number,
    shortfallCurrency: Currency,
    exchangeRate: number,
    paymentMethod: string,
    receiptNumber: string,
    capturedBy: string
  ) => {
    return await cache.recordShortfallPaymentWithCurrency(
      claimId, shortfallAmount, shortfallCurrency, exchangeRate, 
      paymentMethod, receiptNumber, capturedBy
    )
  }, [])

  const markClaimCleared = useCallback(async (
    claimId: string,
    clearedBy: string
  ) => {
    return await cache.markClaimCleared(claimId, clearedBy)
  }, [])

  const refresh = useCallback(() => {
    setClaims(cache.getAllClaims())
    setStats(cache.getStats())
    setCurrencyStats(cache.getCurrencyStats())
  }, [])

  return {
    claims,
    stats,
    currencyStats,
    isLoading,
    recordMedicalAidPayment,
    recordAward,
    recordAwardWithCurrency,
    recordShortfallPayment,
    recordShortfallPaymentWithCurrency,
    markClaimCleared,
    refresh,
    cache
  }
}

export default MedicalAidCache.getInstance()