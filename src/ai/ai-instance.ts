
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// Potentially add other providers like OpenAI if needed:
// import {openai} from 'genkitx-openai';

// Use process.env directly for server-side operations (API routes, Functions)
// GOOGLE_GENAI_API_KEY or OPENAI_API_KEY should be set in the environment.

// Check for necessary AI provider keys on the server-side
if (typeof window === 'undefined') {
    // Example check for Google AI
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        console.warn(
            'GOOGLE_GENAI_API_KEY environment variable is not set. ' +
            'AI features using Google AI models will fail. Set it in your deployment environment.'
        );
    }
    // Example check for OpenAI (if used)
    if (!process.env.OPENAI_API_KEY) {
        console.warn(
            'OPENAI_API_KEY environment variable is not set. ' +
            'AI features using OpenAI models will fail. Set it in your deployment environment.'
        );
    }
    // Add checks for other providers as needed
}


// Configure plugins based on available keys
const plugins = [];
if (process.env.GOOGLE_GENAI_API_KEY) {
    plugins.push(googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY }));
    console.log("Google AI plugin configured.");
}
// Add OpenAI plugin if key exists and it's intended to be used
// if (process.env.OPENAI_API_KEY) {
//     plugins.push(openai({ apiKey: process.env.OPENAI_API_KEY }));
//     console.log("OpenAI plugin configured.");
// }


export const ai = genkit({
  promptDir: './prompts', // Check if prompts directory exists or is needed
  plugins: plugins,
  // Default model for forecast generation - choose a powerful model
  // Use a specific provider/model identifier
  model: 'googleai/gemini-1.5-pro', // Example: Use Gemini 1.5 Pro if available and suitable
  // Or if using OpenAI:
  // model: 'openai/gpt-4-turbo',
  logLevel: 'debug', // Or 'info' for less verbose logging
  enableTracing: true, // Enable tracing for debugging flows
});

// Log confirmation of loaded plugins
if (plugins.length === 0) {
    console.error("CRITICAL: No AI plugins configured. Ensure at least one AI provider API key (e.g., GOOGLE_GENAI_API_KEY or OPENAI_API_KEY) is set in the environment.");
}
