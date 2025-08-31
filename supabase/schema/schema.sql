--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: feedback_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.feedback_type AS ENUM (
    'issue',
    'idea',
    'other'
);


ALTER TYPE public.feedback_type OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'buy',
    'sell',
    'update',
    'deposit',
    'withdrawal'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$begin
    insert into public.profiles (user_id, username)
    values (
        new.id,
        new.raw_user_meta_data->>'username'
    );
    return new;
end;$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_categories (
    code text NOT NULL,
    name text NOT NULL,
    description text,
    display_order smallint NOT NULL
);


ALTER TABLE public.asset_categories OWNER TO postgres;

--
-- Name: TABLE asset_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.asset_categories IS 'Lookup table for categorizing financial assets.';


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.currencies (
    alphabetic_code text NOT NULL,
    name text NOT NULL,
    numeric_code smallint NOT NULL,
    minor_unit smallint NOT NULL,
    CONSTRAINT currencies_alphabetic_code_check CHECK ((length(alphabetic_code) = 3)),
    CONSTRAINT currencies_numeric_code_check CHECK (((numeric_code >= 1) AND (numeric_code <= 999)))
);


ALTER TABLE public.currencies OWNER TO postgres;

--
-- Name: TABLE currencies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.currencies IS 'List of currencies as defined by ISO 4217 (https://datahub.io/core/currency-codes)';


--
-- Name: COLUMN currencies.alphabetic_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.currencies.alphabetic_code IS '3 digit alphabetic code for the currency';


--
-- Name: COLUMN currencies.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.currencies.name IS 'Name of the currency';


--
-- Name: COLUMN currencies.numeric_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.currencies.numeric_code IS '3 digit numeric code';


--
-- Name: dividend_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dividend_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol_id text NOT NULL,
    event_date timestamp with time zone NOT NULL,
    gross_amount numeric NOT NULL,
    currency text NOT NULL,
    source text DEFAULT 'yahoo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dividend_events OWNER TO postgres;

--
-- Name: dividends; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dividends (
    symbol_id text NOT NULL,
    forward_annual_dividend numeric,
    trailing_ttm_dividend numeric,
    dividend_yield numeric,
    ex_dividend_date timestamp with time zone,
    last_dividend_date date,
    inferred_frequency text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dividends OWNER TO postgres;

--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    date date DEFAULT now() NOT NULL,
    base_currency text NOT NULL,
    target_currency text NOT NULL,
    rate numeric(20,10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exchange_rates OWNER TO postgres;

--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT gen_random_uuid(),
    type public.feedback_type NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: holdings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_code text DEFAULT '''other'''::text NOT NULL,
    currency text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    symbol_id text
);


ALTER TABLE public.holdings OWNER TO postgres;

--
-- Name: news; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    yahoo_uuid text NOT NULL,
    related_symbol_ids text[] DEFAULT '{}'::text[],
    title text NOT NULL,
    publisher text NOT NULL,
    link text NOT NULL,
    published_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.news OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    username text NOT NULL,
    display_currency text DEFAULT 'USD'::text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_currency CHECK ((display_currency ~ '^[A-Z]{3}$'::text))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol_id text NOT NULL,
    date date NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotes OWNER TO postgres;

--
-- Name: records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    quantity numeric NOT NULL,
    unit_value numeric NOT NULL,
    holding_id uuid NOT NULL,
    transaction_id uuid,
    cost_basis_per_unit numeric
);


ALTER TABLE public.records OWNER TO postgres;

--
-- Name: symbols; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.symbols (
    id text NOT NULL,
    short_name text,
    long_name text,
    exchange text,
    sector text,
    industry text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quote_type text NOT NULL,
    currency text NOT NULL
);


