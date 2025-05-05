
# SocialTrendRadar

SocialTrendRadar is an AI-driven SaaS application built with Next.js and Firebase. It helps social media content creators stay ahead of the curve by predicting emerging content trends based on historical data analysis.

**Core Concept:** Instead of scraping real-time data, SocialTrendRadar uses AI (powered by Genkit and models like Gemini or GPT) to analyze past trends and generate weekly, niche-specific forecasts of what content styles and formats are likely to perform well.

## Getting Started

1.  **Environment Setup:**
    *   Copy `.env.example` to `.env` and fill in your Firebase project configuration (prefixed with `NEXT_PUBLIC_FIREBASE_...`).
    *   Set up Firebase Authentication (Email/Password, Google).
    *   Set up Firestore database.
    *   Configure Firebase Functions environment variables for Admin SDK access and AI provider keys (e.g., `GOOGLE_GENAI_API_KEY`).
    *   Add Stripe API keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and email provider key (e.g., `SENDGRID_API_KEY`).
    *   Ensure your domain is added to Firebase Auth authorized domains.

2.  **Install Dependencies:**
    ```bash
    npm install
    # Install function dependencies
    cd functions && npm install && cd ..
    ```

3.  **Run Development Servers:**
    *   **Next.js App:** `npm run dev` (Runs on http://localhost:9002 by default)
    *   **Genkit Dev Server (Optional, for testing flows):** `npm run genkit:watch` (Runs on http://localhost:4001 by default)
    *   **Firebase Emulators (Recommended):** `npm run serve --prefix functions` (Runs Functions, Firestore, Auth emulators)
       *   Ensure `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` in `.env` when using emulators.

4.  **Explore the App:**
    *   Visit http://localhost:9002
    *   Sign up and select your content niche(s).
    *   Navigate the dashboard to view forecasts (once generated).

## Key Features

*   **AI Trend Forecasting:** Analyzes historical data to predict weekly trends.
*   **Niche Specialization:** Forecasts tailored to user-selected niches (Fitness, Tech, etc.).
*   **Weekly Notifications:** Email (Free/Paid) and optional Slack (Paid) alerts with the latest forecast.
*   **Dashboard:** View current and past forecasts, save favorites (Paid).
*   **Subscription Management:** Free and Paid tiers managed via Stripe.
*   **Authentication:** Secure login using Firebase Auth.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, Tailwind CSS, ShadCN UI
*   **Backend:** Next.js API Routes, Firebase Functions (Scheduled Jobs)
*   **Database:** Firebase Firestore
*   **Authentication:** Firebase Authentication
*   **AI:** Google Genkit (with Gemini or potentially other models)
*   **Payments:** Stripe
*   **Deployment:** Vercel (Recommended)

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
*   `src/components/`: Reusable UI components.
*   `src/lib/`: Utility functions, Firebase initialization.
*   `src/hooks/`: Custom React hooks.
*   `src/ai/`: Genkit configuration and AI flows (`generate-forecast.ts`).
*   `functions/`: Firebase Cloud Functions (scheduled forecast generation, potentially webhooks).
*   `public/`: Static assets.
