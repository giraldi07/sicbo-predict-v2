
'use server';
/**
 * @fileOverview This file defines a Genkit flow for predicting "ANY (Leopard)" opportunities.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictLeopardOpportunityInputSchema = z.object({
  gameHistory: z.array(z.object({
    dice: z.array(z.number().min(1).max(6)).length(3),
  })),
});
export type PredictLeopardOpportunityInput = z.infer<typeof PredictLeopardOpportunityInputSchema>;

const PredictLeopardOpportunityOutputSchema = z.object({
  isLeopardOpportunity: z.boolean(),
  reasoning: z.string(),
  rollsSinceLastLeopard: z.number(),
  totalLeopardsInHistory: z.number(),
  averageExpectedRollsForLeopard: z.number(),
});
export type PredictLeopardOpportunityOutput = z.infer<typeof PredictLeopardOpportunityOutputSchema>;

export async function predictLeopardOpportunity(input: PredictLeopardOpportunityInput): Promise<PredictLeopardOpportunityOutput> {
  try {
    return await predictLeopardOpportunityFlow(input);
  } catch (error) {
    console.error("Server Action Error Leopard:", error);
    return {
      isLeopardOpportunity: false,
      reasoning: "Gagal memproses data Leopard.",
      rollsSinceLastLeopard: 0,
      totalLeopardsInHistory: 0,
      averageExpectedRollsForLeopard: 36
    };
  }
}

function isLeopard(dice: number[]): boolean {
  return dice.length === 3 && dice[0] === dice[1] && dice[1] === dice[2];
}

const leopardOpportunityPrompt = ai.definePrompt({
  name: 'leopardOpportunityPrompt',
  input: {
    schema: z.object({
      historyLength: z.number(),
      rollsSinceLastLeopard: z.number(),
      totalLeopardsInHistory: z.number(),
      averageExpectedRollsForLeopard: z.number(),
    })
  },
  output: {schema: PredictLeopardOpportunityOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  },
  prompt: `Analisa peluang Leopard.
Data:
- Total rolls: {{{historyLength}}}
- Rolls sejak Leopard terakhir: {{{rollsSinceLastLeopard}}}
- Total Leopard ditemukan: {{{totalLeopardsInHistory}}}
- Rata-rata statistik: 36`
});

const predictLeopardOpportunityFlow = ai.defineFlow(
  {
    name: 'predictLeopardOpportunityFlow',
    inputSchema: PredictLeopardOpportunityInputSchema,
    outputSchema: PredictLeopardOpportunityOutputSchema,
  },
  async (input) => {
    const { gameHistory } = input;
    let rollsSinceLastLeopard = 0;
    let foundLeopard = false;
    for (let i = 0; i < gameHistory.length; i++) {
      if (isLeopard(gameHistory[i].dice)) {
        foundLeopard = true;
        break;
      }
      rollsSinceLastLeopard++;
    }
    if (!foundLeopard) rollsSinceLastLeopard = gameHistory.length;
    const totalLeopardsInHistory = gameHistory.filter(entry => isLeopard(entry.dice)).length;

    const {output} = await leopardOpportunityPrompt({
      historyLength: gameHistory.length,
      rollsSinceLastLeopard,
      totalLeopardsInHistory,
      averageExpectedRollsForLeopard: 36,
    });
    return output!;
  }
);
