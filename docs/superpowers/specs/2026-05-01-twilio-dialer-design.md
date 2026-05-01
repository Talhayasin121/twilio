# Twilio Dialer PWA Design

**Date:** 2026-05-01
**Status:** Draft

## 1. Overview

A Progressive Web App (PWA) that enables voice calling using Twilio's JavaScript Voice SDK. Works seamlessly on desktop and mobile browsers, can be installed as a standalone app.

**Use case:** Personal dialer for making phone calls via Twilio from any device.

## 2. Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (lightweight, no framework needed)
- **Voice:** Twilio JavaScript Voice SDK (`twilio`)
- **PWA:** Service Worker, Web App Manifest
- **Data:** LocalStorage for contacts and settings

## 3. Core Features

### 3.1 Dialpad
- Numeric keypad (0-9, *, #)
- Display showing entered number
- Call button to initiate
- Clear/backspace button
- Supports country codes

### 3.2 Contacts
- List of saved contacts (name + phone number)
- Add new contact
- Edit/delete contact
- Tap to call directly

### 3.3 Call History
- Recent calls list (inbound/outbound)
- Date/time, duration, number
- Tap to call back

### 3.4 Active Call Controls
- End call button
- Mute/unmute toggle
- Hold/unhold toggle
- Numpad (for IVR navigation)
- Call timer display

### 3.5 Settings
- Twilio Account SID
- Twilio Auth Token
- Twilio Caller ID (Outgoing number)
- Theme toggle (light/dark) — optional

## 4. Data Flow

```
User opens app
      │
      ▼
Select contact OR enter number
      │
      ▼
Click "Call"
      │
      ▼
Twilio Voice SDK connects (uses token)
      │
      ▼
Twilio places call to PSTN
      │
      ▼
Active call UI shows controls
      │
      ▼
User ends call → clean up
```

## 5. Architecture

```
┌──────────────────────────────────┐
│         PWA Client               │
├──────────────────────────────────┤
│  index.html                     │
│  ├── Dialpad View               │
│  ├── Contacts View             │
│  ├── History View              │
│  ├── Call Active View         │
│  └── Settings View          │
│                                 │
│  style.css (styles)            │
│  app.js (logic)               │
│  sw.js (service worker)      │
│  manifest.json (PWA)        │
│                             │
│  twilio-sdk (CDN)           │
└──────────────────────────────────┘
           │
           ▼ HTTPS
┌──────────────────────────────────┐
│        Twilio Cloud              │
│  • Voice API                   │
│  • PSTN routing                │
└──────────────────────────────────┘
```

## 6. Security Considerations

- For personal use only — credentials stored in LocalStorage or provided at runtime
- Production would require auth layer (not needed here)
- Twilio access tokens should be generated server-side for security (out of scope for MVP)

## 7. PWA Requirements

- `manifest.json` with icons, name, short name, theme color
- Service worker for offline capability
- `index.html` with manifest link
- HTTPS required for Twilio Voice SDK

## 8. Out of Scope

- SMS/MMS (calls only)
- Video calling
- Conference calls
- Voicemail
- User authentication