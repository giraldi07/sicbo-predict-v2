
'use server';
/**
 * @fileOverview A Genkit flow for predicting the next Sic Bo outcome (Big/Small, Odd/Even).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictSicBoOutcomeInputSchema = z.object({
  history: z.array(
    z.object({
      dice: z.array(z.number().min(1).max(6)).length(3),
      total: z.number(),
      isBig: z.boolean(),
      isOdd: z.boolean(),
    })
  ).describe('Historical Sic Bo rolls.'),
});
export type PredictSicBoOutcomeInput = z.infer<typeof PredictSicBoOutcomeInputSchema>;

const PredictSicBoOutcomeOutputSchema = z.object({
  predictedSize: z.enum(['BIG', 'SMALL']).describe('Prediction for next size.'),
  predictedParity: z.enum(['ODD', 'EVEN']).describe('Prediction for next parity.'),
  reason: z.string().describe('Detailed explanation.'),
});
export type PredictSicBoOutcomeOutput = z.infer<typeof PredictSicBoOutcomeOutputSchema>;

export async function predictSicBoOutcome(input: PredictSicBoOutcomeInput): Promise<PredictSicBoOutcomeOutput> {
  try {
    return await predictSicBoOutcomeFlow(input);
  } catch (error) {
    console.error("Server Action Error:", error);
    // Return fallback instead of crashing
    return {
      predictedSize: Math.random() > 0.5 ? 'BIG' : 'SMALL',
      predictedParity: Math.random() > 0.5 ? 'ODD' : 'EVEN',
      reason: "Oracle sedang dalam mode pemeliharaan (Fallback Aktif)."
    };
  }
}

const predictSicBoPrompt = ai.definePrompt({
  name: 'predictSicBoPrompt',
  input: {schema: PredictSicBoOutcomeInputSchema},
  output: {schema: PredictSicBoOutcomeOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `Analisa histori Sic Bo berikut dan prediksi hasil selanjutnya (BIG/SMALL, ODD/EVEN).
Histori:
{{#each history}}
- Roll: Dice [{{dice}}], Total: {{total}}, Size: {{#if isBig}}BIG{{else}}SMALL{{/if}}, Parity: {{#if isOdd}}ODD{{else}}EVEN{{/if}}
{{/each}}`
});

const predictSicBoOutcomeFlow = ai.defineFlow(
  {
    name: 'predictSicBoOutcomeFlow',
    inputSchema: PredictSicBoOutcomeInputSchema,
    outputSchema: PredictSicBoOutcomeOutputSchema,
  },
  async (input) => {
    const {output} = await predictSicBoPrompt(input);
    if (!output) throw new Error('AI blocked or empty.');
    return output;
  }
);
