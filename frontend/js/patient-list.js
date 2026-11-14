const patientSearchForm = document.getElementById('patient-search-form');
const patientTable = document.getElementById('patient-table');
const patientMessage = document.getElementById('patient-message');
const pageSize = 20;
const patientState = { page: 1, totalPages: 1, sortBy: 'lastName', sortOrder: 'asc' };
let currentRole = '';

function calculatePatientAge(birthDate) {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : '';
}

function patientCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value == null || value === '' ? '—' : String(value);
  if (className) cell.className = className;
  row.appendChild(cell);
  return cell;
}

function patientAction(label, href, primary = false) {
  const link = document.createElement('a');
  link.className = primary ? 'table-action table-action-primary' : 'table-action';
  link.href = href;
  link.textContent = label;
  return link;
}

function renderPatientRow(patient) {
  const row = document.createElement('tr');
  const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
  const detailUrl = `/pages/patient-details.html?patientId=${encodeURIComponent(patient.patientId)}`;

  patientCell(row, patient.patientId, 'patient-id-cell');
  patientCell(row, fullName);
  const birthCell = patientCell(row, '');
  const birthDate = patient.birthDate ? new Date(patient.birthDate) : null;
  birthCell.textContent = birthDate && !Number.isNaN(birthDate.getTime())
    ? `${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(birthDate)} · ${calculatePatientAge(patient.birthDate)} yrs`
    : '—';
  patientCell(row, patient.sex);
  const contactCell = patientCell(row, patient.contactNo || '');
  if (patient.email) {
    const email = document.createElement('small');
    email.className = 'table-secondary-text';
    email.textContent = patient.email;
    contactCell.appendChild(document.createElement('br'));
    contactCell.appendChild(email);
  }
  patientCell(row, patient.city);
  patientCell(row, patient.medical?.bloodType);
  const allergyCell = patientCell(row, patient.medical?.allergies || 'Not recorded');
  if (patient.medical?.allergies) allergyCell.classList.add('allergy-cell');
  patientCell(row, patient.insurance?.provider);

  const actions = document.createElement('td');
  actions.className = 'patient-actions';
  actions.append(patientAction('Details', detailUrl, true));
  if (currentRole !== 'medication_auditor') {
    actions.appendChild(patientAction('Edit', `/pages/patient-form.html?patientId=${encodeURIComponent(patient.patientId)}`));
  }
  actions.append(
    patientAction('History', `/pages/medication-history.html?patientId=${encodeURIComponent(patient.patientId)}`),
    patientAction('Orders', `${detailUrl}#orders`),
    patientAction('Administrations', `${detailUrl}#administrations`)
  );
  row.appendChild(actions);
  return row;
}

function readPatientFilters() {
  const params = new URLSearchParams();
  const values = {
    search: document.getElementById('patient-search').value.trim(),
    sex: document.getElementById('filter-sex').value,
    civilStatus: document.getElementById('filter-civil-status').value,
    city: document.getElementById('filter-city').value.trim(),
    bloodType: document.getElementById('filter-blood-type').value,
    smoker: document.getElementById('filter-smoker').value,
    insuranceProvider: document.getElementById('filter-insurance').value.trim()
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  params.set('page', String(patientState.page));
  params.set('limit', String(pageSize));
  params.set('sortBy', patientState.sortBy);
  params.set('sortOrder', patientState.sortOrder);
  return params;
}

async function loadPatients() {
  patientMessage.textContent = 'Loading patients…';
  patientMessage.className = 'status-message';
  patientTable.replaceChildren();
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 10;
  loadingCell.className = 'table-state';
  loadingCell.textContent = 'Loading patient records…';
  loadingRow.appendChild(loadingCell);
  patientTable.appendChild(loadingRow);

  try {
    if (!currentRole) {
      const session = await apiFetch('/api/v1/auth/me');
      currentRole = session.user.role;
      document.querySelector('[data-edit-role]')?.toggleAttribute('hidden', currentRole === 'medication_auditor');
    }
    const patients = await apiFetch(`/api/v1/patients?${readPatientFilters()}`);
    const pagination = patients.pagination || { page: 1, total: patients.length, totalPages: 1 };
    patientState.totalPages = Math.max(1, pagination.totalPages || 1);
    patientTable.replaceChildren();
    for (const patient of patients) patientTable.appendChild(renderPatientRow(patient));

    if (patients.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 10;
      emptyCell.className = 'table-state';
      emptyCell.textContent = readPatientFilters().has('search') || ['sex', 'civilStatus', 'city', 'bloodType', 'smoker', 'insuranceProvider'].some((key) => readPatientFilters().has(key))
        ? 'No patients match these search and filter criteria.'
        : 'No patients are registered yet. Add a patient to get started.';
      emptyRow.appendChild(emptyCell);
      patientTable.appendChild(emptyRow);
    }

    patientMessage.textContent = patients.length ? `${pagination.total} patient${pagination.total === 1 ? '' : 's'} found.` : '';
    document.getElementById('patient-count').textContent = pagination.total
      ? `Showing ${(pagination.page - 1) * pageSize + 1}–${(pagination.page - 1) * pageSize + patients.length} of ${pagination.total}`
      : 'No patient records';
    document.getElementById('patient-page').textContent = `Page ${pagination.page} of ${patientState.totalPages}`;
    document.getElementById('patient-previous').disabled = pagination.page <= 1;
    document.getElementById('patient-next').disabled = pagination.page >= patientState.totalPages;
  } catch (error) {
    patientTable.replaceChildren();
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = 10;
    errorCell.className = 'table-state table-error-state';
    errorCell.textContent = 'Patient records could not be loaded. Check your connection and try again.';
    errorRow.appendChild(errorCell);
    patientTable.appendChild(errorRow);
    patientMessage.textContent = error.message || 'Unable to load patients.';
    patientMessage.className = 'status-message error-text';
    document.getElementById('patient-count').textContent = 'Patient list unavailable';
    document.getElementById('patient-page').textContent = '';
  }
}

patientSearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  patientState.page = 1;
  loadPatients();
});

document.getElementById('clear-patient-filters').addEventListener('click', () => {
  patientSearchForm.reset();
  patientState.page = 1;
  loadPatients();
});

document.getElementById('patient-previous').addEventListener('click', () => {
  if (patientState.page > 1) {
    patientState.page -= 1;
    loadPatients();
  }
});

document.getElementById('patient-next').addEventListener('click', () => {
  if (patientState.page < patientState.totalPages) {
    patientState.page += 1;
    loadPatients();
  }
});

document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const field = button.dataset.sort;
    patientState.sortOrder = patientState.sortBy === field && patientState.sortOrder === 'asc' ? 'desc' : 'asc';
    patientState.sortBy = field;
    patientState.page = 1;
    loadPatients();
  });
});

loadPatients();
