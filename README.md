# Beyond Sight (Vision Mate - Go Beyond) 👁️✨

A production-ready, zero-latency assistive web application engineered specifically for blind and visually impaired users. It acts and speaks continuously and naturally like Google Gemini Live / Google Assistant, providing spatial navigation, 3D audio radar, obstacle warnings, and voice-controlled person recognition.

---

## 📢 What's New in Beyond Sight
> *"Beyond Sight now features Automatic Offline Mode with PWA caching and on-device fallback. When your connection drops, path clearance, room description, and vehicle alerts continue uninterrupted without internet."*

---

## 🌟 Key Features

### 1. Automatic Offline Mode ("Know what's ahead, even with no internet") 📡
- **Instant, Zero-Button Adaptation:**
  - Automatically monitors network stability with zero buttons or toggle switches required.
  - Operates completely hands-free and preserves active user context (Home Mode, Road Mode, or Walk Mode).
- **PWA Service Worker & Model Pre-Caching:**
  - Configured with `vite-plugin-pwa` and Workbox caching strategies.
  - App shell, icons, audio earcons, and on-device TensorFlow.js COCO-SSD weights are pre-cached in Cache Storage and IndexedDB.
  - Invokes `navigator.storage.persist()` on supported browsers to protect cached AI models from storage eviction.
  - On first visit, downloads and caches assets in the background, announcing once: *"Offline mode is ready. Beyond Sight will keep working without internet."*
  - Spoken, one-time suggestion to add to home screen (*"Install app"*), maintaining a 100% full-screen viewfinder without visual banners.
- **Reliable Connectivity Detection & Flap Prevention:**
  - Triple-check architecture combining `navigator.onLine`, browser online/offline events, and lightweight periodic origin cache-busting probes (`/ping.json`).
  - **Hysteresis filter:** requires **3 consecutive failed probes** before switching to Offline Mode, and **2 consecutive successful probes** before declaring reconnection, preventing jarring audio flapping in elevators or basements.
  - **Degraded Network Fallback:** latency > 2,500ms triggers edge-only fast responses instead of hanging on stalled cloud endpoints.
- **Audio Earcons & Spoken Notifications:**
  - **Disconnect Earcon:** Soft descending two-tone audio cue (440 Hz → 220 Hz).
  - **Offline Announcement (Spoken Once):** *"No internet. Offline mode on. I can still check your path, describe the room by objects, find objects, and warn about vehicles. Voice commands may be limited; use taps."*
  - **Reconnect Earcon:** Ascending harmonic chime (523 Hz C5 → 659 Hz E5 → 784 Hz G5).
  - **Online Announcement:** *"Back online. Full features restored."*
- **Offline On-Device Capabilities:**
  - **1 Tap (Path Clearance):** Live corridor obstacle checks using on-device COCO-SSD.
  - **2 Taps (Room Description Offline):** Summarizes detected furniture, people, doorways, and corridors with clock directions and step estimates, prefaced honestly with *"Basic description, offline."*
  - **3 Taps (Screen Curtain):** Powers down screen backlight for privacy and battery conservation.
  - **Binaural Object Finder:** Acoustic homing and haptic center lock run 100% locally.
  - **Road Mode Sentinel:** Edge vehicle approach detection and pedestrian signal warnings continue offline.
  - **"Where am I?" Offline:** Speaks compass heading, GPS coordinate freshness, and calculates distance/direction to the closest saved location from the last 20 online visits (*"You are approximately 80 steps northeast of the place you saved as Home. Last address check 4 minutes ago."*).
  - **Graceful Cloud Degradation & Queue:** Requests requiring cloud AI (document reading, dense scene descriptions) respond honestly (*"That needs internet. I'll do it when you're back online."*) and queue locally with user confirmation.
- **Offline Voice & Speech Synthesis:**
  - Automatically queries available `SpeechSynthesisVoice` entries to select offline-capable local voices (`localService: true`).
  - Detects offline capability for `SpeechRecognition`; seamlessly falls back to tactile screen tap gestures if speech recognition is unavailable without network.

---

### 2. Smart Walk Mode (Hands-Free Walking Companion) 🚶
- **Hands-Free Activation & Control:**
  - *"Walk mode"* / *"Start walking"* (prompts for destination)
  - *"Take me to [Destination]"* / *"Walk to [Destination]"* (geocodes and routes directly)
  - *"Stop walking"* / *"End route"* (ends route and silences beacons)
  - Zero new visible buttons. 100% full-screen camera viewfinder using tactile tap/hold gestures.
