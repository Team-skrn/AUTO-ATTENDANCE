-- Enhanced Database Schema for Multi-Day Class Support
-- This supports multiple sessions for each class with date selection and reporting

-- Create subjects/courses table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    instructor VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create class_sessions table (multiple sessions per subject)
CREATE TABLE IF NOT EXISTS class_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME DEFAULT '09:00',
    session_name VARCHAR(255), -- e.g., "Lecture 1", "Lab Session"
    url_token VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subject_id, session_date, session_time)
);

-- Enhanced attendance table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    status VARCHAR(20) DEFAULT 'present',
    UNIQUE(session_id, student_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON class_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON class_sessions(url_token);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(marked_at);

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public can create subjects" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update subjects" ON subjects FOR UPDATE USING (true);

CREATE POLICY "Public can view sessions" ON class_sessions FOR SELECT USING (true);
CREATE POLICY "Public can create sessions" ON class_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sessions" ON class_sessions FOR UPDATE USING (true);

CREATE POLICY "Public can view attendance" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "Public can mark attendance" ON attendance_records FOR INSERT WITH CHECK (true);

-- Function to get daily attendance report
CREATE OR REPLACE FUNCTION get_daily_attendance_report(
    subject_id_param UUID,
    date_param DATE
)
RETURNS TABLE (
    student_name VARCHAR,
    student_id VARCHAR,
    attendance_time TIMESTAMP WITH TIME ZONE,
    session_name VARCHAR,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.student_name,
        ar.student_id,
        ar.marked_at as attendance_time,
        cs.session_name,
        ar.status
    FROM attendance_records ar
    JOIN class_sessions cs ON ar.session_id = cs.id
    WHERE cs.subject_id = subject_id_param 
    AND cs.session_date = date_param
    ORDER BY ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly attendance report
CREATE OR REPLACE FUNCTION get_weekly_attendance_report(
    subject_id_param UUID,
    start_date DATE
)
RETURNS TABLE (
    session_date DATE,
    session_name VARCHAR,
    student_name VARCHAR,
    student_id VARCHAR,
    attendance_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.session_date,
        cs.session_name,
        ar.student_name,
        ar.student_id,
        ar.marked_at as attendance_time,
        ar.status
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = subject_id_param 
    AND cs.session_date BETWEEN start_date AND (start_date + INTERVAL '6 days')
    ORDER BY cs.session_date, ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly attendance report
CREATE OR REPLACE FUNCTION get_monthly_attendance_report(
    subject_id_param UUID,
    year_param INTEGER,
    month_param INTEGER
)
RETURNS TABLE (
    session_date DATE,
    session_name VARCHAR,
    total_present INTEGER,
    student_list TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.session_date,
        cs.session_name,
        COUNT(ar.id)::INTEGER as total_present,
        STRING_AGG(ar.student_name || ' (' || ar.student_id || ')', ', ') as student_list
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = subject_id_param 
    AND EXTRACT(YEAR FROM cs.session_date) = year_param
    AND EXTRACT(MONTH FROM cs.session_date) = month_param
    GROUP BY cs.session_date, cs.session_name, cs.id
    ORDER BY cs.session_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get date range attendance report
CREATE OR REPLACE FUNCTION get_date_range_attendance_report(
    subject_id_param UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    session_date DATE,
    session_name VARCHAR,
    student_name VARCHAR,
    student_id VARCHAR,
    attendance_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.session_date,
        cs.session_name,
        ar.student_name,
        ar.student_id,
        ar.marked_at as attendance_time,
        ar.status
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = subject_id_param 
    AND cs.session_date BETWEEN start_date AND end_date
    ORDER BY cs.session_date, ar.marked_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get attendance summary by student
CREATE OR REPLACE FUNCTION get_student_attendance_summary(
    subject_id_param UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    student_name VARCHAR,
    student_id VARCHAR,
    total_sessions INTEGER,
    attended_sessions INTEGER,
    attendance_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH session_count AS (
        SELECT COUNT(*) as total_sessions
        FROM class_sessions
        WHERE subject_id = subject_id_param
        AND session_date BETWEEN start_date AND end_date
    ),
    student_attendance AS (
        SELECT 
            ar.student_name,
            ar.student_id,
            COUNT(*) as attended_sessions
        FROM attendance_records ar
        JOIN class_sessions cs ON ar.session_id = cs.id
        WHERE cs.subject_id = subject_id_param
        AND cs.session_date BETWEEN start_date AND end_date
        GROUP BY ar.student_name, ar.student_id
    )
    SELECT 
        COALESCE(sa.student_name, 'Unknown') as student_name,
        COALESCE(sa.student_id, 'Unknown') as student_id,
        sc.total_sessions::INTEGER,
        COALESCE(sa.attended_sessions, 0)::INTEGER as attended_sessions,
        ROUND((COALESCE(sa.attended_sessions, 0)::DECIMAL / NULLIF(sc.total_sessions, 0)) * 100, 2) as attendance_percentage
    FROM session_count sc
    CROSS JOIN student_attendance sa
    ORDER BY sa.student_name;
END;
$$ LANGUAGE plpgsql;

-- Insert sample subjects
INSERT INTO subjects (name, code, description, instructor) VALUES 
('Data Structures and Algorithms', 'CS101', 'Introduction to Data Structures and Algorithms', 'Dr. Smith'),
('Database Management Systems', 'CS201', 'Database Design and Management', 'Dr. Johnson'),
('Web Development', 'CS301', 'Full Stack Web Development', 'Prof. Brown'),
('Machine Learning', 'CS401', 'Introduction to Machine Learning', 'Dr. Davis')
ON CONFLICT (code) DO NOTHING;
