'use server';
/**
 * @fileOverview A Genkit flow for predicting the next Sic Bo outcome (Big/Small, Odd/Even) and providing a reason.
 *
 * - predictSicBoOutcome - A function that handles the Sic Bo outcome prediction process.
 * - PredictSicBoOutcomeInput - The input type for the predictSicBoOutcome function.
 * - PredictSicBoOutcomeOutput - The return type for the predictSicBoOutcome function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictSicBoOutcomeInputSchema = z.object({
  history: z.array(
    z.object({
      dice: z.array(z.number().min(1).max(6)).length(3).describe('The three dice values for a past roll.'),
      total: z.number().describe('The sum of the three dice values.'),
      isBig: z.boolean().describe('True if the total is 11-18 (Big), false if 3-10 (Small).'),
      isOdd: z.boolean().describe('True if the total is odd, false if even.'),
    })
  ).describe('An array of historical Sic Bo dice roll outcomes, from most recent to oldest. The most recent roll should be at index 0.'),
});
export type PredictSicBoOutcomeInput = z.infer<typeof PredictSicBoOutcomeInputSchema>;

const PredictSicBoOutcomeOutputSchema = z.object({
  predictedSize: z.enum(['BIG', 'SMALL']).describe('The AI\'s prediction for the next outcome size (BIG or SMALL).'),
  predictedParity: z.enum(['ODD', 'EVEN']).describe('The AI\'s prediction for the next outcome parity (ODD or EVEN).'),
  reason: z.string().describe('A detailed explanation from the AI for its prediction, analyzing patterns in the history.'),
});
export type PredictSicBoOutcomeOutput = z.infer<typeof PredictSicBoOutcomeOutputSchema>;

export async function predictSicBoOutcome(input: PredictSicBoOutcomeInput): Promise<PredictSicBoOutcomeOutput> {
  return predictSicBoOutcomeFlow(input);
}

const predictSicBoPrompt = ai.definePrompt({
  name: 'predictSicBoPrompt',
  input: {schema: PredictSicBoOutcomeInputSchema},
  output: {schema: PredictSicBoOutcomeOutputSchema},
  prompt: `You are an expert Sic Bo game analyst and prediction engine. Your goal is to analyze the provided history of dice rolls and predict the next outcome for 'Big/Small' and 'Odd/Even', along with a clear, insightful reason for your prediction.

Sic Bo rules for Big/Small and Odd/Even:
- Total 3-10 is 'SMALL'
- Total 11-18 is 'BIG'
- Total is 'ODD' if it's 3, 5, 7, 9, 11, 13, 15, 17
- Total is 'EVEN' if it's 4, 6, 8, 10, 12, 14, 16, 18

Analyze the following game history from most recent to oldest. Pay close attention to patterns, streaks, and alternating sequences. Provide a prediction for the 'predictedSize' and 'predictedParity' for the *next* roll, and a 'reason' explaining your analysis.

Here is the game history (most recent first):
{{#if history}}
{{#each history}}
- Roll #{{@index}}: Dice [{{dice.[0]}},{{dice.[1]}},{{dice.[2]}}] (Total: {{total}}), Size: {{#if isBig}}BIG{{else}}SMALL{{/if}}, Parity: {{#if isOdd}}ODD{{else}}EVEN{{/if}}
{{/each}}
{{else}}
No history available. Make an initial educated guess.
{{/if}}

Based on this history, what is your prediction for the next roll? Focus on identifying strong patterns.
`
});

const predictSicBoOutcomeFlow = ai.defineFlow(
  {
    name: 'predictSicBoOutcomeFlow',
    inputSchema: PredictSicBoOutcomeInputSchema,
    outputSchema: PredictSicBoOutcomeOutputSchema,
  },
  async (input) => {
    const {output} = await predictSicBoPrompt(input);
    if (!output) {
      throw new Error('AI did not provide a prediction.');
    }
    return output;
  }
);