- **Free-First Geocoding & Turn-by-Turn Routing:**
  - Destination geocoding via OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org`).
  - Foot-walking turn-by-turn routing via OSRM (`router.project-osrm.org/route/v1/foot`).
  - Clean `IRouteProvider` abstraction with fallback support.
  - Spoken confirmation ("Found [Place]. Say yes to confirm.") and up to 3 spoken choices for ambiguous queries.
- **Minimal & Egocentric Guidance Language:**
  - Clock directions and step counts: *"In 40 steps, turn left onto Main Street"*, *"Turn slightly right, 1 o'clock"*.
  - Minimum announcements: speaks only at start, 30 m before a turn, at the turn, off-route, and arrival. Complete silence between turns.
  - Binaural Drift Steering Cue: If heading deviates > 25° from the route, plays a gentle left/right stereo tone first; speaks only if deviation persists for > 5 seconds.
- **Corridor Obstacle Awareness & Escalating Cues:**
  - Analyzes the central 40% walking corridor with on-device TensorFlow.js COCO-SSD.
  - 3-stage escalating cue: Soft ping at 3–4 steps → faster stereo-panned ping at 2 steps → spoken evasion alert (*"Pole ahead, 2 steps, move right"*).
  - Debounced with hysteresis: stable obstacles announced once; re-announced only if distance changes by > 1 step.
  - Road Mode Hazard Sentinel automatically active during Walk Mode (vehicles, bicycles, pedestrian signals). Priority hazards cut off ongoing speech immediately.
- **Pocket & Chest-Mount Mode:**
  - Automatically detects covered lens or phone in pocket (dark/uniform frames).
  - Transitions to GPS + compass + haptics mode, announcing: *"Camera not visible. Using GPS guidance only."*
  - Re-activates obstacle radar when brought out of pocket.
- **Tactile Haptic Navigation Patterns (`navigator.vibrate`):**
  - **1 short pulse (`150ms`):** Go straight
  - **2 pulses (`150ms, 100ms, 150ms`):** Turn left
  - **3 pulses (`150ms, 100ms, 150ms, 100ms, 150ms`):** Turn right
  - **1 long pulse (`800ms`):** Arrived / stop
  - Voice-accessible explanation command: *"What do the vibrations mean?"*
- **Safety Disclaimer & GPS Quality Check:**
  - First-use disclaimer spoken once and stored locally: *"Beyond Sight assists you but does not replace your cane or guide dog. Keep using them."*
  - GPS accuracy monitoring: warns if accuracy is worse than 30 meters.
  - Low battery alert (< 15%) offering screen curtain power conservation.
- **Emergency SOS & Location Share:**
  - Spoken command: *"Help me"* or *"Emergency"*.
  - Reverse geocodes live location and speaks nearest street address out loud.
  - Opens prefilled SMS / WhatsApp link with live Google Maps coordinate URL to a saved trusted contact.
  - Set contact by voice: *"Set emergency contact [number]"*.
  - Privacy command: *"Forget my data"* erases all local storage, contacts, and personal data.
- **Internationalization (i18n):**
  - Built-in support for English (`en`), Hindi (`hi`), Tamil (`ta`), Spanish (`es`), and Arabic (`ar`).
  - Unit switching: Steps, Meters, or Feet.

---

### 3. Zero-Friction Blind Accessibility & Wake-Word
- **Giant Full-Screen Touch Target:** On initial load, the entire screen acts as a giant accessible button to unlock browser permissions (`AudioContext`, Microphone, Camera, and `SpeechSynthesis`).
- **Always-On Wake-Word Listener:** Continuously listens for *"Hey Vision"*, *"Beyond Sight"*, *"Start Camera"*.
- **Synthesized Two-Tone Activation Chime:** Crisp Google Assistant-style 2-tone audio chime (587.33 Hz D5 → 880 Hz A5) generated natively via Web Audio API.
- **Anti-Interruption Echo Prevention:** Microphone audio processing mutes whenever speech synthesis is active to prevent hearing its own voice.

### 4. Real-Time Spatial Navigation & Direction Compass
- **3 Horizontal Spatial Zones:** Left (10 o'clock), Center (12 o'clock), Right (2 o'clock).
- **3 Proximity Tiers:** Danger (< 1.2m), Close (1.2m - 2.5m), Far (2.5m - 4+m).
- **3D Spatial Audio Radar (`StereoPannerNode`):** Binaural sonar ticks panned `-0.8` (left), `0` (center), `+0.8` (right).
- **Edge Door & Exit Analyzer:** Sobel vertical gradient analyzer detecting doorways, portals, and openings offline.

### 5. People & Name Recognition ("Who is in front of me?")
- **Face / Person Memory:** Stores 32-bin color histogram + cropped thumbnail locally.
- **Enroll People by Voice:** *"Remember this person as [Name]"*.
- **Automatic Recognition:** *"John is standing at your 12 o'clock, 2 meters away."*

---

## 🗣️ Voice Commands Reference

| Voice Command | Action |
| --- | --- |
| **"Where am I?"** | Speaks compass heading, GPS coordinates freshness, and distance/direction to nearest saved place |
| **"Install app"** / **"Add to home screen"** | Spoken guidance for adding Beyond Sight to home screen as a standalone PWA |
| **"Simulate offline"** | Manually triggers offline state with disconnect earcon and offline message for testing |
| **"Simulate online"** | Restores simulated connection with ascending harmonic chime and restoration notice |
| **"Simulate flaky connection"** | Injects high packet loss to test 3-fail/2-success hysteresis filter |
| **"Walk mode"** / **"Start walking"** | Activates Smart Walk Mode and prompts for destination |
| **"Take me to [place]"** / **"Walk to [place]"** | Geocodes destination with Nominatim and starts turn-by-turn walk route |
| **"Stop walking"** / **"End route"** | Stops walking route, silences beacons, and returns to standby |
| **"What do the vibrations mean?"** | Explains tactile navigation vibration patterns with live demo |
| **"Help me"** / **"Emergency"** | Speaks current street address and opens live WhatsApp/SMS alert link |
| **"Set emergency contact [phone]"** | Saves trusted emergency phone number locally |
| **"Forget my data"** | Clears all stored contacts, profiles, and route histories |
| **"Simulate walk"** / **"Test walk mode"** | Launches indoor simulation harness with virtual route & obstacles |
| **"What's new?"** | Announces the latest features in Beyond Sight |
| **"Hey Vision"** / **"Beyond Sight"** | Activates assistant listener chime |
| **"Where is the door / exit?"** | Locates exits using edge heuristics & Gemini AI |
| **"Who is in front of me?"** | Identifies registered people or describes people |
| **"Remember this person as [Name]"** | Saves visual profile to acquaintance memory |
| **"Describe the room"** | Provides spatial walkthrough of environment (offline or cloud-enhanced) |
| **"Read text"** | Reads visible text, signs, and labels (notifies if offline) |

---

## 🧪 Simulation / Test Harness (Offline & Walking)

### 1. Network Condition Simulation
Blind users or developers can test network edge cases directly via voice or developer console:
- **"Simulate offline":** Drops network instantly; triggers disconnect earcon and announces edge AI capabilities.
- **"Simulate flaky connection":** Drops 2 out of 3 probes to confirm hysteresis prevents voice notification thrashing.
- **"Simulate online":** Restores full network; plays ascending chime and confirms cloud feature restoration.

### 2. Walk Mode Simulation
1. Open the app and unlock audio.
2. Say **"Simulate walk"** (or **"Test walk mode"**).
3. The harness executes a realistic walking trajectory:
   - Starts route to *Central Pharmacy*.
   - Announces departure in step counts (*"Starting route to Central Pharmacy. Walk straight for 45 steps."*).
   - Injects a synthetic obstacle into the walking corridor (soft ping at 3 steps, faster panned ping at 2 steps, spoken evasion alert).
   - Injects an off-route heading deviation (drifting 35° left), triggering the right binaural steering cue, followed by spoken nudge.
   - User corrects heading, reaches final corner, and triggers arrival announcement with long haptic pulse.
4. Say **"Stop walking"** at any time to exit simulation.

---

## 🏆 Lighthouse PWA & Offline Audit Verification

Beyond Sight complies with PWA installability and offline standards:
- [x] **Service Worker Registration:** `VitePWA` generates a production-ready Service Worker (`dist/sw.js`) with Workbox runtime caching.
- [x] **Web App Manifest:** Standalone display mode, high-resolution icons (192x192, 512x512, maskable), theme color `#0f172a`, and description configured in `public/manifest.webmanifest`.
- [x] **Offline Cache-First Routing:** Cache storage persists TF.js models, app shell, icons, and audio earcons.
- [x] **Storage Durability:** Calls `navigator.storage.persist()` on launch to request eviction immunity.
- [x] **Zero-Clutter Accessibility:** Zero visual installation banners or buttons; spoken install prompt activated via voice intent or one-time gentle reminder.

