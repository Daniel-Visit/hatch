// Hand-written Phase 1a stub. Regenerated from cloud schema in Phase 1b via Supabase MCP.
// DO NOT extend by hand for new tables — add the migration first, then regenerate.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface ProfileLink {
  label: string;
  url: string;
}

export interface NotificationPrefs {
  push_enabled: boolean;
  push_likes: boolean;
  push_follows: boolean;
  push_comments: boolean;
  push_messages: boolean;
  push_contact_requests: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          hue: number;
          emoji: string | null;
          links: ProfileLink[];
          theme_pref: 'light' | 'dark' | 'system';
          notification_prefs: NotificationPrefs;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          hue?: number;
          emoji?: string | null;
          links?: ProfileLink[];
          theme_pref?: 'light' | 'dark' | 'system';
          notification_prefs?: NotificationPrefs;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          handle?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          hue?: number;
          emoji?: string | null;
          links?: ProfileLink[];
          theme_pref?: 'light' | 'dark' | 'system';
          notification_prefs?: NotificationPrefs;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          label: string;
          icon: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          label: string;
          icon: string;
          sort_order?: number;
        };
        Update: {
          label?: string;
          icon?: string;
          sort_order?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      uid: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
