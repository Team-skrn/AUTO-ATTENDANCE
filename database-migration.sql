-- MIGRATION Script for Multi-Day Class Support
-- This script safely updates existing database to match JavaScript code expectations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view subjects" ON subjects;
DROP POLICY IF EXISTS "Public can create subjects" ON subjects;
DROP POLICY IF EXISTS "Public can update subjects" ON subjects;
DROP POLICY IF EXISTS "Public can view sessions" ON class_sessions;
DROP POLICY IF EXISTS "Public can create sessions" ON class_sessions;
DROP POLICY IF EXISTS "Public can update sessions" ON class_sessions;
DROP POLICY IF EXISTS "Public can view attendance" ON attendance_records;
DROP POLICY IF EXISTS "Public can mark attendance" ON attendance_records;

-- Drop existing tables if they exist (CAUTION: This will delete data!)
-- Comment out these lines if you want to keep existing data
-- DROP TABLE IF EXISTS attendance_records CASCADE;
-- DROP TABLE IF EXISTS class_sessions CASCADE; 
-- DROP TABLE IF EXISTS subjects CASCADE;

-- Create subjects/courses table (simplified to match JS code)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create class_sessions table (using session_token as expected by JS)
CREATE TABLE IF NOT EXISTS class_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME DEFAULT '09:00',
    session_token VARCHAR(50) UNIQUE NOT NULL,  -- Changed from url_token to session_token
    is_active BOOLEAN DEFAULT true,
    duration_minutes INTEGER DEFAULT NULL,  -- Session duration in minutes
    auto_close_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,  -- Automatic closure time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced attendance table (matches JS expectations with anti-proxy features)
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    browser_fingerprint VARCHAR(50),
    location_data JSONB,
    user_agent TEXT,
    is_verified BOOLEAN DEFAULT false,
    admin_notes TEXT,
    UNIQUE(session_id, student_id)
);

-- Add new columns to existing tables if they don't exist
DO $$ 
BEGIN
    -- Add columns to attendance_records if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'ip_address') THEN
        ALTER TABLE attendance_records ADD COLUMN ip_address INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'browser_fingerprint') THEN
        ALTER TABLE attendance_records ADD COLUMN browser_fingerprint VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'location_data') THEN
        ALTER TABLE attendance_records ADD COLUMN location_data JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'user_agent') THEN
        ALTER TABLE attendance_records ADD COLUMN user_agent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'is_verified') THEN
        ALTER TABLE attendance_records ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'admin_notes') THEN
        ALTER TABLE attendance_records ADD COLUMN admin_notes TEXT;
    END IF;

    -- Fix column name in class_sessions if needed (url_token -> session_token)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_sessions' AND column_name = 'url_token') THEN
        ALTER TABLE class_sessions RENAME COLUMN url_token TO session_token;
    END IF;

    -- Add timer columns to class_sessions if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_sessions' AND column_name = 'duration_minutes') THEN
        ALTER TABLE class_sessions ADD COLUMN duration_minutes INTEGER DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_sessions' AND column_name = 'auto_close_at') THEN
        ALTER TABLE class_sessions ADD COLUMN auto_close_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON class_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON class_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(marked_at);
CREATE INDEX IF NOT EXISTS idx_attendance_ip ON attendance_records(ip_address);
CREATE INDEX IF NOT EXISTS idx_attendance_fingerprint ON attendance_records(browser_fingerprint);

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust security as needed)
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public can create subjects" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update subjects" ON subjects FOR UPDATE USING (true);

CREATE POLICY "Public can view sessions" ON class_sessions FOR SELECT USING (true);
CREATE POLICY "Public can create sessions" ON class_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sessions" ON class_sessions FOR UPDATE USING (true);

CREATE POLICY "Public can view attendance" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "Public can mark attendance" ON attendance_records FOR INSERT WITH CHECK (true);

-- Function to get daily attendance report (corrected parameters)
CREATE OR REPLACE FUNCTION get_daily_attendance_report(
    p_subject_id UUID,
    p_date DATE
)
RETURNS TABLE (
    session_id UUID,
    session_date DATE,
    session_time TIME,
    student_name VARCHAR,
    student_id VARCHAR,
    marked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        cs.session_date,
        cs.session_time,
        ar.student_name,
        ar.student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date = p_date
    ORDER BY cs.session_time, ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly attendance report (corrected parameters)
CREATE OR REPLACE FUNCTION get_weekly_attendance_report(
    p_subject_id UUID
)
RETURNS TABLE (
    session_id UUID,
    session_date DATE,
    session_time TIME,
    student_name VARCHAR,
    student_id VARCHAR,
    marked_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    start_of_week DATE;
BEGIN
    -- Get start of current week (Monday)
    start_of_week := DATE_TRUNC('week', CURRENT_DATE);
    
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        cs.session_date,
        cs.session_time,
        ar.student_name,
        ar.student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN start_of_week AND (start_of_week + INTERVAL '6 days')
    ORDER BY cs.session_date, cs.session_time, ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly attendance report (corrected parameters)
CREATE OR REPLACE FUNCTION get_monthly_attendance_report(
    p_subject_id UUID
)
RETURNS TABLE (
    session_id UUID,
    session_date DATE,
    session_time TIME,
    student_name VARCHAR,
    student_id VARCHAR,
    marked_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    start_of_month DATE;
    end_of_month DATE;
BEGIN
    -- Get start and end of current month
    start_of_month := DATE_TRUNC('month', CURRENT_DATE);
    end_of_month := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        cs.session_date,
        cs.session_time,
        ar.student_name,
        ar.student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN start_of_month AND end_of_month
    ORDER BY cs.session_date, cs.session_time, ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get date range attendance report (corrected parameters)
CREATE OR REPLACE FUNCTION get_date_range_attendance_report(
    p_subject_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    session_id UUID,
    session_date DATE,
    session_time TIME,
    student_name VARCHAR,
    student_id VARCHAR,
    marked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        cs.session_date,
        cs.session_time,
        ar.student_name,
        ar.student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN p_start_date AND p_end_date
    ORDER BY cs.session_date, cs.session_time, ar.marked_at;
END;
$$ LANGUAGE plpgsql;
