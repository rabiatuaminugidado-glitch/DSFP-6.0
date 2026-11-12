// Hikma JobTrack - Frontend Application Logic

// Global Application State
const state = {
  currentView: 'candidate', // 'candidate' | 'admin'
  adminTab: 'applications', // 'applications' | 'jobs'
  jobs: [],
  selectedJob: null,
  adminCandidate: null,
  candidateRating: 0,
  searchTimer: null,
  adminSearchTimer: null,
  selectedResumeFile: null,
  lastGeneratedTrackingCode: null
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();
  loadJobs();
  setupDragAndDrop();
});

// Setup resume drag & drop
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      const fileInput = document.getElementById('apply-resume-input');
      fileInput.files = files;
      handleFileSelect(fileInput);
    }
  }, false);
}

// ============================================================
// VIEW SWITCHING (CANDIDATE VS ADMIN)
// ============================================================
function switchView(view) {
  state.currentView = view;
  const candidateView = document.getElementById('candidate-view');
  const adminView = document.getElementById('admin-view');
  const toggleCand = document.getElementById('view-toggle-candidate');
  const toggleAdmin = document.getElementById('view-toggle-admin');

  if (view === 'candidate') {
    candidateView.classList.remove('hidden');
    adminView.classList.add('hidden');
    toggleCand.className = 'px-3 py-1.5 rounded-lg bg-white text-sky-700 shadow-sm transition flex items-center gap-1.5 font-bold';
    toggleAdmin.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-sky-700 transition flex items-center gap-1.5 font-medium';
    loadJobs();
  } else {
    candidateView.classList.add('hidden');
    adminView.classList.remove('hidden');
    toggleAdmin.className = 'px-3 py-1.5 rounded-lg bg-white text-sky-700 shadow-sm transition flex items-center gap-1.5 font-bold';
    toggleCand.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-sky-700 transition flex items-center gap-1.5 font-medium';
    loadAdminStats();
    loadAdminApplications();
    loadAdminJobs();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchAdminTab(tab) {
  state.adminTab = tab;
  const tabAppsBtn = document.getElementById('admin-tab-apps');
  const tabJobsBtn = document.getElementById('admin-tab-jobs');
  const panelApps = document.getElementById('admin-panel-applications');
  const panelJobs = document.getElementById('admin-panel-jobs');

  if (tab === 'applications') {
    tabAppsBtn.className = 'pb-3 border-b-2 border-sky-600 text-sky-600 flex items-center gap-2 font-bold';
    tabJobsBtn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-sky-600 flex items-center gap-2 font-semibold';
    panelApps.classList.remove('hidden');
    panelJobs.classList.add('hidden');
    loadAdminApplications();
  } else {
    tabJobsBtn.className = 'pb-3 border-b-2 border-sky-600 text-sky-600 flex items-center gap-2 font-bold';
    tabAppsBtn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-sky-600 flex items-center gap-2 font-semibold';
    panelJobs.classList.remove('hidden');
    panelApps.classList.add('hidden');
    loadAdminJobs();
  }
}

// ============================================================
// CANDIDATE PORTAL: JOBS LISTING & FILTERING
// ============================================================
async function loadDepartments() {
  try {
    const res = await fetch('/api/departments');
    const data = await res.json();
    if (!data.success) return;

    const select = document.getElementById('filter-department');
    select.innerHTML = '<option value="all">All Departments</option>';

    data.departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.department;
      opt.textContent = `${d.department} (${d.count})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading departments:', err);
  }
}

function debounceSearch() {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    loadJobs();
  }, 300);
}

function setDeptFilter(dept) {
  const select = document.getElementById('filter-department');
  select.value = dept;

  document.querySelectorAll('.dept-pill').forEach(pill => {
    if (pill.getAttribute('data-dept') === dept) {
      pill.className = 'dept-pill px-2.5 py-1 rounded-lg bg-sky-600 text-white font-medium transition';
    } else {
      pill.className = 'dept-pill px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700 font-medium transition';
    }
  });

  loadJobs();
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-department').value = 'all';
  document.getElementById('filter-work-type').value = 'all';
  document.getElementById('filter-experience').value = 'all';
  setDeptFilter('all');
  loadJobs();
}

async function loadJobs() {
  const container = document.getElementById('jobs-container');
  const loading = document.getElementById('jobs-loading');
  const empty = document.getElementById('jobs-empty');
  const countBadge = document.getElementById('job-count-badge');

  container.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  const search = document.getElementById('filter-search').value.trim();
  const dept = document.getElementById('filter-department').value;
  const workType = document.getElementById('filter-work-type').value;
  const exp = document.getElementById('filter-experience').value;

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (dept && dept !== 'all') params.append('department', dept);
  if (workType && workType !== 'all') params.append('work_type', workType);
  if (exp && exp !== 'all') params.append('experience_level', exp);

  try {
    const res = await fetch(`/api/jobs?${params.toString()}`);
    const data = await res.json();
    loading.classList.add('hidden');

    if (!data.success || !data.jobs || data.jobs.length === 0) {
      countBadge.textContent = '0 Openings';
      empty.classList.remove('hidden');
      state.jobs = [];
      return;
    }

    state.jobs = data.jobs;
    countBadge.textContent = `${data.jobs.length} Opening${data.jobs.length === 1 ? '' : 's'}`;
    renderJobs(data.jobs);
  } catch (err) {
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
    console.error('Error loading jobs:', err);
    showToast('Failed to load jobs. Check server connection.', 'error');
  }
}

function renderJobs(jobs) {
  const container = document.getElementById('jobs-container');
  container.innerHTML = '';

  jobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card bg-white rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden';

    // Featured Ribbon
    const featuredRibbon = job.featured 
      ? `<div class="absolute top-0 right-0 bg-gradient-to-l from-sky-500 to-sky-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-sm flex items-center gap-1">
          <i class="fa-solid fa-star text-[9px]"></i> Featured
        </div>` 
      : '';

    // Format Salary
    let salaryText = 'Competitive';
    if (job.salary_min && job.salary_max) {
      salaryText = `${formatNumber(job.salary_min)} - ${formatNumber(job.salary_max)} ${job.salary_currency}`;
    } else if (job.salary_min) {
      salaryText = `From ${formatNumber(job.salary_min)} ${job.salary_currency}`;
    }

    card.innerHTML = `
      ${featuredRibbon}
      <div>
        <!-- Badges row -->
        <div class="flex flex-wrap items-center gap-1.5 mb-3 pr-16">
          <span class="badge-light-blue px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
            ${escapeHTML(job.department)}
          </span>
          <span class="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
            <i class="fa-solid fa-${job.work_type === 'Remote' ? 'house-laptop' : job.work_type === 'Hybrid' ? 'shuffle' : 'building'} text-slate-400 text-[10px]"></i>
            ${escapeHTML(job.work_type)}
          </span>
          <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px]">
            ${escapeHTML(job.employment_type)}
          </span>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition leading-snug cursor-pointer" onclick="openJobDetails(${job.id})">
          ${escapeHTML(job.title)}
        </h3>

        <!-- Location & Company -->
        <div class="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
          <span class="font-medium text-slate-700">${escapeHTML(job.company)}</span>
          <span>&bull;</span>
          <span class="flex items-center gap-1"><i class="fa-solid fa-location-dot text-sky-500 text-[11px]"></i> ${escapeHTML(job.location)}</span>
        </div>

        <!-- Short Description -->
        <p class="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
          ${escapeHTML(job.description)}
        </p>

        <!-- Requirements preview chips -->
        ${job.requirements && job.requirements.length > 0 ? `
          <div class="mt-3 flex flex-wrap gap-1">
            ${job.requirements.slice(0, 2).map(r => `
              <span class="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-full">
                ${escapeHTML(r)}
              </span>
            `).join('')}
            ${job.requirements.length > 2 ? `<span class="text-[10px] text-slate-400 px-1">+${job.requirements.length - 2} more</span>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Card Footer -->
      <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span class="text-[10px] text-slate-400 block font-medium">Compensation</span>
          <span class="text-xs font-bold text-slate-900">${salaryText}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openJobDetails(${job.id})" class="px-3 py-1.5 rounded-xl btn-outline-blue text-xs font-semibold">
            Details
          </button>
          <button onclick="openApplyModal(${job.id})" class="px-3.5 py-1.5 rounded-xl btn-primary-blue text-xs font-semibold flex items-center gap-1.5">
            Apply <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================================
// JOB DETAILS MODAL
// ============================================================
async function openJobDetails(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (!data.success) {
      showToast('Could not load job details', 'error');
      return;
    }

    const job = data.job;
    state.selectedJob = job;

    document.getElementById('detail-dept-badge').textContent = job.department;
    document.getElementById('detail-type-badge').textContent = `${job.work_type} • ${job.employment_type}`;
    document.getElementById('detail-exp-badge').textContent = job.experience_level;
    document.getElementById('detail-title').textContent = job.title;
    document.getElementById('detail-location').innerHTML = `<i class="fa-solid fa-location-dot text-sky-500"></i> ${escapeHTML(job.location)}`;

    let salaryText = 'Competitive Compensation';
    if (job.salary_min && job.salary_max) {
      salaryText = `${formatNumber(job.salary_min)} - ${formatNumber(job.salary_max)} ${job.salary_currency}`;
    }
    document.getElementById('detail-salary').innerHTML = `<i class="fa-solid fa-money-bill-wave text-emerald-600"></i> ${salaryText}`;

    document.getElementById('detail-description').textContent = job.description;

    // Lists
    renderList('detail-responsibilities', job.responsibilities);
    renderList('detail-requirements', job.requirements);
    renderList('detail-benefits', job.benefits);

    const deadlineElem = document.getElementById('detail-deadline');
    if (job.deadline) {
      deadlineElem.innerHTML = `<i class="fa-regular fa-calendar-xmark text-slate-400"></i> Applications close: <strong class="text-slate-700">${job.deadline}</strong>`;
    } else {
      deadlineElem.textContent = 'Accepting applications on a rolling basis';
    }

    openModal('modal-job-details');
  } catch (err) {
    console.error('Error in openJobDetails:', err);
    showToast('Failed to load opening details', 'error');
  }
}

function renderList(elemId, items) {
  const ul = document.getElementById(elemId);
  ul.innerHTML = '';
  if (!items || items.length === 0) {
    ul.innerHTML = '<li class="text-slate-400 italic">No specific details listed</li>';
    return;
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
}

function openApplyModalFromDetail() {
  closeModal('modal-job-details');
  if (state.selectedJob) {
    openApplyModal(state.selectedJob.id);
  }
}

// ============================================================
// CANDIDATE APPLICATION MODAL & FORM SUBMISSION
// ============================================================
function openApplyModal(jobId) {
  const job = state.jobs.find(j => j.id === jobId) || state.selectedJob;
  if (!job) return;

  state.selectedJob = job;
  document.getElementById('apply-job-id').value = job.id;
  document.getElementById('apply-modal-job-title').textContent = job.title;
  document.getElementById('apply-modal-job-dept').textContent = `${job.department} • ${job.location} (${job.work_type})`;

  // Reset form
  document.getElementById('form-application').reset();
  clearSelectedFile();
  document.getElementById('apply-error-msg').classList.add('hidden');

  openModal('modal-apply');
}

function handleFileSelect(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    state.selectedResumeFile = file;

    document.getElementById('dropzone-prompt').classList.add('hidden');
    const info = document.getElementById('dropzone-fileinfo');
    info.classList.remove('hidden');

    document.getElementById('dropzone-filename').textContent = file.name;
    document.getElementById('dropzone-filesize').textContent = formatBytes(file.size);
  }
}

function clearSelectedFile(e) {
  if (e) e.stopPropagation();
  state.selectedResumeFile = null;
  const input = document.getElementById('apply-resume-input');
  if (input) input.value = '';
  document.getElementById('dropzone-prompt').classList.remove('hidden');
  document.getElementById('dropzone-fileinfo').classList.add('hidden');
}

async function handleApplicationSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('form-application');
  const errorMsg = document.getElementById('apply-error-msg');
  const submitBtn = document.getElementById('btn-submit-apply');

  errorMsg.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Submitting...';

  try {
    const formData = new FormData(form);

    const res = await fetch('/api/applications', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Submit Application</span> <i class="fa-solid fa-arrow-right"></i>';

    if (!data.success) {
      errorMsg.textContent = data.error || 'Failed to submit application. Please check your inputs.';
      errorMsg.classList.remove('hidden');
      return;
    }

    // Success!
    closeModal('modal-apply');
    state.lastGeneratedTrackingCode = data.tracking_code;
    document.getElementById('success-tracking-code').textContent = data.tracking_code;
    openModal('modal-success');
    showToast('Application successfully submitted!', 'success');
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Submit Application</span> <i class="fa-solid fa-arrow-right"></i>';
    errorMsg.textContent = 'A network error occurred. Please try again.';
    errorMsg.classList.remove('hidden');
    console.error('Error submitting application:', err);
  }
}

function copyTrackingCode() {
  const code = document.getElementById('success-tracking-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Tracking code ${code} copied to clipboard!`, 'info');
  }).catch(() => {
    showToast(code, 'info');
  });
}

function trackFromSuccess() {
  closeModal('modal-success');
  openTrackModal(state.lastGeneratedTrackingCode);
}

// ============================================================
// APPLICATION TRACKER MODAL
// ============================================================
function openTrackModal(optionalCode = '') {
  const input = document.getElementById('track-input');
  if (optionalCode) {
    input.value = optionalCode;
    performTrackLookup(optionalCode);
  } else {
    document.getElementById('track-initial-state').classList.remove('hidden');
    document.getElementById('track-cards-list').classList.add('hidden');
    document.getElementById('track-cards-list').innerHTML = '';
  }
  openModal('modal-track');
}

function handleTrackSearch(e) {
  e.preventDefault();
  const val = document.getElementById('track-input').value.trim();
  if (!val) return;
  performTrackLookup(val);
}

async function performTrackLookup(identifier) {
  const initialState = document.getElementById('track-initial-state');
  const cardsList = document.getElementById('track-cards-list');

  initialState.classList.add('hidden');
  cardsList.classList.remove('hidden');
  cardsList.innerHTML = `
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-200 border-t-sky-600"></div>
      <p class="text-xs text-slate-500 mt-2">Checking application status...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/track/${encodeURIComponent(identifier)}`);
    const data = await res.json();

    if (!data.success || !data.applications || data.applications.length === 0) {
      cardsList.innerHTML = `
        <div class="text-center py-8 bg-rose-50/50 rounded-xl border border-rose-200 p-6">
          <i class="fa-solid fa-circle-exclamation text-2xl text-rose-500 mb-2"></i>
          <p class="font-bold text-slate-800 text-sm">No Applications Found</p>
          <p class="text-xs text-slate-500 mt-1">${escapeHTML(data.error || 'Please double-check the tracking code or email address.')}</p>
        </div>
      `;
      return;
    }

    renderTrackingResults(data.applications);
  } catch (err) {
    cardsList.innerHTML = `
      <div class="text-center py-8 bg-rose-50 rounded-xl text-rose-600 text-xs">
        Failed to fetch tracking data. Please try again.
      </div>
    `;
    console.error('Track error:', err);
  }
}

