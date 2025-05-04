
'use server';

/**
 * @fileOverview Categorizes a trend into specific niches using Genkit.
 *
 * - categorizeTrend - A function that categorizes a trend.
 * - CategorizeTrendInput - The input type for the categorizeTrend function.
 * - CategorizeTrendOutput - The return type for the categorizeTrend function.
 */

import { ai } from '@/ai/ai-instance'; // Use centralized ai instance
import { z } from 'genkit';

const CategorizeTrendInputSchema = z.object({
  trendTitle: z.string().describe('The title of the trend.'),
  trendDescription: z.string().optional().describe('A description of the trend, if available.'),
  niches: z.array(z.string()).describe('A list of possible niches to categorize the trend into.'),
});
export type CategorizeTrendInput = z.infer<typeof CategorizeTrendInputSchema>;

const CategorizeTrendOutputSchema = z.object({
  category: z.string().describe('The niche that the trend best fits into.'),
  confidence: z.number().min(0).max(1).describe('A confidence score between 0 and 1 indicating how well the trend fits the category.'),
});
export type CategorizeTrendOutput = z.infer<typeof CategorizeTrendOutputSchema>;

export async function categorizeTrend(input: CategorizeTrendInput): Promise<CategorizeTrendOutput> {
    // Check for API key existence before calling the flow
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        console.error('GOOGLE_GENAI_API_KEY is not set. Cannot run categorization flow.');
        throw new Error('AI API key is missing. Categorization is unavailable.');
    }
  return categorizeTrendFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeTrendPrompt',
  input: {
    schema: CategorizeTrendInputSchema, // Use the defined schema
  },
  output: {
    schema: CategorizeTrendOutputSchema, // Use the defined schema
  },
  prompt: `You are an expert in identifying social media trends and categorizing them into relevant niches for content creators.

  Given the following trend title and description (if available), determine which single niche from the provided list it best fits into.

  Available Niches:
  {{#each niches}} - {{{this}}}
  {{/each}}

  Trend Information:
  Title: {{{trendTitle}}}
  {{#if trendDescription}}
  Description: {{{trendDescription}}}
  {{/if}}

  Respond with the single best-fitting niche and a confidence score (0.0 to 1.0) indicating how certain you are about this categorization. If no niche fits well, choose the closest one and provide a low confidence score, or select 'Uncategorized'.
  `,
});

const categorizeTrendFlow = ai.defineFlow<
  typeof CategorizeTrendInputSchema,
  typeof CategorizeTrendOutputSchema
>({
  name: 'categorizeTrendFlow',
  inputSchema: CategorizeTrendInputSchema,
  outputSchema: CategorizeTrendOutputSchema,
}, async input => {
  try {
      const { output } = await prompt(input);
      if (!output) {
        console.error('Categorization prompt returned no output for input:', input);
        // Fallback or throw error
        return { category: 'Uncategorized', confidence: 0 };
      }
      // Ensure confidence is within bounds (sometimes LLMs might slightly exceed)
      output.confidence = Math.max(0, Math.min(1, output.confidence));
      return output;
  } catch (error) {
      console.error('Error during categorizeTrendFlow execution:', error);
      // Handle error, maybe return a default or re-throw
      // Returning a default to prevent entire function failure
      return { category: 'Uncategorized', confidence: 0 };
  }

});
      