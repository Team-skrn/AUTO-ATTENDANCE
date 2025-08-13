import './style.css';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { getSupabaseConfig } from './config.js';

class AttendanceSystem {
  constructor() {
    const config = getSupabaseConfig();
    this.supabase = createClient(config.url, config.anonKey);
    this.currentView = 'home';
    this.isAuthenticated = false;
    this.currentSubject = null;
    this.adminPassword = config.adminPassword;
    this.isStudentOnly = this.checkStudentOnlyMode();
    this.init();
  }

  checkStudentOnlyMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('attend') || urlParams.has('session');
  }

  async init() {
    console.log('Initializing AttendanceSystem...');
    
    // Test Supabase connection
    try {
      console.log('Testing Supabase connection...');
      const { data: testData, error: testError } = await this.supabase
        .from('subjects')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Supabase connection test failed:', testError);
      } else {
        console.log('Supabase connection successful:', testData);
      }
    } catch (connError) {
      console.error('Supabase connection error:', connError);
    }
    
    // Check for timer features availability
    try {
      const { error: timerCheck } = await this.supabase
        .from('class_sessions')
        .select('duration_minutes, auto_close_at')
        .limit(1);
      
      if (timerCheck) {
        console.log('Timer features not available - basic session management only');
        this.hasTimerFeatures = false;
      } else {
        console.log('Timer features available - full functionality enabled');
        this.hasTimerFeatures = true;
      }
    } catch (timerError) {
      console.log('Timer feature check failed - using basic functionality');
      this.hasTimerFeatures = false;
    }
    
    this.setupEventListeners();
    
    if (this.isStudentOnly) {
      console.log('Student-only mode detected');
      document.body.classList.add('student-only');
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('attend') || urlParams.get('session');
      if (sessionId) {
        await this.loadStudentAttendanceView(sessionId);
      }
    } else {
      console.log('Normal mode - showing home view');
      this.showHome();
    }
  }

  setupEventListeners() {
    // Navigation
    document.getElementById('homeBtn').addEventListener('click', () => this.showHome());
    document.getElementById('createBtn').addEventListener('click', () => this.showCreateSubject());
    document.getElementById('classesBtn').addEventListener('click', () => this.showSubjects());
    document.getElementById('reportsBtn').addEventListener('click', () => this.showReports());

    // Subject management
    document.getElementById('createSubjectBtn').addEventListener('click', () => this.createSubject());
    
    // Session management
    document.getElementById('createSessionBtn').addEventListener('click', () => this.createSession());
    
    // Attendance
    document.getElementById('markAttendanceBtn').addEventListener('click', () => this.markAttendance());
    
    // Reports
    document.getElementById('generateReportBtn').addEventListener('click', () => this.generateReport());
    document.getElementById('downloadReportBtn').addEventListener('click', () => this.downloadReport());
    
    // Report type change handler
    document.getElementById('reportType').addEventListener('change', () => this.handleReportTypeChange());
    
    // Auto-uppercase student inputs
    document.getElementById('studentName').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
    document.getElementById('studentId').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
    
    // Modal
    document.getElementById('passwordSubmit').addEventListener('click', () => this.authenticateAdmin());
    document.getElementById('modalCancel').addEventListener('click', () => this.hidePasswordModal());
    
    // Session Attendance Modal
    document.getElementById('downloadSessionAttendance').addEventListener('click', () => this.downloadSessionAttendance());
    document.getElementById('closeSessionModal').addEventListener('click', () => this.hideSessionAttendanceModal());
    
    // Password input enter key
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.authenticateAdmin();
    });

    // Timer options event listeners
    const timerSelect = document.getElementById('sessionTimer');
    const customTimerDiv = document.getElementById('customTimerDiv');
    
    if (timerSelect) {
      timerSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customTimerDiv.style.display = 'flex';
          document.getElementById('customTimer').required = true;
        } else {
          customTimerDiv.style.display = 'none';
          document.getElementById('customTimer').required = false;
        }
      });
    }

    // Auto-refresh for session monitoring - check more frequently
    setInterval(() => {
      // Check for expired sessions regardless of current view
      this.updateSessionTimers();
    }, 10000); // Check every 10 seconds for better responsiveness

    console.log('Event listeners setup complete');
  }

  showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('passwordInput').focus();
  }

  hidePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('passwordInput').value = '';
  }

  hideSessionAttendanceModal() {
    const modal = document.getElementById('sessionAttendanceModal');
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      modal.style.opacity = '1'; // Reset for next time
    }, 300);
    this.currentSessionData = null;
  }

  authenticateAdmin() {
    const password = document.getElementById('passwordInput').value;
    if (password === this.adminPassword) {
      this.isAuthenticated = true;
      this.hidePasswordModal();
      this.showCreateSubject();
    } else {
      alert('Incorrect password');
      document.getElementById('passwordInput').value = '';
    }
  }

  requireAuth() {
    if (!this.isAuthenticated) {
      this.showPasswordModal();
      return false;
    }
    return true;
  }

  updateNavigation(activeView) {
    // Remove active class from all navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to current view button
    const buttonMap = {
      'home': 'homeBtn',
      'createSubject': 'createBtn', 
      'subjects': 'classesBtn',
      'reports': 'reportsBtn'
    };
    
    if (buttonMap[activeView]) {
      document.getElementById(buttonMap[activeView]).classList.add('active');
    }
  }

  hideAllViews() {
    const views = ['homeView', 'createSubjectView', 'subjectView', 'sessionView', 'attendanceView', 'reportsView'];
    views.forEach(view => {
      document.getElementById(view).style.display = 'none';
    });
  }

  showHome() {
    this.hideAllViews();
    this.currentView = 'home';
    this.updateNavigation('home');
    document.getElementById('homeView').style.display = 'block';
    console.log('Showing home view');
  }

  showCreateSubject() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'createSubject';
    this.updateNavigation('createSubject');
    document.getElementById('createSubjectView').style.display = 'block';
    console.log('Showing create subject view');
  }

  async showSubjects() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'subjects';
    this.updateNavigation('subjects');
    document.getElementById('subjectView').style.display = 'block';
    await this.loadSubjects();
    console.log('Showing subjects view');
  }

  async showReports() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'reports';
    this.updateNavigation('reports');
    document.getElementById('reportsView').style.display = 'block';
    await this.loadSubjectsForReports();
    this.handleReportTypeChange(); // Initialize the date controls visibility
    console.log('Showing reports view');
  }

  handleReportTypeChange() {
    const reportType = document.getElementById('reportType').value;
    const dateControls = document.querySelector('.date-controls');
    
    if (reportType === 'range') {
      dateControls.classList.add('show-dates');
    } else {
      dateControls.classList.remove('show-dates');
    }
    
    // Clear date inputs when not in range mode
    if (reportType !== 'range') {
      document.getElementById('startDate').value = '';
      document.getElementById('endDate').value = '';
    }
  }

  async createSubject() {
    const name = document.getElementById('subjectName').value.trim();
    const description = document.getElementById('subjectDescription').value.trim();
    
    if (!name) {
      alert('Please enter a subject name');
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .insert([{ name, description }])
        .select();

      if (error) throw error;

      alert('Subject created successfully!');
      document.getElementById('subjectName').value = '';
      document.getElementById('subjectDescription').value = '';
      
      // Refresh subjects list if we're viewing it
      if (this.currentView === 'subjects') {
        await this.loadSubjects();
      }
    } catch (error) {
      console.error('Error creating subject:', error);
      alert('Error creating subject. Please try again.');
    }
  }

  async loadSubjects() {
    try {
      const { data: subjects, error } = await this.supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subjectsList = document.getElementById('subjectsList');
      if (subjects.length === 0) {
        subjectsList.innerHTML = '<p>No subjects created yet.</p>';
        return;
      }

      subjectsList.innerHTML = subjects.map(subject => `
        <div class="subject-card">
          <h3>${subject.name}</h3>
          <p>${subject.description || 'No description'}</p>
          <button onclick="attendanceSystem.showSubjectSessions('${subject.id}', '${subject.name}')">
            Manage Sessions
          </button>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading subjects:', error);
      document.getElementById('subjectsList').innerHTML = '<p>Error loading subjects.</p>';
    }
  }

  async showSubjectSessions(subjectId, subjectName) {
    this.currentSubject = { id: subjectId, name: subjectName };
    this.hideAllViews();
    document.getElementById('sessionView').style.display = 'block';
    document.getElementById('currentSubjectName').textContent = subjectName;
    
    // Set default date and time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    document.getElementById('sessionDate').value = today;
    document.getElementById('sessionTime').value = currentTime;
    
    await this.loadSessions(subjectId);
  }

  async loadSessions(subjectId) {
    try {
      const { data: sessions, error } = await this.supabase
        .from('class_sessions')
        .select(`
          *,
          attendance_count:attendance_records(count)
        `)
        .eq('subject_id', subjectId)
        .order('session_date', { ascending: false });

      if (error) throw error;

      const sessionsList = document.getElementById('sessionsList');
      if (sessions.length === 0) {
        sessionsList.innerHTML = '<p>No sessions created yet.</p>';
        return;
      }

      sessionsList.innerHTML = sessions.map(session => {
        const date = new Date(session.session_date).toLocaleDateString();
        const time = session.session_time || 'No time specified';
        const attendanceCount = session.attendance_count[0]?.count || 0;
        
        return `
          <div class="session-card">
            <h4>Session: ${date} at ${time}</h4>
            <p>Students attended: ${attendanceCount}</p>
            <p>Status: ${session.is_active ? 'Active' : 'Inactive'}</p>
            ${this.getTimerStatusHTML(session)}
            <div class="session-actions">
              <button onclick="attendanceSystem.generateQRCode('${session.id}')">
                Generate QR Code
              </button>
              <button onclick="attendanceSystem.toggleSession('${session.id}', ${!session.is_active})">
                ${session.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onclick="attendanceSystem.viewSessionAttendance('${session.id}')">
                View Attendance
              </button>
              <button onclick="attendanceSystem.quickDownloadSessionAttendance('${session.id}', '${date}', '${time}')" 
                      ${attendanceCount === 0 ? 'disabled title="No attendance to download"' : ''}>
                📥 Download CSV
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading sessions:', error);
      document.getElementById('sessionsList').innerHTML = '<p>Error loading sessions.</p>';
    }
  }

  async createSession() {
    const date = document.getElementById('sessionDate').value;
    const time = document.getElementById('sessionTime').value;
    const timerSelect = document.getElementById('sessionTimer');
    const customTimerInput = document.getElementById('customTimer');
    
    if (!date || !time) {
      alert('Please select both date and time');
      return;
    }

    if (!this.currentSubject) {
      alert('No subject selected');
      return;
    }

    console.log('Starting session creation...');
    console.log('Current subject:', this.currentSubject);
    console.log('Date:', date, 'Time:', time);

    // Calculate timer values
    let durationMinutes = null;
    let autoCloseAt = null;
    
    if (timerSelect && timerSelect.value !== 'none' && timerSelect.value !== '') {
      if (timerSelect.value === 'custom') {
        const customValue = parseInt(customTimerInput.value);
        if (!customValue || customValue < 1) {
          alert('Please enter a valid custom duration (minimum 1 minute)');
          return;
        }
        durationMinutes = customValue;
      } else {
        durationMinutes = parseInt(timerSelect.value);
      }
      
      // Calculate auto-close time based on session time + duration
      const sessionDateTime = new Date(`${date}T${time}`);
      autoCloseAt = new Date(sessionDateTime.getTime() + (durationMinutes * 60000));
    }

    try {
      let sessionToken;
      let attempts = 0;
      let sessionData;
      
      // Retry logic for unique token generation
      while (attempts < 5) { // Increased attempts
        sessionToken = this.generateDailyToken();
        console.log(`Attempt ${attempts + 1}: Generated token:`, sessionToken);
        console.log('Token length:', sessionToken.length);
        
        // Add a small delay between attempts to ensure different timestamps
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Start with basic session data (always works)
        const basicSessionData = {
          subject_id: this.currentSubject.id,
          session_date: date,
          session_time: time,
          session_token: sessionToken,
          is_active: true
        };

        // Only add timer data if the database supports it
        // We'll check this by attempting a simple query first
        let supportsTimerFeatures = false;
        try {
          const { error: schemaCheck } = await this.supabase
            .from('class_sessions')
            .select('duration_minutes, auto_close_at')
            .limit(1);
          
          if (!schemaCheck) {
            supportsTimerFeatures = true;
            console.log('Timer features are supported by database');
          } else {
            console.log('Timer features not supported:', schemaCheck.message);
          }
        } catch (schemaError) {
          console.log('Timer features not available in database schema');
        }

        // Add timer data only if database supports it and timer is set
        if (supportsTimerFeatures && durationMinutes) {
          basicSessionData.duration_minutes = durationMinutes;
          basicSessionData.auto_close_at = autoCloseAt.toISOString();
          console.log('Added timer data to session');
        } else if (durationMinutes) {
          console.log('Timer requested but database does not support timer columns - creating session without timer');
        }

        console.log('Creating session with data:', basicSessionData);
        
        const { data, error } = await this.supabase
          .from('class_sessions')
          .insert([basicSessionData])
          .select();

        console.log('Supabase response - data:', data);
        console.log('Supabase response - error:', error);

        if (error) {
          console.error('Session creation error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          
          if (error.code === '23505' && (error.message.includes('session_token') || (error.details && error.details.includes('session_token')))) {
            // Unique constraint violation on session_token, try again
            console.warn(`Token collision on attempt ${attempts + 1}, retrying with new token...`);
            attempts++;
            continue;
          } else {
            // Different error, throw immediately
            const errorMsg = error.message || 'Unknown database error';
            throw new Error(`Database error: ${errorMsg}`);
          }
        }

        // Success!
        sessionData = data;
        break;
      }

      if (attempts >= 5) {
        throw new Error('Failed to generate unique session token after 5 attempts. Please try again in a moment.');
      }

      console.log('Session created successfully:', sessionData);
      
      // Schedule auto-close if timer is set and database supports it
      if (autoCloseAt && sessionData && sessionData[0] && durationMinutes) {
        try {
          this.scheduleSessionAutoClose(sessionData[0].id, autoCloseAt);
          console.log('Auto-close scheduled for session');
        } catch (timerError) {
          console.log('Auto-close scheduling failed:', timerError.message);
          // Continue without auto-close functionality
        }
      }
      
      alert('Session created successfully!');
      await this.loadSessions(this.currentSubject.id);
      
    } catch (error) {
      console.error('Complete error details:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error.constructor.name);
      alert(`Error creating session: ${error.message || 'Unknown error'}. Please try again.`);
    }
  }

  scheduleSessionAutoClose(sessionId, autoCloseAt) {
    const now = new Date();
    const timeUntilClose = autoCloseAt.getTime() - now.getTime();
    
    if (timeUntilClose > 0) {
      console.log(`Session ${sessionId} scheduled to auto-close in ${Math.round(timeUntilClose / 60000)} minutes`);
      
      setTimeout(async () => {
        try {
          const { error } = await this.supabase
            .from('class_sessions')
            .update({ is_active: false })
            .eq('id', sessionId);
            
          if (!error) {
            console.log(`Session ${sessionId} automatically closed`);
            // Refresh the sessions view if we're still in admin mode
            if (this.currentSubject) {
              await this.loadSessions(this.currentSubject.id);
            }
          }
        } catch (error) {
          console.error('Error auto-closing session:', error);
        }
      }, timeUntilClose);
    }
  }

  async updateSessionTimers() {
    try {
      // Check if timer columns exist in the database
      const { data: testData, error: testError } = await this.supabase
        .from('class_sessions')
        .select('duration_minutes, auto_close_at')
        .limit(1);
      
      if (testError) {
        console.debug('Timer columns not available in database:', testError.message);
        return; // Silently skip timer functionality
      }

      // Check for ALL expired sessions across ALL subjects, not just current one
      const { data: sessions, error } = await this.supabase
        .from('class_sessions')
        .select('id, auto_close_at, is_active, subject_id')
        .eq('is_active', true)
        .not('auto_close_at', 'is', null);

      if (error) {
        console.debug('Timer query failed:', error.message);
        return;
      }
      
      const now = new Date();
      let closedCount = 0;
      
      for (const session of sessions) {
        const autoCloseAt = new Date(session.auto_close_at);
        if (now >= autoCloseAt) {
          // Session should be closed
          const { error: closeError } = await this.supabase
            .from('class_sessions')
            .update({ is_active: false })
            .eq('id', session.id);
          
          if (!closeError) {
            console.log(`Session ${session.id} auto-closed by timer check`);
            closedCount++;
          } else {
            console.error(`Error closing session ${session.id}:`, closeError);
          }
        }
      }
      
      // Reload sessions display if we closed any and we're viewing sessions
      if (closedCount > 0) {
        if (this.currentSubject) {
          await this.loadSessions(this.currentSubject.id);
        }
        
        // Show notification if in admin view
        if (this.currentView === 'subjects' || this.currentView === 'sessions') {
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: linear-gradient(135deg, #ff9800, #f57c00);
            color: white; padding: 12px 20px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
            font-weight: 500; animation: slideInRight 0.3s ease;
          `;
          notification.textContent = `⏰ ${closedCount} expired session(s) auto-closed`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
          }, 4000);
        }
      }
    } catch (error) {
      // Silently handle errors (timer feature not available)
      console.debug('Session timer update skipped:', error.message);
    }
  }

  getTimerStatusHTML(session) {
    // Return empty if no timer data is available
    if (!session.duration_minutes || !session.auto_close_at) {
      return '';
    }
    
    try {
      const autoCloseAt = new Date(session.auto_close_at);
      const now = new Date();
      const timeRemaining = autoCloseAt.getTime() - now.getTime();
      
      if (timeRemaining > 0 && session.is_active) {
        const minutesRemaining = Math.ceil(timeRemaining / 60000);
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const minsRemaining = minutesRemaining % 60;
        
        let timeDisplay = '';
        if (hoursRemaining > 0) {
          timeDisplay = `${hoursRemaining}h ${minsRemaining}m`;
        } else {
          timeDisplay = `${minsRemaining}m`;
        }
        
        const statusClass = minutesRemaining <= 5 ? 'warning' : 'active';
        return `<div class="timer-status ${statusClass}">⏱️ Auto-close in ${timeDisplay}</div>`;
      } else if (timeRemaining <= 0 && session.is_active) {
        // Auto-close expired session immediately
        setTimeout(() => this.autoCloseExpiredSession(session.id), 1000);
        return `<div class="timer-status expired">⏰ Timer expired - closing now... 
                <button onclick="attendanceSystem.autoCloseExpiredSession('${session.id}')" 
                        style="margin-left: 10px; padding: 4px 8px; font-size: 12px; border-radius: 4px; border: 1px solid #f44336; background: rgba(244, 67, 54, 0.1); color: #f44336; cursor: pointer;">
                  Close Now
                </button></div>`;
      } else if (session.duration_minutes) {
        return `<div class="timer-status">⏱️ Had ${session.duration_minutes}min timer</div>`;
      }
    } catch (error) {
      console.debug('Timer display error:', error);
      return '';
    }
    
    return '';
  }

  async autoCloseExpiredSession(sessionId) {
    try {
      console.log(`Auto-closing expired session: ${sessionId}`);
      
      const { error } = await this.supabase
        .from('class_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
        
      if (error) {
        console.error('Error auto-closing session:', error);
        alert('Error closing expired session. Please try manually.');
        return;
      }
      
      console.log(`Session ${sessionId} successfully auto-closed`);
      
      // Refresh the sessions view
      if (this.currentSubject) {
        await this.loadSessions(this.currentSubject.id);
      }
      
      // Show success message
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: linear-gradient(135deg, #4caf50, #45a049);
        color: white; padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        font-weight: 500; animation: slideInRight 0.3s ease;
      `;
      notification.textContent = '✅ Expired session closed automatically';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
      
    } catch (error) {
      console.error('Error in autoCloseExpiredSession:', error);
      alert('Error closing expired session. Please try manually closing it.');
    }
  }

  async generateQRCode(sessionId) {
    try {
      const { data: session, error } = await this.supabase
        .from('class_sessions')
        .select('session_token')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const attendanceUrl = `${window.location.origin}${window.location.pathname}?session=${session.session_token}`;
      
      const canvas = document.getElementById('qrCanvas');
      await QRCode.toCanvas(canvas, attendanceUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#2c3e50',
          light: '#ffffff'
        }
      });

      document.getElementById('qrCode').style.display = 'block';
      document.getElementById('attendanceUrl').textContent = attendanceUrl;
      
      // Copy URL to clipboard
      navigator.clipboard.writeText(attendanceUrl).then(() => {
        alert('Attendance URL copied to clipboard!');
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Error generating QR code. Please try again.');
    }
  }

  async toggleSession(sessionId, activate) {
    try {
      const { error } = await this.supabase
        .from('class_sessions')
        .update({ is_active: activate })
        .eq('id', sessionId);

      if (error) throw error;

      alert(`Session ${activate ? 'activated' : 'deactivated'} successfully!`);
      await this.loadSessions(this.currentSubject.id);
    } catch (error) {
      console.error('Error toggling session:', error);
      alert('Error updating session. Please try again.');
    }
  }

  async viewSessionAttendance(sessionId) {
    try {
      // Get session details
      const { data: session, error: sessionError } = await this.supabase
        .from('class_sessions')
        .select('session_date, session_time, subjects(name)')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get attendance records
      const { data: attendance, error } = await this.supabase
        .from('attendance_records')
        .select('student_name, student_id, marked_at, ip_address, browser_fingerprint')
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: false });

      if (error) throw error;

      // Store data for download
      this.currentSessionData = {
        sessionId,
        session,
        attendance
      };

      // Display in modal
      this.displaySessionAttendanceModal(session, attendance);

    } catch (error) {
      console.error('Error viewing attendance:', error);
      alert('Error loading attendance records.');
    }
  }

  displaySessionAttendanceModal(session, attendance) {
    const modal = document.getElementById('sessionAttendanceModal');
    const sessionInfo = document.getElementById('sessionAttendanceInfo');
    const attendanceList = document.getElementById('sessionAttendanceList');
    const suspiciousActivity = document.getElementById('sessionSuspiciousActivity');

    // Session info with beautiful layout
    const sessionDate = new Date(session.session_date).toLocaleDateString();
    const sessionTime = session.session_time || 'No time specified';
    const subjectName = session.subjects?.name || 'Unknown Subject';

    sessionInfo.innerHTML = `
      <h4>${subjectName}</h4>
      <div class="session-info-grid">
        <div class="info-item">
          <span class="icon">📅</span>
          <span class="label">Date:</span>
          <span class="value">${sessionDate}</span>
        </div>
        <div class="info-item">
          <span class="icon">🕐</span>
          <span class="label">Time:</span>
          <span class="value">${sessionTime}</span>
        </div>
        <div class="info-item">
          <span class="icon">👥</span>
          <span class="label">Total:</span>
          <span class="value">${attendance.length} student${attendance.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="info-item">
          <span class="icon">📊</span>
          <span class="label">Status:</span>
          <span class="value">${attendance.length > 0 ? 'Active Session' : 'No Attendance'}</span>
        </div>
      </div>
    `;

    // Enhanced attendance list
    if (attendance.length === 0) {
      attendanceList.innerHTML = `
        <div class="no-attendance">
          No attendance records for this session yet.
          <br>Students will appear here once they mark their attendance.
        </div>
      `;
    } else {
      attendanceList.innerHTML = `
        <h4>Attendance Records</h4>
        <div class="attendance-records-container">
          ${attendance.map((record, index) => `
            <div class="attendance-record">
              <div class="student-info">
                <div class="student-name">${record.student_name}</div>
                <div class="student-id">${record.student_id}</div>
              </div>
              <div class="attendance-time">
                <div>${new Date(record.marked_at).toLocaleDateString()}</div>
                <div>${new Date(record.marked_at).toLocaleTimeString()}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Enhanced suspicious activity check
    this.checkSuspiciousActivity(attendance, suspiciousActivity);

    // Show modal with fade-in effect
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });
  }

  checkSuspiciousActivity(attendance, suspiciousContainer) {
    const hasAntiProxyData = attendance.some(r => r.ip_address || r.browser_fingerprint);
    
    if (!hasAntiProxyData) {
      suspiciousContainer.innerHTML = `
        <div class="no-suspicious">
          💡 Enable anti-proxy features by updating your database schema for detailed security analysis
        </div>
      `;
      return;
    }

    const ipGroups = {};
    const fpGroups = {};
    const suspiciousItems = [];
    
    attendance.forEach(record => {
      if (record.ip_address) {
        if (!ipGroups[record.ip_address]) ipGroups[record.ip_address] = [];
        ipGroups[record.ip_address].push(record);
      }
      if (record.browser_fingerprint) {
        if (!fpGroups[record.browser_fingerprint]) fpGroups[record.browser_fingerprint] = [];
        fpGroups[record.browser_fingerprint].push(record);
      }
    });

    // Check for multiple students from same IP
    Object.keys(ipGroups).forEach(ip => {
      if (ipGroups[ip].length > 1) {
        suspiciousItems.push(`
          <div class="suspicious-item">
            <strong>⚠️ Multiple students from IP ${ip}:</strong><br>
            ${ipGroups[ip].map(r => `• ${r.student_name} (${r.student_id})`).join('<br>')}
          </div>
        `);
      }
    });

    // Check for multiple students with same browser fingerprint
    Object.keys(fpGroups).forEach(fp => {
      if (fpGroups[fp].length > 1) {
        suspiciousItems.push(`
          <div class="suspicious-item">
            <strong>⚠️ Multiple students with same device fingerprint:</strong><br>
            ${fpGroups[fp].map(r => `• ${r.student_name} (${r.student_id})`).join('<br>')}
          </div>
        `);
      }
    });

    if (suspiciousItems.length > 0) {
      suspiciousContainer.innerHTML = `
        <h4>🔍 Security Analysis</h4>
        ${suspiciousItems.join('')}
      `;
    } else {
      suspiciousContainer.innerHTML = `
        <div class="no-suspicious">
          ✅ No suspicious activity detected
        </div>
      `;
    }
  }

  downloadSessionAttendance() {
    if (!this.currentSessionData) {
      alert('No session data available for download.');
      return;
    }

    const { session, attendance } = this.currentSessionData;
    
    if (attendance.length === 0) {
      alert('No attendance records to download.');
      return;
    }

    // Prepare CSV data
    const headers = ['Student Name', 'Student ID', 'Attendance Time', 'IP Address', 'Browser Fingerprint'];
    const csvData = [
      headers,
      ...attendance.map(record => [
        record.student_name,
        record.student_id,
        new Date(record.marked_at).toLocaleString(),
        record.ip_address || 'N/A',
        record.browser_fingerprint || 'N/A'
      ])
    ];

    // Create CSV content
    const csvContent = csvData.map(row => 
      row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create and download file
    const sessionDate = new Date(session.session_date).toISOString().split('T')[0];
    const sessionTime = session.session_time ? `_${session.session_time.replace(':', '')}` : '';
    const subjectName = session.subjects?.name || 'Unknown';
    const filename = `${subjectName}_${sessionDate}${sessionTime}_attendance.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async quickDownloadSessionAttendance(sessionId, sessionDate, sessionTime) {
    try {
      // Get attendance records
      const { data: attendance, error } = await this.supabase
        .from('attendance_records')
        .select('student_name, student_id, marked_at, ip_address, browser_fingerprint')
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: false });

      if (error) throw error;

      if (attendance.length === 0) {
        alert('No attendance records to download.');
        return;
      }

      // Prepare CSV data
      const headers = ['Student Name', 'Student ID', 'Attendance Time', 'IP Address', 'Browser Fingerprint'];
      const csvData = [
        headers,
        ...attendance.map(record => [
          record.student_name,
          record.student_id,
          new Date(record.marked_at).toLocaleString(),
          record.ip_address || 'N/A',
          record.browser_fingerprint || 'N/A'
        ])
      ];

      // Create CSV content
      const csvContent = csvData.map(row => 
        row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Create and download file
      const subjectName = this.currentSubject?.name || 'Unknown';
      const cleanDate = sessionDate.replace(/\//g, '-');
      const cleanTime = sessionTime.replace(/[:\s]/g, '').replace(/[^0-9]/g, '');
      const filename = `${subjectName}_${cleanDate}_${cleanTime}_attendance.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error('Error downloading session attendance:', error);
      alert('Error downloading attendance data.');
    }
  }

  async loadStudentAttendanceView(sessionToken) {
    try {
      const { data: session, error } = await this.supabase
        .from('class_sessions')
        .select(`
          *,
          subjects(name)
        `)
        .eq('session_token', sessionToken)
        .single();

      if (error) throw error;

      if (!session.is_active) {
        document.getElementById('homeView').innerHTML = `
          <div class="error-message">
            <h2>Session Not Available</h2>
            <p>This attendance session is no longer active.</p>
          </div>
        `;
        return;
      }

      // Check if the session time has arrived (with 10-minute early grace period)
      const now = new Date();
      const sessionDateTime = new Date(`${session.session_date}T${session.session_time || '00:00'}`);
      const gracePeriodMs = 10 * 60 * 1000; // 10 minutes before session time
      const timeUntilSession = sessionDateTime.getTime() - now.getTime() - gracePeriodMs;
      
      if (timeUntilSession > 0) {
        // Session hasn't started yet (even with grace period)
        const minutesUntilSession = Math.ceil(timeUntilSession / 60000);
        const hoursUntilSession = Math.floor(minutesUntilSession / 60);
        const minsUntilSession = minutesUntilSession % 60;
        
        let timeDisplay = '';
        if (hoursUntilSession > 0) {
          timeDisplay = `${hoursUntilSession} hour${hoursUntilSession > 1 ? 's' : ''} and ${minsUntilSession} minute${minsUntilSession !== 1 ? 's' : ''}`;
        } else {
          timeDisplay = `${minutesUntilSession} minute${minutesUntilSession !== 1 ? 's' : ''}`;
        }
        
        document.getElementById('homeView').innerHTML = `
          <div class="error-message">
            <h2>⏰ Session Not Available Yet</h2>
            <p><strong>${session.subjects.name}</strong></p>
            <p>Scheduled for: ${new Date(sessionDateTime).toLocaleString()}</p>
            <p>Attendance opens 10 minutes before session time.</p>
            <p>Please wait ${timeDisplay} before marking attendance.</p>
            <p>This page will automatically refresh when attendance opens.</p>
          </div>
        `;
        
        // Auto-refresh when grace period begins
        setTimeout(() => {
          window.location.reload();
        }, timeUntilSession + 30000); // Refresh 30 seconds after grace period starts
        
        return;
      }

      this.hideAllViews();
      document.getElementById('attendanceView').style.display = 'block';
      
      const sessionDate = new Date(session.session_date).toLocaleDateString();
      const sessionTime = session.session_time || 'No time specified';
      
      // Calculate attendance availability status
      const currentTime = new Date();
      const scheduledDateTime = new Date(`${session.session_date}T${session.session_time || '00:00'}`);
      const gracePeriod = 10 * 60 * 1000; // 10 minutes before session time
      const attendanceOpenTime = new Date(scheduledDateTime.getTime() - gracePeriod);
      
      let statusMessage = '';
      if (currentTime >= attendanceOpenTime) {
        statusMessage = '<div class="attendance-status available">✅ Attendance is now OPEN</div>';
      } else {
        const timeUntilOpen = attendanceOpenTime.getTime() - currentTime.getTime();
        const minutesUntilOpen = Math.ceil(timeUntilOpen / 60000);
        statusMessage = `<div class="attendance-status waiting">⏳ Attendance opens in ${minutesUntilOpen} minute${minutesUntilOpen !== 1 ? 's' : ''}</div>`;
      }
      
      document.getElementById('classInfo').innerHTML = `
        <h3>${session.subjects.name}</h3>
        <p>Date: ${sessionDate}</p>
        <p>Time: ${sessionTime}</p>
        <p>Attendance opens: ${attendanceOpenTime.toLocaleString()}</p>
        ${statusMessage}
      `;
      
      // Store session ID for attendance marking
      document.getElementById('markAttendanceBtn').dataset.sessionId = session.id;
    } catch (error) {
      console.error('Error loading session:', error);
      document.getElementById('homeView').innerHTML = `
        <div class="error-message">
          <h2>Error</h2>
          <p>Could not load session information.</p>
        </div>
      `;
    }
  }

  async markAttendance() {
    const studentName = document.getElementById('studentName').value.trim().toUpperCase();
    const studentId = document.getElementById('studentId').value.trim().toUpperCase();
    const sessionId = document.getElementById('markAttendanceBtn').dataset.sessionId;
    
    console.log('Mark attendance called with:', { studentName, studentId, sessionId });
    
    if (!studentName || !studentId) {
      alert('Please enter both name and student ID');
      return;
    }

    if (!sessionId) {
      alert('No session ID found. Please refresh the page and try again.');
      return;
    }

    try {
      console.log('Checking session time and existing attendance...');
      
      // First, get session details to validate timing
      const { data: sessionData, error: sessionError } = await this.supabase
        .from('class_sessions')
        .select('session_date, session_time, is_active')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Error fetching session details:', sessionError);
        throw new Error('Could not verify session information');
      }

      if (!sessionData.is_active) {
        alert('This session is no longer active. Please contact your instructor.');
        return;
      }

      // Validate session timing (with 10-minute early grace period)
      const now = new Date();
      const sessionDateTime = new Date(`${sessionData.session_date}T${sessionData.session_time || '00:00'}`);
      const gracePeriodMs = 10 * 60 * 1000; // 10 minutes before session time
      const timeUntilSession = sessionDateTime.getTime() - now.getTime() - gracePeriodMs;
      
      if (timeUntilSession > 0) {
        const minutesUntilSession = Math.ceil(timeUntilSession / 60000);
        alert(`⏰ Attendance not yet available! Please wait ${minutesUntilSession} minute${minutesUntilSession !== 1 ? 's' : ''} before marking attendance.\n\nAttendance opens 10 minutes before the scheduled session time.`);
        return;
      }
      
      console.log('Session time validation passed, checking existing attendance...');
      // Check if already marked attendance
      const { data: existing, error: checkError } = await this.supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', studentId);

      console.log('Existing check result:', { existing, checkError });

      if (checkError) {
        console.error('Error checking existing attendance:', checkError);
        throw checkError;
      }

      if (existing.length > 0) {
        alert('Attendance already marked for this student!');
        return;
      }

      console.log('Creating attendance record...');
      // Basic attendance record (compatible with original schema)
      const attendanceData = {
        session_id: sessionId,
        student_name: studentName,
        student_id: studentId
      };

      // Try to add anti-proxy data and check for suspicious activity
      try {
        console.log('Getting browser fingerprint and IP info...');
        const fingerprint = await this.generateBrowserFingerprint();
        const ipInfo = await this.getClientInfo();
        
        console.log('Fingerprint:', fingerprint);
        console.log('IP Info:', ipInfo);
        
        // Check for suspicious activity (only if we can get the data)
        const suspiciousCheck = await this.checkSuspiciousActivity(sessionId, fingerprint, ipInfo.ip);
        console.log('Suspicious check result:', suspiciousCheck);
        
        if (suspiciousCheck.isSuspicious) {
          alert(`⚠️ Suspicious activity detected: ${suspiciousCheck.reason}\nPlease contact your instructor if this is an error.`);
          return;
        }

        // Add anti-proxy fields if available
        attendanceData.ip_address = ipInfo.ip;
        attendanceData.browser_fingerprint = fingerprint;
        attendanceData.location_data = JSON.stringify(ipInfo);
        attendanceData.user_agent = navigator.userAgent;
        
        console.log('Enhanced attendance data with anti-proxy info:', attendanceData);
      } catch (antiProxyError) {
        console.warn('Anti-proxy features not available:', antiProxyError);
        // Continue with basic attendance marking
      }

      console.log('Attendance data to insert:', attendanceData);

      // Mark attendance
      const { data: insertData, error: insertError } = await this.supabase
        .from('attendance_records')
        .insert([attendanceData]);

      console.log('Insert result:', { insertData, insertError });

      if (insertError) {
        console.error('Error inserting attendance:', insertError);
        throw insertError;
      }

      console.log('Attendance marked successfully');
      alert('✅ Attendance marked successfully!');
      document.getElementById('studentName').value = '';
      document.getElementById('studentId').value = '';
    } catch (error) {
      console.error('Error marking attendance:', error);
      console.error('Error details:', error.message, error.code, error.details);
      alert(`Error marking attendance: ${error.message || 'Unknown error'}. Please try again.`);
    }
  }

  async loadSubjectsForReports() {
    try {
      const { data: subjects, error } = await this.supabase
        .from('subjects')
        .select('id, name')
        .order('name');

      if (error) throw error;

      const select = document.getElementById('reportSubject');
      select.innerHTML = '<option value="">Select Subject</option>' + 
        subjects.map(subject => `<option value="${subject.id}">${subject.name}</option>`).join('');
    } catch (error) {
      console.error('Error loading subjects for reports:', error);
    }
  }

  async generateReport() {
    const subjectId = document.getElementById('reportSubject').value;
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!subjectId) {
      alert('Please select a subject');
      return;
    }

    if (reportType === 'range' && (!startDate || !endDate)) {
      alert('Please select start and end dates for date range report');
      return;
    }

    try {
      let reportData;
      
      switch (reportType) {
        case 'daily':
          // For daily reports, use today's date or allow user to select via start date
          const reportDate = new Date().toISOString().split('T')[0];
          reportData = await this.getDailyReport(subjectId, reportDate);
          break;
        case 'weekly':
          reportData = await this.getWeeklyReport(subjectId);
          break;
        case 'monthly':
          reportData = await this.getMonthlyReport(subjectId);
          break;
        case 'range':
          reportData = await this.getDateRangeReport(subjectId, startDate, endDate);
          break;
        default:
          alert('Please select a report type');
          return;
      }

      this.displayReport(reportData, reportType);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    }
  }

  async getDailyReport(subjectId, date) {
    const { data, error } = await this.supabase
      .rpc('get_daily_attendance_report', {
        p_subject_id: subjectId,
        p_date: date
      });

    if (error) throw error;
    return data;
  }

  async getWeeklyReport(subjectId) {
    const { data, error } = await this.supabase
      .rpc('get_weekly_attendance_report', {
        p_subject_id: subjectId
      });

    if (error) throw error;
    return data;
  }

  async getMonthlyReport(subjectId) {
    const { data, error } = await this.supabase
      .rpc('get_monthly_attendance_report', {
        p_subject_id: subjectId
      });

    if (error) throw error;
    return data;
  }

  async getDateRangeReport(subjectId, startDate, endDate) {
    const { data, error } = await this.supabase
      .rpc('get_date_range_attendance_report', {
        p_subject_id: subjectId,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) throw error;
    return data;
  }

  displayReport(data, reportType) {
    const resultsDiv = document.getElementById('reportResults');
    
    if (!data || data.length === 0) {
      resultsDiv.innerHTML = '<p>No sessions found for the selected criteria.</p>';
      return;
    }

    // Filter out null attendance records for statistics but keep sessions visible
    const attendanceRecords = data.filter(record => record.student_name !== null);
    const allSessions = data.filter(record => record.session_id !== null);
    
    // Calculate summary statistics
    const totalSessions = new Set(allSessions.map(record => record.session_id)).size;
    const totalStudents = new Set(attendanceRecords.map(record => record.student_id)).size;
    const totalRecords = attendanceRecords.length;

    const summaryHtml = `
      <div class="report-summary">
        <div class="summary-card">
          <h4>Total Sessions</h4>
          <div class="number">${totalSessions}</div>
        </div>
        <div class="summary-card">
          <h4>Unique Students</h4>
          <div class="number">${totalStudents}</div>
        </div>
        <div class="summary-card">
          <h4>Total Attendance</h4>
          <div class="number">${totalRecords}</div>
        </div>
      </div>
    `;

    const tableHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Student Name</th>
            <th>Student ID</th>
            <th>Attendance Time</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(record => `
            <tr>
              <td>${new Date(record.session_date).toLocaleDateString()}</td>
              <td>${record.session_time || 'N/A'}</td>
              <td>${record.student_name || 'No attendance yet'}</td>
              <td>${record.student_id || '-'}</td>
              <td>${record.marked_at ? new Date(record.marked_at).toLocaleString() : 'Not marked'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    resultsDiv.innerHTML = summaryHtml + tableHtml;
    
    // Store data for download
    this.currentReportData = data;
    document.getElementById('downloadReportBtn').style.display = 'inline-block';
  }

  downloadReport() {
    if (!this.currentReportData) {
      alert('No report data to download');
      return;
    }

    const csvContent = this.convertToCSV(this.currentReportData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  convertToCSV(data) {
    const headers = ['Date', 'Time', 'Student Name', 'Student ID', 'Attendance Time'];
    const csvRows = [headers.join(',')];
    
    data.forEach(record => {
      const row = [
        new Date(record.session_date).toLocaleDateString(),
        record.session_time || 'N/A',
        record.student_name,
        record.student_id,
        new Date(record.marked_at).toLocaleString()
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });
    
    return csvRows.join('\n');
  }

  generateDailyToken() {
    // Create a highly unique token using multiple entropy sources
    const timestamp = Date.now().toString(36); // Current timestamp in base36
    const randomPart1 = Math.random().toString(36).substring(2, 10); // 8 chars
    const randomPart2 = Math.random().toString(36).substring(2, 8);  // 6 chars
    const performanceNow = performance.now().toString().replace('.', ''); // High precision timer
    const extraEntropy = (Math.random() * 0xFFFFFF << 0).toString(16); // Hex random
    
    // Combine all parts and create a unique string
    const uniqueString = `${timestamp}${randomPart1}${performanceNow}${randomPart2}${extraEntropy}`;
    
    // Create a hash-like token that's URL safe
    let token = '';
    for (let i = 0; i < uniqueString.length && token.length < 24; i++) {
      const char = uniqueString[i];
      if (/[a-zA-Z0-9]/.test(char)) {
        token += char;
      }
    }
    
    // Ensure minimum length and add more randomness if needed
    while (token.length < 16) {
      token += Math.random().toString(36).substring(2, 3);
    }
    
    const finalToken = token.substring(0, 24); // Return max 24 characters
    console.log('Generated token details:', {
      finalToken,
      length: finalToken.length,
      timestamp: new Date().toISOString()
    });
    
    return finalToken;
  }

  // Anti-proxy detection methods
  async generateBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = {
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      canvas: canvas.toDataURL(),
      userAgent: navigator.userAgent.substring(0, 100), // Truncated for storage
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory || 'unknown'
    };

    // Create a hash of the fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  async getClientInfo() {
    try {
      // Try to get IP and location info
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return {
        ip: data.ip || 'unknown',
        city: data.city || 'unknown',
        country: data.country_name || 'unknown',
        isp: data.org || 'unknown'
      };
    } catch (error) {
      console.warn('Could not get IP info:', error);
      return {
        ip: 'unknown',
        city: 'unknown',
        country: 'unknown',
        isp: 'unknown'
      };
    }
  }

  async checkSuspiciousActivity(sessionId, fingerprint, ipAddress) {
    try {
      console.log('Checking suspicious activity for:', { sessionId, fingerprint, ipAddress });
      
      // Try to check with anti-proxy fields, fall back to basic check if fields don't exist
      let sameIP = [];
      let sameFingerprint = [];

      // Check for same IP address
      try {
        const { data: ipData, error: ipError } = await this.supabase
          .from('attendance_records')
          .select('student_id, student_name, marked_at')
          .eq('session_id', sessionId)
          .eq('ip_address', ipAddress)
          .neq('ip_address', 'unknown'); // Exclude unknown IPs

        if (ipError && !ipError.message.includes('column')) throw ipError;
        sameIP = ipData || [];
        console.log('Same IP check result:', sameIP);
      } catch (ipError) {
        console.warn('IP address checking not available:', ipError);
      }

      // Check for same browser fingerprint
      try {
        const { data: fpData, error: fpError } = await this.supabase
          .from('attendance_records')
          .select('student_id, student_name, marked_at')
          .eq('session_id', sessionId)
          .eq('browser_fingerprint', fingerprint);

        if (fpError && !fpError.message.includes('column')) throw fpError;
        sameFingerprint = fpData || [];
        console.log('Same fingerprint check result:', sameFingerprint);
      } catch (fpError) {
        console.warn('Browser fingerprint checking not available:', fpError);
      }

      // Flag as suspicious if more than 1 student from same IP (strict mode)
      if (sameIP && sameIP.length >= 1) {
        return {
          isSuspicious: true,
          reason: `Multiple students attempting attendance from same network/IP address. Previous student: ${sameIP[0].student_name} (${sameIP[0].student_id}). Each student must use their own device and internet connection.`
        };
      }

      // Flag as suspicious if same browser fingerprint used by any other student
      if (sameFingerprint && sameFingerprint.length >= 1) {
        return {
          isSuspicious: true,
          reason: `This device/browser has already been used by another student (${sameFingerprint[0].student_name}). Each student must use their own device.`
        };
      }

      // Check for rapid successive submissions (within 30 seconds) - only if we have IP data
      if (sameIP && sameIP.length > 0) {
        const lastSubmission = new Date(sameIP[sameIP.length - 1].marked_at);
        const now = new Date();
        const timeDiff = (now - lastSubmission) / 1000; // seconds

        if (timeDiff < 30) {
          return {
            isSuspicious: true,
            reason: `Too fast! Another student just marked attendance from this device ${Math.round(timeDiff)} seconds ago. Wait at least 30 seconds between submissions.`
          };
        }
      }

      console.log('No suspicious activity detected');
      return { isSuspicious: false };
    } catch (error) {
      console.error('Error in suspicious activity check:', error);
      // If anti-proxy checking fails, don't block but warn
      console.warn('Anti-proxy detection failed, allowing attendance but logging warning');
      return { isSuspicious: false }; // Don't block on error, but this could be made stricter
    }
  }
}

// Initialize the application
const attendanceSystem = new AttendanceSystem();

// Make it globally available for HTML onclick handlers
window.attendanceSystem = attendanceSystem;
