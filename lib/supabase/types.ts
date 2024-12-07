// lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string
          username: string
          native_language: Json
          learning_languages: Json[]
          current_levels: Json
          daily_streak: number
          last_practice: string | null
          settings: Json
        }
        Insert: {
          id: string
          updated_at?: string
          username: string
          native_language: Json
          learning_languages?: Json[]
          current_levels?: Json
          daily_streak?: number
          last_practice?: string | null
          settings?: Json
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      scenarios: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string | null
          title: string
          description: string
          category: string
          difficulty: string
          target_language: Json
          persona: Json
          is_public: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          title: string
          description: string
          category: string
          difficulty: string
          target_language: Json
          persona: Json
          is_public?: boolean
        }
        Update: Partial<Database['public']['Tables']['scenarios']['Insert']>
      }
      chat_sessions: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          scenario_id: string
          messages: Json[]
          source_language: Json
          target_language: Json
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          scenario_id: string
          messages?: Json[]
          source_language: Json
          target_language: Json
        }
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>
      }
    }
  }
}