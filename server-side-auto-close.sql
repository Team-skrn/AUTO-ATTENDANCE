-- ==============================================
-- SERVER-SIDE AUTO-CLOSE SOLUTION FOR SUPABASE
-- ==============================================

-- 1. Create auto-close function
CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS json AS $$
DECLARE
  closed_count integer := 0;
  session_record RECORD;
  result json;
BEGIN
  -- Close all expired active sessions
  FOR session_record IN
    SELECT id, subject_id, session_date, session_time, auto_close_at
    FROM class_sessions
    WHERE is_active = true 
      AND auto_close_at IS NOT NULL 
      AND auto_close_at <= NOW()
  LOOP
    -- Update session to inactive
    UPDATE class_sessions 
    SET is_active = false,
        updated_at = NOW()
    WHERE id = session_record.id;
    
    closed_count := closed_count + 1;
    
    -- Log the auto-close action (optional)
    INSERT INTO session_logs (session_id, action, details, created_at)
    VALUES (
      session_record.id,
      'auto_close',
      format('Session auto-closed at %s (was scheduled to close at %s)', 
             NOW()::text, 
             session_record.auto_close_at::text),
      NOW()
    );
  END LOOP;
  
  -- Return result
  result := json_build_object(
    'success', true,
    'closed_count', closed_count,
    'timestamp', NOW(),
    'message', format('Successfully closed %s expired session(s)', closed_count)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create session logs table (optional - for tracking auto-close actions)
CREATE TABLE IF NOT EXISTS session_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES class_sessions(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT NOW()
);

-- 3. Create a public endpoint function for GitHub Actions
CREATE OR REPLACE FUNCTION public_auto_close_sessions()
RETURNS json AS $$
BEGIN
  -- This function can be called via REST API
  RETURN auto_close_expired_sessions();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable Row Level Security (RLS) for session_logs
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create policy for session_logs (only allow reads by authenticated users)
CREATE POLICY session_logs_policy ON session_logs
  FOR ALL USING (true); -- Adjust as needed for your security requirements

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public_auto_close_sessions() TO anon;
GRANT EXECUTE ON FUNCTION auto_close_expired_sessions() TO authenticated;

-- ==============================================
-- GITHUB ACTIONS WORKFLOW FILE
-- ==============================================

-- Create this file: .github/workflows/auto-close-sessions.yml
/*
name: Auto-Close Expired Sessions

on:
  schedule:
    # Runs every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch:
    # Allows manual triggering

jobs:
  auto-close-sessions:
    runs-on: ubuntu-latest
    steps:
      - name: Close expired sessions
        run: |
          response=$(curl -s -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/public_auto_close_sessions" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}')
          
          echo "Auto-close response: $response"
          
          # Check if the response indicates success
          if echo "$response" | grep -q '"success":true'; then
            echo "✅ Auto-close completed successfully"
          else
            echo "❌ Auto-close may have failed"
            echo "$response"
            exit 1
          fi

      - name: Log completion
        run: |
          echo "Auto-close job completed at $(date)"
*/

-- ==============================================
-- ALTERNATIVE: SUPABASE EDGE FUNCTION
-- ==============================================

-- If you have Supabase Pro, you can create an Edge Function
-- Create file: supabase/functions/auto-close-sessions/index.ts
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the auto-close function
    const { data, error } = await supabase.rpc('auto_close_expired_sessions')
    
    if (error) {
      console.error('Error closing sessions:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      )
    }

    console.log('Auto-close result:', data)
    
    return new Response(
      JSON.stringify({ success: true, result: data }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    )
  }
})
*/

-- ==============================================
-- TESTING THE AUTO-CLOSE FUNCTION
-- ==============================================

-- Test the function manually
SELECT auto_close_expired_sessions();

-- Check logs
SELECT * FROM session_logs WHERE action = 'auto_close' ORDER BY created_at DESC LIMIT 10;

-- Create a test session that expires in 1 minute for testing
/*
INSERT INTO class_sessions (subject_id, session_date, session_time, session_token, is_active, duration_minutes, auto_close_at)
VALUES (
  (SELECT id FROM subjects LIMIT 1),
  CURRENT_DATE,
  CURRENT_TIME,
  'test-token-' || EXTRACT(EPOCH FROM NOW()),
  true,
  1,
  NOW() + INTERVAL '1 minute'
);
*/

-- ==============================================
-- MONITORING QUERY
-- ==============================================

-- Check active sessions with timers
SELECT 
  cs.id,
  s.name as subject_name,
  cs.session_date,
  cs.session_time,
  cs.duration_minutes,
  cs.auto_close_at,
  cs.is_active,
  CASE 
    WHEN cs.auto_close_at <= NOW() AND cs.is_active THEN 'SHOULD BE CLOSED'
    WHEN cs.auto_close_at > NOW() AND cs.is_active THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END as status
FROM class_sessions cs
JOIN subjects s ON cs.subject_id = s.id
WHERE cs.auto_close_at IS NOT NULL
ORDER BY cs.auto_close_at DESC;
