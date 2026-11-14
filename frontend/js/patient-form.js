const patientForm = document.getElementById('patient-form');
const formMessage = document.getElementById('patient-form-message');
const saveButton = document.getElementById('patient-save-button');
const formParams = new URLSearchParams(window.location.search);
const editingPatientId = formParams.get('patientId');

function getField(name) {
  return patientForm.elements.namedItem(name);
}

function calculateAge(dateValue) {
  if (!dateValue) return 'Enter a birth date';
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return 'Enter a valid birth date';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return `${age} years`;
}

function setFormValue(name, value) {
  const field = getField(name);
  if (!field) return;
  if (field.type === 'checkbox') field.checked = Boolean(value);
  else if (field.type === 'date' && value) {
    const date = new Date(value);
    field.value = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  else field.value = value == null ? '' : String(value);
}

function clearFieldErrors() {
  patientForm.querySelectorAll('.field-error').forEach((node) => node.remove());
  patientForm.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
}

function showValidationErrors(errors) {
  clearFieldErrors();
  for (const error of errors) {
    const name = Array.isArray(error.path) ? error.path.join('.') : String(error.path || '');
    const field = getField(name);
    if (!field) continue;
    field.setAttribute('aria-invalid', 'true');
    let message = field.parentElement.querySelector('.field-error');
    if (!message) {
      message = document.createElement('span');
      message.className = 'field-error';
      message.id = `error-${name.replace(/\./g, '-')}`;
      field.parentElement.appendChild(message);
    }
    message.textContent = error.message;
    field.setAttribute('aria-describedby', message.id);
  }
}

function fillPatientForm(patient) {
  for (const field of patientForm.querySelectorAll('[name]')) {
    const value = field.name.split('.').reduce((source, key) => source?.[key], patient);
    if (field.name === 'medical.heightCm') {
      setFormValue(field.name, value ?? patient.medical?.height);
    } else if (field.name === 'medical.weightKg') {
      setFormValue(field.name, value ?? patient.medical?.weight);
    } else {
      setFormValue(field.name, value);
    }
  }
  document.getElementById('patient-age').value = calculateAge(getField('birthDate').value);
  document.getElementById('patient-form-title').textContent = `Edit Patient · ${patient.patientId}`;
  saveButton.textContent = 'Save changes';
}

function collectPatientPayload() {
  const value = (name) => getField(name).value.trim();
  const numberOrNull = (name) => value(name) === '' ? null : Number(value(name));
  const textOrNull = (name) => value(name) === '' ? null : value(name);
  const smoker = value('medical.smoker');

  return {
    firstName: value('firstName'),
    middleName: value('middleName'),
    lastName: value('lastName'),
    birthDate: value('birthDate'),
    sex: value('sex'),
    civilStatus: value('civilStatus'),
    address: value('address'),
    city: value('city'),
    contactNo: value('contactNo'),
    email: value('email'),
    emergencyContact: {
      name: value('emergencyContact.name'),
      relationship: textOrNull('emergencyContact.relationship'),
      contactNo: value('emergencyContact.contactNo')
    },
    medical: {
      bloodType: textOrNull('medical.bloodType'),
      heightCm: numberOrNull('medical.heightCm'),
      weightKg: numberOrNull('medical.weightKg'),
      allergies: textOrNull('medical.allergies'),
      conditions: textOrNull('medical.conditions'),
      medications: textOrNull('medical.medications'),
      surgeries: textOrNull('medical.surgeries'),
      smoker: smoker === '' ? null : smoker === 'true'
    },
    insurance: {
      provider: textOrNull('insurance.provider'),
      memberNo: textOrNull('insurance.memberNo')
    }
  };
}

getField('birthDate').addEventListener('input', () => {
  document.getElementById('patient-age').value = calculateAge(getField('birthDate').value);
});

patientForm.addEventListener('input', (event) => {
  if (event.target.matches('[aria-invalid="true"]')) {
    event.target.removeAttribute('aria-invalid');
    const error = event.target.parentElement.querySelector('.field-error');
    if (error) error.remove();
  }
});

patientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors();
  formMessage.textContent = '';
  if (!patientForm.reportValidity()) return;

  const action = editingPatientId ? 'save changes to this patient record' : 'create this patient record';
  if (!window.confirm(`Are you sure you want to ${action}?`)) return;

  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  try {
    const savedPatient = await apiFetch(
      editingPatientId ? `/api/v1/patients/${encodeURIComponent(editingPatientId)}` : '/api/v1/patients',
      {
        method: editingPatientId ? 'PUT' : 'POST',
        body: JSON.stringify(collectPatientPayload())
      }
    );
    formMessage.textContent = 'Patient record saved successfully.';
    formMessage.className = 'status-message success-text';
    window.location.assign(`/pages/patient-details.html?patientId=${encodeURIComponent(savedPatient.patientId)}`);
  } catch (error) {
    if (error.errors?.length) showValidationErrors(error.errors);
    formMessage.textContent = error.message || 'Unable to save this patient record.';
    formMessage.className = 'status-message error-text';
    saveButton.disabled = false;
    saveButton.textContent = editingPatientId ? 'Save changes' : 'Save patient';
  }
});

Promise.all([
  apiFetch('/api/v1/auth/me'),
  editingPatientId
    ? apiFetch(`/api/v1/patients/${encodeURIComponent(editingPatientId)}`)
    : Promise.resolve(null)
]).then(([session, patient]) => {
  if (session.user.role === 'medication_auditor') {
    formMessage.textContent = 'Your role has view-only access to patient records.';
    formMessage.className = 'status-message error-text';
    patientForm.hidden = true;
    return;
  }
  if (patient) fillPatientForm(patient);
}).catch((error) => {
  formMessage.textContent = error.message || 'Unable to load the patient form.';
  formMessage.className = 'status-message error-text';
  patientForm.hidden = true;
});
