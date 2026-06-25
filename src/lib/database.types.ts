// Generated from the Supabase schema (do not edit by hand).
// Regenerate with the Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      claims: {
        Row: {
          card_values: number[]
          created_at: string
          game_id: string
          id: number
          outcome: string
          player_id: string | null
          user_id: string | null
          valid: boolean
        }
        Insert: {
          card_values: number[]
          created_at?: string
          game_id: string
          id?: never
          outcome: string
          player_id?: string | null
          user_id?: string | null
          valid: boolean
        }
        Update: {
          card_values?: number[]
          created_at?: string
          game_id?: string
          id?: never
          outcome?: string
          player_id?: string | null
          user_id?: string | null
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "claims_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          card_count: number
          cards: number[]
          display_name: string
          dot_count: number
          game_id: string
          id: string
          is_ai: boolean
          joined_at: string
          seat: number
          status: string
          user_id: string | null
        }
        Insert: {
          card_count?: number
          cards?: number[]
          display_name: string
          dot_count?: number
          game_id: string
          id?: string
          is_ai?: boolean
          joined_at?: string
          seat: number
          status?: string
          user_id?: string | null
        }
        Update: {
          card_count?: number
          cards?: number[]
          display_name?: string
          dot_count?: number
          game_id?: string
          id?: string
          is_ai?: boolean
          joined_at?: string
          seat?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          created_at: string
          deck_order: number[]
          deck_pointer: number
          difficulty: string
          finished_at: string | null
          host_id: string
          id: string
          mode: string
          started_at: string | null
          status: string
          table_cards: number[]
          table_size: number
          updated_at: string
          visibility: string
          winner_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          deck_order: number[]
          deck_pointer?: number
          difficulty: string
          finished_at?: string | null
          host_id: string
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          table_cards?: number[]
          table_size: number
          updated_at?: string
          visibility?: string
          winner_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          deck_order?: number[]
          deck_pointer?: number
          difficulty?: string
          finished_at?: string | null
          host_id?: string
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          table_cards?: number[]
          table_size?: number
          updated_at?: string
          visibility?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      solo_scores: {
        Row: {
          cards: number
          created_at: string
          difficulty: string
          dots: number
          id: number
          time_ms: number
          user_id: string
        }
        Insert: {
          cards: number
          created_at?: string
          difficulty: string
          dots: number
          id?: never
          time_ms: number
          user_id: string
        }
        Update: {
          cards?: number
          created_at?: string
          difficulty?: string
          dots?: number
          id?: never
          time_ms?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      claim_group: {
        Args: { p_game_id: string; p_values: number[] }
        Returns: Json
      }
      create_game: {
        Args: { p_difficulty: string; p_visibility?: string }
        Returns: Database["public"]["Tables"]["games"]["Row"]
      }
      join_game: {
        Args: { p_code: string }
        Returns: Database["public"]["Tables"]["games"]["Row"]
      }
      join_quick_match: {
        Args: { p_difficulty: string }
        Returns: Database["public"]["Tables"]["games"]["Row"]
      }
      leave_game: { Args: { p_game_id: string }; Returns: undefined }
      start_game: {
        Args: { p_game_id: string }
        Returns: Database["public"]["Tables"]["games"]["Row"]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type GameRow = PublicSchema["Tables"]["games"]["Row"]
export type GamePlayerRow = PublicSchema["Tables"]["game_players"]["Row"]
export type ClaimRow = PublicSchema["Tables"]["claims"]["Row"]
export type ProfileRow = PublicSchema["Tables"]["profiles"]["Row"]
export type SoloScoreRow = PublicSchema["Tables"]["solo_scores"]["Row"]
