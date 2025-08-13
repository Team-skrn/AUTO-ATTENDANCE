-- Simple SQL to add timer functionality to existing database
-- Run this in your Supabase SQL Editor to enable auto-close features

-- Add timer columns to class_sessions table
ALTER TABLE class_sessions 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_auto_close ON class_sessions(auto_close_at);

-- Display confirmation
SELECT 'Timer columns added successfully!' as status;
