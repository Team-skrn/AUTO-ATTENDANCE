# GitHub Pages Deployment Guide

## 📋 Quick Deployment Steps

### 1. Repository Setup
```bash
# Create new repository on GitHub
# Clone it locally
git clone https://github.com/yourusername/student-attendance-system.git
cd student-attendance-system

# Copy your files
cp -r /path/to/your/project/* .

# Commit and push
git add .
git commit -m "Initial attendance system deployment"
git push origin main
```

### 2. GitHub Pages Configuration
- Go to repository Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)
- Save

### 3. Environment Variables Setup
Create `.env` file (for local development):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ADMIN_PASSWORD=your_admin_password
```

For GitHub Pages, update `config.js` with your actual values.

## 🔧 Server-Side Auto-Close Solutions

### Option 1: Supabase Edge Functions (Recommended)
```sql
-- 1. Create auto-close function in Supabase SQL Editor
CREATE OR REPLACE FUNCTION auto_close_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE class_sessions 
  SET is_active = false 
  WHERE is_active = true 
    AND auto_close_at IS NOT NULL 
    AND auto_close_at <= NOW();
    
  -- Log the action
  INSERT INTO session_logs (action, details, created_at)
  VALUES ('auto_close', 'Closed expired sessions via cron', NOW());
END;
$$ LANGUAGE plpgsql;

-- 2. Enable pg_cron extension (if available)
-- Note: This may require Supabase Pro plan
SELECT cron.schedule('auto-close-sessions', '*/5 * * * *', 'SELECT auto_close_expired_sessions();');
```

### Option 2: GitHub Actions Cron Job
Create `.github/workflows/auto-close-sessions.yml`:
```yaml
name: Auto-Close Expired Sessions

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  auto-close:
    runs-on: ubuntu-latest
    steps:
      - name: Auto-close expired sessions
        run: |
          curl -X POST '${{ secrets.SUPABASE_URL }}/rest/v1/rpc/auto_close_expired_sessions' \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

### Option 3: Webhook Service (Zapier/Make)
1. Create a webhook in Zapier/Make
2. Schedule it to run every 5 minutes
3. Call Supabase function to close expired sessions

## 🌐 Domain Configuration

### Custom Domain (Optional)
1. Buy domain (e.g., attendance.yourschool.com)
2. Add CNAME record pointing to yourusername.github.io
3. In GitHub Pages settings, add custom domain
4. Enable "Enforce HTTPS"

### Subdomain Setup
- Point subdomain to GitHub Pages
- Update Supabase allowed origins
- Update config.js with new domain

## 🔐 Security Considerations

### Environment Variables
```javascript
// config.js - for production deployment
function getSupabaseConfig() {
  // For GitHub Pages deployment
  return {
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    adminPassword: 'YOUR_ADMIN_PASSWORD'
  };
}
```

### CORS Settings in Supabase
Add these URLs to allowed origins:
- `https://yourusername.github.io`
- `https://your-custom-domain.com` (if using custom domain)
- `http://localhost:5173` (for development)

## 📱 PWA Configuration (Optional)

Create `manifest.json`:
```json
{
  "name": "Student Attendance System",
  "short_name": "Attendance",
  "description": "QR-based student attendance tracking",
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

Add to `index.html`:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#8b5cf6">
```

## 🚀 Performance Optimization

### Enable Compression
GitHub Pages automatically serves compressed files.

### Cache Strategy
```html
<!-- In index.html -->
<meta http-equiv="Cache-Control" content="max-age=3600">
```

### CDN Assets
Use CDN versions of libraries:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

## 🔄 Auto-Deployment Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## 📊 Monitoring & Analytics

### GitHub Actions for Health Checks
```yaml
name: Health Check

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check site availability
        run: |
          curl -f https://yourusername.github.io/student-attendance-system || exit 1
```

## 🆘 Troubleshooting

### Common Issues:
1. **404 Error**: Check file paths are correct
2. **CORS Errors**: Update Supabase allowed origins
3. **Timer Not Working**: Implement server-side solution
4. **Mobile Issues**: Test responsive design

### Debug Mode:
Add to config.js:
```javascript
const DEBUG_MODE = window.location.hostname === 'localhost';
if (DEBUG_MODE) {
  console.log('Debug mode enabled');
}
```
