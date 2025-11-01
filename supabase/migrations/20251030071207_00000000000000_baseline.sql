SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
COMMENT ON SCHEMA "public" IS 'standard public schema';
CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE TYPE "public"."conversation_role" AS ENUM (
    'system',
    'user',
    'assistant',
    'tool'
);
ALTER TYPE "public"."conversation_role" OWNER TO "postgres";
CREATE TYPE "public"."feedback_type" AS ENUM (
    'issue',
    'idea',
    'other'
);
ALTER TYPE "public"."feedback_type" OWNER TO "postgres";
CREATE TYPE "public"."portfolio_record_type" AS ENUM (
    'buy',
    'sell',
    'update'
);
ALTER TYPE "public"."portfolio_record_type" OWNER TO "postgres";
CREATE TYPE "public"."position_type" AS ENUM (
    'asset',
    'liability'
);
ALTER TYPE "public"."position_type" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$begin
    insert into public.profiles (user_id, username)
    values (
        new.id,
        new.raw_user_meta_data->>'username'
    );
    return new;
end;$$;
ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
SET default_tablespace = '';
SET default_table_access_method = "heap";
CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."conversation_role" NOT NULL,
    "content" "text" NOT NULL,
    "model" "text",
    "usage_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."conversations" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "alphabetic_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "numeric_code" smallint NOT NULL,
    "minor_unit" smallint NOT NULL,
    CONSTRAINT "currencies_alphabetic_code_check" CHECK (("length"("alphabetic_code") = 3)),
    CONSTRAINT "currencies_numeric_code_check" CHECK ((("numeric_code" >= 1) AND ("numeric_code" <= 999)))
);
ALTER TABLE "public"."currencies" OWNER TO "postgres";
COMMENT ON TABLE "public"."currencies" IS 'List of currencies as defined by ISO 4217 (https://datahub.io/core/currency-codes)';
COMMENT ON COLUMN "public"."currencies"."alphabetic_code" IS '3 digit alphabetic code for the currency';
COMMENT ON COLUMN "public"."currencies"."name" IS 'Name of the currency';
COMMENT ON COLUMN "public"."currencies"."numeric_code" IS '3 digit numeric code';
CREATE TABLE IF NOT EXISTS "public"."dividend_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "symbol_id" "text" NOT NULL,
    "event_date" timestamp with time zone NOT NULL,
    "gross_amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "source" "text" DEFAULT 'yahoo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."dividend_events" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."dividends" (
    "symbol_id" "text" NOT NULL,
    "forward_annual_dividend" numeric,
    "trailing_ttm_dividend" numeric,
    "dividend_yield" numeric,
    "ex_dividend_date" timestamp with time zone,
    "last_dividend_date" "date",
    "inferred_frequency" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."dividends" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."domain_valuations" (
    "id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."domain_valuations" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "date" "date" DEFAULT "now"() NOT NULL,
    "base_currency" "text" NOT NULL,
    "target_currency" "text" NOT NULL,
    "rate" numeric(20,10) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "type" "public"."feedback_type" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL
);
ALTER TABLE "public"."feedback" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."news" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "yahoo_uuid" "text" NOT NULL,
    "related_symbol_ids" "text"[] DEFAULT '{}'::"text"[],
    "title" "text" NOT NULL,
    "publisher" "text" NOT NULL,
    "link" "text" NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."news" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."portfolio_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "type" "public"."portfolio_record_type" NOT NULL,
    "date" "date" DEFAULT "now"() NOT NULL,
    "quantity" numeric NOT NULL,
    "unit_value" numeric NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."portfolio_records" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."position_categories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer NOT NULL,
    "position_type" "public"."position_type" NOT NULL
);
ALTER TABLE "public"."position_categories" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."position_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit_value" numeric NOT NULL,
    "cost_basis_per_unit" numeric,
    "portfolio_record_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."position_snapshots" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."position_type" NOT NULL,
    "name" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "category_id" "text" DEFAULT 'other'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "symbol_id" "text",
    "domain_id" "text"
);
ALTER TABLE "public"."positions" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "display_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_currency" CHECK (("display_currency" ~ '^[A-Z]{3}$'::"text"))
);
ALTER TABLE "public"."profiles" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "symbol_id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."quotes" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."symbols" (
    "id" "text" NOT NULL,
    "short_name" "text",
    "long_name" "text",
    "exchange" "text",
    "sector" "text",
    "industry" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quote_type" "text" NOT NULL,
    "currency" "text" NOT NULL
);
ALTER TABLE "public"."symbols" OWNER TO "postgres";
ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("alphabetic_code");
ALTER TABLE ONLY "public"."dividend_events"
    ADD CONSTRAINT "dividend_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."dividend_events"
    ADD CONSTRAINT "dividend_events_symbol_id_event_date_key" UNIQUE ("symbol_id", "event_date");
