-- Supabase Database Schema for Student Attendance System
-- Run these SQL commands in your Supabase SQL editor

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    url_token VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, date)
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_date ON classes(date);
CREATE INDEX IF NOT EXISTS idx_classes_token ON classes(url_token);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

-- Enable Row Level Security (RLS)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
-- Allow anyone to read classes
CREATE POLICY "Public can view classes" ON classes
    FOR SELECT USING (true);

-- Allow anyone to insert new classes
CREATE POLICY "Public can create classes" ON classes
    FOR INSERT WITH CHECK (true);

-- Allow anyone to read attendance
CREATE POLICY "Public can view attendance" ON attendance
    FOR SELECT USING (true);

-- Allow anyone to mark attendance
CREATE POLICY "Public can mark attendance" ON attendance
    FOR INSERT WITH CHECK (true);

-- Optional: Create a function to clean up old classes (run daily)
CREATE OR REPLACE FUNCTION cleanup_old_classes()
RETURNS void AS $$
BEGIN
    -- Delete classes older than 30 days
    DELETE FROM classes 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a function to get attendance count for a class
CREATE OR REPLACE FUNCTION get_attendance_count(class_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM attendance
    WHERE class_id = class_uuid;
    
    RETURN count_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get attendance for a specific class and date
CREATE OR REPLACE FUNCTION get_class_attendance(
    class_name_param VARCHAR,
    date_param DATE
)
RETURNS TABLE (
    student_name VARCHAR,
    student_id VARCHAR,
    attendance_time TIMESTAMP WITH TIME ZONE,
    class_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.student_name,
        a.student_id,
        a.timestamp as attendance_time,
        c.name as class_name
    FROM attendance a
    JOIN classes c ON a.class_id = c.id
    WHERE c.name = class_name_param 
    AND c.date = date_param
    ORDER BY a.timestamp;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily attendance summary
CREATE OR REPLACE FUNCTION get_daily_summary(date_param DATE)
RETURNS TABLE (
    class_name VARCHAR,
    total_present INTEGER,
    class_date DATE,
    created_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name as class_name,
        COUNT(a.id)::INTEGER as total_present,
        c.date as class_date,
        c.created_at as created_time
    FROM classes c
    LEFT JOIN attendance a ON c.id = a.class_id
    WHERE c.date = date_param
    GROUP BY c.id, c.name, c.date, c.created_at
    ORDER BY c.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get attendance for date range
CREATE OR REPLACE FUNCTION get_attendance_range(
    start_date DATE,
    end_date DATE,
    class_filter VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    date DATE,
    class_name VARCHAR,
    student_name VARCHAR,
    student_id VARCHAR,
    attendance_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.date,
        c.name as class_name,
        a.student_name,
        a.student_id,
        a.timestamp as attendance_time
    FROM classes c
    LEFT JOIN attendance a ON c.id = a.class_id
    WHERE c.date BETWEEN start_date AND end_date
    AND (class_filter IS NULL OR c.name ILIKE '%' || class_filter || '%')
    ORDER BY c.date DESC, c.name, a.timestamp;
END;
$$ LANGUAGE plpgsql;