ALTER TABLE public.symbols OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    holding_id uuid NOT NULL,
    type public.transaction_type NOT NULL,
    date date NOT NULL,
    quantity numeric NOT NULL,
    unit_value numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transactions_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT transactions_unit_value_check CHECK ((unit_value > (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: asset_categories asset_categories_display_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_display_order_key UNIQUE (display_order);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (alphabetic_code);


--
-- Name: dividend_events dividend_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividend_events
    ADD CONSTRAINT dividend_events_pkey PRIMARY KEY (id);


--
-- Name: dividend_events dividend_events_symbol_id_event_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividend_events
    ADD CONSTRAINT dividend_events_symbol_id_event_date_key UNIQUE (symbol_id, event_date);


--
-- Name: dividends dividends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_pkey PRIMARY KEY (symbol_id);


--
-- Name: symbols equities_symbol_exchange_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbols
    ADD CONSTRAINT equities_symbol_exchange_key UNIQUE (id, exchange);


--
-- Name: exchange_rates exchange_rates_date_base_currency_target_currency_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_date_base_currency_target_currency_key UNIQUE (date, base_currency, target_currency);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news news_yahoo_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_yahoo_uuid_key UNIQUE (yahoo_uuid);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);


--
-- Name: quotes symbol_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT symbol_prices_pkey PRIMARY KEY (id);


--
-- Name: symbols symbols_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbols
    ADD CONSTRAINT symbols_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: quotes unique_symbol_date; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT unique_symbol_date UNIQUE (symbol_id, date);


--
-- Name: dividend_events_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dividend_events_created_at_idx ON public.dividend_events USING btree (created_at DESC);


--
-- Name: dividend_events_currency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dividend_events_currency_idx ON public.dividend_events USING btree (currency);


--
-- Name: dividend_events_symbol_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dividend_events_symbol_id_idx ON public.dividend_events USING btree (symbol_id);


--
-- Name: dividends_updated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dividends_updated_at_idx ON public.dividends USING btree (updated_at DESC);


--
-- Name: exchange_rates_base_currency_target_currency_date_desc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX exchange_rates_base_currency_target_currency_date_desc_idx ON public.exchange_rates USING btree (base_currency, target_currency, date DESC);


--
-- Name: exchange_rates_target_currency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX exchange_rates_target_currency_idx ON public.exchange_rates USING btree (target_currency);


--
-- Name: holdings_category_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holdings_category_code_idx ON public.holdings USING btree (category_code);


--
-- Name: holdings_currency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holdings_currency_idx ON public.holdings USING btree (currency);


--
-- Name: holdings_equity_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holdings_equity_id_idx ON public.holdings USING btree (symbol_id);


--
-- Name: holdings_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holdings_user_id_idx ON public.holdings USING btree (user_id);


--
-- Name: idx_dividend_events_event_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dividend_events_event_date_desc ON public.dividend_events USING btree (event_date DESC);


--
-- Name: idx_dividend_events_symbol_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dividend_events_symbol_date_desc ON public.dividend_events USING btree (symbol_id, event_date DESC);


--
-- Name: idx_holdings_category_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holdings_category_user ON public.holdings USING btree (category_code, user_id);


--
-- Name: idx_holdings_user_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holdings_user_archived ON public.holdings USING btree (user_id, is_archived);


--
-- Name: idx_news_related_symbols; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_related_symbols ON public.news USING gin (related_symbol_ids);


--
-- Name: idx_quotes_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_date_desc ON public.quotes USING btree (date DESC);


--
-- Name: idx_records_cost_basis_per_unit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_records_cost_basis_per_unit ON public.records USING btree (cost_basis_per_unit);


--
-- Name: idx_records_holding_user_date_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_records_holding_user_date_created ON public.records USING btree (holding_id, user_id, date DESC, created_at DESC);


--
-- Name: idx_records_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_records_transaction_id ON public.records USING btree (transaction_id);


--
-- Name: news_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX news_created_at_idx ON public.news USING btree (created_at DESC);


--
-- Name: news_published_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX news_published_at_idx ON public.news USING btree (published_at DESC);


--
-- Name: profiles_display_currency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_display_currency_idx ON public.profiles USING btree (display_currency);


--
-- Name: records_destination_holding_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX records_destination_holding_id_idx ON public.records USING btree (holding_id);


--
-- Name: records_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX records_user_id_idx ON public.records USING btree (user_id);


--
-- Name: symbol_prices_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX symbol_prices_date_idx ON public.quotes USING btree (date);


--
-- Name: symbols_currency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX symbols_currency_idx ON public.symbols USING btree (currency);


--
-- Name: transactions_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_date_idx ON public.transactions USING btree (date);


--
-- Name: transactions_holding_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_holding_date_idx ON public.transactions USING btree (holding_id, date DESC);


--
-- Name: transactions_holding_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_holding_id_idx ON public.transactions USING btree (holding_id);


--
-- Name: transactions_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_type_idx ON public.transactions USING btree (type);


--
-- Name: transactions_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_user_id_idx ON public.transactions USING btree (user_id);


--
-- Name: holdings holdings_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER holdings_handle_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: news news_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER news_handle_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: profiles profiles_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER profiles_handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: records records_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER records_handle_updated_at BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: symbols symbols_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER symbols_handle_updated_at BEFORE UPDATE ON public.symbols FOR EACH ROW WHEN (((((((((((new.id IS DISTINCT FROM old.id) OR (new.short_name IS DISTINCT FROM old.short_name)) OR (new.long_name IS DISTINCT FROM old.long_name)) OR (new.exchange IS DISTINCT FROM old.exchange)) OR (new.sector IS DISTINCT FROM old.sector)) OR (new.industry IS DISTINCT FROM old.industry)) OR (new.created_at IS DISTINCT FROM old.created_at)) OR (new.updated_at IS DISTINCT FROM old.updated_at)) OR (new.quote_type IS DISTINCT FROM old.quote_type)) OR (new.currency IS DISTINCT FROM old.currency))) EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: transactions transactions_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER transactions_handle_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: dividend_events dividend_events_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividend_events
    ADD CONSTRAINT dividend_events_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dividend_events dividend_events_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividend_events
    ADD CONSTRAINT dividend_events_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dividends dividends_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exchange_rates exchange_rates_base_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_base_currency_fkey FOREIGN KEY (base_currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: exchange_rates exchange_rates_target_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_target_currency_fkey FOREIGN KEY (target_currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: holdings holdings_category_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.asset_categories(code) ON UPDATE CASCADE ON DELETE SET DEFAULT;


--
-- Name: holdings holdings_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: holdings holdings_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: holdings holdings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: profiles profiles_display_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_display_currency_fkey FOREIGN KEY (display_currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE SET DEFAULT;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: records records_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: records records_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotes symbol_prices_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT symbol_prices_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: symbols symbols_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbols
    ADD CONSTRAINT symbols_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: records transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotes   Enable update for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "  Enable update for authenticated users" ON public.quotes FOR UPDATE TO authenticated USING (true);


--
-- Name: quotes Enable insert for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for all authenticated users" ON public.quotes FOR INSERT TO authenticated, service_role WITH CHECK (true);


--
-- Name: symbols Enable insert for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for all authenticated users" ON public.symbols FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: feedback Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.feedback FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: asset_categories Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.asset_categories FOR SELECT TO authenticated USING (true);


--
-- Name: currencies Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.currencies FOR SELECT TO authenticated USING (true);


--
-- Name: dividend_events Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.dividend_events FOR SELECT TO authenticated USING (true);


--
-- Name: dividends Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.dividends FOR SELECT TO authenticated USING (true);


--
-- Name: exchange_rates Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.exchange_rates FOR SELECT TO authenticated USING (true);


--
-- Name: news Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.news FOR SELECT TO authenticated USING (true);


--
-- Name: quotes Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.quotes FOR SELECT TO authenticated USING (true);


--
-- Name: symbols Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.symbols FOR SELECT TO authenticated, service_role USING (true);


--
-- Name: symbols Enable update for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for all authenticated users" ON public.symbols FOR UPDATE TO authenticated USING (true);


--
-- Name: holdings Users can delete their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own holdings" ON public.holdings FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can delete their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own records" ON public.records FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: transactions Users can delete their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: holdings Users can insert their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own holdings" ON public.holdings FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can insert their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own records" ON public.records FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: transactions Users can insert their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: holdings Users can update their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own holdings" ON public.holdings FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can update their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own records" ON public.records FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: transactions Users can update their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: holdings Users can view their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can view their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own records" ON public.records FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: asset_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: currencies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

--
-- Name: dividend_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dividend_events ENABLE ROW LEVEL SECURITY;

--
-- Name: dividends; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: holdings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: news; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

--
-- Name: symbols; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: TABLE asset_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.asset_categories TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.asset_categories TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.asset_categories TO service_role;


--
-- Name: TABLE currencies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.currencies TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.currencies TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.currencies TO service_role;


--
-- Name: TABLE dividend_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividend_events TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividend_events TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividend_events TO service_role;


--
-- Name: TABLE dividends; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividends TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividends TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dividends TO service_role;


--
-- Name: TABLE exchange_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.exchange_rates TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.exchange_rates TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.exchange_rates TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.feedback TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.feedback TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.feedback TO service_role;


--
-- Name: TABLE holdings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.holdings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.holdings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.holdings TO service_role;


--
-- Name: TABLE news; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.news TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.news TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.news TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO service_role;


--
-- Name: TABLE quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.quotes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.quotes TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.quotes TO service_role;


--
-- Name: TABLE records; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.records TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.records TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.records TO service_role;


--
-- Name: TABLE symbols; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbols TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbols TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbols TO service_role;


--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transactions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transactions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transactions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

