import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hikma_jobs.sqlite');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'Hikma Solutions',
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    work_type TEXT NOT NULL DEFAULT 'Remote',
    employment_type TEXT NOT NULL DEFAULT 'Full-time',
    experience_level TEXT NOT NULL DEFAULT 'Mid Level',
    salary_min INTEGER DEFAULT 0,
    salary_max INTEGER DEFAULT 0,
    salary_currency TEXT DEFAULT 'USD',
    deadline TEXT,
    description TEXT NOT NULL,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    tracking_code TEXT UNIQUE NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT,
    location TEXT,
    current_company TEXT,
    experience_years INTEGER DEFAULT 0,
    linkedin_url TEXT,
    portfolio_url TEXT,
    cover_letter TEXT,
    resume_filename TEXT,
    resume_originalname TEXT,
    resume_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    rating INTEGER DEFAULT 0,
    admin_notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS application_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial jobs if none exist
const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;

if (jobCount === 0) {
  const seedJobs = [
    {
      title: 'Senior Full-Stack Engineer',
      company: 'Hikma Solutions',
      department: 'Engineering',
      location: 'Remote (Worldwide)',
      work_type: 'Remote',
      employment_type: 'Full-time',
      experience_level: 'Senior Level',
      salary_min: 85000,
      salary_max: 120000,
      salary_currency: 'USD',
      deadline: '2026-12-31',
      featured: 1,
      description: 'We are seeking an experienced Senior Full-Stack Engineer to lead development across our core web applications, API services, and real-time dashboard systems.',
      requirements: JSON.stringify([
        '5+ years of full-stack development experience with modern JavaScript/TypeScript frameworks (Node.js, React/Vue)',
        'Proficiency in designing RESTful APIs, relational databases (PostgreSQL/SQLite), and caching layers',
        'Strong understanding of automated testing, CI/CD pipelines, and cloud deployment (AWS/GCP)',
        'Excellent communication and collaborative problem-solving skills in asynchronous remote teams'
      ]),
      responsibilities: JSON.stringify([
        'Architect, build, and maintain high-performance frontend and backend microservices',
        'Collaborate with Product Managers and Designers to iterate rapidly on user-facing features',
        'Mentor junior and mid-level engineers through code reviews and technical design discussions',
        'Optimize application scalability, uptime, security, and developer tooling'
      ]),
      benefits: JSON.stringify([
        '100% remote flexibility with home office stipend ($1,500)',
        'Comprehensive health, dental, and vision insurance coverage',
        'Unlimited paid time off (PTO) with mandatory minimum vacation',
        'Annual learning & development allowance ($2,000)'
      ]),
      status: 'active'
    },
    {
      title: 'Lead UI/UX Product Designer',
      company: 'Hikma Solutions',
      department: 'Design',
      location: 'London, UK (Hybrid)',
      work_type: 'Hybrid',
      employment_type: 'Full-time',
      experience_level: 'Lead / Principal',
      salary_min: 75000,
      salary_max: 95000,
      salary_currency: 'GBP',
      deadline: '2026-12-15',
      featured: 1,
      description: 'Hikma is looking for a creative Lead Product Designer to shape intuitive digital products, elevate our brand design system, and conduct user research.',
      requirements: JSON.stringify([
        '6+ years in digital product design, UX research, and comprehensive design systems (Figma, tokens)',
        'Proven track record of turning complex business workflows into simple, elegant interfaces',
        'Strong presentation skills and experience facilitating design sprints and stakeholder alignment',
        'Strong portfolio showcasing mobile and desktop web product workflows'
      ]),
      responsibilities: JSON.stringify([
        'Define design strategy and vision for Hikma web and mobile applications',
        'Maintain and expand our core component library and design guidelines',
        'Conduct usability testing sessions, interviews, and synthesize qualitative insights',
        'Partner closely with front-end engineers to ensure pixel-perfect implementation'
      ]),
      benefits: JSON.stringify([
        'Competitive salary plus equity stock options',
        'Hybrid schedule (2 days in London studio, 3 days remote)',
        'Latest M-series MacBook Pro and dual 4K monitor setup',
        'Wellness & gym membership contribution'
      ]),
      status: 'active'
    },
    {
      title: 'DevOps & Cloud Infrastructure Engineer',
      company: 'Hikma Solutions',
      department: 'Infrastructure',
      location: 'Casablanca, Morocco (On-site / Hybrid)',
      work_type: 'Hybrid',
      employment_type: 'Full-time',
      experience_level: 'Mid Level',
      salary_min: 40000,
      salary_max: 55000,
      salary_currency: 'USD',
      deadline: '2027-01-20',
      featured: 0,
      description: 'Join our DevOps team to automate deployments, configure Kubernetes clusters, monitor system reliability, and scale cloud infrastructure.',
      requirements: JSON.stringify([
        '3+ years in cloud infrastructure management (AWS, Azure, or GCP)',
        'Deep hands-on experience with Docker, Kubernetes, Terraform, and GitHub Actions',
        'Solid knowledge of Linux administration, networking, security policies, and Prometheus/Grafana monitoring',
        'Familiarity with database administration and automated backup strategies'
      ]),
      responsibilities: JSON.stringify([
        'Manage and optimize multi-region Kubernetes clusters and containerized services',
        'Implement Infrastructure as Code (IaC) utilizing Terraform and GitOps',
        'Continuously improve disaster recovery, automated security scanning, and SLAs',
        'Participate in on-call rotation and incident post-mortems'
      ]),
      benefits: JSON.stringify([
        'Modern office in Casablanca with catered lunch and commuter pass',
        'Flexible working hours and hybrid days',
        'Certification sponsorship (AWS Certified Solutions Architect, CKA)',
        'Annual company retreat'
      ]),
      status: 'active'
    },
    {
      title: 'Product Marketing Manager',
      company: 'Hikma Solutions',
      department: 'Marketing',
      location: 'Remote (Europe / Africa / ME)',
      work_type: 'Remote',
      employment_type: 'Full-time',
      experience_level: 'Mid Level',
      salary_min: 55000,
      salary_max: 70000,
      salary_currency: 'EUR',
      deadline: '2026-12-28',
      featured: 0,
      description: 'We need a storyteller and growth driver to own product messaging, go-to-market launches, and customer acquisition campaigns.',
      requirements: JSON.stringify([
        '3+ years of B2B SaaS product marketing experience',
        'Strong analytical mindset with proficiency in Google Analytics, HubSpot, and campaign metrics',
        'Exceptional copywriting and communication skills in English',
        'Demonstrated success executing cross-channel feature launches'
      ]),
      responsibilities: JSON.stringify([
        'Craft compelling positioning, product messaging, and sales enablement collateral',
        'Lead product launches across email, social, PR, and developer communities',
        'Analyze customer funnels, win-loss reports, and market competitive landscapes',
        'Collaborate with Product and Sales teams to drive product adoption and retention'
      ]),
      benefits: JSON.stringify([
        'Remote-first work environment across CET / GMT time zones',
        'Performance bonus package',
        'Comprehensive healthcare and pension plan',
        'Generous paid parental leave'
      ]),
      status: 'active'
    },
    {
      title: 'Junior Data Analyst',
      company: 'Hikma Solutions',
      department: 'Data & AI',
      location: 'Remote (Worldwide)',
      work_type: 'Remote',
      employment_type: 'Full-time',
      experience_level: 'Entry Level',
      salary_min: 45000,
      salary_max: 58000,
      salary_currency: 'USD',
      deadline: '2027-02-15',
      featured: 0,
      description: 'Start your data career with Hikma. You will analyze user metrics, build executive dashboards, and extract actionable insights.',
      requirements: JSON.stringify([
        'Degree in Computer Science, Data Science, Mathematics, or equivalent practical experience',
        'Strong SQL querying skills and experience with Python or R for data analysis',
        'Hands-on experience building charts and dashboards in Tableau, PowerBI, or Metabase',
        'Curious problem solver with high attention to detail'
      ]),
      responsibilities: JSON.stringify([
        'Build and maintain operational dashboards for marketing, product, and leadership',
        'Clean, model, and validate incoming data pipelines',
        'Perform exploratory analysis to identify user churn risks and feature trends',
        'Present findings in concise weekly reports'
      ]),
      benefits: JSON.stringify([
        'Structured mentorship program with Senior Data Scientists',
        'Continuous training budget and access to data science courses',
        'Home workspace allowance',
        'Flexible hours'
      ]),
      status: 'active'
    }
  ];

  const insertJob = db.prepare(`
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

  for (const job of seedJobs) {
    insertJob.run(job);
  }

  // Pre-seed a few sample applications for testing the candidate tracker and admin view
  const sampleApps = [
    {
      job_id: 1,
      tracking_code: 'HK-74912',
      applicant_name: 'Sara El Amrani',
      applicant_email: 'sara.amrani@example.com',
      applicant_phone: '+212 661 234567',
      location: 'Casablanca, Morocco',
      current_company: 'Fintech Labs',
      experience_years: 6,
      linkedin_url: 'https://linkedin.com/in/sara-elamrani',
      portfolio_url: 'https://github.com/sara-amrani',
      cover_letter: 'I have been building full-stack distributed systems with Node.js and TypeScript for 6 years. Hikma\'s mission deeply resonates with me, and I would love to bring my backend scalability expertise to your team.',
      status: 'shortlisted',
      rating: 5,
      admin_notes: 'Strong backend experience with high-load microservices. Scheduled technical screen.'
    },
    {
      job_id: 1,
      tracking_code: 'HK-83941',
      applicant_name: 'Alex Johnson',
      applicant_email: 'alex.j@example.com',
      applicant_phone: '+1 415 555 0192',
      location: 'San Francisco, USA',
      current_company: 'CloudSphere',
      experience_years: 5,
      linkedin_url: 'https://linkedin.com/in/alexjohnson-dev',
      portfolio_url: 'https://alexjohnson.dev',
      cover_letter: 'Passionate full-stack developer with React and Node.js expertise. Excited about Hikma\'s growth.',
      status: 'reviewing',
      rating: 4,
      admin_notes: 'Good portfolio, checking references.'
    },
    {
      job_id: 2,
      tracking_code: 'HK-91024',
      applicant_name: 'Elena Rostova',
      applicant_email: 'elena.rostova@example.com',
      applicant_phone: '+44 20 7946 0912',
      location: 'London, UK',
      current_company: 'Studio Pixel',
      experience_years: 7,
      linkedin_url: 'https://linkedin.com/in/elena-rostova-design',
      portfolio_url: 'https://dribbble.com/elenarostova',
      cover_letter: 'Hi team! With 7 years creating design systems and leading product design teams in London, I am excited to apply for the Lead UI/UX role at Hikma.',
      status: 'interview',
      rating: 5,
      admin_notes: 'Portfolio is world-class. Final interview scheduled with Chief Product Officer.'
    }
  ];

  const insertApp = db.prepare(`
    INSERT INTO applications (
      job_id, tracking_code, applicant_name, applicant_email, applicant_phone,
      location, current_company, experience_years, linkedin_url, portfolio_url,
      cover_letter, status, rating, admin_notes
    ) VALUES (
      @job_id, @tracking_code, @applicant_name, @applicant_email, @applicant_phone,
      @location, @current_company, @experience_years, @linkedin_url, @portfolio_url,
      @cover_letter, @status, @rating, @admin_notes
    )
  `);

  const insertHist = db.prepare(`
    INSERT INTO application_history (application_id, status, note)
    VALUES (?, ?, ?)
  `);

  for (const app of sampleApps) {
    const res = insertApp.run(app);
    const appId = res.lastInsertRowid;
    insertHist.run(appId, 'pending', 'Application received');
    if (app.status !== 'pending') {
      insertHist.run(appId, app.status, `Status updated to ${app.status}`);
    }
  }
}

export default db;

