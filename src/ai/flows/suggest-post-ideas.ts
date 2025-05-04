'use server';

/**
 * @fileOverview A flow to generate post ideas based on a current trend.
 *
 * - suggestPostIdeas - A function that handles the generation of post ideas.
 * - SuggestPostIdeasInput - The input type for the suggestPostIdeas function.
 * - SuggestPostIdeasOutput - The return type for the suggestPostIdeas function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestPostIdeasInputSchema = z.object({
  trendTitle: z.string().describe('The title of the current trend.'),
  niche: z.string().describe('The niche of the content creator.'),
});
export type SuggestPostIdeasInput = z.infer<typeof SuggestPostIdeasInputSchema>;

const SuggestPostIdeasOutputSchema = z.object({
  postIdeas: z
    .array(z.string())
    .describe('An array of post ideas based on the trend and niche.'),
});
export type SuggestPostIdeasOutput = z.infer<typeof SuggestPostIdeasOutputSchema>;

export async function suggestPostIdeas(input: SuggestPostIdeasInput): Promise<SuggestPostIdeasOutput> {
  return suggestPostIdeasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPostIdeasPrompt',
  input: {
    schema: z.object({
      trendTitle: z.string().describe('The title of the current trend.'),
      niche: z.string().describe('The niche of the content creator.'),
    }),
  },
  output: {
    schema: z.object({
      postIdeas: z
        .array(z.string())
        .describe('An array of post ideas based on the trend and niche.'),
    }),
  },
  prompt: `You are a creative content strategist. Generate engaging post ideas based on the current trend and the content creator's niche.\n\nTrend: {{{trendTitle}}}\nNiche: {{{niche}}}\n\nPost Ideas:`,
});

const suggestPostIdeasFlow = ai.defineFlow<
  typeof SuggestPostIdeasInputSchema,
  typeof SuggestPostIdeasOutputSchema
>(
  {
    name: 'suggestPostIdeasFlow',
    inputSchema: SuggestPostIdeasInputSchema,
    outputSchema: SuggestPostIdeasOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
