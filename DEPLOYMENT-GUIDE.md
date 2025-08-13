# 🚀 SIMPLE DEPLOYMENT GUIDE

Follow these exact steps to get your attendance system running on GitHub:

## ✅ STEP 1: Create GitHub Account & Repository

1. **Go to github.com** and create account (if you don't have one)
2. **Click "+" button** → "New repository"
3. **Repository name**: `student-attendance-system`
4. **Make it Public** ✅
5. **DON'T check any boxes** (README, .gitignore, license)
6. **Click "Create repository"**

## ✅ STEP 2: Upload Your Files

### Option A: Using GitHub Website (Easiest)

1. **Download GitHub Desktop**: https://desktop.github.com/
2. **Clone your repository** using GitHub Desktop
3. **Copy ALL your project files** to the cloned folder
4. **Commit and push** using GitHub Desktop

### Option B: Using Git Commands (If you know command line)

```bash
# In your project folder, run these commands:
git init
git add .
git commit -m "Initial deployment of attendance system"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/student-attendance-system.git
git push -u origin main
```

## ✅ STEP 3: Enable GitHub Pages

1. **Go to your repository** on GitHub
2. **Click Settings** tab
3. **Scroll to "Pages"** on the left menu
4. **Source**: Select "GitHub Actions"
5. **Save**

Your site will be available at:
`https://YOURUSERNAME.github.io/student-attendance-system`

## ✅ STEP 4: Add Repository Secrets (For Auto-Close)

1. **Go to Settings** → **Secrets and variables** → **Actions**
2. **Click "New repository secret"**
3. **Add these secrets**:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://xbiavlxjohoxhvabevpi.supabase.co`

   **Secret 2:**
   - Name: `SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaWF2bHhqb2hveGh2YWJldnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTI1MzAsImV4cCI6MjA3MDEyODUzMH0.8K2ggHoa1LTwQczlKT3ehVc0TZSNumJ1-QzKAJ84RNw`

## ✅ STEP 5: Set Up Auto-Close in Supabase

1. **Go to your Supabase dashboard**: https://supabase.com/dashboard
2. **Open SQL Editor**
3. **Copy and paste this code** and run it:

```sql
-- Create auto-close function
CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS json AS $$
DECLARE
  closed_count integer := 0;
  session_record RECORD;
  result json;
BEGIN
  FOR session_record IN
    SELECT id FROM class_sessions
    WHERE is_active = true 
      AND auto_close_at IS NOT NULL 
      AND auto_close_at <= NOW()
  LOOP
    UPDATE class_sessions 
    SET is_active = false, updated_at = NOW()
    WHERE id = session_record.id;
    closed_count := closed_count + 1;
  END LOOP;
  
  result := json_build_object(
    'success', true,
    'closed_count', closed_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create public endpoint
CREATE OR REPLACE FUNCTION public_auto_close_sessions()
RETURNS json AS $$
BEGIN
  RETURN auto_close_expired_sessions();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public_auto_close_sessions() TO anon;
```

## ✅ STEP 6: Test Your Deployment

1. **Wait 2-3 minutes** for GitHub to deploy
2. **Visit your site**: `https://YOURUSERNAME.github.io/student-attendance-system`
3. **Test the admin login** (password: `admin123`)
4. **Create a test subject and session**

## 🎉 DONE! Your System is Live!

### What You Have Now:

✅ **Live Website** - Students can access via your GitHub Pages URL
✅ **Auto-Close Timers** - Sessions close automatically every 5 minutes
✅ **QR Code Generation** - Create QR codes for easy sharing
✅ **Real-time Database** - All data saved to Supabase
✅ **Beautiful UI** - Modern glass morphism design
✅ **CSV Downloads** - Export attendance data
✅ **Anti-Proxy Protection** - Prevents cheating

### Your URLs:

- **Admin Panel**: `https://YOURUSERNAME.github.io/student-attendance-system`
- **Student Access**: `https://YOURUSERNAME.github.io/student-attendance-system?session=TOKEN`
- **Auto-Close Monitor**: `https://github.com/YOURUSERNAME/student-attendance-system/actions`

## 🆘 If Something Goes Wrong:

1. **404 Error**: Wait 5-10 minutes, GitHub Pages takes time to deploy
2. **Database Errors**: Check your Supabase is still active
3. **Auto-Close Not Working**: Verify you added the repository secrets
4. **Can't Login**: Default password is `admin123`

## 🔄 Making Updates Later:

1. **Edit files** on your computer
2. **Push to GitHub** (using GitHub Desktop or git commands)
3. **GitHub automatically deploys** the changes

---

**Need Help?** Check the Actions tab in your GitHub repository to see deployment status!
