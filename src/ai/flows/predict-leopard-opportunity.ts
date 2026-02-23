'use server';
/**
 * @fileOverview This file defines a Genkit flow for predicting "ANY (Leopard)" opportunities in a Sic Bo game.
 *
 * - predictLeopardOpportunity - A function that analyzes game history to identify statistically opportune moments for an 'ANY (Leopard)' outcome.
 * - PredictLeopardOpportunityInput - The input type for the predictLeopardOpportunity function.
 * - PredictLeopardOpportunityOutput - The return type for the predictLeopardOpportunity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema: Raw game history
const PredictLeopardOpportunityInputSchema = z.object({
  gameHistory: z.array(z.object({
    dice: z.array(z.number().min(1).max(6)).length(3), // An array of 3 dice rolls
  })).describe('The historical records of Sic Bo dice rolls, most recent first. Each entry contains an array of 3 dice numbers.'),
});
export type PredictLeopardOpportunityInput = z.infer<typeof PredictLeopardOpportunityInputSchema>;

// Output Schema: AI's recommendation for Leopard opportunity
const PredictLeopardOpportunityOutputSchema = z.object({
  isLeopardOpportunity: z.boolean().describe('True if an opportune moment for an ANY (Leopard) outcome is detected based on statistical analysis of the game history.'),
  reasoning: z.string().describe('A detailed explanation for the recommendation, considering the game history and statistical probabilities of an ANY (Leopard) outcome.'),
  rollsSinceLastLeopard: z.number().describe('The number of rolls that have passed since the most recent ANY (Leopard) outcome. This value is 0 if the most recent roll was a Leopard, and the total length of the history if no Leopard has occurred within the provided history.'),
  totalLeopardsInHistory: z.number().describe('The total count of ANY (Leopard) outcomes observed within the provided game history.'),
  averageExpectedRollsForLeopard: z.literal(36).describe('The statistical average number of rolls for an ANY (Leopard) outcome to occur in Sic Bo.'),
});
export type PredictLeopardOpportunityOutput = z.infer<typeof PredictLeopardOpportunityOutputSchema>;

// Wrapper function to call the Genkit flow
export async function predictLeopardOpportunity(input: PredictLeopardOpportunityInput): Promise<PredictLeopardOpportunityOutput> {
  return predictLeopardOpportunityFlow(input);
}

// Helper function to detect a leopard roll (all three dice are the same)
function isLeopard(dice: number[]): boolean {
  return dice.length === 3 && dice[0] === dice[1] && dice[1] === dice[2];
}

// Genkit Prompt definition
const leopardOpportunityPrompt = ai.definePrompt({
  name: 'leopardOpportunityPrompt',
  // The prompt input schema defines what pre-calculated data is sent to the LLM.
  input: {
    schema: z.object({
      historyLength: z.number().describe('Total number of rolls in the provided game history.'),
      rollsSinceLastLeopard: z.number().describe('Number of rolls since the last Leopard outcome (0 if current roll is Leopard, historyLength if none).'),
      totalLeopardsInHistory: z.number().describe('Total count of Leopard outcomes in the history.'),
      averageExpectedRollsForLeopard: z.number().describe('The statistical average number of rolls for a Leopard outcome (fixed at 36).'),
    })
  },
  output: {schema: PredictLeopardOpportunityOutputSchema}, // LLM output should match the flow's output schema
  prompt: `You are an expert Sic Bo game analyst. Your task is to analyze the provided game statistics and determine if there is a statistically opportune moment to consider betting on an "ANY (Leopard)" outcome (three identical dice, e.g., 1-1-1, 2-2-2, etc.).

An ANY (Leopard) outcome statistically occurs once every 36 rolls on average.

Here are the current game statistics derived from the game history (ordered most recent first):
- Total rolls in history: {{{historyLength}}}
- Rolls since last ANY (Leopard) outcome: {{{rollsSinceLastLeopard}}}
- Total ANY (Leopard) outcomes in history: {{{totalLeopardsInHistory}}}
- Statistical average rolls expected for a Leopard: {{{averageExpectedRollsForLeopard}}}

Based on these statistics, provide a recommendation in JSON format:
1. Set 'isLeopardOpportunity' to true if it seems statistically opportune to consider betting on a Leopard. This can be when 'rollsSinceLastLeopard' is significantly higher than 'averageExpectedRollsForLeopard', suggesting it's "overdue" from a frequency perspective, or if the overall frequency in 'totalLeopardsInHistory' relative to 'historyLength' is much lower than the statistical average (1/36). Conversely, if 'rollsSinceLastLeopard' is very low, it might suggest less of an opportunity.
2. Provide a clear 'reasoning' (string) for your recommendation. Explain why it is or isn't an opportune time, referencing the statistical average and the current observed frequencies.
3. Ensure the values for 'rollsSinceLastLeopard', 'totalLeopardsInHistory', and 'averageExpectedRollsForLeopard' in your output directly match the input statistics provided to you.
4. The prediction should NOT be a guarantee, but an assessment of statistical opportunity based on the past.

Remember: While each dice roll is an independent event, players often look for statistical anomalies over time. Your role is to highlight these potential 'opportune moments' from a player's perspective, without claiming deterministic prediction.
`,
});

// Genkit Flow definition
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
      const roll = gameHistory[i].dice;
      if (isLeopard(roll)) {
        foundLeopard = true;
        break; // Found the most recent leopard, stop counting rolls since it.
      }
      rollsSinceLastLeopard++;
    }

    // If no leopard was found in the entire history, rollsSinceLastLeopard is the total history length.
    if (!foundLeopard) {
      rollsSinceLastLeopard = gameHistory.length;
    }

    // Count total leopards in the entire history
    const totalLeopardsInHistory = gameHistory.filter(entry => isLeopard(entry.dice)).length;

    const promptInput = {
      historyLength: gameHistory.length,
      rollsSinceLastLeopard: rollsSinceLastLeopard,
      totalLeopardsInHistory: totalLeopardsInHistory,
      averageExpectedRollsForLeopard: 36, // Fixed statistical probability
    };

    const {output} = await leopardOpportunityPrompt(promptInput);
    return output!; // The LLM is instructed to return an object matching PredictLeopardOpportunityOutputSchema
  }
);
