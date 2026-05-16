export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      apps: {
        Row: {
          accent: string;
          art_kind: string;
          author_id: string;
          bg: string | null;
          category_id: string;
          comments_count: number;
          cover_url: string | null;
          created_at: string;
          description: string;
          hot_score: number;
          hue: number;
          id: string;
          is_featured: boolean;
          is_published: boolean;
          likes_count: number;
          link: string;
          published_at: string;
          remixes_count: number;
          saves_count: number;
          search_vector: unknown;
          slug: string;
          tagline: string;
          tags: string[];
          title: string;
          updated_at: string;
          views_count: number;
        };
        Insert: {
          accent?: string;
          art_kind?: string;
          author_id: string;
          bg?: string | null;
          category_id: string;
          comments_count?: number;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          hot_score?: number;
          hue?: number;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          likes_count?: number;
          link: string;
          published_at?: string;
          remixes_count?: number;
          saves_count?: number;
          search_vector?: unknown;
          slug: string;
          tagline: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          views_count?: number;
        };
        Update: {
          accent?: string;
          art_kind?: string;
          author_id?: string;
          bg?: string | null;
          category_id?: string;
          comments_count?: number;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          hot_score?: number;
          hue?: number;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          likes_count?: number;
          link?: string;
          published_at?: string;
          remixes_count?: number;
          saves_count?: number;
          search_vector?: unknown;
          slug?: string;
          tagline?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
          views_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'apps_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'apps_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: { icon: string; id: string; label: string; sort_order: number };
        Insert: { icon: string; id: string; label: string; sort_order?: number };
        Update: { icon?: string; id?: string; label?: string; sort_order?: number };
        Relationships: [];
      };
      comment_likes: {
        Row: { comment_id: string; created_at: string; user_id: string };
        Insert: { comment_id: string; created_at?: string; user_id: string };
        Update: { comment_id?: string; created_at?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'comment_likes_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          app_id: string;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_deleted: boolean;
          likes_count: number;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          app_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          likes_count?: number;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          app_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          likes_count?: number;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: { created_at: string; followee_id: string; follower_id: string };
        Insert: { created_at?: string; followee_id: string; follower_id: string };
        Update: { created_at?: string; followee_id?: string; follower_id?: string };
        Relationships: [
          {
            foreignKeyName: 'follows_followee_id_fkey';
            columns: ['followee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      likes: {
        Row: { app_id: string; created_at: string; user_id: string };
        Insert: { app_id: string; created_at?: string; user_id: string };
        Update: { app_id?: string; created_at?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'likes_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          emoji: string | null;
          handle: string;
          hue: number;
          id: string;
          links: Json;
          notification_prefs: Json;
          theme_pref: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          emoji?: string | null;
          handle: string;
          hue?: number;
          id: string;
          links?: Json;
          notification_prefs?: Json;
          theme_pref?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          emoji?: string | null;
          handle?: string;
          hue?: number;
          id?: string;
          links?: Json;
          notification_prefs?: Json;
          theme_pref?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saves: {
        Row: { app_id: string; created_at: string; user_id: string };
        Insert: { app_id: string; created_at?: string; user_id: string };
        Update: { app_id?: string; created_at?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'saves_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saves_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { uid: { Args: never; Returns: string } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = { public: { Enums: {} } } as const;
