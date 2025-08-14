export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)";
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
      holdings: {
        Row: {
          archived_at: string | null;
          category_code: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_archived: boolean;
          name: string;
          symbol_id: string | null;
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
          is_archived?: boolean;
          name: string;
          symbol_id?: string | null;
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
          is_archived?: boolean;
          name?: string;
          symbol_id?: string | null;
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
          {
            foreignKeyName: "holdings_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "symbols";
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
          created_at: string;
          date: string;
          description: string | null;
          holding_id: string;
          id: string;
          quantity: number;
          unit_value: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id: string;
          id?: string;
          quantity: number;
          unit_value: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          quantity?: number;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
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
    Enums: {},
  },
} as const;