function renderTrackingResults(apps) {
  const cardsList = document.getElementById('track-cards-list');
  cardsList.innerHTML = '';

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-sky-100 shadow-md p-5 space-y-4';

    // Status Stepper calculation
    // Stages: 1. Applied (pending) -> 2. Reviewing -> 3. Shortlisted -> 4. Interview -> 5. Offer (or Rejected / Withdrawn)
    const stages = [
      { key: 'pending', label: 'Applied' },
      { key: 'reviewing', label: 'In Review' },
      { key: 'shortlisted', label: 'Shortlisted' },
      { key: 'interview', label: 'Interview' },
      { key: 'offered', label: 'Offer Extended' }
    ];

    const currentStatus = app.status.toLowerCase();
    const isRejected = currentStatus === 'rejected';
    const isWithdrawn = currentStatus === 'withdrawn';

    let stageIdx = 0;
    if (currentStatus === 'reviewing') stageIdx = 1;
    else if (currentStatus === 'shortlisted') stageIdx = 2;
    else if (currentStatus === 'interview') stageIdx = 3;
    else if (currentStatus === 'offered') stageIdx = 4;

    let stepperHTML = '';
    if (!isRejected && !isWithdrawn) {
      stepperHTML = `
        <div class="pt-2 pb-1">
          <div class="flex items-center justify-between text-center relative">
            <div class="absolute top-3.5 left-4 right-4 h-1 bg-slate-100 -z-0"></div>
            <div class="absolute top-3.5 left-4 h-1 bg-sky-500 -z-0 transition-all duration-500" style="width: ${(stageIdx / (stages.length - 1)) * 90}%"></div>
            ${stages.map((st, idx) => {
              const isPast = idx <= stageIdx;
              const isCurrent = idx === stageIdx;
              return `
                <div class="flex flex-col items-center relative z-10">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    isCurrent 
                      ? 'bg-sky-600 text-white ring-4 ring-sky-100' 
                      : isPast 
                      ? 'bg-sky-500 text-white' 
                      : 'bg-white border-2 border-slate-200 text-slate-400'
                  }">
                    ${isPast ? '<i class="fa-solid fa-check text-[10px]"></i>' : (idx + 1)}
                  </div>
                  <span class="text-[10px] mt-1.5 font-semibold ${isCurrent ? 'text-sky-700 font-bold' : isPast ? 'text-slate-800' : 'text-slate-400'}">
                    ${st.label}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (isRejected) {
      stepperHTML = `
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
          <i class="fa-solid fa-circle-xmark text-rose-600 text-base"></i>
          <div>
            <span class="font-bold">Application Not Selected</span>
            <p class="text-[11px] text-rose-600">While this role wasn't a match, we encourage you to apply for future openings that fit your profile.</p>
          </div>
        </div>
      `;
    } else {
      stepperHTML = `
        <div class="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-700">
          <i class="fa-solid fa-ban text-slate-500 text-base"></i>
          <div>
            <span class="font-bold">Application Withdrawn</span>
            <p class="text-[11px] text-slate-500">You withdrew this application.</p>
          </div>
        </div>
      `;
    }

    // Status Badge Color
    const statusBadges = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      reviewing: 'bg-sky-100 text-sky-800 border-sky-200',
      shortlisted: 'bg-blue-100 text-blue-800 border-blue-200',
      interview: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      offered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      rejected: 'bg-rose-100 text-rose-800 border-rose-200',
      withdrawn: 'bg-slate-100 text-slate-700 border-slate-200'
    };

    // Audit Timeline
    const historyList = app.history && app.history.length > 0 ? `
      <div class="mt-4 pt-3 border-t border-slate-100">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Application Timeline</span>
        <div class="space-y-2 border-l-2 border-sky-200 pl-3 ml-1 text-xs">
          ${app.history.map(h => `
            <div class="relative">
              <div class="w-2 h-2 rounded-full bg-sky-500 absolute -left-[17px] top-1"></div>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-800 capitalize">${escapeHTML(h.status)}</span>
                <span class="text-[10px] text-slate-400">${formatDate(h.created_at)}</span>
              </div>
              ${h.note ? `<p class="text-[11px] text-slate-500 mt-0.5">${escapeHTML(h.note)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span class="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200">
            ${escapeHTML(app.tracking_code)}
          </span>
          <h4 class="text-base font-bold text-slate-900 mt-1">${escapeHTML(app.job_title)}</h4>
          <span class="text-xs text-slate-500">${escapeHTML(app.department)} &bull; ${escapeHTML(app.job_location)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusBadges[app.status] || 'bg-slate-100 text-slate-700'}">
            ${escapeHTML(app.status)}
          </span>
        </div>
      </div>

      <!-- Stepper -->
      ${stepperHTML}

      <!-- Candidate Submitted Summary -->
      <div class="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><strong>Applicant:</strong> ${escapeHTML(app.applicant_name)}</div>
        <div><strong>Email:</strong> ${escapeHTML(app.applicant_email)}</div>
        <div><strong>Applied Date:</strong> ${formatDate(app.created_at)}</div>
        ${app.resume_originalname ? `
          <div>
            <strong>Resume:</strong> 
            <a href="/api/resumes/${app.resume_filename}" target="_blank" class="text-sky-600 hover:underline inline-flex items-center gap-1 font-semibold">
              <i class="fa-solid fa-paperclip"></i> ${escapeHTML(app.resume_originalname)}
            </a>
          </div>
        ` : '<div><strong>Resume:</strong> Profile text submitted</div>'}
      </div>

      <!-- Timeline -->
      ${historyList}

      <!-- Actions -->
      ${!isWithdrawn && !isRejected ? `
        <div class="flex justify-end pt-2">
          <button onclick="withdrawApplication(${app.id}, '${app.tracking_code}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium transition flex items-center gap-1">
            <i class="fa-solid fa-ban"></i> Withdraw Application
          </button>
        </div>
      ` : ''}
    `;

    cardsList.appendChild(card);
  });
}

