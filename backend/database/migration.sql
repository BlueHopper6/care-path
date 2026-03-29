-- ============================================================================
-- CarePath Database Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Users table (Preferences)
-- Mirrors auth.users to store application-specific settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_save_history BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own preferences
CREATE POLICY "Users can view own preferences" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own preferences" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own preferences" ON public.users FOR UPDATE USING (auth.uid() = id);


-- 2. Documents table
-- Stores the raw medical text uploaded by users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user-specific queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can only read their own documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);


-- 2. Analyses table
-- Stores the AI-generated analysis results linked to a document.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analyses (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id      UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  summary          TEXT NOT NULL,
  action_plan      JSONB DEFAULT '[]'::jsonb,
  recurring_tasks  JSONB DEFAULT '[]'::jsonb,
  questions        JSONB DEFAULT '[]'::jsonb,
  warnings         JSONB DEFAULT '[]'::jsonb,
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
  language         TEXT DEFAULT 'English',
  mode             TEXT DEFAULT 'default',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user-specific queries
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);

-- Index for document lookups
CREATE INDEX IF NOT EXISTS idx_analyses_document_id ON public.analyses(document_id);

-- Enable RLS
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Users can only read their own analyses
CREATE POLICY "Users can view own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can insert own analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses"
  ON public.analyses FOR DELETE
  USING (auth.uid() = user_id);
