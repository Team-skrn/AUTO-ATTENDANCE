-- Enhanced Database Schema for Student Attendance System
-- This provides better organization and more features

-- Create subjects table (for different courses/subjects)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create class_sessions table (replaces classes table)
CREATE TABLE IF NOT EXISTS class_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    url_token VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subject_id, date, start_time)
);

-- Create students table (optional - for better student management)
CREATE TABLE IF NOT EXISTS students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced attendance table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'present',
    UNIQUE(session_id, student_id)
);

-- Create daily_attendance_summary table (for quick daily reports)
CREATE TABLE IF NOT EXISTS daily_attendance_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    attendance_percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, subject_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_token ON class_sessions(url_token);
CREATE INDEX IF NOT EXISTS idx_class_sessions_subject ON class_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(marked_at);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_attendance_summary(date);

-- Enable Row Level Security (RLS)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance_summary ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public can create subjects" ON subjects FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view class sessions" ON class_sessions FOR SELECT USING (true);
CREATE POLICY "Public can create class sessions" ON class_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update class sessions" ON class_sessions FOR UPDATE USING (true);

CREATE POLICY "Public can view students" ON students FOR SELECT USING (true);
CREATE POLICY "Public can create students" ON students FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view attendance" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "Public can mark attendance" ON attendance_records FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view daily summary" ON daily_attendance_summary FOR SELECT USING (true);

-- Function to automatically update daily summary
CREATE OR REPLACE FUNCTION update_daily_attendance_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update daily summary
    INSERT INTO daily_attendance_summary (date, subject_id, present_count)
    SELECT 
        cs.date,
        cs.subject_id,
        COUNT(ar.id) as present_count
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.id = NEW.session_id
    GROUP BY cs.date, cs.subject_id
    ON CONFLICT (date, subject_id)
    DO UPDATE SET
        present_count = EXCLUDED.present_count,
        attendance_percentage = ROUND((EXCLUDED.present_count::DECIMAL / NULLIF(daily_attendance_summary.total_students, 0)) * 100, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update summary when attendance is marked
CREATE TRIGGER trigger_update_daily_summary
    AFTER INSERT ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_attendance_summary();

-- Function to get attendance report for a date range
CREATE OR REPLACE FUNCTION get_attendance_report(
    start_date DATE,
    end_date DATE,
    subject_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    date DATE,
    subject_name VARCHAR,
    session_name VARCHAR,
    total_present INTEGER,
    attendance_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.date,
        s.name as subject_name,
        cs.session_name,
        COUNT(ar.id)::INTEGER as total_present,
        ROUND((COUNT(ar.id)::DECIMAL / NULLIF(COUNT(DISTINCT ar.student_id), 0)) * 100, 2) as attendance_percentage
    FROM class_sessions cs
    JOIN subjects s ON cs.subject_id = s.id
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.date BETWEEN start_date AND end_date
    AND (subject_filter IS NULL OR cs.subject_id = subject_filter)
    GROUP BY cs.date, s.name, cs.session_name, cs.id
    ORDER BY cs.date DESC, s.name;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old sessions (run weekly)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    -- Deactivate sessions older than 7 days
    UPDATE class_sessions 
    SET is_active = false 
    WHERE date < CURRENT_DATE - INTERVAL '7 days' AND is_active = true;
    
    -- Delete sessions older than 90 days
    DELETE FROM class_sessions 
    WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Insert some sample subjects
INSERT INTO subjects (name, code, description) VALUES 
('Data Structures', 'CS101', 'Introduction to Data Structures and Algorithms'),
('Database Systems', 'CS201', 'Database Design and Management'),
('Web Development', 'CS301', 'Full Stack Web Development')
ON CONFLICT (code) DO NOTHING;
