--
-- PostgreSQL database dump
--

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
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('EUR', 'Euro', 978, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('KRW', 'Won', 410, 0) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('USD', 'US Dollar', 840, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('GBP', 'Pound Sterling', 826, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('HKD', 'Hong Kong Dollar', 344, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('CHF', 'Swiss Franc', 756, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('CNY', 'Yuan Renminbi', 156, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('JPY', 'Yen', 392, 0) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('AUD', 'Australian Dollar', 36, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('CAD', 'Canadian Dollar', 124, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('SGD', 'Singapore Dollar', 702, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('PLN', 'Zloty', 985, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('SEK', 'Swedish Krona', 752, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('NOK', 'Norwegian Krone', 578, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('DKK', 'Danish Krone', 208, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('NZD', 'New Zealand Dollar', 554, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('MXN', 'Mexican Peso', 484, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('ZAR', 'Rand', 710, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('THB', 'Thai Baht', 764, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('MYR', 'Malaysian Ringgit', 458, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('BRL', 'Brazilian Real', 986, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
INSERT INTO public.currencies (alphabetic_code, name, numeric_code, minor_unit) VALUES ('INR', 'Indian Rupee', 356, 2) ON CONFLICT (alphabetic_code) DO NOTHING;
--
-- Data for Name: position_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('cryptocurrency', 'Cryptocurrencies', 'Bitcoin, Ethereum, and other supported digital currencies', 4, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('commodities', 'Commodities', 'Precious metals, raw materials, and other physical goods', 5, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('real_estate', 'Real Estate', 'Property investments and REITs', 3, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('fixed_income', 'Fixed Income', 'Bonds, CDs, and other debt instruments', 2, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('equity', 'Equity', 'Stocks, ETFs, and other equity investments', 1, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('cash', 'Cash & Equivalents', 'Cash, bank accounts, and money market funds', 0, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('other', 'Others', 'Collectibles, Art, Private Equity, and other alternative assets', 7, 'asset') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.position_categories (id, name, description, display_order, position_type) VALUES ('domain', 'Domains', 'Registered internet domains held as digital assets.', 6, 'asset') ON CONFLICT (id) DO NOTHING;
--
-- PostgreSQL database dump complete
--;
