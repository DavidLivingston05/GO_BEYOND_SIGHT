// PWA Service Worker & Model Asset Cache Manager
// Manages Cache Storage, IndexedDB, persistence and background precaching
import { speechManager } from '../speechSynthesis';

const CACHE_NAME = 'beyond-sight-offline-v1';
const MODEL_CACHE_NAME = 'tfjs-models-cache';
const OFFLINE_READY_STORAGE_KEY = 'beyond_sight_offline_ready_announced';
const PWA_INSTALLED_KEY = 'beyond_sight_pwa_installed';
const PWA_PROMPTED_KEY = 'beyond_sight_pwa_prompted';

export interface StorageStatus {
  isPersisted: boolean;
  usedBytes: number;
  quotaBytes: number;
  usagePercentage: number;
  isStorageLow: boolean;
}

export class CacheManager {
  private deferredInstallPrompt: any = null;
  private isPrecaching = false;
  private isReadyAnnounced = false;

  constructor() {
    this.initInstallListener();
  }

  private initInstallListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.maybePromptSpokenInstall();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      try {
        localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      } catch {
        // Ignore
      }
    });
  }

  /**
   * Request persistent storage to prevent browser eviction of ML models
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[CacheManager] Storage persist granted: ${isPersisted}`);
        return isPersisted;
      } catch (err) {
        console.warn('[CacheManager] Error requesting persistent storage:', err);
      }
    }
    return false;
  }

  /**
   * Check storage quota usage
   */
  public async getStorageStatus(): Promise<StorageStatus> {
    let usedBytes = 0;
    let quotaBytes = 0;
    let isPersisted = false;

    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persisted) {
        try {
          isPersisted = await navigator.storage.persisted();
        } catch {
          // Ignore
        }
      }

      if (navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          usedBytes = estimate.usage || 0;
          quotaBytes = estimate.quota || 0;
        } catch {
          // Ignore
        }
      }
    }

    const usagePercentage = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
    const isStorageLow = quotaBytes > 0 && quotaBytes - usedBytes < 50 * 1024 * 1024; // <50MB remaining

    return {
      isPersisted,
      usedBytes,
      quotaBytes,
      usagePercentage,
      isStorageLow,
    };
  }

  /**
   * Pre-downloads app shell, ML model files, and assets on first online visit
   */
  public async precacheOfflineAssets(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof caches === 'undefined' || this.isPrecaching) {
      return false;
    }

    try {
      this.isPrecaching = true;
      await this.requestPersistentStorage();

      const storage = await this.getStorageStatus();
      if (storage.isStorageLow) {
        speechManager.speakUrgent(
          'Device storage is low. Some offline features may be limited.'
        );
      }

      const cache = await caches.open(CACHE_NAME);
      const essentialAssets = [
        '/',
        '/index.html',
        '/favicon.svg',
        '/icons.svg',
        '/manifest.webmanifest',
        '/ping.json',
      ];

      // Cache core assets safely
      await Promise.allSettled(
        essentialAssets.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: 'no-cache' });
            if (resp.ok) {
              await cache.put(url, resp);
            }
          } catch {
            // Ignore asset skip
          }
        })
      );

      // Precache COCO-SSD lite mobilenet v2 weights into model cache
      const modelCache = await caches.open(MODEL_CACHE_NAME);
      const modelUrls = [
        'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json',
      ];

      await Promise.allSettled(
        modelUrls.map(async (url) => {
          try {
            const cached = await modelCache.match(url);
            if (!cached) {
              const resp = await fetch(url, { mode: 'cors' });
              if (resp.ok) {
                await modelCache.put(url, resp);
              }
            }
          } catch {
            // Ignore
          }
        })
      );

      // Announce offline readiness ONCE upon successful caching
      this.maybeAnnounceOfflineReady();
      this.isPrecaching = false;
      return true;
    } catch (err) {
      console.warn('[CacheManager] Precache encountered error:', err);
      this.isPrecaching = false;
      return false;
    }
  }

  private maybeAnnounceOfflineReady(): void {
    if (typeof window === 'undefined' || this.isReadyAnnounced) return;

    try {
      const alreadyAnnounced = localStorage.getItem(OFFLINE_READY_STORAGE_KEY);
      if (!alreadyAnnounced) {
        this.isReadyAnnounced = true;
        localStorage.setItem(OFFLINE_READY_STORAGE_KEY, 'true');
        setTimeout(() => {
          speechManager.speakBackground(
            'Offline mode is ready. Beyond Sight will keep working without internet.'
          );
        }, 3000);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Spoken one-time suggestion to Add to Home Screen (No visual banners!)
   */
  public maybePromptSpokenInstall(): void {
    if (typeof window === 'undefined') return;

    try {
      const isInstalled = localStorage.getItem(PWA_INSTALLED_KEY);
      const isPrompted = localStorage.getItem(PWA_PROMPTED_KEY);

      if (!isInstalled && !isPrompted && this.deferredInstallPrompt) {
        localStorage.setItem(PWA_PROMPTED_KEY, 'true');
        setTimeout(() => {
          speechManager.speakBackground(
            'Tip: Say "Install app" anytime to add Beyond Sight directly to your home screen for instant offline access.'
          );
        }, 8000);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Trigger the PWA install prompt via voice command
   */
  public async promptInstall(): Promise<boolean> {
    if (!this.deferredInstallPrompt) {
      speechManager.speakReply(
        'Beyond Sight is already installed, or your browser does not support home screen installation.'
      );
      return false;
    }

    try {
      this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      if (choice.outcome === 'accepted') {
        speechManager.speakReply('Installing Beyond Sight to your home screen.');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const cacheManager = new CacheManager();
