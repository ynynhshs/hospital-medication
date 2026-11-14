const reconciliationForm = document.getElementById('reconciliation-form');
const reviewOutcome = document.getElementById('review-outcome');
const discrepancies = document.getElementById('discrepancies');
const reconciliationMessage = document.getElementById('page-message');
const reconciliationRows = document.getElementById('reconciliation-rows');

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value == null ? '' : String(value);
  row.appendChild(cell);
}

function updateDiscrepancyRequirement() {
  discrepancies.required = reviewOutcome.value === 'Discrepancy Identified';
}

async function loadReconciliations() {
  const patientId = document.getElementById('patient-id').value.trim();
  const path = patientId
    ? `/api/v1/medication-reconciliation?patientId=${encodeURIComponent(patientId)}`
    : '/api/v1/medication-reconciliation';
  try {
    const records = await apiFetch(path);
    reconciliationRows.replaceChildren();
    for (const record of records) {
      const row = document.createElement('tr');
      addCell(row, new Date(record.dateTime).toLocaleString());
      addCell(row, record.patientId);
      addCell(row, record.medicationName);
      addCell(row, record.existingMedicationInfo);
      addCell(row, record.reviewOutcome);
      addCell(row, record.discrepancies);
      addCell(row, record.notes);
      reconciliationRows.appendChild(row);
    }
    if (records.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'No reconciliation records found.';
      row.appendChild(cell);
      reconciliationRows.appendChild(row);
    }
  } catch (error) {
    reconciliationMessage.textContent = error.message || 'Unable to load reconciliation history.';
  }
}

reviewOutcome.addEventListener('change', updateDiscrepancyRequirement);
document.getElementById('load-reconciliations').addEventListener('click', loadReconciliations);
reconciliationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    patientId: document.getElementById('patient-id').value.trim(),
    medicationName: document.getElementById('medication-name').value.trim(),
    existingMedicationInfo: document.getElementById('existing-medication-info').value.trim(),
    reviewOutcome: reviewOutcome.value,
    discrepancies: discrepancies.value.trim(),
    notes: document.getElementById('notes').value.trim()
  };
  try {
    await apiFetch('/api/v1/medication-reconciliation', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    reconciliationMessage.textContent = 'Reconciliation saved.';
    await loadReconciliations();
  } catch (error) {
    reconciliationMessage.textContent = error.message || 'Unable to save reconciliation.';
  }
});

updateDiscrepancyRequirement();
loadReconciliations();
