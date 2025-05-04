'use server';

/**
 * @fileOverview Categorizes a trend into specific niches.
 *
 * - categorizeTrend - A function that categorizes a trend.
 * - CategorizeTrendInput - The input type for the categorizeTrend function.
 * - CategorizeTrendOutput - The return type for the categorizeTrend function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const CategorizeTrendInputSchema = z.object({
  trendTitle: z.string().describe('The title of the trend.'),
  trendDescription: z.string().optional().describe('A description of the trend, if available.'),
  niches: z.array(z.string()).describe('A list of possible niches to categorize the trend into.'),
});
export type CategorizeTrendInput = z.infer<typeof CategorizeTrendInputSchema>;

const CategorizeTrendOutputSchema = z.object({
  category: z.string().describe('The niche that the trend best fits into.'),
  confidence: z.number().describe('A confidence score between 0 and 1 indicating how well the trend fits the category.'),
});
export type CategorizeTrendOutput = z.infer<typeof CategorizeTrendOutputSchema>;

export async function categorizeTrend(input: CategorizeTrendInput): Promise<CategorizeTrendOutput> {
  return categorizeTrendFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeTrendPrompt',
  input: {
    schema: z.object({
      trendTitle: z.string().describe('The title of the trend.'),
      trendDescription: z.string().optional().describe('A description of the trend, if available.'),
      niches: z.array(z.string()).describe('A list of possible niches to categorize the trend into.'),
    }),
  },
  output: {
    schema: z.object({
      category: z.string().describe('The niche that the trend best fits into.'),
      confidence: z.number().describe('A confidence score between 0 and 1 indicating how well the trend fits the category.'),
    }),
  },
  prompt: `You are an expert in identifying trends and categorizing them into niches.

  Given the following trend title and description (if available), categorize it into one of the following niches:
  {{#each niches}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Trend Title: {{{trendTitle}}}
  {{#if trendDescription}}
  Trend Description: {{{trendDescription}}}
  {{/if}}

  Return the category that the trend best fits into, and a confidence score between 0 and 1 indicating how well the trend fits the category.
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
  const {output} = await prompt(input);
  return output!;
});