---

## 📋 Manual Test Checklist for Blind Testers

| Scenario | Steps to Execute | Expected Audio / Haptic Feedback | Pass / Fail |
| --- | --- | --- | --- |
| **A. Indoors: Airplane Mode on after first visit** | 1. Open app while online to cache assets.<br>2. Close app or refresh tab.<br>3. Turn on Airplane Mode.<br>4. Re-open app. | • App shell loads instantly from Service Worker cache.<br>• COCO-SSD edge vision initializes from Cache Storage.<br>• Tap once: immediate corridor obstacle check.<br>• Tap twice: spoken room summary (*"Basic description, offline."*). | [ ] |
| **B. Subway / Basement: Sudden Signal Loss** | 1. Use app online in Road or Home mode.<br>2. Walk into elevator shaft, subway, or basement (loss of network). | • Disconnect earcon plays (soft descending 440 Hz → 220 Hz tones).<br>• Speaks once: *"No internet. Offline mode on. I can still check your path, describe the room by objects, find objects, and warn about vehicles. Voice commands may be limited; use taps."*<br>• No repetitive spamming of offline notice.<br>• HUD shows visual badge `OFFLINE MODE (EDGE AI)` for sighted helpers. | [ ] |
| **C. Lift / Flaky Connection: Hysteresis Flap Prevention** | 1. Move through spotty reception (or say *"Simulate flaky connection"*).<br>2. Observe whether the app repeatedly announces offline/online. | • Hysteresis requires 3 consecutive probe failures before declaring offline.<br>• Requires 2 consecutive successes before declaring online.<br>• App remains calm with ZERO auditory thrashing or repeated earcons. | [ ] |
| **D. Returning Online: Full Reconnection & Queue Restoration** | 1. Exit subway or re-enable network.<br>2. Wait ~5-10 seconds for probe detection. | • Ascending harmonic chime plays (523 Hz → 659 Hz → 784 Hz).<br>• App speaks: *"Back online. Full features restored."*<br>• If cloud requests were queued, app prompts: *"You have a saved request. Would you like me to process it now?"* | [ ] |
| **E. "Where am I?" Offline** | 1. With Airplane Mode active, say *"Where am I?"* (or trigger via gesture). | • App speaks: *"Compass heading: [Heading] degrees [Direction]. You are approximately [X] steps [direction] of the place you saved as [Place Name]. Last address check [X] minutes ago."* | [ ] |
| **F. Walk Mode Corridor Obstacle Escalation** | 1. Say *"Walk mode"* or *"Simulate walk"*.<br>2. Walk toward chair, pole, or simulated obstacle. | • 3-stage escalating cue: Soft ping (3-4 steps) → Faster stereo ping (2 steps) → Spoken warning (*"Pole ahead, 2 steps, move right"*).<br>• Stable obstacles announced once; hysteresis suppresses duplicate alerts. | [ ] |
| **G. Street Crossing Vehicle Siren** | 1. Switch to Road Mode or Walk Mode.<br>2. Approaching vehicle appears in viewfinder. | • Urgent siren earcon cuts off speech immediately.<br>• Instant voice alert: *"Warning! Fast car approaching at 11 o'clock! Step back on curb!"* | [ ] |
| **H. Pocket / Chest-Mount Transition** | 1. Cover camera lens or slip phone into front chest pocket during walking route. | • App speaks once: *"Camera not visible. Using GPS guidance only."*<br>• Turn-by-turn guidance continues via GPS and tactile vibrations.<br>• Removing from pocket announces: *"Camera visible. Obstacle awareness resumed."* | [ ] |
| **I. Emergency SOS** | 1. Say *"Set emergency contact [phone]"*.<br>2. Say *"Help me"*. | • App confirms contact saved locally.<br>• Speaks reverse-geocoded street address.<br>• Opens prefilled SMS/WhatsApp message with live Google Maps coordinate link. | [ ] |

