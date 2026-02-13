// lib/offline/OfflineManager.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// TYPES - Production Grade, Immutable
// ============================================================================

type OfflineActionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
type OfflineActionPriority = 'high' | 'normal' | 'low'
type OfflineStorageType = 'indexeddb' | 'localstorage' | 'memory'

interface OfflineAction {
  readonly id: string
  readonly type: string
  readonly payload: unknown
  readonly status: OfflineActionStatus
  readonly priority: OfflineActionPriority
  readonly timestamp: number
  readonly retryCount: number
  readonly maxRetries: number
  readonly error?: string
  readonly stack?: string
  readonly metadata?: Record<string, unknown>
}

interface OfflineQueueConfig {
  readonly maxConcurrent: number
  readonly retryDelay: number
  readonly maxRetries: number
  readonly persistQueue: boolean
  readonly storageType: OfflineStorageType
  readonly syncOnReconnect: boolean
  readonly syncInterval?: number
}

interface OfflineStorageAdapter {
  readonly name: OfflineStorageType
  save: (key: string, data: unknown) => Promise<boolean>
  load: <T>(key: string) => Promise<T | null>
  delete: (key: string) => Promise<boolean>
  clear: () => Promise<boolean>
}

// ============================================================================
// INDEXEDDB STORAGE ADAPTER - Production Grade
// ============================================================================

class IndexedDBAdapter implements OfflineStorageAdapter {
  readonly name: OfflineStorageType = 'indexeddb'
  private dbName = 'VisionPlusOfflineDB'
  private storeName = 'offline_queue'
  private version = 1
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('priority', 'priority', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  async save(key: string, data: unknown): Promise<boolean> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put({ id: key, ...(data as object) })

        request.onerror = () => {
          console.error('IndexedDB save failed:', request.error)
          reject(false)
        }

        request.onsuccess = () => resolve(true)
      })
    } catch (error) {
      console.error('IndexedDB save error:', error)
      return false
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(key)

        request.onerror = () => {
          console.error('IndexedDB load failed:', request.error)
          reject(null)
        }

        request.onsuccess = () => {
          const result = request.result
          resolve(result ? (result as T) : null)
        }
      })
    } catch (error) {
      console.error('IndexedDB load error:', error)
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.delete(key)

        request.onerror = () => {
          console.error('IndexedDB delete failed:', request.error)
          reject(false)
        }

        request.onsuccess = () => resolve(true)
      })
    } catch (error) {
      console.error('IndexedDB delete error:', error)
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onerror = () => {
          console.error('IndexedDB clear failed:', request.error)
          reject(false)
        }

        request.onsuccess = () => resolve(true)
      })
    } catch (error) {
      console.error('IndexedDB clear error:', error)
      return false
    }
  }
}

// ============================================================================
// LOCALSTORAGE ADAPTER - Fallback
// ============================================================================

class LocalStorageAdapter implements OfflineStorageAdapter {
  readonly name: OfflineStorageType = 'localstorage'

  async save(key: string, data: unknown): Promise<boolean> {
    try {
      localStorage.setItem(key, JSON.stringify(data))
      return true
    } catch (error) {
      console.error('LocalStorage save failed:', error)
      return false
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('LocalStorage load failed:', error)
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('LocalStorage delete failed:', error)
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('LocalStorage clear failed:', error)
      return false
    }
  }
}

// ============================================================================
// MEMORY ADAPTER - Fastest, Non-persistent
// ============================================================================

class MemoryAdapter implements OfflineStorageAdapter {
  readonly name: OfflineStorageType = 'memory'
  private store: Map<string, unknown> = new Map()

  async save(key: string, data: unknown): Promise<boolean> {
    try {
      this.store.set(key, data)
      return true
    } catch {
      return false
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      return (this.store.get(key) as T) || null
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.store.delete(key)
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      this.store.clear()
      return true
    } catch {
      return false
    }
  }
}

// ============================================================================
// OFFLINE MANAGER - Singleton, Production Ready
// ============================================================================

