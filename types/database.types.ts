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
          display_order: number | null;
          name: string;
        };
        Insert: {
          code: string;
          description?: string | null;
          display_order?: number | null;
          name: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          display_order?: number | null;
          name?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          alphabetic_code: string;
          currency: string;
          minor_unit: number;
          numeric_code: number;
        };
        Insert: {
          alphabetic_code: string;
          currency: string;
          minor_unit: number;
          numeric_code: number;
        };
        Update: {
          alphabetic_code?: string;
          currency?: string;
          minor_unit?: number;
          numeric_code?: number;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          category_code: string;
          created_at: string;
          currency: string;
          current_value: number;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_code?: string;
          created_at?: string;
          currency: string;
          current_value?: number;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category_code?: string;
          created_at?: string;
          currency?: string;
          current_value?: number;
          description?: string | null;
          id?: string;
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
    Enums: {},
  },
} as const;
