# OpenSkolae

OpenSkolae is an open-source mobile client for the Skolae school platform (Kordis).  
This project rewrites the client experience with a modern React Native + Expo stack.

## Features

- Authentication against Skolae (`authentication.kordis.fr`)
- Account and profile loading
- Multi-year data handling (school years)
- Agenda view
- Grades view
- Absences view
- Courses view with details
- Project details
- News feed and article details
- Notifications preferences
- Annual documents
- Speed meetings
- Partners and suggestions screens

## Tech Stack

- React Native
- Expo
- TypeScript
- React Navigation
- Expo Secure Store (token persistence)

## Project Structure

- `src/api` – API client, typed endpoints, auth helpers
- `src/context` – authentication and global session state
- `src/navigation` – stack/tab navigation setup
- `src/screens` – UI screens
- `src/components` – reusable UI components
- `api-skolae.md` – reverse-engineered API notes and endpoint documentation

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Expo CLI (optional, `npx expo` works)

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

Then open the app in:

- Expo Go (Android/iOS)
- Android emulator (`npm run android`)
- iOS simulator (`npm run ios`)
- Web (`npm run web`)

## Authentication Notes

This client follows the same request constraints as the official Skolae app (notably the `okhttp/3.13.1` user-agent requirement) to avoid API rejections.

## Disclaimer

OpenSkolae is an independent project and is not officially affiliated with Skolae or Kordis.
Use it responsibly and in compliance with your institution's policies and applicable terms.
