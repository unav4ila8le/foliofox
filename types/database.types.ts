export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      asset_categories: {
        Row: {
          code: string;
          description: string | null;
          display_order: number;
          name: string;
        };
        Insert: {
          code: string;
          description?: string | null;
          display_order: number;
          name: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          display_order?: number;
          name?: string;
        };
        Relationships: [];
      };
      conversation_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          model: string | null;
          role: Database["public"]["Enums"]["conversation_role"];
          usage_tokens: number | null;
          user_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          model?: string | null;
          role: Database["public"]["Enums"]["conversation_role"];
          usage_tokens?: number | null;
          user_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          model?: string | null;
          role?: Database["public"]["Enums"]["conversation_role"];
          usage_tokens?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          alphabetic_code: string;
          minor_unit: number;
          name: string;
          numeric_code: number;
        };
        Insert: {
          alphabetic_code: string;
          minor_unit: number;
          name: string;
          numeric_code: number;
        };
        Update: {
          alphabetic_code?: string;
          minor_unit?: number;
          name?: string;
          numeric_code?: number;
        };
        Relationships: [];
      };
      dividend_events: {
        Row: {
          created_at: string;
          currency: string;
          event_date: string;
          gross_amount: number;
          id: string;
          source: string;
          symbol_id: string;
        };
        Insert: {
          created_at?: string;
          currency: string;
          event_date: string;
          gross_amount: number;
          id?: string;
          source?: string;
          symbol_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          event_date?: string;
          gross_amount?: number;
          id?: string;
          source?: string;
          symbol_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dividend_events_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
          {
            foreignKeyName: "dividend_events_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
      dividends: {
        Row: {
          created_at: string;
          dividend_yield: number | null;
          ex_dividend_date: string | null;
          forward_annual_dividend: number | null;
          inferred_frequency: string | null;
          last_dividend_date: string | null;
          symbol_id: string;
          trailing_ttm_dividend: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dividend_yield?: number | null;
          ex_dividend_date?: string | null;
          forward_annual_dividend?: number | null;
          inferred_frequency?: string | null;
          last_dividend_date?: string | null;
          symbol_id: string;
          trailing_ttm_dividend?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dividend_yield?: number | null;
          ex_dividend_date?: string | null;
          forward_annual_dividend?: number | null;
          inferred_frequency?: string | null;
          last_dividend_date?: string | null;
          symbol_id?: string;
          trailing_ttm_dividend?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dividends_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: true;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_holdings: {
        Row: {
          created_at: string;
          domain_id: string;
          holding_id: string;
        };
        Insert: {
          created_at?: string;
          domain_id: string;
          holding_id: string;
        };
        Update: {
          created_at?: string;
          domain_id?: string;
          holding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "domain_holdings_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: true;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_valuations: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          price: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          id: string;
          price: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          price?: number;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          base_currency: string;
          created_at: string;
          date: string;
          id: string;
          rate: number;
          target_currency: string;
        };
        Insert: {
          base_currency: string;
          created_at?: string;
          date?: string;
          id?: string;
          rate: number;
          target_currency: string;
        };
        Update: {
          base_currency?: string;
          created_at?: string;
          date?: string;
          id?: string;
          rate?: number;
          target_currency?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_currency_fkey";
            columns: ["base_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
          {
            foreignKeyName: "exchange_rates_target_currency_fkey";
            columns: ["target_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
        ];
      };
      feedback: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          resolved: boolean;
          type: Database["public"]["Enums"]["feedback_type"];
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          resolved?: boolean;
          type: Database["public"]["Enums"]["feedback_type"];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          resolved?: boolean;
          type?: Database["public"]["Enums"]["feedback_type"];
          user_id?: string | null;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          archived_at: string | null;
          category_code: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          name: string;
          source: Database["public"]["Enums"]["holding_source"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          category_code?: string;
          created_at?: string;
          currency: string;
          description?: string | null;
          id?: string;
          name: string;
          source?: Database["public"]["Enums"]["holding_source"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          category_code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          name?: string;
          source?: Database["public"]["Enums"]["holding_source"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "holdings_category_code_fkey";
            columns: ["category_code"];
            isOneToOne: false;
            referencedRelation: "asset_categories";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "holdings_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
        ];
      };
      news: {
        Row: {
          created_at: string;
          id: string;
          link: string;
          published_at: string;
          publisher: string;
          related_symbol_ids: string[] | null;
          title: string;
          updated_at: string;
          yahoo_uuid: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          link: string;
          published_at: string;
          publisher: string;
          related_symbol_ids?: string[] | null;
          title: string;
          updated_at?: string;
          yahoo_uuid: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          link?: string;
          published_at?: string;
          publisher?: string;
          related_symbol_ids?: string[] | null;
          title?: string;
          updated_at?: string;
          yahoo_uuid?: string;
        };
        Relationships: [];
      };
      portfolio_records: {
        Row: {
          created_at: string;
          date: string;
          description: string | null;
          id: string;
          position_id: string;
          quantity: number;
          type: Database["public"]["Enums"]["portfolio_record_type"];
          unit_value: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          description?: string | null;
          id?: string;
          position_id: string;
          quantity: number;
          type: Database["public"]["Enums"]["portfolio_record_type"];
          unit_value: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          id?: string;
          position_id?: string;
          quantity?: number;
          type?: Database["public"]["Enums"]["portfolio_record_type"];
          unit_value?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portfolio_records_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      position_categories: {
        Row: {
          description: string | null;
          display_order: number;
          id: string;
          name: string;
          position_type: Database["public"]["Enums"]["position_type"];
        };
        Insert: {
          description?: string | null;
          display_order: number;
          id: string;
          name: string;
          position_type: Database["public"]["Enums"]["position_type"];
        };
        Update: {
          description?: string | null;
          display_order?: number;
          id?: string;
          name?: string;
          position_type?: Database["public"]["Enums"]["position_type"];
        };
        Relationships: [];
      };
      position_snapshots: {
        Row: {
          cost_basis_per_unit: number | null;
          created_at: string;
          date: string;
          id: string;
          portfolio_record_id: string | null;
          position_id: string;
          quantity: number;
          unit_value: number;
          user_id: string;
        };
        Insert: {
          cost_basis_per_unit?: number | null;
          created_at?: string;
          date: string;
          id?: string;
          portfolio_record_id?: string | null;
          position_id: string;
          quantity: number;
          unit_value: number;
          user_id: string;
        };
        Update: {
          cost_basis_per_unit?: number | null;
          created_at?: string;
          date?: string;
          id?: string;
          portfolio_record_id?: string | null;
          position_id?: string;
          quantity?: number;
          unit_value?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "position_snapshots_portfolio_record_id_fkey";
            columns: ["portfolio_record_id"];
            isOneToOne: false;
            referencedRelation: "portfolio_records";
            referencedColumns: ["id"];
          },
        ];
      };
      position_sources: {
        Row: {
          created_at: string;
          id: string;
          type: Database["public"]["Enums"]["position_source_type"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          type: Database["public"]["Enums"]["position_source_type"];
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database["public"]["Enums"]["position_source_type"];
        };
        Relationships: [];
      };
      positions: {
        Row: {
          archived_at: string | null;
          category_id: string;
          created_at: string;
          currency: string;
          id: string;
          name: string;
          source_id: string | null;
          type: Database["public"]["Enums"]["position_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          category_id?: string;
          created_at?: string;
          currency: string;
          id?: string;
          name: string;
          source_id?: string | null;
          type: Database["public"]["Enums"]["position_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          name?: string;
          source_id?: string | null;
          type?: Database["public"]["Enums"]["position_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "position_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "positions_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
          {
            foreignKeyName: "positions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "position_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "positions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "position_sources_flat";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_currency: string;
          updated_at: string;
          user_id: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_currency?: string;
          updated_at?: string;
          user_id: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_currency?: string;
          updated_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_display_currency_fkey";
            columns: ["display_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
        ];
      };
      quotes: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          price: number;
          symbol_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          price: number;
          symbol_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          price?: number;
          symbol_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symbol_prices_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
      records: {
        Row: {
          cost_basis_per_unit: number | null;
          created_at: string;
          date: string;
          description: string | null;
          holding_id: string;
          id: string;
          quantity: number;
          transaction_id: string | null;
          unit_value: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cost_basis_per_unit?: number | null;
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id: string;
          id?: string;
          quantity: number;
          transaction_id?: string | null;
          unit_value: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cost_basis_per_unit?: number | null;
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          quantity?: number;
          transaction_id?: string | null;
          unit_value?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "records_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "records_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      source_domains: {
        Row: {
          domain_id: string;
          id: string;
        };
        Insert: {
          domain_id: string;
          id: string;
        };
        Update: {
          domain_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_domains_position_source_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "position_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_domains_position_source_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "position_sources_flat";
            referencedColumns: ["id"];
          },
        ];
      };
      source_symbols: {
        Row: {
          id: string;
          symbol_id: string;
        };
        Insert: {
          id: string;
          symbol_id: string;
        };
        Update: {
          id?: string;
          symbol_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_symbols_position_source_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "position_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_symbols_position_source_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "position_sources_flat";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_symbols_symbol_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
      symbol_holdings: {
        Row: {
          created_at: string;
          holding_id: string;
          symbol_id: string;
        };
        Insert: {
          created_at?: string;
          holding_id: string;
          symbol_id: string;
        };
        Update: {
          created_at?: string;
          holding_id?: string;
          symbol_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symbol_holdings_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: true;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "symbol_holdings_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
      symbols: {
        Row: {
          created_at: string;
          currency: string;
          exchange: string | null;
          id: string;
          industry: string | null;
          long_name: string | null;
          quote_type: string;
          sector: string | null;
          short_name: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency: string;
          exchange?: string | null;
          id: string;
          industry?: string | null;
          long_name?: string | null;
          quote_type: string;
          sector?: string | null;
          short_name?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          exchange?: string | null;
          id?: string;
          industry?: string | null;
          long_name?: string | null;
          quote_type?: string;
          sector?: string | null;
          short_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symbols_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
        ];
      };
      transactions: {
        Row: {
          created_at: string | null;
          date: string;
          description: string | null;
          holding_id: string;
          id: string;
          quantity: number;
          type: Database["public"]["Enums"]["transaction_type"];
          unit_value: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          description?: string | null;
          holding_id: string;
          id?: string;
          quantity: number;
          type: Database["public"]["Enums"]["transaction_type"];
          unit_value: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          quantity?: number;
          type?: Database["public"]["Enums"]["transaction_type"];
          unit_value?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      position_sources_flat: {
        Row: {
          domain_id: string | null;
          id: string | null;
          symbol_id: string | null;
          type: Database["public"]["Enums"]["position_source_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "source_symbols_symbol_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      conversation_role: "system" | "user" | "assistant" | "tool";
      feedback_type: "issue" | "idea" | "other";
      holding_source: "custom" | "symbol" | "domain";
      portfolio_record_type: "buy" | "sell" | "update";
      position_source_type: "symbol" | "domain";
      position_type: "asset" | "liability";
      transaction_type: "buy" | "sell" | "update" | "deposit" | "withdrawal";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      conversation_role: ["system", "user", "assistant", "tool"],
      feedback_type: ["issue", "idea", "other"],
      holding_source: ["custom", "symbol", "domain"],
      portfolio_record_type: ["buy", "sell", "update"],
      position_source_type: ["symbol", "domain"],
      position_type: ["asset", "liability"],
      transaction_type: ["buy", "sell", "update", "deposit", "withdrawal"],
    },
  },
} as const;