async function withdrawApplication(appId, code) {
  if (!confirm('Are you sure you want to withdraw this application? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/applications/${appId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_code: code })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Application withdrawn successfully.', 'info');
      performTrackLookup(code);
    } else {
      showToast(data.error || 'Failed to withdraw', 'error');
    }
  } catch (err) {
    showToast('Failed to withdraw application', 'error');
  }
}

// ============================================================
// ADMIN PORTAL LOGIC: KPI STATS & OVERVIEW
// ============================================================
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (!data.success) return;

    const s = data.stats;
    document.getElementById('stat-total-jobs').textContent = s.totalJobs;
    document.getElementById('stat-active-jobs').textContent = `${s.activeJobs} Active • ${s.closedJobs} Closed`;
    document.getElementById('stat-total-apps').textContent = s.totalApplications;
    document.getElementById('stat-pending-apps').textContent = s.pendingApps;
    document.getElementById('stat-shortlisted-apps').textContent = s.shortlistedApps;
    document.getElementById('stat-interview-apps').textContent = s.interviewApps;
    document.getElementById('stat-offered-apps').textContent = s.offeredApps;
  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

// ============================================================
// ADMIN: CANDIDATE APPLICATIONS MANAGEMENT
// ============================================================
function debounceAdminApps() {
  clearTimeout(state.adminSearchTimer);
  state.adminSearchTimer = setTimeout(() => {
    loadAdminApplications();
  }, 300);
}

