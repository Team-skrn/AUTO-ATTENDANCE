# Copilot Instructions for Student Attendance System

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a web-based student attendance tracking system built with:
- **Frontend**: Vite + Vanilla JavaScript
- **Database**: Supabase
- **Hosting**: GitHub Pages
- **QR Code Generation**: qrcode library

## Key Features
- Daily-changing URLs for each class
- QR code generation for easy sharing
- Student attendance tracking with Supabase
- Responsive web design
- GitHub Pages deployment

## Code Style Guidelines
- Use modern JavaScript (ES6+)
- Follow semantic HTML structure
- Use CSS Grid/Flexbox for layouts
- Implement proper error handling
- Use async/await for database operations

## Database Schema
- Classes table: id, name, date, url_token
- Attendance table: id, class_id, student_name, student_id, timestamp

## Security Considerations
- Validate all user inputs
- Use environment variables for Supabase keys
- Implement proper CORS settings
- Generate secure daily tokens
