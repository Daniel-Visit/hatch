export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          last_used_at: string | null;
          revoked_at: string | null;
          token_hash: string;
          token_prefix: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash: string;
          token_prefix: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
          token_prefix?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      api_rate_limits: {
        Row: {
          bucket_start: string;
          count: number;
          ip: string;
        };
        Insert: {
          bucket_start: string;
          count?: number;
          ip: string;
        };
        Update: {
          bucket_start?: string;
          count?: number;
          ip?: string;
        };
        Relationships: [];
      };
      app_views: {
        Row: {
          app_id: string;
          viewed_at: string;
          viewed_date: string;
          viewer_key: string;
        };
        Insert: {
          app_id: string;
          viewed_at?: string;
          viewed_date?: string;
          viewer_key: string;
        };
        Update: {
          app_id?: string;
          viewed_at?: string;
          viewed_date?: string;
          viewer_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_views_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
        ];
      };
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
        Row: {
          icon: string;
          id: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          icon: string;
          id: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          icon?: string;
          id?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      comment_likes: {
        Row: {
          comment_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          user_id?: string;
        };
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
      contact_requests: {
        Row: {
          app_id: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          note: string;
          recipient_id: string;
          responded_at: string | null;
          role: Database['public']['Enums']['contact_role'];
          sender_id: string;
          sender_link: string | null;
          status: Database['public']['Enums']['contact_status'];
        };
        Insert: {
          app_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string;
          recipient_id: string;
          responded_at?: string | null;
          role: Database['public']['Enums']['contact_role'];
          sender_id: string;
          sender_link?: string | null;
          status?: Database['public']['Enums']['contact_status'];
        };
        Update: {
          app_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string;
          recipient_id?: string;
          responded_at?: string | null;
          role?: Database['public']['Enums']['contact_role'];
          sender_id?: string;
          sender_link?: string | null;
          status?: Database['public']['Enums']['contact_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'contact_requests_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_requests_conversation_fk';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_requests_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_requests_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          app_id: string | null;
          created_at: string;
          id: string;
          last_message_at: string | null;
          participant_a: string;
          participant_b: string;
        };
        Insert: {
          app_id?: string | null;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          participant_a: string;
          participant_b: string;
        };
        Update: {
          app_id?: string | null;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          participant_a?: string;
          participant_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_participant_a_fkey';
            columns: ['participant_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_participant_b_fkey';
            columns: ['participant_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      featured_apps: {
        Row: {
          app_id: string;
          created_at: string;
          reason: string;
          week_of: string;
        };
        Insert: {
          app_id: string;
          created_at?: string;
          reason?: string;
          week_of: string;
        };
        Update: {
          app_id?: string;
          created_at?: string;
          reason?: string;
          week_of?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'featured_apps_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          followee_id: string;
          follower_id: string;
        };
        Insert: {
          created_at?: string;
          followee_id: string;
          follower_id: string;
        };
        Update: {
          created_at?: string;
          followee_id?: string;
          follower_id?: string;
        };
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
        Row: {
          app_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          app_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          app_id?: string;
          created_at?: string;
          user_id?: string;
        };
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
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          app_id: string | null;
          comment_id: string | null;
          contact_request_id: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['notif_kind'];
          payload: Json;
          read_at: string | null;
          recipient_id: string;
        };
        Insert: {
          actor_id?: string | null;
          app_id?: string | null;
          comment_id?: string | null;
          contact_request_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['notif_kind'];
          payload?: Json;
          read_at?: string | null;
          recipient_id: string;
        };
        Update: {
          actor_id?: string | null;
          app_id?: string | null;
          comment_id?: string | null;
          contact_request_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['notif_kind'];
          payload?: Json;
          read_at?: string | null;
          recipient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_app_id_fkey';
            columns: ['app_id'];
            isOneToOne: false;
            referencedRelation: 'apps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_contact_request_id_fkey';
            columns: ['contact_request_id'];
            isOneToOne: false;
            referencedRelation: 'contact_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          banner_gradient: string | null;
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
          banner_gradient?: string | null;
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
          banner_gradient?: string | null;
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
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saves: {
        Row: {
          app_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          app_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          app_id?: string;
          created_at?: string;
          user_id?: string;
        };
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
    Views: {
      [_ in never]: never;
    };
    Functions: {
      compute_hot_score: {
        Args: {
          comments: number;
          likes: number;
          published: string;
          saves: number;
        };
        Returns: number;
      };
      find_or_create_conversation: {
        Args: { app: string; user_a: string; user_b: string };
        Returns: string;
      };
      increment_rate_limit: {
        Args: { p_bucket_start: string; p_ip: string };
        Returns: number;
      };
      is_participant: { Args: { c: string }; Returns: boolean };
      pick_featured_app: { Args: never; Returns: string };
      refresh_hot_scores: { Args: never; Returns: number };
      uid: { Args: never; Returns: string };
    };
    Enums: {
      contact_role: 'investor' | 'partner' | 'hire' | 'fan';
      contact_status: 'pending' | 'accepted' | 'declined' | 'expired';
      notif_kind:
        | 'contact_request'
        | 'contact_accepted'
        | 'contact_declined'
        | 'like'
        | 'comment'
        | 'comment_reply'
        | 'follow'
        | 'message';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      contact_role: ['investor', 'partner', 'hire', 'fan'],
      contact_status: ['pending', 'accepted', 'declined', 'expired'],
      notif_kind: [
        'contact_request',
        'contact_accepted',
        'contact_declined',
        'like',
        'comment',
        'comment_reply',
        'follow',
        'message',
      ],
    },
  },
} as const;