async function loadAdminApplications() {
  const tbody = document.getElementById('admin-applications-tbody');
  const empty = document.getElementById('admin-apps-empty');
  const countElem = document.getElementById('admin-apps-count');
  const jobSelect = document.getElementById('admin-filter-job');

  const jobId = jobSelect ? jobSelect.value : 'all';
  const status = document.getElementById('admin-filter-status').value;
  const search = document.getElementById('admin-filter-search').value.trim();

  const params = new URLSearchParams();
  if (jobId && jobId !== 'all') params.append('job_id', jobId);
  if (status && status !== 'all') params.append('status', status);
  if (search) params.append('search', search);

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-8 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-lg text-sky-500"></i>
        <span class="block text-xs mt-1">Loading candidates...</span>
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/admin/applications?${params.toString()}`);
    const data = await res.json();

    if (!data.success || !data.applications || data.applications.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      countElem.textContent = '0 candidates';
      return;
    }

    empty.classList.add('hidden');
    countElem.textContent = `${data.applications.length} candidate${data.applications.length === 1 ? '' : 's'}`;
    renderAdminApplications(data.applications);

    // Also populate admin-filter-job options if empty
    populateAdminJobFilter(data.applications);
  } catch (err) {
    console.error('Error loading admin applications:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error loading applications</td></tr>`;
  }
}

