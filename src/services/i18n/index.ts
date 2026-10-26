// i18n Service for Beyond Sight
import { translations, type TranslationDictionary } from './translations';
import type { SupportedLanguage } from '../../types';

const STORAGE_LANG_KEY = 'beyond_sight_language';
const STORAGE_UNIT_KEY = 'beyond_sight_unit';

export type DistanceUnit = 'steps' | 'meters' | 'feet';

class I18nService {
  private currentLanguage: SupportedLanguage = 'en';
  private currentUnit: DistanceUnit = 'steps';

  constructor() {
    this.initFromLocale();
  }

  private initFromLocale(): void {
    if (typeof window === 'undefined') return;

    // Check stored preference
    try {
      const storedLang = localStorage.getItem(STORAGE_LANG_KEY) as SupportedLanguage | null;
      if (storedLang && translations[storedLang]) {
        this.currentLanguage = storedLang;
      } else {
        // Detect from browser navigator.language
        const browserLang = (navigator.language || 'en').toLowerCase();
        if (browserLang.startsWith('hi')) this.currentLanguage = 'hi';
        else if (browserLang.startsWith('ta')) this.currentLanguage = 'ta';
        else if (browserLang.startsWith('es')) this.currentLanguage = 'es';
        else if (browserLang.startsWith('ar')) this.currentLanguage = 'ar';
        else this.currentLanguage = 'en';
      }

      const storedUnit = localStorage.getItem(STORAGE_UNIT_KEY) as DistanceUnit | null;
      if (storedUnit) {
        this.currentUnit = storedUnit;
      }
    } catch {
      this.currentLanguage = 'en';
    }
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public setLanguage(lang: SupportedLanguage): void {
    if (translations[lang]) {
      this.currentLanguage = lang;
      try {
        localStorage.setItem(STORAGE_LANG_KEY, lang);
      } catch {
        // Ignore
      }
    }
  }

  public getUnit(): DistanceUnit {
    return this.currentUnit;
  }

  public setUnit(unit: DistanceUnit): void {
    this.currentUnit = unit;
    try {
      localStorage.setItem(STORAGE_UNIT_KEY, unit);
    } catch {
      // Ignore
    }
  }

  public get t(): TranslationDictionary {
    return translations[this.currentLanguage] || translations.en;
  }

  /**
   * Formats distance into steps, meters, or feet based on user preference
   */
  public formatDistance(distanceMeters: number): { value: number; label: string; text: string } {
    const t = this.t;
    if (this.currentUnit === 'meters') {
      const rounded = Math.round(distanceMeters);
      return { value: rounded, label: t.metersLabel, text: `${rounded} ${t.metersLabel}` };
    }
    if (this.currentUnit === 'feet') {
      const feet = Math.round(distanceMeters * 3.28084);
      return { value: feet, label: t.feetLabel, text: `${feet} ${t.feetLabel}` };
    }
    // Default: Steps (1 step ~ 0.75 meters)
    const steps = Math.max(1, Math.round(distanceMeters / 0.75));
    return { value: steps, label: t.stepsLabel, text: `${steps} ${t.stepsLabel}` };
  }

  /**
   * Helper to get speech recognition language tag
   */
  public getSpeechLangTag(): string {
    switch (this.currentLanguage) {
      case 'hi':
        return 'hi-IN';
      case 'ta':
        return 'ta-IN';
      case 'es':
        return 'es-ES';
      case 'ar':
        return 'ar-SA';
      default:
        return 'en-US';
    }
  }
}

export const i18n = new I18nService();
