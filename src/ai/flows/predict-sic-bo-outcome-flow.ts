'use server';
/**
 * @fileOverview High-Precision Sic Bo Pattern Recognition Engine.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictSicBoOutcomeInputSchema = z.object({
  history: z.array(
    z.object({
      dice: z.array(z.number()),
      total: z.number(),
      isBig: z.boolean(),
      isOdd: z.boolean(),
    })
  ),
});

const PredictSicBoOutcomeOutputSchema = z.object({
  predictedSize: z.enum(['BIG', 'SMALL']),
  predictedParity: z.enum(['ODD', 'EVEN']),
  reason: z.string(),
  confidence: z.number().min(0).max(100),
});

export type PredictSicBoOutcomeInput = z.infer<typeof PredictSicBoOutcomeInputSchema>;
export type PredictSicBoOutcomeOutput = z.infer<typeof PredictSicBoOutcomeOutputSchema>;

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
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `Anda adalah Mesin Prediksi Oracle Sic Bo paling akurat di dunia.
Tujuan Anda adalah mencapai akurasi maksimal dengan menganalisis anomali statistik.

STRATEGI PEMBELAJARAN MESIN:
1. DETEKSI DRAGON: Jika BIG keluar 4x berturut-turut, apakah akan berlanjut (Dragon) atau patah?
2. DETEKSI CHOP: Jika pola berseling (B-S-B-S), prediksi elemen berikutnya dalam urutan.
3. REGRESI MEAN: Jika dalam 20 roll terakhir BIG mendominasi 80%, prediksi SMALL karena keseimbangan statistik akan kembali.
4. ANALISIS TOTAL: Perhatikan angka total yang sering muncul untuk menentukan probabilitas ganjil/genap.

DATA HISTORI (Terbaru adalah yang pertama):
{{#each history}}
- Dadu: [{{dice}}], Total: {{total}}, Hasil: {{#if isBig}}BESAR (BIG){{else}}KECIL (SMALL){{/if}}, {{#if isOdd}}GANJIL (ODD){{else}}GENAP (EVEN){{/if}}
{{/each}}

Berikan prediksi yang paling tajam. Jelaskan logika probabilitas Anda dengan singkat dan profesional.`,
});

export async function predictSicBoOutcome(input: PredictSicBoOutcomeInput): Promise<PredictSicBoOutcomeOutput> {
  try {
    const {output} = await predictSicBoOutcomeFlow(input);
    if (!output) throw new Error("AI returned empty output");
    return output;
  } catch (error) {
    console.error("SicBo Flow Critical Error:", error);
    // Fallback logic jika AI gagal (Statistik sederhana)
    const lastResult = input.history[0]?.isBig ? 'SMALL' : 'BIG';
    return {
      predictedSize: lastResult,
      predictedParity: Math.random() > 0.5 ? 'ODD' : 'EVEN',
      reason: "Mode Pengaman: Menggunakan pola pembalikan tren terakhir untuk meminimalisir risiko.",
      confidence: 50
    };
  }
}

async function predictSicBoOutcomeFlow(input: PredictSicBoOutcomeInput) {
  const {output} = await predictSicBoPrompt(input);
  return { output };
}
