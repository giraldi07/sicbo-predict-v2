'use server';
/**
 * @fileOverview Leopard (Triple) Probability Analyzer.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictLeopardOpportunityInputSchema = z.object({
  gameHistory: z.array(z.object({
    dice: z.array(z.number()),
  })),
});

const PredictLeopardOpportunityOutputSchema = z.object({
  isLeopardOpportunity: z.boolean(),
  recommendation: z.enum(['WAIT', 'BET_LIGHT', 'BET_HEAVY', 'STRONG_BUY']),
  reasoning: z.string(),
  rollsSinceLastLeopard: z.number(),
});

export type PredictLeopardOpportunityInput = z.infer<typeof PredictLeopardOpportunityInputSchema>;
export type PredictLeopardOpportunityOutput = z.infer<typeof PredictLeopardOpportunityOutputSchema>;

const leopardPrompt = ai.definePrompt({
  name: 'leopardPrompt',
  input: {
    schema: z.object({
      rollsSinceLast: z.number(),
      history: z.string(),
    })
  },
  output: {schema: PredictLeopardOpportunityOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `Analisis Probabilitas Triple (Leopard) Sic Bo.
Statistik: 1:36 (2.8%).

INPUT:
- Jarak roll dari Leopard terakhir: {{rollsSinceLast}}
- Histori dice: {{history}}

LOGIKA:
- Jika rollsSinceLast > 30: Peluang BET_LIGHT.
- Jika rollsSinceLast > 45: Peluang BET_HEAVY.
- Jika rollsSinceLast > 60: Peluang STRONG_BUY.

Berikan analisis apakah saat ini waktu yang tepat untuk memasang taruhan Triple (Payout 30x).`
});

export async function predictLeopardOpportunity(input: PredictLeopardOpportunityInput): Promise<PredictLeopardOpportunityOutput> {
  let rollsSinceLast = input.gameHistory.length;
  const historyString = input.gameHistory.map(h => h.dice.join(',')).join('|');

  for (let i = 0; i < input.gameHistory.length; i++) {
    const d = input.gameHistory[i].dice;
    if (d[0] === d[1] && d[1] === d[2]) {
      rollsSinceLast = i;
      break;
    }
  }

  try {
    const { output } = await leopardPrompt({
      rollsSinceLast,
      history: historyString
    });
    
    if (!output) throw new Error("AI Error");

    return {
      ...output,
      rollsSinceLastLeopard: rollsSinceLast,
    };
  } catch (error) {
    return {
      isLeopardOpportunity: rollsSinceLast > 40,
      recommendation: rollsSinceLast > 50 ? 'BET_HEAVY' : 'WAIT',
      reasoning: "Analisis statistik mendeteksi keterlambatan kemunculan Triple selama " + rollsSinceLast + " putaran.",
      rollsSinceLastLeopard: rollsSinceLast
    };
  }
}
