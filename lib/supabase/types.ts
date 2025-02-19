// lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          updated_at: string;
          username: string | null;
          native_language: any;
          learning_languages: any[];
          current_levels: any;
          daily_streak: number | null;
          last_practice: string | null;
          settings: any | null;
        };
        Insert: {
          id: string;
          updated_at?: string;
          username?: string | null;
          native_language?: any;
          learning_languages?: any[];
          current_levels?: any;
          daily_streak?: number | null;
          last_practice?: string | null;
          settings?: any | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      scenarios: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          title: string;
          description: string;
          category: string;
          difficulty: string;
          target_language: Json;
          persona: Json;
          is_public: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          title: string;
          description: string;
          category: string;
          difficulty: string;
          target_language: Json;
          persona: Json;
          is_public?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["scenarios"]["Insert"]>;
      };
      chat_sessions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          scenario_id: string;
          messages: Json[];
          source_language: Json;
          target_language: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          scenario_id: string;
          messages?: Json[];
          source_language: Json;
          target_language: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["chat_sessions"]["Insert"]
        >;
      };
    };
  };
}
