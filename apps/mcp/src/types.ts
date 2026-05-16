import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';

export interface McpContext {
  userId: string;
  supabase: SupabaseClient<Database>;
}

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
};

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}
