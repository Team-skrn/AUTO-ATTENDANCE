-- Fix for reporting functions to properly handle sessions without attendance
-- Run this in your Supabase SQL Editor to fix the null reporting issues

-- Updated function to get daily attendance report (with better null handling)
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
        COALESCE(ar.student_name, NULL) as student_name,
        COALESCE(ar.student_id, NULL) as student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date = p_date
    ORDER BY cs.session_time, ar.marked_at NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Updated function to get weekly attendance report (with better null handling)
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
        COALESCE(ar.student_name, NULL) as student_name,
        COALESCE(ar.student_id, NULL) as student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN start_of_week AND (start_of_week + INTERVAL '6 days')
    ORDER BY cs.session_date, cs.session_time, ar.marked_at NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Updated function to get monthly attendance report (with better null handling)
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
        COALESCE(ar.student_name, NULL) as student_name,
        COALESCE(ar.student_id, NULL) as student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN start_of_month AND end_of_month
    ORDER BY cs.session_date, cs.session_time, ar.marked_at NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Updated function to get date range attendance report (with better null handling)
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
        COALESCE(ar.student_name, NULL) as student_name,
        COALESCE(ar.student_id, NULL) as student_id,
        ar.marked_at
    FROM class_sessions cs
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.subject_id = p_subject_id 
    AND cs.session_date BETWEEN p_start_date AND p_end_date
    ORDER BY cs.session_date, cs.session_time, ar.marked_at NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Display confirmation
SELECT 'Reporting functions updated successfully!' as status;

-- Function to get attendance for a specific session
CREATE OR REPLACE FUNCTION get_session_attendance_report(
    p_session_id UUID
)
RETURNS TABLE (
    session_id UUID,
    session_date DATE,
    session_time TIME,
    subject_name VARCHAR,
    student_name VARCHAR,
    student_id VARCHAR,
    marked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    browser_fingerprint TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        cs.session_date,
        cs.session_time,
        s.name as subject_name,
        COALESCE(ar.student_name, NULL) as student_name,
        COALESCE(ar.student_id, NULL) as student_id,
        ar.marked_at,
        ar.ip_address,
        ar.browser_fingerprint
    FROM class_sessions cs
    LEFT JOIN subjects s ON cs.subject_id = s.id
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id
    WHERE cs.id = p_session_id
    ORDER BY ar.marked_at NULLS LAST;
END;
$$ LANGUAGE plpgsql;