---

## 🛠️ Tech Stack
- **Framework:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Progressive Web App (PWA):** `vite-plugin-pwa` + Workbox (`generateSW`, Cache-First ML models, IndexedDB persistence, `navigator.storage.persist()`)
- **Connectivity & Offline Resilience:** Multi-endpoint probe (`/ping.json`), 3-fail/2-success hysteresis, degraded latency thresholding
- **Local Vision:** `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` (On-device offline obstacle tracking)
- **Turn-by-Turn Routing:** OpenStreetMap Nominatim + OSRM Foot Walking Profiles (Free, zero-cost API)
- **Audio & Spatial Engine:** Web Audio API (`AudioContext`, `StereoPannerNode`, `OscillatorNode`)
- **Speech Engine:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` + `window.speechSynthesis`)
- **Haptics:** Web Haptics API (`navigator.vibrate`)
- **Multimodal AI:** Google Gemini 2.5 Flash Vision API (Optional for scene description & OCR)
- **Audio & Spatial Engine:** Web Audio API (`AudioContext`, `StereoPannerNode`, `OscillatorNode`)
- **Speech Engine:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` + `window.speechSynthesis`)
- **Haptics:** Web Haptics API (`navigator.vibrate`)
- **Multimodal AI:** Google Gemini 2.5 Flash Vision API (Optional for scene description & OCR)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
