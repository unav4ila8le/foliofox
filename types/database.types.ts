export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          order: number
          parts: Json
          role: Database["public"]["Enums"]["conversation_role"]
          usage_tokens: number | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          order?: number
          parts?: Json
          role: Database["public"]["Enums"]["conversation_role"]
          usage_tokens?: number | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          order?: number
          parts?: Json
          role?: Database["public"]["Enums"]["conversation_role"]
          usage_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          alphabetic_code: string
          minor_unit: number
          name: string
          numeric_code: number
        }
        Insert: {
          alphabetic_code: string
          minor_unit: number
          name: string
          numeric_code: number
        }
        Update: {
          alphabetic_code?: string
          minor_unit?: number
          name?: string
          numeric_code?: number
        }
        Relationships: []
      }
      dividend_events: {
        Row: {
          created_at: string
          currency: string
          event_date: string
          gross_amount: number
          id: string
          source: string
          symbol_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          event_date: string
          gross_amount: number
          id?: string
          source?: string
          symbol_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          event_date?: string
          gross_amount?: number
          id?: string
          source?: string
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividend_events_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
          {
            foreignKeyName: "dividend_events_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      dividends: {
        Row: {
          created_at: string
          dividend_yield: number | null
          dividends_checked_at: string | null
          ex_dividend_date: string | null
          forward_annual_dividend: number | null
          inferred_frequency: string | null
          last_dividend_date: string | null
          pays_dividends: boolean | null
          symbol_id: string
          trailing_ttm_dividend: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dividend_yield?: number | null
          dividends_checked_at?: string | null
          ex_dividend_date?: string | null
          forward_annual_dividend?: number | null
          inferred_frequency?: string | null
          last_dividend_date?: string | null
          pays_dividends?: boolean | null
          symbol_id: string
          trailing_ttm_dividend?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dividend_yield?: number | null
          dividends_checked_at?: string | null
          ex_dividend_date?: string | null
          forward_annual_dividend?: number | null
          inferred_frequency?: string | null
          last_dividend_date?: string | null
          pays_dividends?: boolean | null
          symbol_id?: string
          trailing_ttm_dividend?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: true
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_valuations: {
        Row: {
          created_at: string
          date: string
          id: string
          price: number
        }
        Insert: {
          created_at?: string
          date: string
          id: string
          price: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          price?: number
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          date: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          date?: string
          id?: string
          rate: number
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          date?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
          {
            foreignKeyName: "exchange_rates_target_currency_fkey"
            columns: ["target_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          resolved: boolean
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          type: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      financial_profiles: {
        Row: {
          about: string | null
          age_band: Database["public"]["Enums"]["age_band"] | null
          created_at: string
          id: string
          income_amount: number | null
          income_currency: string | null
          risk_preference: Database["public"]["Enums"]["risk_preference"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string | null
          age_band?: Database["public"]["Enums"]["age_band"] | null
          created_at?: string
          id?: string
          income_amount?: number | null
          income_currency?: string | null
          risk_preference?:
            | Database["public"]["Enums"]["risk_preference"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string | null
          age_band?: Database["public"]["Enums"]["age_band"] | null
          created_at?: string
          id?: string
          income_amount?: number | null
          income_currency?: string | null
          risk_preference?:
            | Database["public"]["Enums"]["risk_preference"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_profiles_income_currency_fkey"
            columns: ["income_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
          {
            foreignKeyName: "financial_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financial_scenarios: {
        Row: {
          created_at: string
          engine_version: number
          events: Json
          id: string
          initial_balance: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engine_version?: number
          events?: Json
          id?: string
          initial_balance?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engine_version?: number
          events?: Json
          id?: string
          initial_balance?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_scenarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      news: {
        Row: {
          created_at: string
          id: string
          link: string
          published_at: string
          publisher: string
          related_symbol_ids: string[] | null
          title: string
          updated_at: string
          yahoo_uuid: string
        }
        Insert: {
          created_at?: string
          id?: string
          link: string
          published_at: string
          publisher: string
          related_symbol_ids?: string[] | null
          title: string
          updated_at?: string
          yahoo_uuid: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string
          published_at?: string
          publisher?: string
          related_symbol_ids?: string[] | null
          title?: string
          updated_at?: string
          yahoo_uuid?: string
        }
        Relationships: []
      }
      portfolio_records: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          position_id: string
          quantity: number
          type: Database["public"]["Enums"]["portfolio_record_type"]
          unit_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          position_id: string
          quantity: number
          type: Database["public"]["Enums"]["portfolio_record_type"]
          unit_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          position_id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["portfolio_record_type"]
          unit_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      position_categories: {
        Row: {
          description: string | null
          display_order: number
          id: string
          name: string
          position_type: Database["public"]["Enums"]["position_type"]
        }
        Insert: {
          description?: string | null
          display_order: number
          id: string
          name: string
          position_type: Database["public"]["Enums"]["position_type"]
        }
        Update: {
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          position_type?: Database["public"]["Enums"]["position_type"]
        }
        Relationships: []
      }
      position_snapshots: {
        Row: {
          cost_basis_per_unit: number | null
          created_at: string
          date: string
          id: string
          portfolio_record_id: string | null
          position_id: string
          quantity: number
          unit_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_basis_per_unit?: number | null
          created_at?: string
          date: string
          id?: string
          portfolio_record_id?: string | null
          position_id: string
          quantity: number
          unit_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_basis_per_unit?: number | null
          created_at?: string
          date?: string
          id?: string
          portfolio_record_id?: string | null
          position_id?: string
          quantity?: number
          unit_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_snapshots_portfolio_record_id_fkey"
            columns: ["portfolio_record_id"]
            isOneToOne: true
            referencedRelation: "portfolio_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_snapshots_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          archived_at: string | null
          capital_gains_tax_rate: number | null
          category_id: string
          created_at: string
          currency: string
          description: string | null
          domain_id: string | null
          id: string
          name: string
          symbol_id: string | null
          type: Database["public"]["Enums"]["position_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          capital_gains_tax_rate?: number | null
          category_id?: string
          created_at?: string
          currency: string
          description?: string | null
          domain_id?: string | null
          id?: string
          name: string
          symbol_id?: string | null
          type: Database["public"]["Enums"]["position_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          capital_gains_tax_rate?: number | null
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          name?: string
          symbol_id?: string | null
          type?: Database["public"]["Enums"]["position_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "position_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
          {
            foreignKeyName: "positions_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          data_sharing_consent: boolean
          display_currency: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          data_sharing_consent?: boolean
          display_currency?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          data_sharing_consent?: boolean
          display_currency?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_display_currency_fkey"
            columns: ["display_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
        ]
      }
      public_portfolios: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          date: string
          id: string
          price: number
          symbol_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          price: number
          symbol_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          price?: number
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_prices_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_aliases: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_primary: boolean
          source: string
          symbol_id: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          symbol_id: string
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          symbol_id?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_aliases_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      symbols: {
        Row: {
          created_at: string
          currency: string
          exchange: string | null
          id: string
          industry: string | null
          last_quote_at: string | null
          long_name: string | null
          quote_type: string
          sector: string | null
          short_name: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          exchange?: string | null
          id?: string
          industry?: string | null
          last_quote_at?: string | null
          long_name?: string | null
          quote_type: string
          sector?: string | null
          short_name?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          exchange?: string | null
          id?: string
          industry?: string | null
          last_quote_at?: string | null
          long_name?: string | null
          quote_type?: string
          sector?: string | null
          short_name?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbols_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["alphabetic_code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_username_available: { Args: { name: string }; Returns: boolean }
    }
    Enums: {
      age_band: "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+"
      conversation_role: "system" | "user" | "assistant" | "tool"
      feedback_type: "issue" | "idea" | "other"
      portfolio_record_type: "buy" | "sell" | "update"
      position_type: "asset" | "liability"
      risk_preference:
        | "very_conservative"
        | "conservative"
        | "moderate"
        | "aggressive"
        | "very_aggressive"
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
      age_band: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
      conversation_role: ["system", "user", "assistant", "tool"],
      feedback_type: ["issue", "idea", "other"],
      portfolio_record_type: ["buy", "sell", "update"],
      position_type: ["asset", "liability"],
      risk_preference: [
        "very_conservative",
        "conservative",
        "moderate",
        "aggressive",
        "very_aggressive",
      ],
    },
  },
} as const