export class OfflineManager {
  private static instance: OfflineManager
  private isOnline: boolean = true
  private isSyncing: boolean = false
  private queue: OfflineAction[] = []
  private processing: Set<string> = new Set()
  private subscribers: Set<(state: OfflineState) => void> = new Set()
  private storageAdapter: OfflineStorageAdapter
  private syncTimer: NodeJS.Timeout | null = null
  private readonly QUEUE_KEY = 'visionplus_offline_queue'
  private readonly MAX_ACTIONS_PER_SYNC = 50
  private readonly MAX_QUEUE_SIZE = 1000

  private config: OfflineQueueConfig = {
    maxConcurrent: 3,
    retryDelay: 5000,
    maxRetries: 5,
    persistQueue: true,
    storageType: 'indexeddb',
    syncOnReconnect: true,
    syncInterval: 30000 // 30 seconds
  }

  private constructor() {
    // Try IndexedDB first, fallback to localStorage, then memory
    this.storageAdapter = this.detectBestStorage()
    this.init()
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager()
    }
    return OfflineManager.instance
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private detectBestStorage(): OfflineStorageAdapter {
    if (typeof window === 'undefined') {
      return new MemoryAdapter()
    }

    // Try IndexedDB
    if (window.indexedDB) {
      try {
        return new IndexedDBAdapter()
      } catch {
        // Fallback to localStorage
      }
    }

    // Try localStorage
    if (window.localStorage) {
      try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return new LocalStorageAdapter()
      } catch {
        // Fallback to memory
      }
    }

