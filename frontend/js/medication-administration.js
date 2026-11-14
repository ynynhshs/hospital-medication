const selection = document.getElementById('dose-selection');
const statusSelect = document.getElementById('administration-status');
const actualDose = document.getElementById('actual-dose');
const exceptionReason = document.getElementById('exception-reason');
const message = document.getElementById('page-message');
const administrationRows = document.getElementById('administration-rows');
let doseOptions = new Map();

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value == null ? '' : String(value);
  row.appendChild(cell);
}

function updateRequirements() {
  const administered = statusSelect.value === 'Administered';
  actualDose.required = administered;
  exceptionReason.required = !administered;
}

function selectDose() {
  const dose = doseOptions.get(selection.value);
  document.getElementById('patient-id').value = dose ? dose.patientId : '';
  document.getElementById('medication-name').value = dose ? dose.medicationName : '';
  document.getElementById('prescribed-dose').value = dose ? dose.prescribedDose : '';
}

async function loadData() {
  try {
    const [schedules, orders, records] = await Promise.all([
      apiFetch('/api/v1/medication-schedules'),
      apiFetch('/api/v1/medication-orders'),
      apiFetch('/api/v1/medication-administration')
    ]);

    doseOptions = new Map();
    selection.replaceChildren(new Option('Select a dose', ''));
    for (const schedule of schedules) {
      if (['Administered', 'Discontinued'].includes(schedule.status)) continue;
      const key = `schedule:${schedule._id}`;
      doseOptions.set(key, { ...schedule, orderId: schedule.orderId, scheduleId: schedule._id });
      selection.add(new Option(
        `${new Date(schedule.scheduledDateTime).toLocaleString()} — ${schedule.patientName || schedule.patientId} — ${schedule.medicationName} (${schedule.status})`,
        key
      ));
    }

    for (const order of orders) {
      if (order.orderStatus !== 'Active' || order.verificationStatus !== 'Verified' || !order.prnIndicator) continue;
      const key = `prn:${order._id}`;
      doseOptions.set(key, {
        orderId: order._id,
        patientId: order.patientId,
        medicationName: order.medicationName,
        prescribedDose: order.prescribedDose,
        doseUnit: order.doseUnit,
        route: order.route
      });
      selection.add(new Option(`PRN — ${order.patientName || order.patientId} — ${order.medicationName}`, key));
    }

    administrationRows.replaceChildren();
    for (const record of records.slice(0, 100)) {
      const row = document.createElement('tr');
      addCell(row, record.actualAdministrationTime ? new Date(record.actualAdministrationTime).toLocaleString() : '—');
      addCell(row, record.patientId);
      addCell(row, record.medicationName);
      addCell(row, record.actualDose ? `${record.actualDose} ${record.doseUnit}` : '—');
      addCell(row, record.status);
      addCell(row, record.exceptionReason);
      administrationRows.appendChild(row);
    }
    if (records.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No administration records found.';
      row.appendChild(cell);
      administrationRows.appendChild(row);
    }
  } catch (error) {
    message.textContent = error.message || 'Unable to load medication administration data.';
  }
}

selection.addEventListener('change', selectDose);
statusSelect.addEventListener('change', updateRequirements);
document.getElementById('administration-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const dose = doseOptions.get(selection.value);
  if (!dose) {
    message.textContent = 'Select a scheduled dose or verified PRN order.';
    return;
  }

  const payload = {
    orderId: dose.orderId,
    patientId: dose.patientId,
    medicationName: dose.medicationName,
    prescribedDose: dose.prescribedDose,
    doseUnit: dose.doseUnit,
    route: dose.route,
    status: statusSelect.value,
    actualDose: actualDose.value.trim(),
    exceptionReason: exceptionReason.value.trim(),
    notes: document.getElementById('administration-notes').value.trim()
  };
  if (dose.scheduleId) {
    payload.scheduleId = dose.scheduleId;
  }

  message.textContent = '';
  try {
    await apiFetch('/api/v1/medication-administration/record', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    message.textContent = 'Medication administration outcome recorded.';
    event.target.reset();
    updateRequirements();
    selectDose();
    await loadData();
  } catch (error) {
    message.textContent = error.message || 'Unable to record medication administration.';
  }
});

updateRequirements();
loadData();
