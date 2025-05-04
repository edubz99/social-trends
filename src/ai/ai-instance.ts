
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Use process.env directly for server-side (like Cloud Functions)
// If this instance were used directly on the Next.js client, it would need NEXT_PUBLIC_ prefix.
// Since categorize-trend.ts has 'use server', it runs server-side, and the function also runs server-side.
// Thus, GOOGLE_GENAI_API_KEY without prefix is correct here for backend usage.

// Make sure GOOGLE_GENAI_API_KEY is set in the environment where this code runs
// (e.g., Cloud Function environment variables, or .env for local genkit:dev)
if (!process.env.GOOGLE_GENAI_API_KEY && typeof window === 'undefined') { // Check only on server-side
    console.warn(
        'GOOGLE_GENAI_API_KEY environment variable is not set. ' +
        'AI features requiring this key (like categorization) will fail. ' +
        'Set it in your deployment environment (e.g., Cloud Function variables) or .env file for local development.'
    );
}

export const ai = genkit({
  promptDir: './prompts', // Relative to where genkit command is run, adjust if needed
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY, // Keep as is for backend
    }),
  ],
  // Default model, can be overridden in specific flows/prompts
  // Consider using a cheaper/faster model if cost/latency is a concern for bulk categorization
  model: 'googleai/gemini-1.5-flash', // Example: using flash model
});
        