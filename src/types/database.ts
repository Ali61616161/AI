// Bu dosya otomatik üretilir, elle düzenlemeyin. Şema değişince: npm run db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      consents: {
        Row: {
          consent: Database['public']['Enums']['consent_type'];
          created_at: string;
          granted: boolean;
          id: number;
          user_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          consent: Database['public']['Enums']['consent_type'];
          created_at?: string;
          granted: boolean;
          id?: never;
          user_id?: string;
          version: string;
        };
        Update: {
          consent?: Database['public']['Enums']['consent_type'];
          created_at?: string;
          granted?: boolean;
          id?: never;
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      day_plans: {
        Row: {
          city: string | null;
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          plan_version_id: string;
          title: string | null;
          trip_id: string;
          weather: Json | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          notes?: string | null;
          plan_version_id: string;
          title?: string | null;
          trip_id: string;
          weather?: Json | null;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          plan_version_id?: string;
          title?: string | null;
          trip_id?: string;
          weather?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'day_plans_plan_version_id_fkey';
            columns: ['plan_version_id'];
            isOneToOne: false;
            referencedRelation: 'plan_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'day_plans_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          confidence: Json | null;
          created_at: string;
          detected_type: Database['public']['Enums']['reservation_type'] | null;
          error: string | null;
          id: string;
          mime_type: string;
          parsed_data: Json | null;
          status: Database['public']['Enums']['document_status'];
          storage_path: string;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          confidence?: Json | null;
          created_at?: string;
          detected_type?: Database['public']['Enums']['reservation_type'] | null;
          error?: string | null;
          id?: string;
          mime_type: string;
          parsed_data?: Json | null;
          status?: Database['public']['Enums']['document_status'];
          storage_path: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          confidence?: Json | null;
          created_at?: string;
          detected_type?: Database['public']['Enums']['reservation_type'] | null;
          error?: string | null;
          id?: string;
          mime_type?: string;
          parsed_data?: Json | null;
          status?: Database['public']['Enums']['document_status'];
          storage_path?: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      emergency_contacts: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          phone: string;
          relation: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          phone: string;
          relation?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string;
          relation?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      expense_shares: {
        Row: {
          expense_id: string;
          id: string;
          is_settled: boolean;
          participant_name: string;
          share_amount: number;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          expense_id: string;
          id?: string;
          is_settled?: boolean;
          participant_name: string;
          share_amount: number;
          user_id?: string | null;
        };
        Update: {
          expense_id?: string;
          id?: string;
          is_settled?: boolean;
          participant_name?: string;
          share_amount?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_shares_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          amount_in_budget_currency: number | null;
          category: Database['public']['Enums']['expense_category'];
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          paid_by: string | null;
          plan_item_id: string | null;
          spent_at: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          amount_in_budget_currency?: number | null;
          category?: Database['public']['Enums']['expense_category'];
          created_at?: string;
          currency: string;
          description?: string | null;
          id?: string;
          paid_by?: string | null;
          plan_item_id?: string | null;
          spent_at?: string;
          trip_id: string;
        };
        Update: {
          amount?: number;
          amount_in_budget_currency?: number | null;
          category?: Database['public']['Enums']['expense_category'];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          paid_by?: string | null;
          plan_item_id?: string | null;
          spent_at?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_plan_item_id_fkey';
            columns: ['plan_item_id'];
            isOneToOne: false;
            referencedRelation: 'plan_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      location_shares: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          last_location: unknown;
          last_seen_at: string | null;
          token: string;
          trip_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          last_location?: unknown;
          last_seen_at?: string | null;
          token?: string;
          trip_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_location?: unknown;
          last_seen_at?: string | null;
          token?: string;
          trip_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_shares_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      match_invites: {
        Row: {
          created_at: string;
          from_user: string;
          google_place_id: string;
          id: string;
          meet_at: string;
          message: string | null;
          place_location: unknown;
          place_name: string;
          responded_at: string | null;
          status: Database['public']['Enums']['invite_status'];
          to_user: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          from_user: string;
          google_place_id: string;
          id?: string;
          meet_at: string;
          message?: string | null;
          place_location?: unknown;
          place_name: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['invite_status'];
          to_user: string;
        };
        Update: {
          created_at?: string;
          from_user?: string;
          google_place_id?: string;
          id?: string;
          meet_at?: string;
          message?: string | null;
          place_location?: unknown;
          place_name?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['invite_status'];
          to_user?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: number;
          invite_id: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: never;
          invite_id: string;
          sender_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: never;
          invite_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_invite_id_fkey';
            columns: ['invite_id'];
            isOneToOne: false;
            referencedRelation: 'match_invites';
            referencedColumns: ['id'];
          },
        ];
      };
      packing_items: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          is_packed: boolean;
          label: string;
          position: number;
          quantity: number;
          source: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_packed?: boolean;
          label: string;
          position?: number;
          quantity?: number;
          source?: string;
          trip_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_packed?: boolean;
          label?: string;
          position?: number;
          quantity?: number;
          source?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'packing_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      place_ratings: {
        Row: {
          created_at: string;
          google_place_id: string | null;
          id: string;
          note: string | null;
          place_name: string;
          plan_item_id: string | null;
          rating: number;
          trip_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          google_place_id?: string | null;
          id?: string;
          note?: string | null;
          place_name: string;
          plan_item_id?: string | null;
          rating: number;
          trip_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          google_place_id?: string | null;
          id?: string;
          note?: string | null;
          place_name?: string;
          plan_item_id?: string | null;
          rating?: number;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_ratings_plan_item_id_fkey';
            columns: ['plan_item_id'];
            isOneToOne: false;
            referencedRelation: 'plan_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'place_ratings_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_items: {
        Row: {
          address: string | null;
          affiliate_partner: string | null;
          booking_url: string | null;
          category: string | null;
          cost_currency: string | null;
          created_at: string;
          day_plan_id: string;
          description: string | null;
          ends_at: string | null;
          estimated_cost: number | null;
          google_place_id: string | null;
          id: string;
          is_indoor: boolean | null;
          is_locked: boolean;
          kind: Database['public']['Enums']['plan_item_kind'];
          location: unknown;
          place_name: string | null;
          position: number;
          priority: number;
          reservation_id: string | null;
          starts_at: string | null;
          status: Database['public']['Enums']['plan_item_status'];
          timezone: string | null;
          title: string;
          trip_id: string;
          visited_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          affiliate_partner?: string | null;
          booking_url?: string | null;
          category?: string | null;
          cost_currency?: string | null;
          created_at?: string;
          day_plan_id: string;
          description?: string | null;
          ends_at?: string | null;
          estimated_cost?: number | null;
          google_place_id?: string | null;
          id?: string;
          is_indoor?: boolean | null;
          is_locked?: boolean;
          kind: Database['public']['Enums']['plan_item_kind'];
          location?: unknown;
          place_name?: string | null;
          position?: number;
          priority?: number;
          reservation_id?: string | null;
          starts_at?: string | null;
          status?: Database['public']['Enums']['plan_item_status'];
          timezone?: string | null;
          title: string;
          trip_id: string;
          visited_at?: string | null;
        };
        Update: {
          address?: string | null;
          affiliate_partner?: string | null;
          booking_url?: string | null;
          category?: string | null;
          cost_currency?: string | null;
          created_at?: string;
          day_plan_id?: string;
          description?: string | null;
          ends_at?: string | null;
          estimated_cost?: number | null;
          google_place_id?: string | null;
          id?: string;
          is_indoor?: boolean | null;
          is_locked?: boolean;
          kind?: Database['public']['Enums']['plan_item_kind'];
          location?: unknown;
          place_name?: string | null;
          position?: number;
          priority?: number;
          reservation_id?: string | null;
          starts_at?: string | null;
          status?: Database['public']['Enums']['plan_item_status'];
          timezone?: string | null;
          title?: string;
          trip_id?: string;
          visited_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_items_day_plan_id_fkey';
            columns: ['day_plan_id'];
            isOneToOne: false;
            referencedRelation: 'day_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_items_reservation_id_fkey';
            columns: ['reservation_id'];
            isOneToOne: false;
            referencedRelation: 'reservations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_limits: {
        Row: {
          feature: Database['public']['Enums']['quota_feature'];
          per_day: number | null;
          per_trip: number | null;
          plan: Database['public']['Enums']['subscription_plan'];
        };
        ComputedFields: never;
        Insert: {
          feature: Database['public']['Enums']['quota_feature'];
          per_day?: number | null;
          per_trip?: number | null;
          plan: Database['public']['Enums']['subscription_plan'];
        };
        Update: {
          feature?: Database['public']['Enums']['quota_feature'];
          per_day?: number | null;
          per_trip?: number | null;
          plan?: Database['public']['Enums']['subscription_plan'];
        };
        Relationships: [];
      };
      plan_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          reason: Database['public']['Enums']['plan_change_reason'];
          summary: string | null;
          trip_end_date: string | null;
          trip_id: string;
          trip_start_date: string | null;
          user_prompt: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          reason: Database['public']['Enums']['plan_change_reason'];
          summary?: string | null;
          trip_end_date?: string | null;
          trip_id: string;
          trip_start_date?: string | null;
          user_prompt?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          reason?: Database['public']['Enums']['plan_change_reason'];
          summary?: string | null;
          trip_end_date?: string | null;
          trip_id?: string;
          trip_start_date?: string | null;
          user_prompt?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_versions_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          birth_year: number | null;
          created_at: string;
          default_budget: Database['public']['Enums']['budget_tier'] | null;
          default_companion: Database['public']['Enums']['companion_type'] | null;
          display_name: string | null;
          gender: string;
          home_country: string | null;
          home_currency: string;
          id: string;
          identity_verified_at: string | null;
          interests: string[];
          onboarding_completed_at: string | null;
          passport_country: string | null;
          preferred_language: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          default_budget?: Database['public']['Enums']['budget_tier'] | null;
          default_companion?: Database['public']['Enums']['companion_type'] | null;
          display_name?: string | null;
          gender?: string;
          home_country?: string | null;
          home_currency?: string;
          id: string;
          identity_verified_at?: string | null;
          interests?: string[];
          onboarding_completed_at?: string | null;
          passport_country?: string | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          default_budget?: Database['public']['Enums']['budget_tier'] | null;
          default_companion?: Database['public']['Enums']['companion_type'] | null;
          display_name?: string | null;
          gender?: string;
          home_country?: string | null;
          home_currency?: string;
          id?: string;
          identity_verified_at?: string | null;
          interests?: string[];
          onboarding_completed_at?: string | null;
          passport_country?: string | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          destination_code: string | null;
          destination_name: string | null;
          details: NonNullable<Json>;
          document_id: string | null;
          end_timezone: string | null;
          ends_at: string | null;
          google_place_id: string | null;
          id: string;
          is_cancelled: boolean;
          location: unknown;
          origin_code: string | null;
          origin_name: string | null;
          provider_name: string | null;
          reference_code: string | null;
          start_timezone: string | null;
          starts_at: string;
          title: string;
          trip_id: string;
          type: Database['public']['Enums']['reservation_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_code?: string | null;
          destination_name?: string | null;
          details?: NonNullable<Json>;
          document_id?: string | null;
          end_timezone?: string | null;
          ends_at?: string | null;
          google_place_id?: string | null;
          id?: string;
          is_cancelled?: boolean;
          location?: unknown;
          origin_code?: string | null;
          origin_name?: string | null;
          provider_name?: string | null;
          reference_code?: string | null;
          start_timezone?: string | null;
          starts_at: string;
          title: string;
          trip_id: string;
          type: Database['public']['Enums']['reservation_type'];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_code?: string | null;
          destination_name?: string | null;
          details?: NonNullable<Json>;
          document_id?: string | null;
          end_timezone?: string | null;
          ends_at?: string | null;
          google_place_id?: string | null;
          id?: string;
          is_cancelled?: boolean;
          location?: unknown;
          origin_code?: string | null;
          origin_name?: string | null;
          provider_name?: string | null;
          reference_code?: string | null;
          start_timezone?: string | null;
          starts_at?: string;
          title?: string;
          trip_id?: string;
          type?: Database['public']['Enums']['reservation_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      social_profiles: {
        Row: {
          approx_location: unknown;
          available_from: string | null;
          available_until: string | null;
          city: string | null;
          country_code: string | null;
          is_visible: boolean;
          looking_for: string[];
          trip_id: string | null;
          updated_at: string;
          user_id: string;
          women_only: boolean;
        };
        ComputedFields: never;
        Insert: {
          approx_location?: unknown;
          available_from?: string | null;
          available_until?: string | null;
          city?: string | null;
          country_code?: string | null;
          is_visible?: boolean;
          looking_for?: string[];
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
          women_only?: boolean;
        };
        Update: {
          approx_location?: unknown;
          available_from?: string | null;
          available_until?: string | null;
          city?: string | null;
          country_code?: string | null;
          is_visible?: boolean;
          looking_for?: string[];
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
          women_only?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'social_profiles_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          original_transaction_id: string | null;
          plan: Database['public']['Enums']['subscription_plan'];
          product_id: string;
          starts_at: string;
          status: Database['public']['Enums']['subscription_status'];
          store: string;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          original_transaction_id?: string | null;
          plan: Database['public']['Enums']['subscription_plan'];
          product_id: string;
          starts_at?: string;
          status: Database['public']['Enums']['subscription_status'];
          store: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          original_transaction_id?: string | null;
          plan?: Database['public']['Enums']['subscription_plan'];
          product_id?: string;
          starts_at?: string;
          status?: Database['public']['Enums']['subscription_status'];
          store?: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_trip_fk';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_destinations: {
        Row: {
          arrive_on: string | null;
          city: string;
          country_code: string | null;
          created_at: string;
          depart_on: string | null;
          google_place_id: string | null;
          id: string;
          location: unknown;
          position: number;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          arrive_on?: string | null;
          city: string;
          country_code?: string | null;
          created_at?: string;
          depart_on?: string | null;
          google_place_id?: string | null;
          id?: string;
          location?: unknown;
          position?: number;
          trip_id: string;
        };
        Update: {
          arrive_on?: string | null;
          city?: string;
          country_code?: string | null;
          created_at?: string;
          depart_on?: string | null;
          google_place_id?: string | null;
          id?: string;
          location?: unknown;
          position?: number;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_destinations_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_members: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['trip_member_role'];
          trip_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['trip_member_role'];
          trip_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['trip_member_role'];
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_members_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_reports: {
        Row: {
          ai_insights: Json | null;
          feedback: string | null;
          generated_at: string;
          overall_rating: number | null;
          route_rating: number | null;
          share_card_path: string | null;
          stats: NonNullable<Json>;
          trip_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_insights?: Json | null;
          feedback?: string | null;
          generated_at?: string;
          overall_rating?: number | null;
          route_rating?: number | null;
          share_card_path?: string | null;
          stats?: NonNullable<Json>;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          ai_insights?: Json | null;
          feedback?: string | null;
          generated_at?: string;
          overall_rating?: number | null;
          route_rating?: number | null;
          share_card_path?: string | null;
          stats?: NonNullable<Json>;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_reports_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: true;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          adults: number;
          budget_amount: number | null;
          budget_currency: string | null;
          budget_tier: Database['public']['Enums']['budget_tier'];
          children: number;
          companion_type: Database['public']['Enums']['companion_type'];
          completed_at: string | null;
          cover_image_url: string | null;
          created_at: string;
          end_date: string | null;
          id: string;
          interests: string[];
          owner_id: string;
          start_date: string | null;
          status: Database['public']['Enums']['trip_status'];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adults?: number;
          budget_amount?: number | null;
          budget_currency?: string | null;
          budget_tier?: Database['public']['Enums']['budget_tier'];
          children?: number;
          companion_type?: Database['public']['Enums']['companion_type'];
          completed_at?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          interests?: string[];
          owner_id?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          adults?: number;
          budget_amount?: number | null;
          budget_currency?: string | null;
          budget_tier?: Database['public']['Enums']['budget_tier'];
          children?: number;
          companion_type?: Database['public']['Enums']['companion_type'];
          completed_at?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          interests?: string[];
          owner_id?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          created_at: string;
          feature: Database['public']['Enums']['quota_feature'];
          id: number;
          trip_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feature: Database['public']['Enums']['quota_feature'];
          id?: never;
          trip_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feature?: Database['public']['Enums']['quota_feature'];
          id?: never;
          trip_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_events_trip_fk';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id?: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          invite_id: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reported_id: string;
          reporter_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          invite_id?: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reported_id: string;
          reporter_id?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          invite_id?: string | null;
          reason?: Database['public']['Enums']['report_reason'];
          reported_id?: string;
          reporter_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_reports_invite_id_fkey';
            columns: ['invite_id'];
            isOneToOne: false;
            referencedRelation: 'match_invites';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_plan_version: { Args: { p_version_id: string }; Returns: undefined };
      apply_trip_dates: {
        Args: { p_days: Json; p_end: string; p_start: string; p_summary?: string; p_trip_id: string };
        Returns: string;
      };
      can_edit_trip: { Args: { p_trip_id: string }; Returns: boolean };
      consume_quota: {
        Args: { p_feature: Database['public']['Enums']['quota_feature']; p_trip_id?: string };
        Returns: {
          allowed: boolean;
          plan: Database['public']['Enums']['subscription_plan'];
          remaining: number;
        }[];
      };
      create_trip_from_documents: {
        Args: {
          p_destinations: Json;
          p_document_ids: string[];
          p_reservations: Json;
          p_trip: Json;
          p_trip_id?: string;
        };
        Returns: string;
      };
      current_plan: {
        Args: { p_trip_id?: string };
        Returns: Database['public']['Enums']['subscription_plan'];
      };
      has_consent: { Args: { p_consent: Database['public']['Enums']['consent_type'] }; Returns: boolean };
      is_blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean };
      is_invite_participant: { Args: { p_invite_id: string; p_require_accepted: boolean }; Returns: boolean };
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean };
      is_trip_owner: { Args: { p_trip_id: string }; Returns: boolean };
      nearby_travelers: {
        Args: { p_radius_km?: number };
        Returns: {
          available_until: string;
          avatar_url: string;
          bio: string;
          city: string;
          display_name: string;
          distance_km: number;
          interests: string[];
          is_verified: boolean;
          looking_for: string[];
          user_id: string;
        }[];
      };
      respond_invite: {
        Args: { p_invite_id: string; p_status: Database['public']['Enums']['invite_status'] };
        Returns: undefined;
      };
      restore_plan_version: { Args: { p_version_id: string }; Returns: undefined };
      save_plan_version: {
        Args: {
          p_days: Json;
          p_reason: Database['public']['Enums']['plan_change_reason'];
          p_summary?: string;
          p_trip_id: string;
          p_user_prompt?: string;
        };
        Returns: string;
      };
      send_invite: {
        Args: {
          p_google_place_id: string;
          p_meet_at: string;
          p_message?: string;
          p_place_lat: number;
          p_place_lng: number;
          p_place_name: string;
          p_to_user: string;
        };
        Returns: string;
      };
    };
    Enums: {
      budget_tier: 'low' | 'mid' | 'lux';
      companion_type: 'solo' | 'couple' | 'family' | 'friends';
      consent_type: 'terms' | 'privacy' | 'location' | 'social_matching' | 'id_verification' | 'marketing';
      document_status: 'uploaded' | 'processing' | 'parsed' | 'confirmed' | 'failed';
      expense_category: 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
      invite_status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
      plan_change_reason: 'initial' | 'dates_changed' | 'replan' | 'crisis' | 'manual_edit';
      plan_item_kind: 'activity' | 'meal' | 'transport' | 'accommodation' | 'free_time' | 'reservation';
      plan_item_status: 'planned' | 'visited' | 'skipped';
      quota_feature: 'document_scan' | 'itinerary_generation' | 'replan' | 'menu_scan' | 'social_invite';
      report_reason: 'harassment' | 'fake_profile' | 'unsafe_behavior' | 'spam' | 'other';
      reservation_type: 'flight' | 'hotel' | 'train' | 'bus' | 'car_rental' | 'event' | 'other';
      subscription_plan: 'free' | 'trip_pass' | 'pro_monthly' | 'pro_yearly';
      subscription_status: 'active' | 'in_grace' | 'cancelled' | 'expired' | 'refunded';
      trip_member_role: 'owner' | 'editor' | 'viewer';
      trip_status: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled';
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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

export const Constants = {
  public: {
    Enums: {
      budget_tier: ['low', 'mid', 'lux'],
      companion_type: ['solo', 'couple', 'family', 'friends'],
      consent_type: ['terms', 'privacy', 'location', 'social_matching', 'id_verification', 'marketing'],
      document_status: ['uploaded', 'processing', 'parsed', 'confirmed', 'failed'],
      expense_category: ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'],
      invite_status: ['pending', 'accepted', 'declined', 'cancelled', 'expired'],
      plan_change_reason: ['initial', 'dates_changed', 'replan', 'crisis', 'manual_edit'],
      plan_item_kind: ['activity', 'meal', 'transport', 'accommodation', 'free_time', 'reservation'],
      plan_item_status: ['planned', 'visited', 'skipped'],
      quota_feature: ['document_scan', 'itinerary_generation', 'replan', 'menu_scan', 'social_invite'],
      report_reason: ['harassment', 'fake_profile', 'unsafe_behavior', 'spam', 'other'],
      reservation_type: ['flight', 'hotel', 'train', 'bus', 'car_rental', 'event', 'other'],
      subscription_plan: ['free', 'trip_pass', 'pro_monthly', 'pro_yearly'],
      subscription_status: ['active', 'in_grace', 'cancelled', 'expired', 'refunded'],
      trip_member_role: ['owner', 'editor', 'viewer'],
      trip_status: ['draft', 'planned', 'active', 'completed', 'cancelled'],
    },
  },
} as const;
