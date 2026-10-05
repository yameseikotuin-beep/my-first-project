import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '@/lib/supabase/database.types';
import { getActiveConsents, type Subject } from '@/lib/consent';
import { isClaudeConfigured } from '@/lib/ai/claude-describer';
import { aiDailyLimit } from '@/lib/ai/limits';
import type { AiAvailability } from './analyze-confirm';

export async function getAiAvailability(
  supabase: SupabaseClient<Database>,
  subject: Subject,
  role: AppRole,
): Promise<AiAvailability> {
  const [consents, usage] = await Promise.all([getActiveConsents(supabase, subject), supabase.rpc('my_ai_usage_today')]);
  return {
    consent: Boolean(consents.ai_processing),
    configured: isClaudeConfigured(),
    remaining: Math.max(0, aiDailyLimit(role) - (usage.data ?? 0)),
  };
}
