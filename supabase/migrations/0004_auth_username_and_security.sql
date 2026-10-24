-- ==============================================================================
-- Migration: 0004_auth_username_and_security.sql
-- Description: Adds username mapping to profiles table, updates user creation
-- trigger, and establishes unique case-insensitive username index.
-- ==============================================================================

-- 1. Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(60) UNIQUE;

-- 2. Create case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username 
  ON public.profiles(LOWER(username)) 
  WHERE username IS NOT NULL;

-- 3. Update handle_new_user trigger to preserve username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
    LOWER(TRIM(NEW.raw_user_meta_data->>'username')),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      username = COALESCE(EXCLUDED.username, public.profiles.username),
      avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

-- 4. Set default usernames for existing system owner and staff accounts
UPDATE public.profiles
SET username = 'owner'
WHERE email = 'owner@rtrmobiles.com' AND username IS NULL;

UPDATE public.profiles
SET username = 'staff'
WHERE email = 'staff@rtrmobiles.com' AND username IS NULL;
