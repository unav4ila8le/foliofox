export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
      holding_quantities: {
        Row: {
          created_at: string;
          date: string;
          description: string | null;
          holding_id: string;
          id: string;
          quantity: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          quantity: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "holding_quantities_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
        ];
      };
      holding_valuations: {
        Row: {
          created_at: string;
          date: string;
          description: string | null;
          holding_id: string;
          id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          holding_id?: string;
          id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "holding_valuations_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
        ];
      };
      holdings: {
        Row: {
          archived_at: string | null;
          category_code: string;
          created_at: string;
          currency: string;
          current_quantity: number;
          current_value: number;
          description: string | null;
          id: string;
          is_archived: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          category_code?: string;
          created_at?: string;
          currency: string;
          current_quantity?: number;
          current_value?: number;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          category_code?: string;
          created_at?: string;
          currency?: string;
          current_quantity?: number;
          current_value?: number;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          name?: string;
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
      transactions: {
        Row: {
          created_at: string;
          currency: string | null;
          date: string;
          description: string | null;
          destination_holding_id: string | null;
          id: string;
          quantity: number;
          source_holding_id: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at: string;
          user_id: string;
          value: number | null;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          date?: string;
          description?: string | null;
          destination_holding_id?: string | null;
          id?: string;
          quantity: number;
          source_holding_id?: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id: string;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          date?: string;
          description?: string | null;
          destination_holding_id?: string | null;
          id?: string;
          quantity?: number;
          source_holding_id?: string | null;
          type?: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["alphabetic_code"];
          },
          {
            foreignKeyName: "transactions_destination_holding_id_fkey";
            columns: ["destination_holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_source_holding_id_fkey";
            columns: ["source_holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
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
      transaction_type: "purchase" | "sale" | "transfer" | "update";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      transaction_type: ["purchase", "sale", "transfer", "update"],
    },
  },
} as const;
