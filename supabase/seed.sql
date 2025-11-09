-- ============================================================================
-- Foliofox Local Development Seed Data
-- ============================================================================
-- This script seeds a test user for local development only.
-- It will NOT run against linked or production projects because seed.sql
-- is only executed by 'supabase db reset' in local environments.
--
-- Test User Credentials:
--   Email:    test@example.com
--   Password: Password123
--   Username: Testuser
-- ============================================================================

-- Insert test user into auth.users
-- Password hash generated with: crypt('Password123', gen_salt('bf'))
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'f7e710c7-2e9c-4925-a8d8-6a13def5fe41',
    'authenticated',
    'authenticated',
    'test@example.com',
    crypt('Password123', gen_salt('bf')),
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"sub": "f7e710c7-2e9c-4925-a8d8-6a13def5fe41", "email": "test@example.com", "username": "Testuser", "email_verified": true, "phone_verified": false}',
    NULL,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL,
    false
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding identity record
INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    'f7e710c7-2e9c-4925-a8d8-6a13def5fe41',
    'f7e710c7-2e9c-4925-a8d8-6a13def5fe41',
    '{"sub": "f7e710c7-2e9c-4925-a8d8-6a13def5fe41", "email": "test@example.com", "username": "Testuser", "email_verified": true, "phone_verified": false}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    'e9ad1c46-1ce4-415f-9e39-12a1e9f617d6'
) ON CONFLICT (id) DO NOTHING;

-- Insert user profile
INSERT INTO public.profiles (
    user_id,
    username,
    display_currency,
    avatar_url,
    created_at,
    updated_at
) VALUES (
    'f7e710c7-2e9c-4925-a8d8-6a13def5fe41',
    'Testuser',
    'USD',
    NULL,
    NOW(),
    NOW()
) ON CONFLICT (user_id) DO NOTHING;
