import { z } from 'zod';
import type { AnalyzerInfo, AnalyzerPhoto, ItemResult } from '@/lib/analysis/types';

/** 保存する説明文 */
export type VisualDescription = {
  summary: string;
  itemNotes: { metric: string; note: string }[];
  cautions: string;
  selfCareInfo: string;
  suggestMedicalConsult: boolean;
  provider: 'anthropic' | 'mock';
  model: string | null;
  promptVersion: string;
  filteredCount: number;
};

export interface VisualDescriber {
  readonly info: AnalyzerInfo & { provider: 'anthropic' | 'mock' };
  describe(input: {
    photos: (AnalyzerPhoto & { jpeg: Uint8Array })[];
    items: ItemResult[];
  }): Promise<VisualDescription>;
}

/** Claude に返させる JSON の形（構造化出力）。長さはあとで切り詰める */
export const claudeOutputSchema = z.object({
  summary: z.string(),
  observations: z.array(
    z.object({
      metric: z.enum(['pores', 'redness', 'pigmentation_like', 'texture', 'surface']),
      note: z.string(),
    }),
  ),
  photo_condition_notes: z.string(),
  self_care_tips: z.array(z.string()),
  suggest_medical_consult: z.boolean(),
  medical_consult_reason: z.string(),
});

export type ClaudeOutput = z.infer<typeof claudeOutputSchema>;

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
