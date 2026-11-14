const scheduleRows = document.getElementById('schedule-rows');
const scheduleMessage = document.getElementById('page-message');

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value == null ? '' : String(value);
  row.appendChild(cell);
}

async function loadSchedules() {
  try {
    const schedules = await apiFetch('/api/v1/medication-schedules');
    scheduleRows.replaceChildren();
    for (const schedule of schedules) {
      const row = document.createElement('tr');
      addCell(row, new Date(schedule.scheduledDateTime).toLocaleString());
      addCell(row, `${schedule.patientName || ''} (${schedule.patientId})`);
      addCell(row, schedule.medicationName);
      addCell(row, `${schedule.prescribedDose}`);
      addCell(row, schedule.route);
      addCell(row, schedule.status);
      scheduleRows.appendChild(row);
    }
    if (schedules.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No medication schedules found.';
      row.appendChild(cell);
      scheduleRows.appendChild(row);
    }
  } catch (error) {
    scheduleMessage.textContent = error.message || 'Unable to load medication schedules.';
  }
}

document.getElementById('generate-schedules').addEventListener('click', async () => {
  scheduleMessage.textContent = '';
  try {
    const generated = await apiFetch('/api/v1/medication-schedules/generate', { method: 'POST' });
    scheduleMessage.textContent = `Generated ${generated.length} new schedule entries.`;
    await loadSchedules();
  } catch (error) {
    scheduleMessage.textContent = error.message || 'Unable to generate medication schedules.';
  }
});

loadSchedules();
