# Beyond Sight (Vision Mate - Go Beyond) 👁️✨

A production-ready, zero-latency assistive web application engineered specifically for blind and visually impaired users. It acts and speaks continuously and naturally like Google Gemini Live / Google Assistant, providing spatial navigation, 3D audio radar, obstacle warnings, and voice-controlled person recognition.

---

## 🌟 Key Features

### 1. Zero-Friction Blind Accessibility & Wake-Word
- **Giant Full-Screen Touch Target:** On initial load, the entire screen acts as a giant accessible button to unlock browser permissions (`AudioContext`, Microphone, Camera, and `SpeechSynthesis`).
- **Always-On Wake-Word Listener:** Continuously listens for:
  - *"Hey Vision"*
  - *"Beyond Sight"*
  - *"Start Camera"*
- **Synthesized Two-Tone Activation Chime:** Plays a crisp, Google Assistant-style 2-tone audio chime (587.33 Hz D5 → 880 Hz A5) generated natively via the Web Audio API without relying on external sound files that could fail to load.
- **Critical Anti-Interruption Echo Prevention:** Microphones will never hear the application's own speech! Speech recognition transcript processing is automatically muted whenever `speechSynthesis.speaking` is true, and safely debounced with a 250ms restart delay to prevent browser crash loops or `InvalidStateError`.

### 2. Real-Time Spatial Navigation & Clock-Face Direction
- **3 Horizontal Spatial Zones:**
  - **Left:** 10 o'clock (`x < 35%` of video width)
  - **Center:** 12 o'clock (`35% - 65%` of video width)
  - **Right:** 2 o'clock (`x > 65%` of video width)
- **3 Proximity Tiers:**
  - **Immediate Danger (< 1.2 meters):** Object takes > 45% of frame height → triggers an urgent high-priority voice alert, dual-tone alarm, and haptic vibration (`navigator.vibrate([300, 100, 300])`).
  - **Close (1.2m - 2.5 meters):** 25% - 45% frame height → warns user with walking bypass steps.
  - **Far (2.5m - 4+ meters):** 10% - 25% frame height → informs of distant objects.
- **3D Spatial Audio Radar (`StereoPannerNode`):** Plays non-intrusive 3D spatial sonar ticks panned left (`-0.8`), center (`0`), or right (`+0.8`) based on obstacle coordinates.
- **Edge Door & Exit Analyzer:** Structural Sobel vertical gradient analyzer that detects doorways, exits, and hallway openings even without an internet connection.

### 3. People & Name Recognition ("Who is in front of me?")
- **Voice-Controlled Face / Person Memory:** Stored persistently in `LocalStorage` / `IndexedDB`.
- **Enroll People by Voice:**
  - Stand in front of someone and say: *"Hey Vision, remember this person as Dharshan"* (or Mom, Sarah, John, etc.).
  - Extracts the person's upper body visual signature (normalized 32-bin color histogram + cropped thumbnail).
- **Automatic Recognition:**
  - When that person walks into frame, Beyond Sight announces them naturally:
    *"Dharshan is standing at your 12 o'clock, 2 meters away."*

### 4. Google Assistant / Gemini Live Persona
- **Voice Priority Queue:**
  - **Urgent Warnings (Obstacles < 1.2m):** Cancels ongoing speech immediately.
  - **Conversational Queries (User asks question):** High priority, natural conversational responses.
  - **Background Updates:** Governed by a 4-second cooldown so it never spams or talks over itself.
- **Multimodal AI with Google Gemini 2.5 Flash:**
  - Seamlessly enhances local detection with Google Gemini AI Studio for:
    - *"Describe the room"* (spatial room walkthrough)
    - *"Where is the door / exit / stairs?"*
    - *"Read text / read this sign"* (reads signs, mail, screens)

---

## 🗣️ Voice Commands Reference

| Voice Command | Action |
| --- | --- |
| **"Hey Vision"** / **"Beyond Sight"** | Activates the chime and wakes up listener |
| **"Start camera"** / **"Turn on camera"** | Starts rear camera and 30FPS real-time detection |
| **"Stop camera"** / **"Go to sleep"** | Pauses camera and keeps wake-word listener on standby |
| **"Where is the [chair / couch / table / bottle]?"** | Scans room and announces exact clock direction & steps |
| **"Where is the door / exit / stairs?"** | Locates exits using edge heuristics & Gemini AI |
| **"Who is in front of me?"** | Identifies registered people by name or describes them |
| **"Remember this person as [Name]"** | Saves the current person to persistent memory |
| **"Describe the room"** / **"What do you see?"** | Provides full spatial walkthrough of environment |
| **"Read text"** / **"Read this"** | Reads visible text, signs, and labels |

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Icons:** Lucide React
- **Local Vision:** `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` (Zero-latency 30FPS offline tracking)
- **Multimodal Vision:** Google Gemini 2.5 Flash Multimodal API
- **Audio & Spatial Engine:** Web Audio API (`AudioContext`, `StereoPannerNode`, `OscillatorNode`)
- **Speech Engine:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` + `window.speechSynthesis`)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Gemini API Key (Optional)
You can enter your Google AI Studio Gemini API key directly in the app's **Settings Modal** or put it in `.env`:
```env
VITE_GEMINI_API_KEY=your_google_ai_studio_api_key_here
```
*(Note: Beyond Sight runs 100% offline out-of-the-box using TensorFlow.js even without an API key!)*

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 📱 Accessibility Instructions
1. **Initial Tap:** Browsers require at least one user gesture before enabling microphone and audio playback. **Tap anywhere on the screen** to activate.
2. **Rear Camera:** On mobile devices, the app automatically selects the rear-facing environment camera (`facingMode: "environment"`).
3. **Voice or Touch:** All features can be operated 100% hands-free by voice or using the extra-large tactile accessibility action buttons at the bottom.
