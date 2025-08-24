# Supabase Database Schema

This document outlines the required database schema for the Overlay application.

## Required Tables

### 1. Users (Managed by Supabase Auth)
The `auth.users` table is automatically created by Supabase Auth and includes:
- `id` (UUID, Primary Key)
- `email` (Text)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 2. User Profiles
```sql
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 3. Transcripts
```sql
CREATE TABLE public.transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  original_text TEXT,
  language TEXT NOT NULL,
  target_language TEXT,
  was_translated BOOLEAN DEFAULT FALSE,
  confidence FLOAT,
  word_count INTEGER NOT NULL,
  wpm FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own transcripts" ON public.transcripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transcripts" ON public.transcripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transcripts" ON public.transcripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcripts" ON public.transcripts
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX transcripts_user_id_created_at_idx ON public.transcripts(user_id, created_at DESC);
CREATE INDEX transcripts_user_id_was_translated_idx ON public.transcripts(user_id, was_translated);
```

### 4. User Settings
```sql
CREATE TABLE public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Functions

### Auto-update timestamps
```sql
-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_profiles
CREATE TRIGGER handle_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply to user_settings  
CREATE TRIGGER handle_updated_at_user_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### Create user profile on signup
```sql
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  fallback_name TEXT;
BEGIN
  -- Debug logging
  RAISE NOTICE 'Creating profile for user: %, metadata: %', NEW.email, NEW.raw_user_meta_data;
  
  -- Extract fallback name from email
  fallback_name := split_part(NEW.email, '@', 1);
  
  -- Ensure we have a fallback that's not empty
  IF fallback_name IS NULL OR fallback_name = '' THEN
    fallback_name := 'User';
  END IF;
  
  -- Try to extract name from user metadata, fallback to email prefix
  user_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    fallback_name
  );
  
  -- Final safety check - ensure we have a non-null, non-empty name
  IF user_name IS NULL OR TRIM(user_name) = '' THEN
    user_name := fallback_name;
  END IF;
  
  RAISE NOTICE 'Using name for profile: "%"', user_name;
  
  -- Insert with error handling
  BEGIN
    INSERT INTO public.user_profiles (id, name, subscription_tier, onboarding_completed)
    VALUES (NEW.id, user_name, 'free', false);
    RAISE NOTICE 'Successfully created profile for user: %', NEW.email;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create profile for user %. Error: %', NEW.email, SQLERRM;
      -- Try with just email prefix as absolute fallback
      INSERT INTO public.user_profiles (id, name, subscription_tier, onboarding_completed)
      VALUES (NEW.id, split_part(NEW.email, '@', 1), 'free', false);
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Delete user account function
```sql
-- Function to delete user account and all associated data
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- Delete user data in the correct order
  -- 1. Delete user settings
  DELETE FROM public.user_settings WHERE user_id = current_user_id;
  
  -- 2. Delete transcripts
  DELETE FROM public.transcripts WHERE user_id = current_user_id;
  
  -- 3. Delete user profile
  DELETE FROM public.user_profiles WHERE id = current_user_id;
  
  -- 4. Delete auth user (this requires admin privileges)
  -- Note: This will only work if RLS is properly configured
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Account successfully deleted'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
```

### Migration for Existing Installations
```sql
-- Add name field to existing user_profiles table (if not exists)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add onboarding_completed field to existing user_profiles table (if not exists)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing user profiles with names from email
UPDATE public.user_profiles 
SET name = split_part((SELECT email FROM auth.users WHERE auth.users.id = user_profiles.id), '@', 1)
WHERE name IS NULL;

-- Set onboarding_completed to TRUE for existing users who have user_settings (indicates they completed onboarding)
UPDATE public.user_profiles 
SET onboarding_completed = TRUE
WHERE id IN (SELECT user_id FROM public.user_settings);

-- Make name field required after populating existing records
ALTER TABLE public.user_profiles 
ALTER COLUMN name SET NOT NULL;
```

## Setup Instructions

1. Create a new Supabase project at https://supabase.com
2. Go to the SQL Editor in your Supabase dashboard
3. Run each SQL block above in order
4. Copy your project URL and anon key to your `.env.development` file
5. Update the Supabase configuration in `src/renderer/main_window/lib/supabase.ts`

## Environment Variables

Create a `.env.development` file with:
```env
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_POSTHOG_KEY=your-posthog-key
REACT_APP_POSTHOG_HOST=https://app.posthog.com
```

## Testing the Setup

After setting up the database and environment variables:

1. Start the app: `npm start`
2. Try registering a new user
3. Complete the onboarding flow
4. Test recording and transcription
5. Check that transcripts appear in the Supabase dashboard