import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup for resume uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('text')) {
      cb(null, true);
    } else {
      cb(new Error('Only document files (PDF, DOC, DOCX, TXT) are allowed.'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Generate tracking code
function generateTrackingCode() {
  const letters = 'HK';
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${letters}-${randomNum}`;
}

// Helper: Parse JSON or return empty array
function safeParseJSON(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return str.split('\n').map(s => s.trim()).filter(Boolean);
  }
}

// ==========================================
// PUBLIC & CANDIDATE API ENDPOINTS
// ==========================================

// Get all jobs (with optional filters)
app.get('/api/jobs', (req, res) => {
  try {
    const { search, department, work_type, employment_type, experience_level, status } = req.query;

    let query = `
      SELECT j.*, 
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applicant_count
      FROM jobs j
      WHERE 1=1
    `;
    const params = [];

    // Filter by status (public view defaults to active, admin can request all or specific)
    if (status && status !== 'all') {
      query += ` AND j.status = ?`;
      params.push(status);
    } else if (!status) {
      query += ` AND j.status = 'active'`;
    }

    if (department && department !== 'all') {
      query += ` AND j.department = ?`;
      params.push(department);
    }

    if (work_type && work_type !== 'all') {
      query += ` AND j.work_type = ?`;
      params.push(work_type);
    }

    if (employment_type && employment_type !== 'all') {
      query += ` AND j.employment_type = ?`;
      params.push(employment_type);
    }

    if (experience_level && experience_level !== 'all') {
      query += ` AND j.experience_level = ?`;
      params.push(experience_level);
    }

    if (search) {
      query += ` AND (j.title LIKE ? OR j.description LIKE ? OR j.location LIKE ? OR j.department LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY j.featured DESC, j.created_at DESC`;

    const jobs = db.prepare(query).all(...params);

    const formattedJobs = jobs.map(j => ({
      ...j,
      requirements: safeParseJSON(j.requirements),
      responsibilities: safeParseJSON(j.responsibilities),
      benefits: safeParseJSON(j.benefits)
    }));

    res.json({ success: true, count: formattedJobs.length, jobs: formattedJobs });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve jobs' });
  }
});

// Get department list with active job count
app.get('/api/departments', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT department, COUNT(*) as count 
      FROM jobs 
      WHERE status = 'active' 
      GROUP BY department 
      ORDER BY count DESC
    `).all();
    res.json({ success: true, departments: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single job details
app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = db.prepare(`
      SELECT j.*, 
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applicant_count
      FROM jobs j 
      WHERE j.id = ?
    `).get(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job opening not found' });
    }

    res.json({
      success: true,
      job: {
        ...job,
        requirements: safeParseJSON(job.requirements),
        responsibilities: safeParseJSON(job.responsibilities),
        benefits: safeParseJSON(job.benefits)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit job application
app.post('/api/applications', upload.single('resume'), (req, res) => {
  try {
    const {
      job_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      location,
      current_company,
      experience_years,
      linkedin_url,
      portfolio_url,
      cover_letter
    } = req.body;

    if (!job_id || !applicant_name || !applicant_email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: Job ID, Full Name, and Email are mandatory.'
      });
    }

    // Verify job exists and is open
    const job = db.prepare('SELECT id, title, status FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'The selected job opening does not exist.' });
    }
    if (job.status !== 'active') {
      return res.status(400).json({ success: false, error: 'This job opening is no longer accepting applications.' });
    }

    // Check if duplicate submission for same email and job
    const existing = db.prepare(`
      SELECT id, tracking_code FROM applications 
      WHERE job_id = ? AND LOWER(applicant_email) = LOWER(?)
    `).get(job_id, applicant_email.trim());

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `You have already applied for this job with email ${applicant_email}. Your tracking code is ${existing.tracking_code}.`,
        tracking_code: existing.tracking_code
      });
    }

    let trackingCode = generateTrackingCode();
    // Ensure uniqueness
    while (db.prepare('SELECT id FROM applications WHERE tracking_code = ?').get(trackingCode)) {
      trackingCode = generateTrackingCode();
    }

    const resumeFilename = req.file ? req.file.filename : null;
    const resumeOriginalName = req.file ? req.file.originalname : null;
    const resumeSize = req.file ? req.file.size : null;

    const stmt = db.prepare(`
      INSERT INTO applications (
        job_id, tracking_code, applicant_name, applicant_email, applicant_phone,
        location, current_company, experience_years, linkedin_url, portfolio_url,
        cover_letter, resume_filename, resume_originalname, resume_size, status
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 'pending'
      )
    `);

    const result = stmt.run(
      job_id,
      trackingCode,
      applicant_name.trim(),
      applicant_email.trim().toLowerCase(),
      applicant_phone ? applicant_phone.trim() : null,
      location ? location.trim() : null,
      current_company ? current_company.trim() : null,
      experience_years ? parseInt(experience_years, 10) || 0 : 0,
      linkedin_url ? linkedin_url.trim() : null,
      portfolio_url ? portfolio_url.trim() : null,
      cover_letter ? cover_letter.trim() : null,
      resumeFilename,
      resumeOriginalName,
      resumeSize
    );

    const appId = result.lastInsertRowid;

    // Record initial history
    db.prepare(`
      INSERT INTO application_history (application_id, status, note)
      VALUES (?, 'pending', 'Application received and registered in Hikma JobTrack')
    `).run(appId);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      tracking_code: trackingCode,
      application_id: appId,
      job_title: job.title
    });
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to submit application' });
  }
});

// Track application by tracking code or applicant email
app.get('/api/track/:identifier', (req, res) => {
  try {
    const identifier = req.params.identifier.trim();
    const isEmail = identifier.includes('@');

    let applications = [];
    if (isEmail) {
      applications = db.prepare(`
        SELECT a.*, j.title AS job_title, j.department, j.location AS job_location, j.work_type, j.status AS job_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE LOWER(a.applicant_email) = LOWER(?)
        ORDER BY a.created_at DESC
      `).all(identifier);
    } else {
      const single = db.prepare(`
        SELECT a.*, j.title AS job_title, j.department, j.location AS job_location, j.work_type, j.status AS job_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE UPPER(a.tracking_code) = UPPER(?)
      `).get(identifier);
      if (single) applications = [single];
    }

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        error: isEmail 
          ? `No applications found associated with email: ${identifier}`
          : `No application found with tracking code: ${identifier}`
      });
    }

    // Attach history timeline for each application
    const historyStmt = db.prepare(`
      SELECT * FROM application_history 
      WHERE application_id = ? 
      ORDER BY created_at ASC
    `);

    const result = applications.map(app => {
      const history = historyStmt.all(app.id);
      return {
        ...app,
        history
      };
    });

    res.json({ success: true, count: result.length, applications: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Candidate withdraws application
app.post('/api/applications/:id/withdraw', (req, res) => {
  try {
    const { tracking_code } = req.body;
    const appId = req.params.id;

    const appRecord = db.prepare('SELECT id, status, tracking_code FROM applications WHERE id = ?').get(appId);
    if (!appRecord) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (tracking_code && appRecord.tracking_code !== tracking_code) {
      return res.status(403).json({ success: false, error: 'Invalid tracking verification' });
    }

    if (appRecord.status === 'withdrawn') {
      return res.status(400).json({ success: false, error: 'Application is already withdrawn' });
    }

    db.prepare("UPDATE applications SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(appId);
    db.prepare("INSERT INTO application_history (application_id, status, note) VALUES (?, 'withdrawn', 'Candidate withdrew the application')").run(appId);

    res.json({ success: true, message: 'Application has been successfully withdrawn.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download / View resume
app.get('/api/resumes/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Resume file not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ADMIN API ENDPOINTS
// ==========================================

// Dashboard KPI analytics
app.get('/api/admin/stats', (req, res) => {
  try {
    const totalJobs = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
    const activeJobs = db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'active'").get().c;
    const closedJobs = db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'closed'").get().c;
    
    const totalApplications = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
    const pendingApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'pending'").get().c;
    const reviewingApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'reviewing'").get().c;
    const shortlistedApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'shortlisted'").get().c;
    const interviewApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'interview'").get().c;
    const offeredApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'offered'").get().c;
    const rejectedApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'rejected'").get().c;

    // Applications per job breakdown
    const jobBreakdown = db.prepare(`
      SELECT j.id, j.title, j.department, j.status, COUNT(a.id) as app_count
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      GROUP BY j.id
      ORDER BY app_count DESC
      LIMIT 8
    `).all();

    res.json({
      success: true,
      stats: {
        totalJobs,
        activeJobs,
        closedJobs,
        totalApplications,
        pendingApps,
        reviewingApps,
        shortlistedApps,
        interviewApps,
        offeredApps,
        rejectedApps
      },
      jobBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Post new job opening
app.post('/api/admin/jobs', (req, res) => {
  try {
    const {
      title,
      company = 'Hikma Solutions',
      department,
      location,
      work_type = 'Remote',
      employment_type = 'Full-time',
      experience_level = 'Mid Level',
      salary_min = 0,
      salary_max = 0,
      salary_currency = 'USD',
      deadline,
      description,
      requirements,
      responsibilities,
      benefits,
      status = 'active',
      featured = 0
    } = req.body;

    if (!title || !department || !location || !description) {
      return res.status(400).json({
        success: false,
        error: 'Job Title, Department, Location, and Description are required.'
      });
    }

    const reqStr = Array.isArray(requirements) ? JSON.stringify(requirements) : (requirements || '[]');
    const respStr = Array.isArray(responsibilities) ? JSON.stringify(responsibilities) : (responsibilities || '[]');
    const benStr = Array.isArray(benefits) ? JSON.stringify(benefits) : (benefits || '[]');

    const stmt = db.prepare(`
      INSERT INTO jobs (
        title, company, department, location, work_type, employment_type,
        experience_level, salary_min, salary_max, salary_currency, deadline,
        description, requirements, responsibilities, benefits, status, featured
      ) VALUES (
        @title, @company, @department, @location, @work_type, @employment_type,
        @experience_level, @salary_min, @salary_max, @salary_currency, @deadline,
        @description, @requirements, @responsibilities, @benefits, @status, @featured
      )
    `);

    const result = stmt.run({
      title: title.trim(),
      company: company.trim(),
      department: department.trim(),
      location: location.trim(),
      work_type,
      employment_type,
      experience_level,
      salary_min: parseInt(salary_min, 10) || 0,
      salary_max: parseInt(salary_max, 10) || 0,
      salary_currency: salary_currency.trim().toUpperCase(),
      deadline: deadline || null,
      description: description.trim(),
      requirements: reqStr,
      responsibilities: respStr,
      benefits: benStr,
      status,
      featured: featured ? 1 : 0
    });

    res.status(201).json({
      success: true,
      message: 'Job opening created successfully!',
      job_id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update job opening
app.put('/api/admin/jobs/:id', (req, res) => {
  try {
    const jobId = req.params.id;
    const {
      title,
      company = 'Hikma Solutions',
      department,
      location,
      work_type,
      employment_type,
      experience_level,
      salary_min,
      salary_max,
      salary_currency,
      deadline,
      description,
      requirements,
      responsibilities,
      benefits,
      status,
      featured
    } = req.body;

    const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Job opening not found' });
    }

    const reqStr = Array.isArray(requirements) ? JSON.stringify(requirements) : (requirements || '[]');
    const respStr = Array.isArray(responsibilities) ? JSON.stringify(responsibilities) : (responsibilities || '[]');
    const benStr = Array.isArray(benefits) ? JSON.stringify(benefits) : (benefits || '[]');

    db.prepare(`
      UPDATE jobs SET
        title = @title,
        company = @company,
        department = @department,
        location = @location,
        work_type = @work_type,
        employment_type = @employment_type,
        experience_level = @experience_level,
        salary_min = @salary_min,
        salary_max = @salary_max,
        salary_currency = @salary_currency,
        deadline = @deadline,
        description = @description,
        requirements = @requirements,
        responsibilities = @responsibilities,
        benefits = @benefits,
        status = @status,
        featured = @featured,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: jobId,
      title: title.trim(),
      company: company.trim(),
      department: department.trim(),
      location: location.trim(),
      work_type,
      employment_type,
      experience_level,
      salary_min: parseInt(salary_min, 10) || 0,
      salary_max: parseInt(salary_max, 10) || 0,
      salary_currency: (salary_currency || 'USD').trim().toUpperCase(),
      deadline: deadline || null,
      description: description.trim(),
      requirements: reqStr,
      responsibilities: respStr,
      benefits: benStr,
      status: status || 'active',
      featured: featured ? 1 : 0
    });

    res.json({ success: true, message: 'Job opening updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Toggle job status (active, draft, closed)
app.patch('/api/admin/jobs/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'draft', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const result = db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Job opening not found' });
    }

    res.json({ success: true, message: `Job status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Delete job opening
app.delete('/api/admin/jobs/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Job opening not found' });
    }
    res.json({ success: true, message: 'Job opening and associated records deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get applications list (with filters)
app.get('/api/admin/applications', (req, res) => {
  try {
    const { job_id, status, search } = req.query;

    let query = `
      SELECT a.*, j.title AS job_title, j.department AS job_department, j.location AS job_location
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE 1=1
    `;
    const params = [];

    if (job_id && job_id !== 'all') {
      query += ` AND a.job_id = ?`;
      params.push(job_id);
    }

    if (status && status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (a.applicant_name LIKE ? OR a.applicant_email LIKE ? OR a.tracking_code LIKE ? OR j.title LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY a.created_at DESC`;

    const apps = db.prepare(query).all(...params);

    res.json({ success: true, count: apps.length, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get single application details with history
app.get('/api/admin/applications/:id', (req, res) => {
  try {
    const app = db.prepare(`
      SELECT a.*, j.title AS job_title, j.department, j.location AS job_location, j.work_type, j.employment_type
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const history = db.prepare(`
      SELECT * FROM application_history 
      WHERE application_id = ? 
      ORDER BY created_at ASC
    `).all(req.params.id);

    res.json({ success: true, application: { ...app, history } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update candidate status
app.patch('/api/admin/applications/:id/status', (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ['pending', 'reviewing', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid application status' });
    }

    const appId = req.params.id;
    const current = db.prepare('SELECT id, status FROM applications WHERE id = ?').get(appId);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    db.prepare('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, appId);

    const logNote = note && note.trim() 
      ? note.trim() 
      : `Status updated from ${current.status} to ${status}`;

    db.prepare(`
      INSERT INTO application_history (application_id, status, note)
      VALUES (?, ?, ?)
    `).run(appId, status, logNote);

    res.json({ success: true, message: `Candidate status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update recruiter notes and rating
app.patch('/api/admin/applications/:id/notes', (req, res) => {
  try {
    const { admin_notes, rating } = req.body;
    const appId = req.params.id;

    db.prepare(`
      UPDATE applications 
      SET admin_notes = ?, rating = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(admin_notes || '', parseInt(rating, 10) || 0, appId);

    res.json({ success: true, message: 'Notes and rating updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Export applications to CSV
app.get('/api/admin/export/csv', (req, res) => {
  try {
    const applications = db.prepare(`
      SELECT 
        a.tracking_code,
        a.applicant_name,
        a.applicant_email,
        a.applicant_phone,
        a.location,
        a.experience_years,
        a.status,
        a.rating,
        j.title AS job_title,
        j.department,
        a.created_at
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.created_at DESC
    `).all();

    let csv = 'Tracking Code,Applicant Name,Email,Phone,Location,Experience (Yrs),Status,Rating,Job Title,Department,Applied Date\n';

    for (const r of applications) {
      const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
      csv += [
        escape(r.tracking_code),
        escape(r.applicant_name),
        escape(r.applicant_email),
        escape(r.applicant_phone),
        escape(r.location),
        escape(r.experience_years),
        escape(r.status),
        escape(r.rating),
        escape(r.job_title),
        escape(r.department),
        escape(r.created_at)
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hikma_job_applications.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Hikma JobTrack is live at: http://localhost:${PORT}`);
  console.log(` Primary Theme: Light Blue (#0284c7 / #38bdf8)`);
  console.log(` Environment: Node.js ${process.version}`);
  console.log(`===============================================`);
});
