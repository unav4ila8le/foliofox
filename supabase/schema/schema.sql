--
-- PostgreSQL database dump
--

\restrict TZyUIT9juCRh5vcByYKFcpegSc4bejGPdezYNwbAxjp1qHSplriqLAucciuCr0N

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6 (Homebrew)

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
-- Name: conversation_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.conversation_role AS ENUM (
    'system',
    'user',
    'assistant',
    'tool'
);


ALTER TYPE public.conversation_role OWNER TO postgres;

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
-- Name: holding_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.holding_source AS ENUM (
    'custom',
    'symbol',
    'domain'
);


ALTER TYPE public.holding_source OWNER TO postgres;

--
-- Name: portfolio_record_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.portfolio_record_type AS ENUM (
    'buy',
    'sell',
    'update'
);


ALTER TYPE public.portfolio_record_type OWNER TO postgres;

--
-- Name: position_source_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.position_source_type AS ENUM (
    'symbol',
    'domain'
);


ALTER TYPE public.position_source_type OWNER TO postgres;

--
-- Name: position_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.position_type AS ENUM (
    'asset',
    'liability'
);


ALTER TYPE public.position_type OWNER TO postgres;

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
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.conversation_role NOT NULL,
    content text NOT NULL,
    model text,
    usage_tokens integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversation_messages OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

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
-- Name: domain_holdings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_holdings (
    holding_id uuid NOT NULL,
    domain_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domain_holdings OWNER TO postgres;

--
-- Name: domain_valuations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_valuations (
    id text NOT NULL,
    date date NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domain_valuations OWNER TO postgres;

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
    archived_at timestamp with time zone,
    source public.holding_source DEFAULT 'custom'::public.holding_source NOT NULL
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
-- Name: portfolio_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portfolio_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    position_id uuid NOT NULL,
    type public.portfolio_record_type NOT NULL,
    date date DEFAULT now() NOT NULL,
    quantity numeric NOT NULL,
    unit_value numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.portfolio_records OWNER TO postgres;

--
-- Name: position_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.position_categories (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer NOT NULL,
    position_type public.position_type NOT NULL
);


ALTER TABLE public.position_categories OWNER TO postgres;

--
-- Name: position_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.position_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    position_id uuid NOT NULL,
    date date NOT NULL,
    quantity numeric NOT NULL,
    unit_value numeric NOT NULL,
    cost_basis_per_unit numeric,
    portfolio_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.position_snapshots OWNER TO postgres;

--
-- Name: position_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.position_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.position_source_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.position_sources OWNER TO postgres;

--
-- Name: source_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_domains (
    id uuid NOT NULL,
    domain_id text NOT NULL
);


ALTER TABLE public.source_domains OWNER TO postgres;

--
-- Name: source_symbols; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_symbols (
    id uuid NOT NULL,
    symbol_id text NOT NULL
);


ALTER TABLE public.source_symbols OWNER TO postgres;

--
-- Name: position_sources_flat; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.position_sources_flat WITH (security_invoker='true', security_barrier='true') AS
 SELECT ps.id,
    ps.type,
    ss.symbol_id,
    sd.domain_id
   FROM ((public.position_sources ps
     LEFT JOIN public.source_symbols ss ON ((ss.id = ps.id)))
     LEFT JOIN public.source_domains sd ON ((sd.id = ps.id)));


ALTER VIEW public.position_sources_flat OWNER TO postgres;

--
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.position_type NOT NULL,
    name text NOT NULL,
    currency text NOT NULL,
    source_id uuid,
    category_id text DEFAULT 'other'::text NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);


ALTER TABLE public.positions OWNER TO postgres;

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
-- Name: symbol_holdings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.symbol_holdings (
    holding_id uuid NOT NULL,
    symbol_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.symbol_holdings OWNER TO postgres;

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
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


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
-- Name: domain_holdings domain_holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_holdings
    ADD CONSTRAINT domain_holdings_pkey PRIMARY KEY (holding_id);


--
-- Name: domain_valuations domain_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_valuations
    ADD CONSTRAINT domain_valuations_pkey PRIMARY KEY (id, date);


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
-- Name: portfolio_records portfolio_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portfolio_records
    ADD CONSTRAINT portfolio_records_pkey PRIMARY KEY (id);


--
-- Name: position_categories position_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_categories
    ADD CONSTRAINT position_categories_pkey PRIMARY KEY (id);


--
-- Name: position_snapshots position_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_snapshots
    ADD CONSTRAINT position_snapshots_pkey PRIMARY KEY (id);


--
-- Name: position_sources position_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_sources
    ADD CONSTRAINT position_sources_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


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
-- Name: source_domains source_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_domains
    ADD CONSTRAINT source_domains_pkey PRIMARY KEY (id);


--
-- Name: source_symbols source_symbols_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_symbols
    ADD CONSTRAINT source_symbols_pkey PRIMARY KEY (id);


--
-- Name: symbol_holdings symbol_holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbol_holdings
    ADD CONSTRAINT symbol_holdings_pkey PRIMARY KEY (holding_id);


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
-- Name: holdings_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holdings_source_idx ON public.holdings USING btree (source);


--
-- Name: idx_conversations_user_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user_updated ON public.conversations USING btree (user_id, updated_at DESC);


--
-- Name: idx_dividend_events_event_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dividend_events_event_date_desc ON public.dividend_events USING btree (event_date DESC);


--
-- Name: idx_dividend_events_symbol_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dividend_events_symbol_date_desc ON public.dividend_events USING btree (symbol_id, event_date DESC);


--
-- Name: idx_domain_holdings_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_domain_holdings_domain ON public.domain_holdings USING btree (domain_id);


--
-- Name: idx_domain_valuations_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_domain_valuations_date_desc ON public.domain_valuations USING btree (date DESC);


--
-- Name: idx_holdings_category_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holdings_category_user ON public.holdings USING btree (category_code, user_id);


--
-- Name: idx_holdings_user_archived_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holdings_user_archived_at ON public.holdings USING btree (user_id, archived_at);


--
-- Name: idx_messages_conversation_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_time ON public.conversation_messages USING btree (conversation_id, created_at);


--
-- Name: idx_news_related_symbols; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_related_symbols ON public.news USING gin (related_symbol_ids);


--
-- Name: idx_position_categories_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_position_categories_type ON public.position_categories USING btree (position_type);


--
-- Name: idx_position_snapshots_portfolio_record_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_position_snapshots_portfolio_record_id ON public.position_snapshots USING btree (portfolio_record_id);


--
-- Name: idx_position_snapshots_position_date_created_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_position_snapshots_position_date_created_desc ON public.position_snapshots USING btree (position_id, date DESC, created_at DESC);


--
-- Name: idx_position_snapshots_user_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_position_snapshots_user_date_desc ON public.position_snapshots USING btree (user_id, date DESC);


--
-- Name: idx_position_sources_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_position_sources_type ON public.position_sources USING btree (type);


--
-- Name: idx_positions_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_category_id ON public.positions USING btree (category_id);


--
-- Name: idx_positions_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_source ON public.positions USING btree (source_id);


--
-- Name: idx_positions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_type ON public.positions USING btree (type);


--
-- Name: idx_positions_user_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_user_archived ON public.positions USING btree (user_id, archived_at);


--
-- Name: idx_pr_pos_date_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pr_pos_date_created ON public.portfolio_records USING btree (position_id, date DESC, created_at DESC);


--
-- Name: idx_pr_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pr_user_created ON public.portfolio_records USING btree (user_id, created_at DESC);


--
-- Name: idx_pr_user_pos_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pr_user_pos_date ON public.portfolio_records USING btree (user_id, position_id, date DESC);


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
-- Name: idx_symbol_holdings_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_symbol_holdings_symbol ON public.symbol_holdings USING btree (symbol_id);


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
-- Name: transactions_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_type_idx ON public.transactions USING btree (type);


--
-- Name: transactions_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX transactions_user_id_idx ON public.transactions USING btree (user_id);


--
-- Name: uq_position_categories_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_position_categories_display_order ON public.position_categories USING btree (display_order);


--
-- Name: uq_position_snapshots_position_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_position_snapshots_position_date ON public.position_snapshots USING btree (position_id, date);


--
-- Name: uq_source_domains_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_source_domains_domain ON public.source_domains USING btree (domain_id);


--
-- Name: uq_source_symbols_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_source_symbols_symbol ON public.source_symbols USING btree (symbol_id);


--
-- Name: conversations conversations_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER conversations_handle_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: holdings holdings_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER holdings_handle_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: news news_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER news_handle_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: portfolio_records portfolio_records_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER portfolio_records_handle_updated_at BEFORE UPDATE ON public.portfolio_records FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: position_snapshots position_snapshots_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER position_snapshots_handle_updated_at BEFORE UPDATE ON public.position_snapshots FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: positions positions_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER positions_handle_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


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

CREATE TRIGGER symbols_handle_updated_at BEFORE UPDATE ON public.symbols FOR EACH ROW WHEN (((new.id IS DISTINCT FROM old.id) OR (new.short_name IS DISTINCT FROM old.short_name) OR (new.long_name IS DISTINCT FROM old.long_name) OR (new.exchange IS DISTINCT FROM old.exchange) OR (new.sector IS DISTINCT FROM old.sector) OR (new.industry IS DISTINCT FROM old.industry) OR (new.created_at IS DISTINCT FROM old.created_at) OR (new.updated_at IS DISTINCT FROM old.updated_at) OR (new.quote_type IS DISTINCT FROM old.quote_type) OR (new.currency IS DISTINCT FROM old.currency))) EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: transactions transactions_handle_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER transactions_handle_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: domain_holdings domain_holdings_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_holdings
    ADD CONSTRAINT domain_holdings_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: holdings holdings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: portfolio_records portfolio_records_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portfolio_records
    ADD CONSTRAINT portfolio_records_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: portfolio_records portfolio_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portfolio_records
    ADD CONSTRAINT portfolio_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: position_snapshots position_snapshots_portfolio_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_snapshots
    ADD CONSTRAINT position_snapshots_portfolio_record_id_fkey FOREIGN KEY (portfolio_record_id) REFERENCES public.portfolio_records(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: position_snapshots position_snapshots_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_snapshots
    ADD CONSTRAINT position_snapshots_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: positions positions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.position_categories(id) ON UPDATE CASCADE ON DELETE SET DEFAULT;


--
-- Name: positions positions_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: positions positions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.position_sources(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: positions positions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: source_domains source_domains_position_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_domains
    ADD CONSTRAINT source_domains_position_source_id_fkey FOREIGN KEY (id) REFERENCES public.position_sources(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_symbols source_symbols_position_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_symbols
    ADD CONSTRAINT source_symbols_position_source_id_fkey FOREIGN KEY (id) REFERENCES public.position_sources(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: source_symbols source_symbols_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_symbols
    ADD CONSTRAINT source_symbols_symbol_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: symbol_holdings symbol_holdings_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbol_holdings
    ADD CONSTRAINT symbol_holdings_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: symbol_holdings symbol_holdings_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbol_holdings
    ADD CONSTRAINT symbol_holdings_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE;


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
-- Name: domain_valuations Enable insert for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for all authenticated users" ON public.domain_valuations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: quotes Enable insert for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for all authenticated users" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);


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
-- Name: domain_valuations Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.domain_valuations FOR SELECT TO authenticated USING (true);


--
-- Name: exchange_rates Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.exchange_rates FOR SELECT TO authenticated USING (true);


--
-- Name: news Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.news FOR SELECT TO authenticated USING (true);


--
-- Name: position_categories Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.position_categories FOR SELECT TO authenticated USING (true);


--
-- Name: position_sources Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.position_sources FOR SELECT TO authenticated USING (true);


--
-- Name: quotes Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.quotes FOR SELECT TO authenticated USING (true);


--
-- Name: source_domains Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.source_domains FOR SELECT TO authenticated USING (true);


--
-- Name: source_symbols Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.source_symbols FOR SELECT TO authenticated USING (true);


--
-- Name: symbols Enable read access for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all authenticated users" ON public.symbols FOR SELECT TO authenticated USING (true);


--
-- Name: symbols Enable update for all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for all authenticated users" ON public.symbols FOR UPDATE TO authenticated USING (true);


--
-- Name: domain_valuations Enable update for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for authenticated users" ON public.domain_valuations FOR UPDATE TO authenticated USING (true);


--
-- Name: conversation_messages Users can delete their own conversation messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own conversation messages" ON public.conversation_messages FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations Users can delete their own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: domain_holdings Users can delete their own domain holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own domain holdings" ON public.domain_holdings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = domain_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: holdings Users can delete their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own holdings" ON public.holdings FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: portfolio_records Users can delete their own portfolio records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own portfolio records" ON public.portfolio_records FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: position_snapshots Users can delete their own position snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own position snapshots" ON public.position_snapshots FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: positions Users can delete their own positions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own positions" ON public.positions FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can delete their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own records" ON public.records FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: symbol_holdings Users can delete their own symbol holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own symbol holdings" ON public.symbol_holdings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = symbol_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: transactions Users can delete their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: portfolio_records Users can insert portfolio records they own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert portfolio records they own" ON public.portfolio_records FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: position_snapshots Users can insert position snapshots they own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert position snapshots they own" ON public.position_snapshots FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: positions Users can insert positions they own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert positions they own" ON public.positions FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversation_messages Users can insert their own conversation messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own conversation messages" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations Users can insert their own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: domain_holdings Users can insert their own domain holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own domain holdings" ON public.domain_holdings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = domain_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: holdings Users can insert their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own holdings" ON public.holdings FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can insert their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own records" ON public.records FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: symbol_holdings Users can insert their own symbol holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own symbol holdings" ON public.symbol_holdings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = symbol_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: transactions Users can insert their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversation_messages Users can update their own conversation messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own conversation messages" ON public.conversation_messages FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations Users can update their own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own conversations" ON public.conversations FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: domain_holdings Users can update their own domain holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own domain holdings" ON public.domain_holdings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = domain_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = domain_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: holdings Users can update their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own holdings" ON public.holdings FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: portfolio_records Users can update their own portfolio records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own portfolio records" ON public.portfolio_records FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: position_snapshots Users can update their own position snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own position snapshots" ON public.position_snapshots FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: positions Users can update their own positions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own positions" ON public.positions FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can update their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own records" ON public.records FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: symbol_holdings Users can update their own symbol holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own symbol holdings" ON public.symbol_holdings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = symbol_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = symbol_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: transactions Users can update their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversation_messages Users can view their own conversation messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own conversation messages" ON public.conversation_messages FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations Users can view their own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: domain_holdings Users can view their own domain holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own domain holdings" ON public.domain_holdings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = domain_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: holdings Users can view their own holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: portfolio_records Users can view their own portfolio records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own portfolio records" ON public.portfolio_records FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: position_snapshots Users can view their own position snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own position snapshots" ON public.position_snapshots FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: positions Users can view their own positions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own positions" ON public.positions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: records Users can view their own records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own records" ON public.records FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: symbol_holdings Users can view their own symbol holdings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own symbol holdings" ON public.symbol_holdings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.holdings h
  WHERE ((h.id = symbol_holdings.holding_id) AND (h.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: asset_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

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
-- Name: domain_holdings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.domain_holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: domain_valuations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.domain_valuations ENABLE ROW LEVEL SECURITY;

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
-- Name: portfolio_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.portfolio_records ENABLE ROW LEVEL SECURITY;

--
-- Name: position_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.position_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: position_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.position_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: position_sources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.position_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: positions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

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
-- Name: source_domains; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.source_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: source_symbols; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.source_symbols ENABLE ROW LEVEL SECURITY;

--
-- Name: symbol_holdings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.symbol_holdings ENABLE ROW LEVEL SECURITY;

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
-- Name: TABLE conversation_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversation_messages TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversation_messages TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversation_messages TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.conversations TO service_role;


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
-- Name: TABLE domain_holdings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_holdings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_holdings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_holdings TO service_role;


--
-- Name: TABLE domain_valuations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_valuations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_valuations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.domain_valuations TO service_role;


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
-- Name: TABLE portfolio_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.portfolio_records TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.portfolio_records TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.portfolio_records TO service_role;


--
-- Name: TABLE position_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_categories TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_categories TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_categories TO service_role;


--
-- Name: TABLE position_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_snapshots TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_snapshots TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_snapshots TO service_role;


--
-- Name: TABLE position_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_sources TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_sources TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.position_sources TO service_role;


--
-- Name: TABLE source_domains; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_domains TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_domains TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_domains TO service_role;


--
-- Name: TABLE source_symbols; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_symbols TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_symbols TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.source_symbols TO service_role;


--
-- Name: TABLE position_sources_flat; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.position_sources_flat TO authenticated;
GRANT SELECT ON TABLE public.position_sources_flat TO service_role;


--
-- Name: TABLE positions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.positions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.positions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.positions TO service_role;


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
-- Name: TABLE symbol_holdings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbol_holdings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbol_holdings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.symbol_holdings TO service_role;


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

\unrestrict TZyUIT9juCRh5vcByYKFcpegSc4bejGPdezYNwbAxjp1qHSplriqLAucciuCr0N

