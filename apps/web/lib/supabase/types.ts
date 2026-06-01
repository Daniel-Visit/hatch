export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          bucket_start: string
          count: number
          ip: string
        }
        Insert: {
          bucket_start: string
          count?: number
          ip: string
        }
        Update: {
          bucket_start?: string
          count?: number
          ip?: string
        }
        Relationships: []
      }
      app_views: {
        Row: {
          app_id: string
          viewed_at: string
          viewed_date: string
          viewer_key: string
        }
        Insert: {
          app_id: string
          viewed_at?: string
          viewed_date?: string
          viewer_key: string
        }
        Update: {
          app_id?: string
          viewed_at?: string
          viewed_date?: string
          viewer_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_views_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          accent: string
          art_kind: string
          author_id: string
          bg: string | null
          built_with: string[]
          category_id: string
          comments_count: number
          cover_url: string | null
          created_at: string
          description: string
          discovery_via_brief_count: number
          hot_score: number
          hue: number
          id: string
          is_featured: boolean
          is_published: boolean
          likes_count: number
          link: string
          published_at: string
          saves_count: number
          search_vector: unknown
          slug: string
          solves_problems: string[]
          tagline: string
          tags: string[]
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          accent?: string
          art_kind?: string
          author_id: string
          bg?: string | null
          built_with?: string[]
          category_id: string
          comments_count?: number
          cover_url?: string | null
          created_at?: string
          description?: string
          discovery_via_brief_count?: number
          hot_score?: number
          hue?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          likes_count?: number
          link: string
          published_at?: string
          saves_count?: number
          search_vector?: unknown
          slug: string
          solves_problems?: string[]
          tagline: string
          tags?: string[]
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          accent?: string
          art_kind?: string
          author_id?: string
          bg?: string | null
          built_with?: string[]
          category_id?: string
          comments_count?: number
          cover_url?: string | null
          created_at?: string
          description?: string
          discovery_via_brief_count?: number
          hot_score?: number
          hue?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          likes_count?: number
          link?: string
          published_at?: string
          saves_count?: number
          search_vector?: unknown
          slug?: string
          solves_problems?: string[]
          tagline?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "apps_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_match_audit_logs: {
        Row: {
          brief_id: string
          candidates_considered: number
          candidates_final: number
          candidates_shortlisted: number
          created_at: string
          duration_ms: number
          id: string
          model_used: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          rationale_json: Json | null
        }
        Insert: {
          brief_id: string
          candidates_considered?: number
          candidates_final?: number
          candidates_shortlisted?: number
          created_at?: string
          duration_ms?: number
          id?: string
          model_used?: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          rationale_json?: Json | null
        }
        Update: {
          brief_id?: string
          candidates_considered?: number
          candidates_final?: number
          candidates_shortlisted?: number
          created_at?: string
          duration_ms?: number
          id?: string
          model_used?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          rationale_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_match_audit_logs_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_refinement_turns: {
        Row: {
          brief_id: string
          content: string
          content_json: Json | null
          created_at: string
          id: string
          model_used: string | null
          role: Database["public"]["Enums"]["turn_role"]
          round: number
          tokens_in: number | null
          tokens_out: number | null
          turn_index: number
          ui_component_invocation: Json | null
        }
        Insert: {
          brief_id: string
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          model_used?: string | null
          role: Database["public"]["Enums"]["turn_role"]
          round: number
          tokens_in?: number | null
          tokens_out?: number | null
          turn_index: number
          ui_component_invocation?: Json | null
        }
        Update: {
          brief_id?: string
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          model_used?: string | null
          role?: Database["public"]["Enums"]["turn_role"]
          round?: number
          tokens_in?: number | null
          tokens_out?: number | null
          turn_index?: number
          ui_component_invocation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_refinement_turns_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          author_id: string
          budget_band: Database["public"]["Enums"]["budget_band"] | null
          completeness_score: number
          content: Json
          created_at: string
          entry_mode: Database["public"]["Enums"]["brief_entry_mode"]
          expires_at: string
          geography: string | null
          id: string
          industry: string | null
          intent: string
          manually_edited_fields: string[]
          match_potential_estimate: Json | null
          matching_started_at: string | null
          parsed_from: string | null
          public_at: string | null
          public_likes: number
          public_rank: number
          quality_by_section: Json | null
          quality_score: number
          refinement_round: number
          resolution: Database["public"]["Enums"]["brief_resolution"] | null
          resolved_at: string | null
          solution_types: Database["public"]["Enums"]["solution_type"][]
          status: Database["public"]["Enums"]["brief_status"]
          technical_level: Database["public"]["Enums"]["technical_level"] | null
          timeline: Database["public"]["Enums"]["brief_timeline"] | null
          title: string | null
          updated_at: string
          use_case: Database["public"]["Enums"]["brief_use_case"] | null
          visibility: Database["public"]["Enums"]["brief_visibility"]
        }
        Insert: {
          author_id: string
          budget_band?: Database["public"]["Enums"]["budget_band"] | null
          completeness_score?: number
          content?: Json
          created_at?: string
          entry_mode: Database["public"]["Enums"]["brief_entry_mode"]
          expires_at?: string
          geography?: string | null
          id?: string
          industry?: string | null
          intent?: string
          manually_edited_fields?: string[]
          match_potential_estimate?: Json | null
          matching_started_at?: string | null
          parsed_from?: string | null
          public_at?: string | null
          public_likes?: number
          public_rank?: number
          quality_by_section?: Json | null
          quality_score?: number
          refinement_round?: number
          resolution?: Database["public"]["Enums"]["brief_resolution"] | null
          resolved_at?: string | null
          solution_types?: Database["public"]["Enums"]["solution_type"][]
          status?: Database["public"]["Enums"]["brief_status"]
          technical_level?:
            | Database["public"]["Enums"]["technical_level"]
            | null
          timeline?: Database["public"]["Enums"]["brief_timeline"] | null
          title?: string | null
          updated_at?: string
          use_case?: Database["public"]["Enums"]["brief_use_case"] | null
          visibility?: Database["public"]["Enums"]["brief_visibility"]
        }
        Update: {
          author_id?: string
          budget_band?: Database["public"]["Enums"]["budget_band"] | null
          completeness_score?: number
          content?: Json
          created_at?: string
          entry_mode?: Database["public"]["Enums"]["brief_entry_mode"]
          expires_at?: string
          geography?: string | null
          id?: string
          industry?: string | null
          intent?: string
          manually_edited_fields?: string[]
          match_potential_estimate?: Json | null
          matching_started_at?: string | null
          parsed_from?: string | null
          public_at?: string | null
          public_likes?: number
          public_rank?: number
          quality_by_section?: Json | null
          quality_score?: number
          refinement_round?: number
          resolution?: Database["public"]["Enums"]["brief_resolution"] | null
          resolved_at?: string | null
          solution_types?: Database["public"]["Enums"]["solution_type"][]
          status?: Database["public"]["Enums"]["brief_status"]
          technical_level?:
            | Database["public"]["Enums"]["technical_level"]
            | null
          timeline?: Database["public"]["Enums"]["brief_timeline"] | null
          title?: string | null
          updated_at?: string
          use_case?: Database["public"]["Enums"]["brief_use_case"] | null
          visibility?: Database["public"]["Enums"]["brief_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "briefs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          icon: string
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          icon?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          app_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          is_deleted: boolean
          likes_count: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          app_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          app_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          app_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          note: string
          recipient_id: string
          responded_at: string | null
          role: Database["public"]["Enums"]["contact_role"]
          sender_id: string
          sender_link: string | null
          status: Database["public"]["Enums"]["contact_status"]
        }
        Insert: {
          app_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string
          recipient_id: string
          responded_at?: string | null
          role: Database["public"]["Enums"]["contact_role"]
          sender_id: string
          sender_link?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
        }
        Update: {
          app_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string
          recipient_id?: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["contact_role"]
          sender_id?: string
          sender_link?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_conversation_fk"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          app_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          participant_a: string
          participant_b: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_a: string
          participant_b: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_a?: string
          participant_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_apps: {
        Row: {
          app_id: string
          created_at: string
          reason: string
          week_of: string
        }
        Insert: {
          app_id: string
          created_at?: string
          reason?: string
          week_of: string
        }
        Update: {
          app_id?: string
          created_at?: string
          reason?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          app_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          agent_confidence: number
          agent_rationale: string
          brief_id: string
          candidate_acted_at: string | null
          candidate_action: Database["public"]["Enums"]["swipe_action"]
          candidate_app_id: string | null
          candidate_builder_id: string | null
          candidate_type: Database["public"]["Enums"]["candidate_type"]
          commercial_status: Database["public"]["Enums"]["commercial_status"]
          created_at: string
          id: string
          seeker_acted_at: string | null
          seeker_action: Database["public"]["Enums"]["swipe_action"]
          thread_id: string | null
        }
        Insert: {
          agent_confidence: number
          agent_rationale?: string
          brief_id: string
          candidate_acted_at?: string | null
          candidate_action?: Database["public"]["Enums"]["swipe_action"]
          candidate_app_id?: string | null
          candidate_builder_id?: string | null
          candidate_type: Database["public"]["Enums"]["candidate_type"]
          commercial_status?: Database["public"]["Enums"]["commercial_status"]
          created_at?: string
          id?: string
          seeker_acted_at?: string | null
          seeker_action?: Database["public"]["Enums"]["swipe_action"]
          thread_id?: string | null
        }
        Update: {
          agent_confidence?: number
          agent_rationale?: string
          brief_id?: string
          candidate_acted_at?: string | null
          candidate_action?: Database["public"]["Enums"]["swipe_action"]
          candidate_app_id?: string | null
          candidate_builder_id?: string | null
          candidate_type?: Database["public"]["Enums"]["candidate_type"]
          commercial_status?: Database["public"]["Enums"]["commercial_status"]
          created_at?: string
          id?: string
          seeker_acted_at?: string | null
          seeker_action?: Database["public"]["Enums"]["swipe_action"]
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_candidate_app_id_fkey"
            columns: ["candidate_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_candidate_builder_id_fkey"
            columns: ["candidate_builder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          app_id: string | null
          comment_id: string | null
          contact_request_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notif_kind"]
          payload: Json
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          app_id?: string | null
          comment_id?: string | null
          contact_request_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notif_kind"]
          payload?: Json
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          app_id?: string | null
          comment_id?: string | null
          contact_request_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notif_kind"]
          payload?: Json
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_request_id_fkey"
            columns: ["contact_request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_requests: boolean
          avatar_url: string | null
          banner_gradient: string | null
          bio: string | null
          created_at: string
          display_name: string
          emoji: string | null
          feature_flags: Json
          handle: string
          hue: number
          id: string
          inferred_capabilities: string[]
          last_brief_response_at: string | null
          links: Json
          locale_pref: string | null
          notification_prefs: Json
          request_capacity: number
          request_domains: string[]
          request_rate_band: Database["public"]["Enums"]["budget_band"] | null
          theme_pref: string
          updated_at: string
        }
        Insert: {
          accepts_requests?: boolean
          avatar_url?: string | null
          banner_gradient?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          emoji?: string | null
          feature_flags?: Json
          handle: string
          hue?: number
          id: string
          inferred_capabilities?: string[]
          last_brief_response_at?: string | null
          links?: Json
          locale_pref?: string | null
          notification_prefs?: Json
          request_capacity?: number
          request_domains?: string[]
          request_rate_band?: Database["public"]["Enums"]["budget_band"] | null
          theme_pref?: string
          updated_at?: string
        }
        Update: {
          accepts_requests?: boolean
          avatar_url?: string | null
          banner_gradient?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          emoji?: string | null
          feature_flags?: Json
          handle?: string
          hue?: number
          id?: string
          inferred_capabilities?: string[]
          last_brief_response_at?: string | null
          links?: Json
          locale_pref?: string | null
          notification_prefs?: Json
          request_capacity?: number
          request_domains?: string[]
          request_rate_band?: Database["public"]["Enums"]["budget_band"] | null
          theme_pref?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          app_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      validator_suggestions: {
        Row: {
          applied_value: string | null
          brief_id: string
          created_at: string
          diagnosis: string
          example_better: string
          id: string
          model_used: string | null
          resolved_at: string | null
          section_path: string
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          applied_value?: string | null
          brief_id: string
          created_at?: string
          diagnosis: string
          example_better: string
          id?: string
          model_used?: string | null
          resolved_at?: string | null
          section_path: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          applied_value?: string | null
          brief_id?: string
          created_at?: string
          diagnosis?: string
          example_better?: string
          id?: string
          model_used?: string | null
          resolved_at?: string | null
          section_path?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "validator_suggestions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_hot_score: {
        Args: {
          comments: number
          likes: number
          published: string
          saves: number
        }
        Returns: number
      }
      find_or_create_conversation: {
        Args: { app: string; user_a: string; user_b: string }
        Returns: string
      }
      increment_rate_limit: {
        Args: { p_bucket_start: string; p_ip: string }
        Returns: number
      }
      is_participant: { Args: { c: string }; Returns: boolean }
      pick_featured_app: { Args: never; Returns: string }
      refresh_hot_scores: { Args: never; Returns: number }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      brief_entry_mode: "CHAT" | "FORM" | "PASTE"
      brief_resolution:
        | "RESOLVED_WITH_APP"
        | "RESOLVED_WITH_BUILDER"
        | "RESOLVED_ELSEWHERE"
        | "ABANDONED"
      brief_status:
        | "DRAFT"
        | "REFINING"
        | "PARSING"
        | "AWAITING_VALIDATION"
        | "REVIEW_HEALTH"
        | "MATCHING"
        | "PRIVATE"
        | "PUBLIC"
        | "RESOLVED"
        | "EXPIRED"
      brief_timeline: "ASAP" | "WEEKS" | "MONTHS" | "NO_RUSH"
      brief_use_case: "PERSONAL" | "TEAM" | "CLIENT_DELIVERABLE" | "OTHER"
      brief_visibility: "PRIVATE_MATCHED" | "PUBLIC_GALLERY"
      budget_band:
        | "EXPLORATORY"
        | "LT_500"
        | "FROM_500_2K"
        | "FROM_2K_10K"
        | "GT_10K"
        | "OPEN"
      candidate_type: "APP" | "BUILDER"
      commercial_status: "NONE" | "REPORTED_AGREED" | "REPORTED_CLOSED"
      contact_role: "investor" | "partner" | "hire" | "fan"
      contact_status: "pending" | "accepted" | "declined" | "expired"
      match_phase: "APP" | "BUILDER"
      notif_kind:
        | "contact_request"
        | "contact_accepted"
        | "contact_declined"
        | "like"
        | "comment"
        | "comment_reply"
        | "follow"
        | "message"
      solution_type:
        | "EXISTING_APP"
        | "CUSTOM_BUILD"
        | "FORK_AND_MODIFY"
        | "CONSULTING"
      suggestion_status: "PENDING" | "APPLIED" | "DISMISSED" | "AUTO_DISMISSED"
      swipe_action: "PENDING" | "CONNECT" | "SKIP" | "AUTO_SKIPPED"
      technical_level: "NON_TECHNICAL" | "SEMI_TECHNICAL" | "DEVELOPER"
      turn_role: "AGENT" | "USER" | "SYSTEM"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      brief_entry_mode: ["CHAT", "FORM", "PASTE"],
      brief_resolution: [
        "RESOLVED_WITH_APP",
        "RESOLVED_WITH_BUILDER",
        "RESOLVED_ELSEWHERE",
        "ABANDONED",
      ],
      brief_status: [
        "DRAFT",
        "REFINING",
        "PARSING",
        "AWAITING_VALIDATION",
        "REVIEW_HEALTH",
        "MATCHING",
        "PRIVATE",
        "PUBLIC",
        "RESOLVED",
        "EXPIRED",
      ],
      brief_timeline: ["ASAP", "WEEKS", "MONTHS", "NO_RUSH"],
      brief_use_case: ["PERSONAL", "TEAM", "CLIENT_DELIVERABLE", "OTHER"],
      brief_visibility: ["PRIVATE_MATCHED", "PUBLIC_GALLERY"],
      budget_band: [
        "EXPLORATORY",
        "LT_500",
        "FROM_500_2K",
        "FROM_2K_10K",
        "GT_10K",
        "OPEN",
      ],
      candidate_type: ["APP", "BUILDER"],
      commercial_status: ["NONE", "REPORTED_AGREED", "REPORTED_CLOSED"],
      contact_role: ["investor", "partner", "hire", "fan"],
      contact_status: ["pending", "accepted", "declined", "expired"],
      match_phase: ["APP", "BUILDER"],
      notif_kind: [
        "contact_request",
        "contact_accepted",
        "contact_declined",
        "like",
        "comment",
        "comment_reply",
        "follow",
        "message",
      ],
      solution_type: [
        "EXISTING_APP",
        "CUSTOM_BUILD",
        "FORK_AND_MODIFY",
        "CONSULTING",
      ],
      suggestion_status: ["PENDING", "APPLIED", "DISMISSED", "AUTO_DISMISSED"],
      swipe_action: ["PENDING", "CONNECT", "SKIP", "AUTO_SKIPPED"],
      technical_level: ["NON_TECHNICAL", "SEMI_TECHNICAL", "DEVELOPER"],
      turn_role: ["AGENT", "USER", "SYSTEM"],
    },
  },
} as const
