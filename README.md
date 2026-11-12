# Hikma JobTrack 🌐

A modern, responsive **Job Tracking and Career Portal Application** crafted with a sleek **Light Blue Theme** (`#0284c7` / `#38bdf8`), built with **Node.js, Express, and SQLite** (via `node:sqlite`).

---

## 🌟 Key Features

### 👤 For Candidates & Job Seekers
- **Interactive Job Board**: Browse active job openings categorized by Department (Engineering, Design, Infrastructure, Marketing, Data & AI), Location, and Work Arrangement (Remote, Hybrid, On-site).
- **Fast Search & Real-Time Filtering**: Search openings by keyword, title, skills, or department pills.
- **Detailed Position Overviews**: Modal drawer with comprehensive role descriptions, key responsibilities, qualifications, compensation bands, and employee benefits.
- **Seamless Application Process**:
  - One-click application modal.
  - Drag-and-drop resume upload (PDF, DOC, DOCX, TXT with size validation).
  - Profile links (LinkedIn, Portfolio / GitHub) and personalized cover letter.
  - Automatic generation of a unique **Application Tracking Code** (e.g. `HK-74912`).
- **Live Application Tracker**:
  - Candidates can track their submissions using either their **Tracking Code** or **Email Address**.
  - **Visual 5-Stage Stepper**: `Applied` ➔ `In Review` ➔ `Shortlisted` ➔ `Interview` ➔ `Offer Extended` (or `Not Selected`).
  - Full audit timeline showing status updates and recruiter feedback timestamps.
  - Candidate withdrawal option.

### 💼 For Admins & Recruiters
- **One-Click Portal Switcher**: Seamlessly toggle between Candidate View and Admin Portal from the top navigation bar.
- **Executive Recruitment KPIs**:
  - Total Openings & Active vs. Closed breakdown.
  - Total Applications Received.
  - Pipeline stages count (Pending Review, Shortlisted, Interviews Scheduled, Offers Extended).
- **Job Openings Management**:
  - **Post New Job Openings**: Define title, department, location, work type, experience level, salary range & currency, application deadlines, bullet-point responsibilities, requirements, and benefits.
  - **Edit & Modify Postings**: Update any job listing at any time.
  - **Quick Status Toggle**: Instantly switch openings between `Active`, `Draft`, and `Closed`.
  - **Delete Openings**: Cascades and safely cleans up records.
  - **Applicant Counters**: Direct badge displaying the number of applicants per opening with one-click filtering.
- **Candidate Pipeline & Review**:
  - Filter applicants by opening, pipeline status, or search by name, email, or code.
  - Quick inline status switcher.
  - **Full Candidate Inspection Drawer**:
    - Complete contact details with direct email and phone links.
    - One-click **Resume Download / View**.
    - Candidate cover letter display.
    - Recruiter Assessment with **1-to-5 Star Rating**.
    - Internal private HR notes (persisted in SQLite).
    - Status changer with custom notification notes.
    - Complete chronological stage history.
- **Data Export**: Export candidate rosters to CSV format for spreadsheets or reporting.

---

## 🎨 Theme & Palette (Light Blue)

- **Primary Light Blue**: `#0284c7` (Sky-600)
- **Primary Accent / Glow**: `#0ea5e9` (Sky-500)
- **Soft Backgrounds**: `#f0f9ff` (Sky-50) & `#e0f2fe` (Sky-100)
- **Card Accents & Borders**: `#bae6fd` (Sky-200) & `#e2e8f0` (Slate-200)
- **Text & Contrast**: High-contrast Slate-900 (`#0f172a`) for maximum accessibility.

---

## 🚀 Quick Start Guide

### Option 1: Double-Click Launcher (Windows)
Double-click `start.bat` in this folder:
```cmd
start.bat
```
This automatically starts the server and opens `http://localhost:3000` in your default browser.

### Option 2: PowerShell
```powershell
.\start.ps1
```

### Option 3: Terminal Command
```bash
node server.js
```
Then visit: **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Demo Data Preloaded

The application automatically seeds realistic demo data upon first launch:

### Sample Job Openings:
1. **Senior Full-Stack Engineer** (Engineering • Remote • $85,000 - $120,000 USD)
2. **Lead UI/UX Product Designer** (Design • Hybrid London • £75,000 - £95,000 GBP)
3. **DevOps & Cloud Infrastructure Engineer** (Infrastructure • Hybrid Casablanca • $40,000 - $55,000 USD)
4. **Product Marketing Manager** (Marketing • Remote • €55,000 - €70,000 EUR)
5. **Junior Data Analyst** (Data & AI • Remote • $45,000 - $58,000 USD)

### Sample Application Tracking Codes for Testing:
- `HK-74912` (Sara El Amrani - *Shortlisted*)
- `HK-83941` (Alex Johnson - *Reviewing*)
- `HK-91024` (Elena Rostova - *Interview Scheduled*)

---

## 📁 Project Structure

```
Hikma/
├── data/
│   └── hikma_jobs.sqlite    # Persistent SQLite database (WAL mode)
├── public/
│   ├── index.html           # Single-page UI with Tailwind & FontAwesome
│   ├── app.js               # Reactive frontend logic & state management
│   └── styles.css           # Custom Light Blue theme variables & styles
├── uploads/                 # Storage for candidate uploaded resumes
├── db.js                    # Database schema, prepared queries & seed data
├── server.js                # Express REST API & file upload endpoints
├── start.bat                # Windows batch launcher
├── start.ps1                # PowerShell launcher
├── package.json             # Project dependencies & scripts
└── README.md                # Documentation
```

