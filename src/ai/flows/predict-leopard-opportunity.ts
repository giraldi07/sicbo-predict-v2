'use server';
/**
 * @fileOverview Leopard (Triple) Probability Analyzer with Robust Error Handling.
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
  reasoning: z.string(),
  rollsSinceLastLeopard: z.number(),
  totalLeopardsInHistory: z.number(),
});

export type PredictLeopardOpportunityInput = z.infer<typeof PredictLeopardOpportunityInputSchema>;
export type PredictLeopardOpportunityOutput = z.infer<typeof PredictLeopardOpportunityOutputSchema>;

const leopardPrompt = ai.definePrompt({
  name: 'leopardPrompt',
  input: {
    schema: z.object({
      rollsSinceLast: z.number(),
      totalLeopards: z.number(),
      historyLength: z.number(),
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
  prompt: `Analisis probabilitas kemunculan Triple (Leopard) pada Sic Bo.
Secara statistik murni, Triple muncul rata-rata 1 kali setiap 36 putaran (2.8%).

DATA INPUT SAAT INI:
- Putaran sejak Leopard terakhir: {{rollsSinceLast}}
- Total Leopard dalam sejarah: {{totalLeopards}}
- Total Histori Data: {{historyLength}}

INSTRUKSI ANALISIS:
1. Jika rollsSinceLast > 30, probabilitas meningkat secara signifikan (hukum rata-rata).
2. Jika belum pernah muncul (rollsSinceLast == historyLength) dan historyLength > 40, beri sinyal bahaya (Strong Buy).
3. Berikan alasan matematis yang meyakinkan.
4. Set isLeopardOpportunity ke TRUE jika peluang di atas 60%.`
});

export async function predictLeopardOpportunity(input: PredictLeopardOpportunityInput): Promise<PredictLeopardOpportunityOutput> {
  let rollsSinceLast = input.gameHistory.length;
  let totalLeopards = 0;

  try {
    const { gameHistory } = input;
    let foundLast = false;

    for (let i = 0; i < gameHistory.length; i++) {
      const d = gameHistory[i].dice;
      const isL = d[0] === d[1] && d[1] === d[2];
      
      if (isL) {
        totalLeopards++;
        if (!foundLast) {
          rollsSinceLast = i;
          foundLast = true;
        }
      }
    }

    const { output } = await leopardPrompt({
      rollsSinceLast,
      totalLeopards,
      historyLength: gameHistory.length
    });
    
    if (!output) throw new Error("AI Blocked or Empty");

    return {
      ...output,
      rollsSinceLastLeopard: rollsSinceLast,
      totalLeopardsInHistory: totalLeopards
    };
  } catch (error) {
    console.error("Leopard Flow Error:", error);
    return {
      isLeopardOpportunity: rollsSinceLast > 36,
      reasoning: "Analisis Statistik Lokal: " + (rollsSinceLast > 36 ? "Probabilitas Triple meningkat karena sudah melampaui rata-rata interval 36 roll." : "Interval Triple masih dalam rentang normal."),
      rollsSinceLastLeopard: rollsSinceLast,
      totalLeopardsInHistory: totalLeopards
    };
  }
}