function populateAdminJobFilter(apps) {
  const select = document.getElementById('admin-filter-job');
  if (select.options.length > 1) return; // already populated

  const map = new Map();
  apps.forEach(a => map.set(a.job_id, a.job_title));

  map.forEach((title, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = title;
    select.appendChild(opt);
  });
}

function renderAdminApplications(apps) {
  const tbody = document.getElementById('admin-applications-tbody');
  tbody.innerHTML = '';

  const statusColors = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    reviewing: 'bg-sky-100 text-sky-800 border-sky-200',
    shortlisted: 'bg-blue-100 text-blue-800 border-blue-200',
    interview: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    offered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-800 border-rose-200',
    withdrawn: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  apps.forEach(app => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition cursor-pointer';
    tr.onclick = (e) => {
      // Avoid firing if clicked on action button/select
      if (e.target.closest('button') || e.target.closest('select')) return;
      openAdminCandidateModal(app.id);
    };

    // Stars rating display
    const stars = app.rating > 0 
      ? `<span class="text-amber-400 text-[10px] ml-1.5">${'★'.repeat(app.rating)}${'☆'.repeat(5 - app.rating)}</span>` 
      : '';

    tr.innerHTML = `
      <td class="px-4 py-3">
        <div class="font-bold text-slate-900 flex items-center">
          ${escapeHTML(app.applicant_name)}
          ${stars}
        </div>
        <div class="text-[11px] text-slate-500">${escapeHTML(app.applicant_email)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="font-semibold text-slate-800">${escapeHTML(app.job_title)}</div>
        <div class="text-[11px] text-slate-400">${escapeHTML(app.job_department)}</div>
      </td>
      <td class="px-4 py-3">
        <span class="font-medium text-slate-700">${app.experience_years || 0} yrs</span>
      </td>
      <td class="px-4 py-3">
        <span class="font-mono text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
          ${escapeHTML(app.tracking_code)}
        </span>
      </td>
      <td class="px-4 py-3 text-slate-500 whitespace-nowrap">
        ${formatDate(app.created_at)}
      </td>
      <td class="px-4 py-3">
        <select onchange="updateApplicationStatusDirect(${app.id}, this.value)" class="text-[11px] font-bold rounded-lg px-2.5 py-1 border ${statusColors[app.status] || 'bg-slate-100'} cursor-pointer focus:outline-none">
          <option value="pending" ${app.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="reviewing" ${app.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
          <option value="shortlisted" ${app.status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
          <option value="interview" ${app.status === 'interview' ? 'selected' : ''}>Interview</option>
          <option value="offered" ${app.status === 'offered' ? 'selected' : ''}>Offered</option>
          <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
      <td class="px-4 py-3 text-right">
        <button onclick="openAdminCandidateModal(${app.id})" class="px-3 py-1.5 rounded-lg btn-outline-blue text-[11px] font-semibold inline-flex items-center gap-1">
          Review <i class="fa-solid fa-angle-right"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function updateApplicationStatusDirect(appId, newStatus) {
  try {
    const res = await fetch(`/api/admin/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, note: `Status updated via Admin Table to ${newStatus}` })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Candidate status set to ${newStatus}`, 'success');
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch (err) {
    showToast('Network error updating status', 'error');
  }
}

// ============================================================
// ADMIN: CANDIDATE DETAIL MODAL
// ============================================================
async function openAdminCandidateModal(appId) {
  try {
    const res = await fetch(`/api/admin/applications/${appId}`);
    const data = await res.json();
    if (!data.success) {
      showToast('Could not load candidate profile', 'error');
      return;
    }

    const cand = data.application;
    state.adminCandidate = cand;
    state.candidateRating = cand.rating || 0;

    document.getElementById('cand-name').textContent = cand.applicant_name;
    document.getElementById('cand-tracking-code').textContent = cand.tracking_code;
    document.getElementById('cand-status-badge').textContent = cand.status;
    document.getElementById('cand-job-title').textContent = `${cand.job_title} • ${cand.department}`;

    const emailLink = document.getElementById('cand-email-link');
    emailLink.textContent = cand.applicant_email;
    emailLink.href = `mailto:${cand.applicant_email}`;

    document.getElementById('cand-phone').textContent = cand.applicant_phone || 'N/A';
    document.getElementById('cand-location').textContent = cand.location || 'Not specified';
    document.getElementById('cand-exp').textContent = cand.experience_years || '0';

    // Resume button
    const resumeBtn = document.getElementById('cand-resume-btn');
    if (cand.resume_filename) {
      resumeBtn.href = `/api/resumes/${cand.resume_filename}`;
      resumeBtn.classList.remove('hidden');
      resumeBtn.innerHTML = `<i class="fa-solid fa-file-arrow-down text-base"></i> Download Resume (${escapeHTML(cand.resume_originalname || 'file')})`;
    } else {
      resumeBtn.classList.add('hidden');
    }

    // LinkedIn & Portfolio
    const liBtn = document.getElementById('cand-linkedin');
    if (cand.linkedin_url) {
      liBtn.href = cand.linkedin_url;
      liBtn.classList.remove('hidden');
    } else {
      liBtn.classList.add('hidden');
    }

    const portBtn = document.getElementById('cand-portfolio');
    if (cand.portfolio_url) {
      portBtn.href = cand.portfolio_url;
      portBtn.classList.remove('hidden');
    } else {
      portBtn.classList.add('hidden');
    }

    // Cover letter
    document.getElementById('cand-cover-letter').textContent = cand.cover_letter || 'No cover note provided by applicant.';

    // Status changer
    document.getElementById('cand-status-select').value = cand.status;
    document.getElementById('cand-status-note').value = '';

    // Rating & Notes
    updateRatingStarsUI(cand.rating || 0);
    document.getElementById('cand-notes-input').value = cand.admin_notes || '';

    // Timeline
    renderCandidateTimeline(cand.history || []);

    openModal('modal-admin-candidate');
  } catch (err) {
    console.error('Error opening candidate modal:', err);
    showToast('Failed to load candidate', 'error');
  }
}

function updateRatingStarsUI(rating) {
  state.candidateRating = rating;
  const buttons = document.querySelectorAll('#cand-rating-stars .star-btn');
  buttons.forEach((btn, idx) => {
    if (idx < rating) {
      btn.className = 'star-btn text-amber-400 text-sm';
    } else {
      btn.className = 'star-btn text-slate-300 hover:text-amber-400 text-sm';
    }
  });
}

function setCandidateRating(stars) {
  updateRatingStarsUI(stars);
  saveCandidateNotes();
}

async function saveCandidateNotes() {
  if (!state.adminCandidate) return;
  const notes = document.getElementById('cand-notes-input').value.trim();

  try {
    const res = await fetch(`/api/admin/applications/${state.adminCandidate.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes, rating: state.candidateRating })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Recruiter assessment saved', 'info');
      loadAdminApplications();
    }
  } catch (err) {
    showToast('Failed to save assessment', 'error');
  }
}

