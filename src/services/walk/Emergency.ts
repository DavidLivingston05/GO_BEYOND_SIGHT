// Emergency Assistance & Location Sharing
// Speaks current address & opens prefilled SMS / WhatsApp share link to trusted contact
import type { EmergencyContact, LatLng } from '../../types';
import { defaultRouteProvider, type IRouteProvider } from './RouteProvider';
import { speechManager } from '../speechSynthesis';
import { audioEngine } from '../audioEngine';
import { i18n } from '../i18n';
import { personMemoryService } from '../personMemory';

const EMERGENCY_CONTACT_KEY = 'beyond_sight_emergency_contact';

export class EmergencyService {
  private routeProvider: IRouteProvider = defaultRouteProvider;

  public getSavedContact(): EmergencyContact | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(EMERGENCY_CONTACT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return null;
  }

  public saveContact(contact: EmergencyContact): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EMERGENCY_CONTACT_KEY, JSON.stringify(contact));
    } catch {
      // Ignore
    }
  }

  /**
   * Sets emergency contact from spoken voice transcript
   * e.g. "Set emergency contact mom 555-0199" or "Emergency contact 9876543210"
   */
  public parseAndSaveContact(transcript: string): boolean {
    const clean = transcript.trim();
    // Match phone digits and optional contact name
    const phoneRegex = /(?:(\+?\d[\d\s-]{6,15}))/;
    const phoneMatch = clean.match(phoneRegex);

    if (phoneMatch && phoneMatch[1]) {
      const phone = phoneMatch[1].replace(/[\s-]/g, '');
      let name = 'Trusted Contact';

      // Look for name before or after
      const nameRegex = /(?:contact|for|to)\s+([a-zA-Z]+)/i;
      const nameMatch = clean.match(nameRegex);
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1].trim();
      }

      this.saveContact({ name, phone });
      speechManager.speakUrgent(i18n.t.contactSaved(name, phone));
      return true;
    }

    speechManager.speakReply('Please speak the phone number clearly, for example: "Set emergency contact 9876543210".');
    return false;
  }

  /**
   * Triggers emergency alert:
   * 1. Reverse geocodes user location to get current street address.
   * 2. Speaks address out loud.
   * 3. Prepares and opens SMS/WhatsApp link with live Google Maps coordinate URL.
   */
  public async triggerEmergency(currentLoc?: LatLng | null): Promise<void> {
    audioEngine.playDangerAlert();

    const loc: LatLng = currentLoc || { lat: 37.7749, lng: -122.4194 };
    const mapsLink = `https://maps.google.com/?q=${loc.lat},${loc.lng}`;

    let address = 'your current GPS location';
    try {
      address = await this.routeProvider.reverseGeocode(loc);
    } catch {
      // Fallback
    }

    const contact = this.getSavedContact();
    const t = i18n.t;

    if (contact) {
      speechManager.speakUrgent(t.emergencySpeakingAddress(address));
      const messageBody = encodeURIComponent(
        `EMERGENCY ALERT: I need immediate assistance! My current location is: ${address}. Live Google Maps: ${mapsLink}`
      );

      // Open WhatsApp or SMS
      const smsUrl = `sms:${contact.phone}?body=${messageBody}`;
      const waUrl = `https://wa.me/${contact.phone}?text=${messageBody}`;

      setTimeout(() => {
        try {
          // Attempt to open SMS / WhatsApp in new tab / intent
          const opened = window.open(waUrl, '_blank');
          if (!opened) {
            window.open(smsUrl, '_blank');
          }
        } catch {
          // Ignore
        }
      }, 2000);
    } else {
      speechManager.speakUrgent(t.emergencyNoContact(address));
      setTimeout(() => {
        try {
          window.open(mapsLink, '_blank');
        } catch {
          // Ignore
        }
      }, 2000);
    }
  }

  /**
   * "Forget my data" voice command: clears all local storage for privacy
   */
  public forgetAllData(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(EMERGENCY_CONTACT_KEY);
      localStorage.removeItem('beyond_sight_disclaimer_ack');
      localStorage.removeItem('beyond_sight_language');
      localStorage.removeItem('beyond_sight_unit');
      personMemoryService.clearAll();
      speechManager.speakUrgent(i18n.t.dataCleared);
    } catch {
      speechManager.speakReply('Cleared local data.');
    }
  }
}

export const emergencyService = new EmergencyService();
