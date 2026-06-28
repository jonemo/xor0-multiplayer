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
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
      game_decks: {
        Row: {
          deck_order: number[]
          deck_pointer: number
          game_id: string
        }
        Insert: {
          deck_order: number[]
          deck_pointer?: number
          game_id: string
        }
        Update: {
          deck_order?: number[]
          deck_pointer?: number
          game_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_decks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
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
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_group: {
        Args: { p_game_id: string; p_values: number[] }
        Returns: Json
      }
      create_game: {
        Args: { p_difficulty: string; p_visibility?: string }
        Returns: {
          code: string
          created_at: string
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
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_solo_leaderboard: {
        Args: { p_difficulty: string; p_limit?: number }
        Returns: {
          cards: number
          created_at: string
          display_name: string
          dots: number
          time_ms: number
          user_id: string
        }[]
      }
      join_game: {
        Args: { p_code: string }
        Returns: {
          code: string
          created_at: string
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
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_quick_match: {
        Args: { p_difficulty: string }
        Returns: {
          code: string
          created_at: string
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
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_game: { Args: { p_game_id: string }; Returns: undefined }
      restart_game: {
        Args: { p_game_id: string }
        Returns: {
          code: string
          created_at: string
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
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_game: {
        Args: { p_game_id: string }
        Returns: {
          code: string
          created_at: string
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
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const

type PublicSchema = Database["public"]

export type GameRow = PublicSchema["Tables"]["games"]["Row"]
export type GamePlayerRow = PublicSchema["Tables"]["game_players"]["Row"]
export type ClaimRow = PublicSchema["Tables"]["claims"]["Row"]
export type ProfileRow = PublicSchema["Tables"]["profiles"]["Row"]
export type SoloScoreRow = PublicSchema["Tables"]["solo_scores"]["Row"]