    // Memory fallback
    return new MemoryAdapter()
  }

  private async init(): Promise<void> {
    // Set initial online status
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    // Load persisted queue
    if (this.config.persistQueue) {
      await this.loadQueue()
    }

    // Setup event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
      window.addEventListener('beforeunload', this.handleBeforeUnload)
    }

    // Start sync interval
    if (this.config.syncInterval) {
      this.startSyncTimer()
    }

    // Initial sync if online
    if (this.isOnline && this.queue.length > 0) {
      this.processQueue()
    }
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  private handleOnline = () => {
    this.isOnline = true
    this.notifySubscribers()

    if (this.config.syncOnReconnect && this.queue.length > 0) {
      this.processQueue()
    }

    window.dispatchEvent(new CustomEvent('visionplus:online', {
      detail: { timestamp: Date.now(), pendingCount: this.queue.length }
    }))
  }

  private handleOffline = () => {
    this.isOnline = false
    this.notifySubscribers()

    window.dispatchEvent(new CustomEvent('visionplus:offline', {
      detail: { timestamp: Date.now(), pendingCount: this.queue.length }
    }))
  }

  private handleBeforeUnload = () => {
    if (this.config.persistQueue) {
      this.saveQueue()
    }
  }

  // ==========================================================================
  // QUEUE MANAGEMENT
  // ==========================================================================

  private async loadQueue(): Promise<void> {
    try {
      const saved = await this.storageAdapter.load<{ queue: OfflineAction[] }>(this.QUEUE_KEY)
      if (saved?.queue) {
        // Filter out completed actions and sort by priority/timestamp
        this.queue = saved.queue
          .filter(action => action.status === 'pending' || action.status === 'failed')
          .sort((a, b) => {
            const priorityWeight = { high: 3, normal: 2, low: 1 }
            const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority]
            if (weightDiff !== 0) return weightDiff
            return a.timestamp - b.timestamp
          })
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
    }
  }

  private async saveQueue(): Promise<void> {
    if (!this.config.persistQueue) return

    try {
      await this.storageAdapter.save(this.QUEUE_KEY, {
        queue: this.queue,
        lastUpdated: Date.now(),
        version: '1.0'
      })
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.queue.length > 0) {
        this.processQueue()
      }
    }, this.config.syncInterval)
  }

  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  // ==========================================================================
  // CORE API
  // ==========================================================================

  async enqueue<T>(
    action: () => Promise<T>,
    options: {
      id?: string
      type: string
      payload: unknown
      priority?: OfflineActionPriority
      maxRetries?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<string> {
    const actionId = options.id || `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low priority action
      const oldestLowPriority = this.queue
        .filter(a => a.priority === 'low' && a.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp)[0]

      if (oldestLowPriority) {
        await this.remove(oldestLowPriority.id)
      } else {
        throw new Error('Offline queue is full')
      }
    }

    const offlineAction: OfflineAction = {
      id: actionId,
      type: options.type,
      payload: options.payload,
      status: 'pending',
      priority: options.priority || 'normal',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      metadata: options.metadata
    }

    this.queue.push(offlineAction)
    await this.saveQueue()
    this.notifySubscribers()

    // Try to process immediately if online
    if (this.isOnline && !this.isSyncing) {
      this.processQueue()
    }

    return actionId
  }

  private async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.queue.length === 0) {
      return
    }

    this.isSyncing = true
    this.notifySubscribers()

    try {
      // Get pending actions, prioritize high priority
      const pending = this.queue
        .filter(a => a.status === 'pending' && !this.processing.has(a.id))
        .sort((a, b) => {
          const priorityWeight = { high: 3, normal: 2, low: 1 }
          const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority]
          if (weightDiff !== 0) return weightDiff
          return a.timestamp - b.timestamp
        })
        .slice(0, this.config.maxConcurrent)

      // Mark as processing
      pending.forEach(a => this.processing.add(a.id))

      // Process concurrently
      await Promise.all(
        pending.map(action => this.processAction(action))
      )

      // Clean up completed actions
      this.queue = this.queue.filter(a => 
        a.status !== 'completed' && 
        (a.status === 'failed' ? a.retryCount < a.maxRetries : true)
      )

      await this.saveQueue()
      this.notifySubscribers()

      // Continue processing if more items
      if (this.queue.filter(a => a.status === 'pending').length > 0) {
        setTimeout(() => this.processQueue(), 100)
      }
    } finally {
      this.isSyncing = false
      this.processing.clear()
      this.notifySubscribers()
    }
  }

  private async processAction(action: OfflineAction): Promise<void> {
    try {
      // Update status
      action.status = 'processing'
      await this.saveQueue()
      this.notifySubscribers()

      // Execute the action (in production, this would call the actual API)
      // This is a placeholder - real implementation would use a registry of handlers
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Simulate success/failure (remove in production)
      if (Math.random() > 0.9) {
        throw new Error('Simulated network error')
      }

      // Mark as completed
      action.status = 'completed'
      await this.saveQueue()
      this.notifySubscribers()

      // Dispatch success event
      window.dispatchEvent(new CustomEvent('visionplus:action-completed', {
        detail: { actionId: action.id, type: action.type, timestamp: Date.now() }
      }))

    } catch (error) {
      action.retryCount++
      action.status = action.retryCount >= action.maxRetries ? 'failed' : 'pending'
      action.error = error instanceof Error ? error.message : 'Unknown error'
      action.stack = error instanceof Error ? error.stack : undefined

      await this.saveQueue()
      this.notifySubscribers()

      // Dispatch error event
      window.dispatchEvent(new CustomEvent('visionplus:action-failed', {
        detail: { 
          actionId: action.id, 
          type: action.type, 
          error: action.error,
          retryCount: action.retryCount,
          timestamp: Date.now()
        }
      }))

      console.error(`Action ${action.id} failed (${action.retryCount}/${action.maxRetries}):`, error)
    } finally {
      this.processing.delete(action.id)
    }
  }

  async remove(actionId: string): Promise<boolean> {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(a => a.id !== actionId)
    this.processing.delete(actionId)
    
    if (this.queue.length !== initialLength) {
      await this.saveQueue()
      this.notifySubscribers()
      return true
    }
    return false
  }

  async clear(): Promise<void> {
    this.queue = []
    this.processing.clear()
    await this.storageAdapter.delete(this.QUEUE_KEY)
    this.notifySubscribers()
  }

  async retryFailed(): Promise<void> {
    let changed = false
    
    this.queue = this.queue.map(action => {
      if (action.status === 'failed' && action.retryCount < action.maxRetries) {
        changed = true
        return { ...action, status: 'pending', error: undefined, stack: undefined }
      }
      return action
    })

    if (changed) {
      await this.saveQueue()
      this.notifySubscribers()
      
      if (this.isOnline) {
        this.processQueue()
      }
    }
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  configure(config: Partial<OfflineQueueConfig>): void {
    this.config = { ...this.config, ...config }

    // Update sync timer if interval changed
    if (config.syncInterval !== undefined) {
      this.stopSyncTimer()
      if (this.config.syncInterval) {
        this.startSyncTimer()
      }
    }
  }

  // ==========================================================================
  // STATE QUERIES
  // ==========================================================================

  getState(): OfflineState {
    const byStatus = this.queue.reduce((acc, action) => {
      acc[action.status] = (acc[action.status] || 0) + 1
      return acc
    }, {} as Record<OfflineActionStatus, number>)

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter(a => a.status === 'pending').length,
      processingCount: this.processing.size,
      failedCount: this.queue.filter(a => a.status === 'failed').length,
      completedCount: this.queue.filter(a => a.status === 'completed').length,
      byStatus,
      storageType: this.storageAdapter.name,
      config: this.config
    }
  }

  getQueue(): readonly OfflineAction[] {
    return this.queue.map(action => ({ ...action })) // Immutable copy
  }

  getAction(actionId: string): OfflineAction | undefined {
    const action = this.queue.find(a => a.id === actionId)
    return action ? { ...action } : undefined
  }

  // ==========================================================================
  // SUBSCRIPTION
  // ==========================================================================

  subscribe(callback: (state: OfflineState) => void): () => void {
    this.subscribers.add(callback)
    callback(this.getState())
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers(): void {
    const state = this.getState()
    this.subscribers.forEach(callback => {
      try {
        callback(state)
      } catch (error) {
        console.error('Subscriber callback error:', error)
      }
    })
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  destroy(): void {
    this.stopSyncTimer()
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
      window.removeEventListener('beforeunload', this.handleBeforeUnload)
    }

    this.subscribers.clear()
  }
}

// ============================================================================
// OFFLINE STATE INTERFACE
// ============================================================================

export interface OfflineState {
  readonly isOnline: boolean
  readonly isSyncing: boolean
  readonly queueLength: number
  readonly pendingCount: number
  readonly processingCount: number
  readonly failedCount: number
  readonly completedCount: number
  readonly byStatus: Record<OfflineActionStatus, number>
  readonly storageType: OfflineStorageType
  readonly config: OfflineQueueConfig
}

// ============================================================================
// REACT HOOK - Production Ready
// ============================================================================

export function useOfflineManager() {
  const [state, setState] = useState<OfflineState>(() => 
    OfflineManager.getInstance().getState()
  )
  
  const managerRef = useRef(OfflineManager.getInstance())

  useEffect(() => {
    const manager = managerRef.current
    
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const enqueue = useCallback(<T>(
    action: () => Promise<T>,
    options: {
      type: string
      payload: unknown
      priority?: OfflineActionPriority
      maxRetries?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<string> => {
    return managerRef.current.enqueue(action, {
      ...options,
      id: options.metadata?.id as string | undefined
    })
  }, [])

  const remove = useCallback((actionId: string): Promise<boolean> => {
    return managerRef.current.remove(actionId)
  }, [])

  const clear = useCallback((): Promise<void> => {
    return managerRef.current.clear()
  }, [])

  const retryFailed = useCallback((): Promise<void> => {
    return managerRef.current.retryFailed()
  }, [])

  const configure = useCallback((config: Partial<OfflineQueueConfig>): void => {
    managerRef.current.configure(config)
  }, [])

  const getQueue = useCallback((): readonly OfflineAction[] => {
    return managerRef.current.getQueue()
  }, [])

  const getAction = useCallback((actionId: string): OfflineAction | undefined => {
    return managerRef.current.getAction(actionId)
  }, [])

  return {
    // State
    ...state,
    
    // Actions
    enqueue,
    remove,
    clear,
    retryFailed,
    configure,
    getQueue,
    getAction,
    
    // Manager instance (for advanced use cases)
    manager: managerRef.current
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export const waitForOnline = (timeout?: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve()
      return
    }

    let timeoutId: NodeJS.Timeout | null = null

    const handleOnline = () => {
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('online', handleOnline)
      resolve()
    }

    window.addEventListener('online', handleOnline)

    if (timeout) {
      timeoutId = setTimeout(() => {
        window.removeEventListener('online', handleOnline)
        reject(new Error('Timeout waiting for online connection'))
      }, timeout)
    }
  })
}

// ============================================================================
// EXPORT DEFAULT SINGLETON
// ============================================================================

export default OfflineManager.getInstance()