ALTER TABLE ONLY "public"."dividends"
    ADD CONSTRAINT "dividends_pkey" PRIMARY KEY ("symbol_id");
ALTER TABLE ONLY "public"."domain_valuations"
    ADD CONSTRAINT "domain_valuations_pkey" PRIMARY KEY ("id", "date");
ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_date_base_currency_target_currency_key" UNIQUE ("date", "base_currency", "target_currency");
ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_yahoo_uuid_key" UNIQUE ("yahoo_uuid");
ALTER TABLE ONLY "public"."portfolio_records"
    ADD CONSTRAINT "portfolio_records_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."position_categories"
    ADD CONSTRAINT "position_categories_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."position_snapshots"
    ADD CONSTRAINT "position_snapshots_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");
ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "symbol_prices_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."symbols"
    ADD CONSTRAINT "symbols_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "unique_symbol_date" UNIQUE ("symbol_id", "date");
ALTER TABLE ONLY "public"."position_snapshots"
    ADD CONSTRAINT "uq_position_snapshots_portfolio_record" UNIQUE ("portfolio_record_id");
CREATE INDEX "dividend_events_created_at_idx" ON "public"."dividend_events" USING "btree" ("created_at" DESC);
CREATE INDEX "dividend_events_currency_idx" ON "public"."dividend_events" USING "btree" ("currency");
CREATE INDEX "dividends_updated_at_idx" ON "public"."dividends" USING "btree" ("updated_at" DESC);
CREATE INDEX "exchange_rates_base_currency_target_currency_date_desc_idx" ON "public"."exchange_rates" USING "btree" ("base_currency", "target_currency", "date" DESC);
CREATE INDEX "exchange_rates_target_currency_idx" ON "public"."exchange_rates" USING "btree" ("target_currency");
CREATE INDEX "idx_conversation_messages_user_id" ON "public"."conversation_messages" USING "btree" ("user_id");
CREATE INDEX "idx_conversations_user_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);
CREATE INDEX "idx_dividend_events_event_date_desc" ON "public"."dividend_events" USING "btree" ("event_date" DESC);
CREATE INDEX "idx_dividend_events_symbol_date_desc" ON "public"."dividend_events" USING "btree" ("symbol_id", "event_date" DESC);
CREATE INDEX "idx_domain_valuations_date_desc" ON "public"."domain_valuations" USING "btree" ("date" DESC);
CREATE INDEX "idx_messages_conversation_time" ON "public"."conversation_messages" USING "btree" ("conversation_id", "created_at");
CREATE INDEX "idx_news_related_symbols" ON "public"."news" USING "gin" ("related_symbol_ids");
CREATE INDEX "idx_position_snapshots_portfolio_record_id" ON "public"."position_snapshots" USING "btree" ("portfolio_record_id");
CREATE INDEX "idx_position_snapshots_position_date_created_desc" ON "public"."position_snapshots" USING "btree" ("position_id", "date" DESC, "created_at" DESC);
CREATE INDEX "idx_position_snapshots_user_date_desc" ON "public"."position_snapshots" USING "btree" ("user_id", "date" DESC);
CREATE INDEX "idx_positions_category_id" ON "public"."positions" USING "btree" ("category_id");
CREATE INDEX "idx_positions_currency" ON "public"."positions" USING "btree" ("currency");
CREATE INDEX "idx_positions_domain_id" ON "public"."positions" USING "btree" ("domain_id");
CREATE INDEX "idx_positions_symbol_id" ON "public"."positions" USING "btree" ("symbol_id");
CREATE INDEX "idx_positions_user_archived" ON "public"."positions" USING "btree" ("user_id", "archived_at");
CREATE INDEX "idx_pr_pos_date_created" ON "public"."portfolio_records" USING "btree" ("position_id", "date" DESC, "created_at" DESC);
CREATE INDEX "idx_pr_user_created" ON "public"."portfolio_records" USING "btree" ("user_id", "created_at" DESC);
CREATE INDEX "idx_pr_user_pos_date" ON "public"."portfolio_records" USING "btree" ("user_id", "position_id", "date" DESC);
CREATE INDEX "idx_quotes_date_desc" ON "public"."quotes" USING "btree" ("date" DESC);
CREATE INDEX "news_created_at_idx" ON "public"."news" USING "btree" ("created_at" DESC);
CREATE INDEX "news_published_at_idx" ON "public"."news" USING "btree" ("published_at" DESC);
CREATE INDEX "profiles_display_currency_idx" ON "public"."profiles" USING "btree" ("display_currency");
CREATE INDEX "symbols_currency_idx" ON "public"."symbols" USING "btree" ("currency");
CREATE UNIQUE INDEX "uq_position_categories_display_order" ON "public"."position_categories" USING "btree" ("display_order");
CREATE OR REPLACE TRIGGER "conversations_handle_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "news_handle_updated_at" BEFORE UPDATE ON "public"."news" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "portfolio_records_handle_updated_at" BEFORE UPDATE ON "public"."portfolio_records" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "position_snapshots_handle_updated_at" BEFORE UPDATE ON "public"."position_snapshots" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "positions_handle_updated_at" BEFORE UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "profiles_handle_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "symbols_handle_updated_at" BEFORE UPDATE ON "public"."symbols" FOR EACH ROW WHEN ((("new"."id" IS DISTINCT FROM "old"."id") OR ("new"."short_name" IS DISTINCT FROM "old"."short_name") OR ("new"."long_name" IS DISTINCT FROM "old"."long_name") OR ("new"."exchange" IS DISTINCT FROM "old"."exchange") OR ("new"."sector" IS DISTINCT FROM "old"."sector") OR ("new"."industry" IS DISTINCT FROM "old"."industry") OR ("new"."created_at" IS DISTINCT FROM "old"."created_at") OR ("new"."updated_at" IS DISTINCT FROM "old"."updated_at") OR ("new"."quote_type" IS DISTINCT FROM "old"."quote_type") OR ("new"."currency" IS DISTINCT FROM "old"."currency"))) EXECUTE FUNCTION "storage"."update_updated_at_column"();
ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."dividend_events"
    ADD CONSTRAINT "dividend_events_currency_fkey" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."dividend_events"
    ADD CONSTRAINT "dividend_events_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."dividends"
    ADD CONSTRAINT "dividends_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_target_currency_fkey" FOREIGN KEY ("target_currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY "public"."portfolio_records"
    ADD CONSTRAINT "portfolio_records_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."portfolio_records"
    ADD CONSTRAINT "portfolio_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."position_snapshots"
    ADD CONSTRAINT "position_snapshots_portfolio_record_id_fkey" FOREIGN KEY ("portfolio_record_id") REFERENCES "public"."portfolio_records"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY "public"."position_snapshots"
    ADD CONSTRAINT "position_snapshots_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."position_categories"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;
ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_currency_fkey" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_display_currency_fkey" FOREIGN KEY ("display_currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE SET DEFAULT;
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "symbol_prices_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."symbols"
    ADD CONSTRAINT "symbols_currency_fkey" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("alphabetic_code") ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE POLICY "  Enable update for authenticated users" ON "public"."quotes" FOR UPDATE TO "authenticated" USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON "public"."domain_valuations" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable insert for all authenticated users" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable insert for all authenticated users" ON "public"."symbols" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users only" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."currencies" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."dividend_events" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."dividends" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."domain_valuations" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."exchange_rates" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."news" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."position_categories" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."quotes" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON "public"."symbols" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Enable update for all authenticated users" ON "public"."symbols" FOR UPDATE TO "authenticated" USING (true);
CREATE POLICY "Enable update for authenticated users" ON "public"."domain_valuations" FOR UPDATE TO "authenticated" USING (true);
CREATE POLICY "Users can delete their own conversation messages" ON "public"."conversation_messages" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can delete their own conversations" ON "public"."conversations" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can delete their own portfolio records" ON "public"."portfolio_records" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can delete their own position snapshots" ON "public"."position_snapshots" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can delete their own positions" ON "public"."positions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert portfolio records they own" ON "public"."portfolio_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert position snapshots they own" ON "public"."position_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert positions they own" ON "public"."positions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert their own conversation messages" ON "public"."conversation_messages" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can insert their own conversations" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update their own conversation messages" ON "public"."conversation_messages" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update their own conversations" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update their own portfolio records" ON "public"."portfolio_records" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update their own position snapshots" ON "public"."position_snapshots" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can update their own positions" ON "public"."positions" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view their own conversation messages" ON "public"."conversation_messages" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view their own portfolio records" ON "public"."portfolio_records" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view their own position snapshots" ON "public"."position_snapshots" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Users can view their own positions" ON "public"."positions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dividend_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dividends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."domain_valuations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."news" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."portfolio_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."position_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."position_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."symbols" ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_messages" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."currencies" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."currencies" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."currencies" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividend_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividend_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividend_events" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividends" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividends" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."dividends" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_valuations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_valuations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_valuations" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."exchange_rates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."exchange_rates" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."news" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."news" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."news" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."portfolio_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."portfolio_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."portfolio_records" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_categories" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_snapshots" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_snapshots" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_snapshots" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."quotes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."quotes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."quotes" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."symbols" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."symbols" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."symbols" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";
RESET ALL;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
