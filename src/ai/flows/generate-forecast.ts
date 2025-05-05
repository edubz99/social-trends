
'use server';

/**
 * @fileOverview Generates a weekly social media content forecast for a specific niche.
 *
 * - generateNicheForecast - Function to trigger the forecast generation flow.
 * - GenerateNicheForecastInput - Input schema for the flow.
 * - GenerateNicheForecastOutput - Output schema for the flow.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// --- Input Schema ---
const GenerateNicheForecastInputSchema = z.object({
  niche: z.string().describe('The specific content niche for which to generate the forecast (e.g., "Fitness", "Tech").'),
  // Placeholder for historical data - structure needs refinement based on actual available data
  historicalData: z.any().optional().describe('Historical trend data relevant to the niche. Structure TBD. Could be summaries, past successful post types, engagement metrics, etc.'),
  // You might add parameters like forecast_period_start_date, number_of_items_to_generate, etc.
});
export type GenerateNicheForecastInput = z.infer<typeof GenerateNicheForecastInputSchema>;


// --- Output Schema ---
const ForecastItemSchema = z.object({
    id: z.string().uuid().describe('Unique identifier for this forecast item.'),
    title: z.string().describe('A catchy, short title for the predicted trend or content format (e.g., "Retro Vlog Edits", "AI Avatar Explainers").'),
    description: z.string().describe('A detailed explanation of the trend/format, why it might work now, and actionable advice for creators (2-3 sentences).'),
    confidence: z.number().min(0).max(1).optional().describe('AI\'s confidence score (0.0 to 1.0) in this prediction.'),
    hashtags: z.array(z.string()).optional().describe('Optional list of 3-5 relevant hashtags.'),
    // Add other potential fields like 'content_format_suggestion', 'visual_style_tip', etc.
}).describe('A single predicted trend or content idea for the upcoming week.');

const GenerateNicheForecastOutputSchema = z.object({
  niche: z.string().describe('The niche for which this forecast was generated.'),
  weekStartDate: z.string().datetime().describe('The starting date (ISO 8601 format) of the week this forecast applies to (e.g., the upcoming Monday).'),
  generatedAt: z.string().datetime().describe('Timestamp (ISO 8601 format) when the forecast was generated.'),
  forecastItems: z.array(ForecastItemSchema).min(3).max(5).describe('An array of 3 to 5 actionable forecast items for the week.'),
  revivalSuggestion: z.object({
      title: z.string().describe("Title of a past trend suggested for revival."),
      description: z.string().describe("Reasoning for suggesting the revival."),
  }).optional().describe('Optional suggestion for reviving a past successful trend.'),
});
export type GenerateNicheForecastOutput = z.infer<typeof GenerateNicheForecastOutputSchema>;


// --- Exported Function ---
export async function generateNicheForecast(input: GenerateNicheForecastInput): Promise<GenerateNicheForecastOutput> {
    // Basic input validation (Genkit schemas handle more)
    if (!input.niche) {
        throw new Error("Niche is required to generate a forecast.");
    }

    // Check for AI provider keys before proceeding
    if (ai.plugins.length === 0) {
         console.error('generateNicheForecast: No AI plugins configured. Cannot run forecast flow.');
        throw new Error('AI provider key is missing. Forecast generation is unavailable.');
    }
    console.log(`Generating forecast for niche: ${input.niche}`);
    return generateForecastFlow(input);
}


// --- Genkit Prompt Definition ---
const forecastPrompt = ai.definePrompt({
  name: 'generateForecastPrompt',
  input: { schema: GenerateNicheForecastInputSchema },
  output: { schema: GenerateNicheForecastOutputSchema },

  prompt: `You are an expert Social Media Trend Forecaster AI. Your task is to analyze historical data patterns (if provided) and general knowledge of social media dynamics to predict emerging content trends for the upcoming week (starting next Monday) within a specific niche.

Niche: {{{niche}}}

Historical Data Summary (if available):
{{{historicalData}}}

Based on the niche and any historical context, generate a forecast for the upcoming week. Provide 3-5 distinct and actionable trend predictions or content format suggestions. For each item, include a catchy title, a detailed description explaining the trend and giving advice, an optional confidence score, and optional relevant hashtags. Also, optionally suggest one past trend from this niche that might be worth reviving.

Structure your entire response according to the required JSON output schema. Ensure dates are in ISO 8601 format. Generate unique UUIDs for each forecast item ID.
`,
});


// --- Genkit Flow Definition ---
const generateForecastFlow = ai.defineFlow<
  typeof GenerateNicheForecastInputSchema,
  typeof GenerateNicheForecastOutputSchema
>(
  {
    name: 'generateForecastFlow',
    inputSchema: GenerateNicheForecastInputSchema,
    outputSchema: GenerateNicheForecastOutputSchema,
  },
  async (input) => {
    console.log("generateForecastFlow: Starting flow execution for niche:", input.niche);

    // Here you would ideally fetch and process actual historical data based on the input.niche
    // For now, we'll pass the placeholder input.historicalData directly.
    // Example: const processedHistoricalData = await processHistoricalData(input.niche, input.historicalData);

    try {
        // Determine the start date of the upcoming week (next Monday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Days to add to get to next Monday
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + daysUntilMonday);
        nextMonday.setHours(0, 0, 0, 0); // Set to start of day

        console.log(`generateForecastFlow: Calling AI prompt for niche "${input.niche}" for week starting ${nextMonday.toISOString()}`);

        // Call the AI prompt
        const { output } = await forecastPrompt({
            niche: input.niche,
            historicalData: input.historicalData || "No specific historical data provided. Rely on general knowledge.",
        });

        if (!output) {
            console.error('generateForecastFlow: AI prompt returned no output for input:', input);
            throw new Error('AI failed to generate a forecast.');
        }

         // Add/overwrite calculated dates to the output before returning
        const finalOutput: GenerateNicheForecastOutput = {
            ...output,
            niche: input.niche, // Ensure niche matches input
            weekStartDate: nextMonday.toISOString(),
            generatedAt: new Date().toISOString(),
             // Ensure generated IDs are unique (if AI didn't provide them reliably)
            forecastItems: output.forecastItems.map(item => ({
                ...item,
                id: item.id || crypto.randomUUID(), // Generate UUID if missing
            })),
        };


        console.log(`generateForecastFlow: Successfully generated forecast for niche "${input.niche}". Items:`, finalOutput.forecastItems.length);
        return finalOutput;

    } catch (error: any) {
        console.error(`generateForecastFlow: Error during execution for niche "${input.niche}":`, error.message || error);
        // Rethrow or handle specific errors
        throw new Error(`Failed to generate forecast for ${input.niche}: ${error.message}`);
    }
  }
);
