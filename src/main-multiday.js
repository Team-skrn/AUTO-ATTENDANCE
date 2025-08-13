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
    this.setupEventListeners();
    
    if (this.isStudentOnly) {
      document.body.classList.add('student-only');
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('attend') || urlParams.get('session');
      if (sessionId) {
        await this.loadStudentAttendanceView(sessionId);
      }
    } else {
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
    
    // Modal
    document.getElementById('passwordSubmit').addEventListener('click', () => this.authenticateAdmin());
    document.getElementById('modalCancel').addEventListener('click', () => this.hidePasswordModal());
    
    // Password input enter key
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.authenticateAdmin();
    });
  }

  showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('passwordInput').focus();
  }

  hidePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('passwordInput').value = '';
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

  hideAllViews() {
    const views = ['homeView', 'createSubjectView', 'subjectView', 'sessionView', 'attendanceView', 'reportsView'];
    views.forEach(view => {
      document.getElementById(view).style.display = 'none';
    });
  }

  showHome() {
    this.hideAllViews();
    this.currentView = 'home';
    document.getElementById('homeView').style.display = 'block';
  }

  showCreateSubject() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'createSubject';
    document.getElementById('createSubjectView').style.display = 'block';
  }

  async showSubjects() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'subjects';
    document.getElementById('subjectView').style.display = 'block';
    await this.loadSubjects();
  }

  async showReports() {
    if (!this.requireAuth()) return;
    this.hideAllViews();
    this.currentView = 'reports';
    document.getElementById('reportsView').style.display = 'block';
    await this.loadSubjectsForReports();
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
    
    if (!date || !time) {
      alert('Please select both date and time');
      return;
    }

    if (!this.currentSubject) {
      alert('No subject selected');
      return;
    }

    try {
      const sessionToken = this.generateDailyToken();
      
      const { data, error } = await this.supabase
        .from('class_sessions')
        .insert([{
          subject_id: this.currentSubject.id,
          session_date: date,
          session_time: time,
          session_token: sessionToken,
          is_active: true
        }])
        .select();

      if (error) throw error;

      alert('Session created successfully!');
      await this.loadSessions(this.currentSubject.id);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Error creating session. Please try again.');
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
      const { data: attendance, error } = await this.supabase
        .from('attendance_records')
        .select('student_name, student_id, marked_at')
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: false });

      if (error) throw error;

      if (attendance.length === 0) {
        alert('No attendance records for this session.');
        return;
      }

      const attendanceList = attendance.map(record => 
        `${record.student_name} (${record.student_id}) - ${new Date(record.marked_at).toLocaleString()}`
      ).join('\n');

      alert(`Attendance Records:\n\n${attendanceList}`);
    } catch (error) {
      console.error('Error viewing attendance:', error);
      alert('Error loading attendance records.');
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

      this.hideAllViews();
      document.getElementById('attendanceView').style.display = 'block';
      
      const sessionDate = new Date(session.session_date).toLocaleDateString();
      const sessionTime = session.session_time || 'No time specified';
      
      document.getElementById('classInfo').innerHTML = `
        <h3>${session.subjects.name}</h3>
        <p>Date: ${sessionDate}</p>
        <p>Time: ${sessionTime}</p>
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
    const studentName = document.getElementById('studentName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const sessionId = document.getElementById('markAttendanceBtn').dataset.sessionId;
    
    if (!studentName || !studentId) {
      alert('Please enter both name and student ID');
      return;
    }

    try {
      // Check if already marked attendance
      const { data: existing, error: checkError } = await this.supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', studentId);

      if (checkError) throw checkError;

      if (existing.length > 0) {
        alert('Attendance already marked for this student!');
        return;
      }

      // Mark attendance
      const { error } = await this.supabase
        .from('attendance_records')
        .insert([{
          session_id: sessionId,
          student_name: studentName,
          student_id: studentId
        }]);

      if (error) throw error;

      alert('Attendance marked successfully!');
      document.getElementById('studentName').value = '';
      document.getElementById('studentId').value = '';
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Error marking attendance. Please try again.');
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
          const reportDate = startDate || new Date().toISOString().split('T')[0];
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
      resultsDiv.innerHTML = '<p>No attendance data found for the selected criteria.</p>';
      return;
    }

    // Calculate summary statistics
    const totalSessions = new Set(data.map(record => record.session_id)).size;
    const totalStudents = new Set(data.map(record => record.student_id)).size;
    const totalRecords = data.length;

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
              <td>${record.student_name}</td>
              <td>${record.student_id}</td>
              <td>${new Date(record.marked_at).toLocaleString()}</td>
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
    const today = new Date().toISOString().split('T')[0];
    return btoa(`${today}-${Math.random().toString(36).substr(2, 9)}`).replace(/[^a-zA-Z0-9]/g, '').substr(0, 12);
  }
}

// Initialize the application
const attendanceSystem = new AttendanceSystem();

// Make it globally available for HTML onclick handlers
window.attendanceSystem = attendanceSystem;