async function handleCandidateStatusUpdate() {
  if (!state.adminCandidate) return;
  const newStatus = document.getElementById('cand-status-select').value;
  const note = document.getElementById('cand-status-note').value.trim();

  try {
    const res = await fetch(`/api/admin/applications/${state.adminCandidate.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, note })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Status updated to ${newStatus}`, 'success');
      openAdminCandidateModal(state.adminCandidate.id);
      loadAdminStats();
      loadAdminApplications();
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch (err) {
    showToast('Error updating status', 'error');
  }
}

function renderCandidateTimeline(history) {
  const container = document.getElementById('cand-timeline');
  container.innerHTML = '';

  if (!history || history.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-xs italic">No timeline entries yet</p>';
    return;
  }

  history.forEach(h => {
    const div = document.createElement('div');
    div.className = 'relative';
    div.innerHTML = `
      <div class="w-2.5 h-2.5 rounded-full bg-sky-500 absolute -left-[21px] top-1"></div>
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-800 capitalize">${escapeHTML(h.status)}</span>
        <span class="text-[10px] text-slate-400">${formatDate(h.created_at)}</span>
      </div>
      <p class="text-xs text-slate-600 mt-0.5">${escapeHTML(h.note || '')}</p>
    `;
    container.appendChild(div);
  });
}

// ============================================================
// ADMIN: JOB OPENINGS CRUD
// ============================================================
async function loadAdminJobs() {
  const tbody = document.getElementById('admin-jobs-tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-6 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-sky-500"></i> Loading jobs...
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/jobs?status=all');
    const data = await res.json();

    if (!data.success || !data.jobs || data.jobs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No job openings created yet.</td></tr>`;
      return;
    }

    renderAdminJobsTable(data.jobs);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Failed to load openings.</td></tr>`;
  }
}

function renderAdminJobsTable(jobs) {
  const tbody = document.getElementById('admin-jobs-tbody');
  tbody.innerHTML = '';

  jobs.forEach(job => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    let salaryText = 'Competitive';
    if (job.salary_min && job.salary_max) {
      salaryText = `${formatNumber(job.salary_min)} - ${formatNumber(job.salary_max)} ${job.salary_currency}`;
    }

    const statusBadge = job.status === 'active'
      ? `<span class="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">Active</span>`
      : job.status === 'draft'
      ? `<span class="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Draft</span>`
      : `<span class="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">Closed</span>`;

    tr.innerHTML = `
      <td class="px-4 py-3">
        <div class="font-bold text-slate-900">${escapeHTML(job.title)}</div>
        <div class="text-[11px] text-sky-700">${escapeHTML(job.department)}</div>
      </td>
      <td class="px-4 py-3">
        <div>${escapeHTML(job.location)}</div>
        <div class="text-[11px] text-slate-400">${escapeHTML(job.work_type)} • ${escapeHTML(job.employment_type)}</div>
      </td>
      <td class="px-4 py-3 font-medium text-slate-800">
        ${salaryText}
      </td>
      <td class="px-4 py-3">
        <button onclick="filterAppsByJob(${job.id})" class="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold hover:bg-sky-200 transition text-[11px]">
          ${job.applicant_count || 0} applicants
        </button>
      </td>
      <td class="px-4 py-3">
        ${statusBadge}
      </td>
      <td class="px-4 py-3 text-slate-500">
        ${job.deadline || 'Open'}
      </td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick="openEditJobModal(${job.id})" class="p-1.5 text-slate-600 hover:text-sky-600 transition" title="Edit Opening">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="toggleJobStatusQuick(${job.id}, '${job.status === 'active' ? 'closed' : 'active'}')" class="p-1.5 ${job.status === 'active' ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-500 hover:text-emerald-700'} transition" title="${job.status === 'active' ? 'Close Opening' : 'Reopen Job'}">
          <i class="fa-solid fa-${job.status === 'active' ? 'box-archive' : 'arrow-rotate-left'}"></i>
        </button>
        <button onclick="deleteJobConfirm(${job.id})" class="p-1.5 text-rose-500 hover:text-rose-700 transition" title="Delete Opening">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterAppsByJob(jobId) {
  switchAdminTab('applications');
  const jobSelect = document.getElementById('admin-filter-job');
  jobSelect.value = jobId;
  loadAdminApplications();
}

function openPostJobModal() {
  document.getElementById('form-admin-job').reset();
  document.getElementById('admin-job-id').value = '';
  document.getElementById('admin-job-modal-title').textContent = 'Post New Job Opening';
  document.getElementById('btn-admin-job-text').textContent = 'Publish Job Opening';
  openModal('modal-admin-job');
}

async function openEditJobModal(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (!data.success) return;

    const j = data.job;
    document.getElementById('admin-job-id').value = j.id;
    document.getElementById('admin-job-title').value = j.title;
    document.getElementById('admin-job-dept').value = j.department;
    document.getElementById('admin-job-location').value = j.location;
    document.getElementById('admin-job-work-type').value = j.work_type;
    document.getElementById('admin-job-emp-type').value = j.employment_type;
    document.getElementById('admin-job-exp-level').value = j.experience_level;
    document.getElementById('admin-job-salary-min').value = j.salary_min || '';
    document.getElementById('admin-job-salary-max').value = j.salary_max || '';
    document.getElementById('admin-job-currency').value = j.salary_currency || 'USD';
    document.getElementById('admin-job-deadline').value = j.deadline || '';
    document.getElementById('admin-job-status').value = j.status;
    document.getElementById('admin-job-featured').checked = !!j.featured;
    document.getElementById('admin-job-desc').value = j.description;

    document.getElementById('admin-job-responsibilities').value = (j.responsibilities || []).join('\n');
    document.getElementById('admin-job-requirements').value = (j.requirements || []).join('\n');
    document.getElementById('admin-job-benefits').value = (j.benefits || []).join('\n');

    document.getElementById('admin-job-modal-title').textContent = 'Edit Job Opening';
    document.getElementById('btn-admin-job-text').textContent = 'Save Changes';

    openModal('modal-admin-job');
  } catch (err) {
    showToast('Failed to open job for editing', 'error');
  }
}

async function handleAdminJobSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('admin-job-id').value;

  const payload = {
    title: document.getElementById('admin-job-title').value,
    department: document.getElementById('admin-job-dept').value,
    location: document.getElementById('admin-job-location').value,
    work_type: document.getElementById('admin-job-work-type').value,
    employment_type: document.getElementById('admin-job-emp-type').value,
    experience_level: document.getElementById('admin-job-exp-level').value,
    salary_min: document.getElementById('admin-job-salary-min').value,
    salary_max: document.getElementById('admin-job-salary-max').value,
    salary_currency: document.getElementById('admin-job-currency').value,
    deadline: document.getElementById('admin-job-deadline').value,
    status: document.getElementById('admin-job-status').value,
    featured: document.getElementById('admin-job-featured').checked ? 1 : 0,
    description: document.getElementById('admin-job-desc').value,
    responsibilities: document.getElementById('admin-job-responsibilities').value.split('\n').map(s => s.trim()).filter(Boolean),
    requirements: document.getElementById('admin-job-requirements').value.split('\n').map(s => s.trim()).filter(Boolean),
    benefits: document.getElementById('admin-job-benefits').value.split('\n').map(s => s.trim()).filter(Boolean)
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/admin/jobs/${id}` : '/api/admin/jobs';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeModal('modal-admin-job');
      showToast(isEdit ? 'Job opening updated' : 'New job posted successfully', 'success');
      loadAdminJobs();
      loadAdminStats();
      loadDepartments();
    } else {
      showToast(data.error || 'Failed to save job', 'error');
    }
  } catch (err) {
    showToast('Network error saving job', 'error');
  }
}

async function toggleJobStatusQuick(jobId, newStatus) {
  try {
    const res = await fetch(`/api/admin/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Job is now ${newStatus}`, 'info');
      loadAdminJobs();
      loadAdminStats();
    }
  } catch (err) {
    showToast('Failed to update job status', 'error');
  }
}

async function deleteJobConfirm(jobId) {
  if (!confirm('Are you sure you want to permanently delete this job opening and its associated applications?')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/jobs/${jobId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Job opening deleted', 'info');
      loadAdminJobs();
      loadAdminStats();
      loadDepartments();
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  } catch (err) {
    showToast('Error deleting job', 'error');
  }
}

function exportCSV() {
  window.location.href = '/api/admin/export/csv';
}

// ============================================================
// MODAL & UTILITY FUNCTIONS
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

// Close on backdrop click or ESC key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
      closeModal(modal.id);
    });
  }
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-sky-700 text-white'
  };

  const icons = {
    success: 'fa-check',
    error: 'fa-triangle-exclamation',
    info: 'fa-info'
  };

  toast.className = `${typeStyles[type] || typeStyles.info} px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2.5 animate-fade-in pointer-events-auto transition-all`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

