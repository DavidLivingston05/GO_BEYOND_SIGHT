// Persistent Face & Person Profile Memory (LocalStorage & Visual Feature Matching)
import type { PersonProfile } from '../types';

const STORAGE_KEY = 'beyond_sight_person_profiles';

class PersonMemoryService {
  private profiles: PersonProfile[] = [];

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.profiles = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse saved profiles from localStorage:', e);
      this.profiles = [];
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
    } catch (e) {
      console.error('Failed to save profiles to localStorage:', e);
    }
  }

  public getAllProfiles(): PersonProfile[] {
    return this.profiles;
  }

  public getProfileById(id: string): PersonProfile | undefined {
    return this.profiles.find((p) => p.id === id);
  }

  public deleteProfile(id: string): void {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    this.persist();
  }

  public clearAll(): void {
    this.profiles = [];
    this.persist();
  }

  /**
   * Save a newly enrolled person profile
   */
  public saveProfile(
    name: string,
    thumbnail: string,
    colorHistogram: number[],
    notes = ''
  ): PersonProfile {
    // Check if person with same name already exists -> update it
    const existingIndex = this.profiles.findIndex(
      (p) => p.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    const newProfile: PersonProfile = {
      id: existingIndex >= 0 ? this.profiles[existingIndex].id : `person_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      name: name.trim(),
      thumbnail,
      colorHistogram,
      enrolledAt: Date.now(),
      notes,
    };

    if (existingIndex >= 0) {
      this.profiles[existingIndex] = newProfile;
    } else {
      this.profiles.unshift(newProfile);
    }

    this.persist();
    return newProfile;
  }

  /**
   * Crops the detected person's bounding box and computes a normalized 32-bin RGB/HSV color histogram
   */
  public extractVisualSignature(
    video: HTMLVideoElement,
    bbox: [number, number, number, number]
  ): { thumbnail: string; histogram: number[] } | null {
    try {
      const [x, y, width, height] = bbox;
      if (width < 20 || height < 20) return null;

      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 160;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      // Draw cropped person area
      ctx.drawImage(
        video,
        Math.max(0, x),
        Math.max(0, y),
        Math.min(video.videoWidth - x, width),
        Math.min(video.videoHeight - y, height),
        0,
        0,
        120,
        160
      );

      const thumbnail = canvas.toDataURL('image/jpeg', 0.85);

      // Extract pixel color data for histogram (focusing on upper torso and head)
      const imgData = ctx.getImageData(0, 0, 120, 160);
      const data = imgData.data;

      // 32-bin color histogram (8 bins Red, 8 bins Green, 8 bins Blue, 8 bins Brightness)
      const histogram = new Array(32).fill(0);
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        const rBin = Math.min(7, Math.floor(r / 32));
        const gBin = Math.min(7, Math.floor(g / 32)) + 8;
        const bBin = Math.min(7, Math.floor(b / 32)) + 16;
        const brightBin = Math.min(7, Math.floor(brightness / 32)) + 24;

        histogram[rBin]++;
        histogram[gBin]++;
        histogram[bBin]++;
        histogram[brightBin]++;
      }

      // Normalize histogram values
      const normalizedHistogram = histogram.map((count) => count / (totalPixels * 4));

      return {
        thumbnail,
        histogram: normalizedHistogram,
      };
    } catch {
      return null;
    }
  }

  /**
   * Compare candidate histogram against enrolled profiles using histogram intersection & cosine similarity
   */
  public matchPerson(
    candidateHistogram: number[],
    minSimilarity = 0.72
  ): { profile: PersonProfile; score: number } | null {
    if (!this.profiles.length || !candidateHistogram.length) return null;

    let bestMatch: PersonProfile | null = null;
    let bestScore = -1;

    for (const profile of this.profiles) {
      if (!profile.colorHistogram || profile.colorHistogram.length !== candidateHistogram.length) {
        continue;
      }

      // Cosine similarity
      let dotProduct = 0;
      let magA = 0;
      let magB = 0;

      for (let i = 0; i < candidateHistogram.length; i++) {
        const a = candidateHistogram[i];
        const b = profile.colorHistogram[i];
        dotProduct += a * b;
        magA += a * a;
        magB += b * b;
      }

      const cosineSim = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-7);

      // Histogram Intersection
      let intersection = 0;
      for (let i = 0; i < candidateHistogram.length; i++) {
        intersection += Math.min(candidateHistogram[i], profile.colorHistogram[i]);
      }

      const combinedScore = cosineSim * 0.5 + intersection * 0.5;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = profile;
      }
    }

    if (bestMatch && bestScore >= minSimilarity) {
      return {
        profile: bestMatch,
        score: +(bestScore.toFixed(3)),
      };
    }

    return null;
  }
}

export const personMemoryService = new PersonMemoryService();
