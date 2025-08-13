# Student Attendance System

A modern web-based attendance tracking system that generates daily-changing URLs and QR codes for easy student attendance marking. Built with Vite, Supabase, and designed for GitHub Pages deployment.

## 🌟 Features

- **Daily-changing URLs**: Each class gets a unique URL that changes daily for security
- **QR Code Generation**: Automatic QR code creation for easy sharing with students
- **Real-time Database**: Powered by Supabase for reliable data storage
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **GitHub Pages Deployment**: Easy hosting with automatic deployment
- **Class Management**: Create and manage multiple classes per day
- **Attendance Tracking**: Students can mark attendance with name and ID
- **Duplicate Prevention**: Prevents multiple attendance entries per student per class

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- A Supabase account and project
- A GitHub account for hosting

### 1. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL commands from `database-schema.sql` to create the required tables
4. Get your Project URL and Anon Key from Settings > API

### 2. Configure the Application

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. Alternatively, update `src/config.js` directly with your credentials

### 3. Install and Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🏗️ Deployment to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

1. Push your code to a GitHub repository
2. Go to your repository's Settings > Secrets and variables > Actions
3. Add these secrets:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
4. Go to Settings > Pages and set source to "GitHub Actions"
5. Push to the main branch to trigger automatic deployment

### Option 2: Manual Deployment

```bash
# Build the project
npm run build

# Deploy to gh-pages branch (install gh-pages first: npm install -g gh-pages)
npx gh-pages -d dist
```

## 📱 How to Use

### For Teachers/Administrators:

1. **Create a Class**:
   - Enter the class name (e.g., "CS101 - Data Structures")
   - Click "Create Class"
   - A unique URL and QR code will be generated

2. **Share with Students**:
   - Share the generated URL or QR code
   - Students can scan the QR code or visit the URL directly

3. **Monitor Attendance**:
   - Click "View" next to any class to see attendance records
   - Each student can only mark attendance once per class

### For Students:

1. **Access the Attendance Link**:
   - Scan the QR code or visit the URL provided by your teacher
   - The page will automatically show the attendance form

2. **Mark Attendance**:
   - Enter your full name
   - Enter your student ID
   - Click "Mark Attendance"
   - You'll see a confirmation message

## 🗃️ Database Schema

### Classes Table
- `id`: Unique identifier (UUID)
- `name`: Class name
- `date`: Date of the class
- `url_token`: Unique daily token for URL generation
- `created_at`: Timestamp of creation

### Attendance Table
- `id`: Unique identifier (UUID)
- `class_id`: Reference to the class
- `student_name`: Student's name
- `student_id`: Student's ID number
- `timestamp`: When attendance was marked

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

### Vite Configuration

The `vite.config.js` is configured for GitHub Pages deployment. Update the `base` path if deploying to a different location:

```javascript
export default defineConfig({
  base: '/your-repo-name/',
  // ... other config
})
```

## 🛡️ Security Features

- **Daily Token Generation**: URLs change every day automatically
- **Duplicate Prevention**: Students cannot mark attendance multiple times
- **Input Validation**: All user inputs are validated
- **Supabase RLS**: Row Level Security enabled for data protection

## 🔄 Daily URL Changes

The system automatically generates new URLs for each class every day using:
- Class name
- Current date
- Random component
- Base64 encoding with character filtering

This ensures that old URLs become invalid and new ones are required daily.

## 📊 Features in Detail

### QR Code Generation
- High-quality QR codes with custom styling
- 256x256 pixel resolution
- Error correction level M
- Custom colors matching the app theme

### Responsive Design
- Mobile-first approach
- Touch-friendly interface
- Optimized for both phone and desktop use
- Progressive enhancement

### Real-time Updates
- Instant feedback on actions
- Live attendance status updates
- Error handling with user-friendly messages

## 🚧 Future Enhancements

- [ ] Attendance analytics and reporting
- [ ] Email notifications for attendance records
- [ ] Bulk class creation
- [ ] Export attendance data to CSV/Excel
- [ ] Student authentication system
- [ ] Class scheduling integration
- [ ] Mobile app using Capacitor

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify your Supabase credentials are correct
3. Ensure the database schema is properly set up
4. Check that your Supabase project has the correct RLS policies

For additional help, please open an issue in the GitHub repository.

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
