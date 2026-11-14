const historySearchForm = document.getElementById('history-search-form');
const historyPatientId = document.getElementById('history-patient-id');
const historyMessage = document.getElementById('history-message');
const historyPatientName = document.getElementById('history-patient-name');

function formatHistoryDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function renderHistoryTable(targetId, rows, columns) {
  const target = document.getElementById(targetId);
  target.replaceChildren();
  if (rows.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No records found.';
    target.appendChild(emptyMessage);
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  const head = table.createTHead().insertRow();
  for (const column of columns) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = column.label;
    head.appendChild(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const tableRow = body.insertRow();
    for (const column of columns) {
      const cell = tableRow.insertCell();
      const value = column.value(row);
      cell.textContent = value == null || value === '' ? '—' : String(value);
    }
  }
  target.appendChild(table);
}

async function loadMedicationHistory(patientId) {
  historyMessage.textContent = '';
  historyPatientName.textContent = '';
  for (const id of ['history-orders', 'history-administrations', 'history-exceptions', 'history-reconciliations']) {
    document.getElementById(id).replaceChildren();
  }

  try {
    const [patient, history] = await Promise.all([
      apiFetch(`/api/v1/patients/${encodeURIComponent(patientId)}`),
      apiFetch(`/api/v1/medication-history?patientId=${encodeURIComponent(patientId)}`)
    ]);
    historyPatientName.textContent = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    renderHistoryTable('history-orders', history.orders, [
      { label: 'Order', value: (row) => row.orderNumber },
      { label: 'Medication', value: (row) => row.medicationName },
      { label: 'Dose', value: (row) => `${row.prescribedDose} ${row.doseUnit}` },
      { label: 'Frequency', value: (row) => row.frequency },
      { label: 'Status', value: (row) => row.orderStatus },
      { label: 'Ordered', value: (row) => formatHistoryDate(row.orderDate) }
    ]);
    renderHistoryTable('history-administrations', history.administrations, [
      { label: 'Record', value: (row) => row.recordNumber },
      { label: 'Medication', value: (row) => row.medicationName },
      { label: 'Dose', value: (row) => `${row.actualDose || row.prescribedDose} ${row.doseUnit}` },
      { label: 'Status', value: (row) => row.status },
      { label: 'Administered', value: (row) => formatHistoryDate(row.actualAdministrationTime || row.createdAt) }
    ]);
    renderHistoryTable('history-exceptions', history.exceptions, [
      { label: 'Medication', value: (row) => row.medicationName },
      { label: 'Exception', value: (row) => row.exceptionType },
      { label: 'Reason', value: (row) => row.reason },
      { label: 'Review', value: (row) => row.reviewStatus },
      { label: 'Recorded', value: (row) => formatHistoryDate(row.dateTime) }
    ]);
    renderHistoryTable('history-reconciliations', history.reconciliations, [
      { label: 'Medication', value: (row) => row.medicationName },
      { label: 'Outcome', value: (row) => row.reviewOutcome },
      { label: 'Discrepancies', value: (row) => row.discrepancies },
      { label: 'Notes', value: (row) => row.notes },
      { label: 'Recorded', value: (row) => formatHistoryDate(row.dateTime) }
    ]);
  } catch (error) {
    historyMessage.textContent = error.message || 'Unable to load medication history.';
  }
}

historySearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const patientId = historyPatientId.value.trim();
  if (patientId) loadMedicationHistory(patientId);
});

const initialPatientId = new URLSearchParams(window.location.search).get('patientId');
if (initialPatientId) {
  historyPatientId.value = initialPatientId;
  loadMedicationHistory(initialPatientId);
}
