// Gemini Multimodal Vision API integration for Deep Scene, Door & Text Analysis
import { featureGate } from './offline/FeatureGate';

const GEMINI_API_KEY_STORAGE = 'beyond_sight_gemini_api_key';
const GEMINI_MODEL_STORAGE = 'beyond_sight_gemini_model';

class GeminiVisionService {
  private apiKey: string = '';
  private modelName: string = 'gemini-2.5-flash';

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
      const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      this.apiKey = storedKey || envKey || '';

      const storedModel = localStorage.getItem(GEMINI_MODEL_STORAGE);
      this.modelName = storedModel || 'gemini-2.5-flash';
    } catch {
      // Ignore
    }
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, this.apiKey);
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setModel(model: string): void {
    this.modelName = model;
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_MODEL_STORAGE, model);
    }
  }

  public getModel(): string {
    return this.modelName;
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  /**
   * Captures a base64 JPEG from video element
   */
  public captureFrameBase64(video: HTMLVideoElement, quality = 0.8): string | null {
    try {
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
      const canvas = document.createElement('canvas');
      // Scale down to 640 max width for fast Gemini transfer
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      // Strip prefix 'data:image/jpeg;base64,'
      return dataUrl.split(',')[1] || null;
    } catch {
      return null;
    }
  }

  /**
   * Direct multimodal API request to Google AI Studio Gemini endpoint
   */
  private async generateVisionContent(
    base64Image: string,
    prompt: string,
    systemInstruction = 'You are Beyond Sight, a warm, concise, and ultra-precise spatial accessibility assistant for blind individuals. Describe spaces using clock-face directions (10 o\'clock, 12 o\'clock, 2 o\'clock) and estimated meters/steps. Keep answers under 3 concise sentences. Never use visual markdown or bullet points—speak in pure spoken natural sentences.'
  ): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('No Gemini API key configured.');
    }

    if (featureGate.evaluate('read_text') === 'unavailable') {
      throw new Error('That needs internet. I will do it when you are back online.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 300,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const message = errJson?.error?.message || `Gemini API error (${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('No description received from Gemini.');
    }

    return candidate.trim();
  }

  /**
   * Full room & spatial walkthrough description
   */
  public async describeRoom(base64Image: string): Promise<string> {
    const prompt =
      'Describe this room for a blind user. First mention if the immediate walking path is clear or blocked. Then state key landmark objects (doors, exits, tables, chairs, people) with clock-face directions and distance in steps or meters.';
    return this.generateVisionContent(base64Image, prompt);
  }

  /**
   * Specific target lookup (e.g., door, exit, stairs, keys, mug)
   */
  public async findTarget(base64Image: string, targetName: string): Promise<string> {
    const prompt = `The user is blind and asking: "Where is the ${targetName}?" Scan the image carefully. If visible, state its exact clock direction (10 o'clock, 12 o'clock, or 2 o'clock), estimated distance in meters and walking steps, and how they can reach it safely. If not visible, say clearly that the ${targetName} is not in current view and suggest turning left or right.`;
    return this.generateVisionContent(base64Image, prompt);
  }

  /**
   * Read signs, text, mail, labels, screens out loud
   */
  public async readVisibleText(base64Image: string): Promise<string> {
    const prompt =
      'Read all visible text, signs, labels, or writing shown in this image clearly and concisely for a blind user. If no text is visible, state "No readable text detected in front of you."';
    return this.generateVisionContent(base64Image, prompt);
  }

  /**
   * Detailed person descriptor (clothing, expression, estimated distance)
   */
  public async describePerson(base64Image: string): Promise<string> {
    const prompt =
      'Describe the person standing in front of the camera. Mention their position (clock direction and meters), estimated age range, what clothing they are wearing, and their general expression or action.';
    return this.generateVisionContent(base64Image, prompt);
  }
}

export const geminiVisionService = new GeminiVisionService();
