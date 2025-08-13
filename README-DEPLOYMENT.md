# 🚀 Student Attendance System - GitHub Deployment

## 📋 Quick Start Guide

### 1. Repository Setup

```bash
# 1. Create a new repository on GitHub named "student-attendance-system"
# 2. Clone your repository
git clone https://github.com/yourusername/student-attendance-system.git
cd student-attendance-system

# 3. Copy all your project files to the repository
# 4. Commit and push
git add .
git commit -m "🎉 Initial deployment of attendance system"
git push origin main
```

### 2. GitHub Pages Setup

1. Go to your repository **Settings**
2. Scroll to **Pages** section  
3. Under **Source**: Choose **GitHub Actions**
4. The deployment workflow will automatically trigger

Your site will be available at:
`https://yourusername.github.io/student-attendance-system`

### 3. Environment Setup

#### A. Repository Secrets (Required for Auto-Close)
Go to Settings → Secrets and variables → Actions, add:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon public key

#### B. Update config.js
Update your `src/config.js` with production values:

```javascript
function getSupabaseConfig() {
  return {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key-here',
    adminPassword: 'your-secure-admin-password'
  };
}
```

## 🔧 Server-Side Auto-Close Setup

### Step 1: Run SQL Functions

Execute this in your **Supabase SQL Editor**:

```sql
-- Create auto-close function
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
    UPDATE class_sessions 
    SET is_active = false,
        updated_at = NOW()
    WHERE id = session_record.id;
    
    closed_count := closed_count + 1;
  END LOOP;
  
  result := json_build_object(
    'success', true,
    'closed_count', closed_count,
    'timestamp', NOW(),
    'message', format('Successfully closed %s expired session(s)', closed_count)
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

### Step 2: Test the Function

```sql
-- Test manually
SELECT auto_close_expired_sessions();
```

### Step 3: Verify Auto-Close Workflow

The GitHub Action (`.github/workflows/auto-close-sessions.yml`) will:
- Run every 5 minutes automatically
- Call your Supabase function to close expired sessions
- Log the results

## 🌐 Custom Domain (Optional)

### Setup Custom Domain

1. **Buy a domain** (e.g., `attendance.yourschool.edu`)
2. **Add DNS CNAME record**:
   - Name: `attendance` (or `@` for root domain)
   - Value: `yourusername.github.io`
3. **Configure in GitHub**:
   - Settings → Pages → Custom domain
   - Enter: `attendance.yourschool.edu`
   - Enable "Enforce HTTPS"

### Update CORS in Supabase

Add your domain to Supabase allowed origins:
- `https://yourusername.github.io`
- `https://attendance.yourschool.edu`
- `http://localhost:5173` (for development)

## 🔐 Security Considerations

### Production Checklist

- [ ] Strong admin password in config.js
- [ ] CORS properly configured in Supabase
- [ ] Repository secrets configured
- [ ] Database RLS policies active
- [ ] HTTPS enforced (automatic with GitHub Pages)

### Environment Variables Security

```javascript
// For extra security, consider environment-based config
function getSupabaseConfig() {
  // Use different configs for different environments
  const isProduction = window.location.hostname !== 'localhost';
  
  if (isProduction) {
    return {
      url: 'PRODUCTION_SUPABASE_URL',
      anonKey: 'PRODUCTION_ANON_KEY',
      adminPassword: 'PRODUCTION_ADMIN_PASSWORD'
    };
  } else {
    return {
      url: 'DEVELOPMENT_SUPABASE_URL',
      anonKey: 'DEVELOPMENT_ANON_KEY',
      adminPassword: 'dev_password'
    };
  }
}
```

## 📱 Mobile & PWA Features

### Responsive Design
The system is already mobile-responsive with:
- Touch-friendly buttons
- Responsive layouts
- Mobile QR scanning support

### PWA Setup (Optional)
To make it installable on mobile devices, add to `index.html`:

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#8b5cf6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

Create `manifest.json`:
```json
{
  "name": "Student Attendance System",
  "short_name": "Attendance",
  "description": "QR-based attendance tracking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#8b5cf6",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 📊 Monitoring & Maintenance

### GitHub Actions Monitoring

Check your workflows at:
`https://github.com/yourusername/student-attendance-system/actions`

- **Auto-Close Sessions**: Runs every 5 minutes
- **Deploy to Pages**: Runs on each push to main
- **Health Check**: Verifies site availability

### Database Monitoring

```sql
-- Check recent auto-close activities
SELECT 
  id,
  session_date,
  session_time,
  auto_close_at,
  is_active,
  updated_at
FROM class_sessions 
WHERE auto_close_at IS NOT NULL 
ORDER BY updated_at DESC 
LIMIT 10;

-- Count sessions by status
SELECT 
  is_active,
  COUNT(*) as count
FROM class_sessions 
WHERE auto_close_at IS NOT NULL 
GROUP BY is_active;
```

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 404 Page Not Found | Check GitHub Pages source settings |
| CORS Errors | Update Supabase allowed origins |
| Auto-close not working | Verify GitHub secrets and SQL function |
| Mobile QR issues | Ensure HTTPS is enabled |
| Timer display wrong | Check timezone settings |

### Debug Mode

Add to your config.js:
```javascript
const DEBUG_MODE = window.location.hostname.includes('localhost') || 
                   window.location.search.includes('debug=true');

if (DEBUG_MODE) {
  console.log('🐛 Debug mode enabled');
  // Add debug logging
}
```

### Health Check Commands

```bash
# Test your deployed site
curl -I https://yourusername.github.io/student-attendance-system

# Test auto-close endpoint manually
curl -X POST "https://your-project.supabase.co/rest/v1/rpc/public_auto_close_sessions" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🔄 Updates & Maintenance

### Updating the System

1. Make changes to your local files
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "✨ Add new feature"
   git push origin main
   ```
3. GitHub Actions will automatically deploy the updates

### Database Schema Updates

When updating database schema:
1. Run SQL updates in Supabase dashboard
2. Update your application code accordingly
3. Test locally before deploying

## 📞 Support

### Getting Help

1. **GitHub Issues**: Report bugs or request features
2. **Documentation**: Check this README and code comments
3. **Supabase Docs**: For database-related questions
4. **GitHub Pages Docs**: For deployment issues

---

## 🎉 Deployment Complete!

Your attendance system is now running on GitHub Pages with:
- ✅ Automatic deployments
- ✅ Server-side auto-close (every 5 minutes)
- ✅ HTTPS security
- ✅ Mobile-responsive design
- ✅ Health monitoring

**Next Steps:**
1. Share the URL with your instructors
2. Test creating sessions with timers
3. Verify auto-close functionality
4. Set up custom domain (optional)

Happy tracking! 📚✨
