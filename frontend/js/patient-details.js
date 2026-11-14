const patientDetailRoot = document.getElementById('patient-detail-root');
const patientDetailMessage = document.getElementById('patient-detail-message');
const patientId = new URLSearchParams(window.location.search).get('patientId');

function valueOrDash(value) {
  return value == null || value === '' ? 'Not recorded' : String(value);
}

function calculateDetailAge(birthDate) {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return 'Age not recorded';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age} years` : 'Age not recorded';
}

function formatDetailDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(date);
}

function formatDetailBirthDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(date);
}

function createDetailField(label, value, options = {}) {
  const item = document.createElement('div');
  item.className = options.emphasis ? 'detail-field detail-emphasis' : 'detail-field';
  const heading = document.createElement('dt');
  heading.textContent = label;
  const content = document.createElement('dd');
  content.textContent = valueOrDash(value);
  item.append(heading, content);
  return item;
}

function createProfileSection(title, fields, sectionId) {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  if (sectionId) section.id = sectionId;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const list = document.createElement('dl');
  list.className = 'detail-grid';
  for (const field of fields) list.appendChild(createDetailField(field[0], field[1], field[2] || {}));
  section.append(heading, list);
  return section;
}

function renderRecordTable(title, headers, rows, sectionId, emptyMessage) {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  if (sectionId) section.id = sectionId;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headerRow.appendChild(cell);
  }
  thead.appendChild(headerRow);
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = headers.length;
    cell.className = 'table-state';
    cell.textContent = emptyMessage;
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    for (const values of rows) {
      const row = document.createElement('tr');
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = valueOrDash(value);
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
  }
  table.append(thead, tbody);
  wrapper.appendChild(table);
  section.append(heading, wrapper);
  return section;
}

function renderPatientProfile(data, role) {
  const patient = data.patient;
  const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
  const header = document.createElement('header');
  header.className = 'page-header patient-profile-header';
  const headerCopy = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `PATIENT ID · ${patient.patientId}`;
  const name = document.createElement('h1');
  name.textContent = fullName;
  const subtitle = document.createElement('p');
  subtitle.textContent = `${patient.sex} · ${calculateDetailAge(patient.birthDate)} · ${valueOrDash(patient.contactNo)}`;
  headerCopy.append(eyebrow, name, subtitle);
  const actions = document.createElement('div');
  actions.className = 'row';
  const back = document.createElement('a');
  back.className = 'button-link secondary-link';
  back.href = '/pages/patient-list.html';
  back.textContent = 'Back to patients';
  actions.appendChild(back);
  if (role !== 'medication_auditor') {
    const edit = document.createElement('a');
    edit.className = 'button-link';
    edit.href = `/pages/patient-form.html?patientId=${encodeURIComponent(patient.patientId)}`;
    edit.textContent = 'Edit patient';
    actions.appendChild(edit);
  }
  header.append(headerCopy, actions);

  const allergy = document.createElement('div');
  allergy.className = patient.medical?.allergies ? 'allergy-banner' : 'allergy-banner allergy-banner-muted';
  allergy.setAttribute('role', patient.medical?.allergies ? 'note' : 'status');
  allergy.textContent = patient.medical?.allergies
    ? `Allergies: ${patient.medical.allergies}`
    : 'No allergies recorded';

  const orderRows = data.orders.map((order) => [
    order.orderNumber,
    order.medicationName,
    order.prescribedDose,
    order.route,
    order.frequency,
    order.orderStatus,
    order.startDate ? formatDetailDate(order.startDate) : '—'
  ]);
  const administrationRows = data.administrations.map((record) => [
    record.medicationName,
    record.prescribedDose || record.actualDose,
    record.route,
    formatDetailDate(record.scheduledDateTime),
    formatDetailDate(record.actualAdministrationTime),
    record.status,
    record.administeringUserId?.username || record.administeringUserId?.name || 'Staff record'
  ]);
  const scheduleRows = data.schedules.map((schedule) => [
    schedule.medicationName,
    schedule.prescribedDose,
    schedule.route,
    formatDetailDate(schedule.scheduledDateTime),
    schedule.status
  ]);
  const exceptionRows = data.exceptions.map((exception) => [
    exception.medicationName,
    exception.exceptionType,
    exception.reason,
    formatDetailDate(exception.dateTime),
    exception.reviewStatus
  ]);

  patientDetailRoot.replaceChildren(
    header,
    allergy,
    createProfileSection('Personal information', [
      ['Patient ID', patient.patientId],
      ['First name', patient.firstName],
      ['Middle name', patient.middleName],
      ['Last name', patient.lastName],
      ['Birth date', formatDetailBirthDate(patient.birthDate)],
      ['Age', calculateDetailAge(patient.birthDate)],
      ['Sex', patient.sex],
      ['Civil status', patient.civilStatus]
    ]),
    createProfileSection('Contact information', [
      ['Address', patient.address],
      ['City or municipality', patient.city],
      ['Contact number', patient.contactNo],
      ['Email', patient.email]
    ]),
    createProfileSection('Emergency contact', [
      ['Contact name', patient.emergencyContact?.name],
      ['Relationship', patient.emergencyContact?.relationship],
      ['Contact number', patient.emergencyContact?.contactNo]
    ]),
    createProfileSection('Medical information', [
      ['Blood type', patient.medical?.bloodType],
      ['Height (cm)', patient.medical?.heightCm],
      ['Weight (kg)', patient.medical?.weightKg],
      ['Allergies', patient.medical?.allergies, { emphasis: Boolean(patient.medical?.allergies) }],
      ['Existing conditions', patient.medical?.conditions],
      ['Current medications', patient.medical?.medications],
      ['Past surgeries', patient.medical?.surgeries],
      ['Smoker status', patient.medical?.smoker == null ? null : patient.medical.smoker ? 'Yes' : 'No']
    ]),
    createProfileSection('Insurance information', [
      ['Provider', patient.insurance?.provider],
      ['Member number', patient.insurance?.memberNo]
    ]),
    renderRecordTable('Medication orders', ['Order', 'Medication', 'Prescribed dose', 'Route', 'Frequency', 'Status', 'Start date'], orderRows, 'orders', 'No medication orders recorded.'),
    renderRecordTable('Medication administration history', ['Medication', 'Dose', 'Route', 'Scheduled time', 'Actual time', 'Status', 'Administered by'], administrationRows, 'administrations', 'No administration records.'),
    renderRecordTable('Scheduled doses', ['Medication', 'Dose', 'Route', 'Scheduled time', 'Status'], scheduleRows, 'schedules', 'No medication schedules recorded.'),
    renderRecordTable('Medication exceptions', ['Medication', 'Exception', 'Reason', 'Date', 'Review status'], exceptionRows, 'exceptions', 'No medication exceptions recorded.')
  );
  patientDetailRoot.hidden = false;
  patientDetailMessage.textContent = '';
  patientDetailMessage.hidden = true;
  document.title = `${fullName} · Patient Profile`;
  if (window.location.hash) {
    window.setTimeout(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior, block: 'start' });
    }, 0);
  }
}

async function loadPatientDetails() {
  if (!patientId) {
    patientDetailMessage.textContent = 'A patient ID is required to view this profile.';
    patientDetailMessage.className = 'status-message error-text';
    return;
  }
  try {
    const [data, session] = await Promise.all([
      apiFetch(`/api/v1/patients/${encodeURIComponent(patientId)}/medications`),
      apiFetch('/api/v1/auth/me')
    ]);
    renderPatientProfile(data, session.user.role);
  } catch (error) {
    patientDetailMessage.textContent = error.message || 'Unable to load this patient profile.';
    patientDetailMessage.className = 'status-message error-text';
  }
}

loadPatientDetails();
