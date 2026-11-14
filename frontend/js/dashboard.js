function formatDashboardTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(date);
}

function dashboardEmpty(host, message) {
  const empty = document.createElement('p');
  empty.className = 'dashboard-empty';
  empty.textContent = message;
  host.replaceChildren(empty);
}

function renderDashboardTable(host, schedules) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'table dashboard-table';
  const header = document.createElement('tr');
  for (const label of ['Patient', 'Medication', 'Dose', 'Route', 'Time', 'Status']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.appendChild(cell);
  }
  const thead = document.createElement('thead');
  thead.appendChild(header);
  const body = document.createElement('tbody');
  for (const schedule of schedules) {
    const row = document.createElement('tr');
    for (const value of [
      schedule.patientName || schedule.patientId,
      schedule.medicationName,
      schedule.prescribedDose,
      schedule.route,
      formatDashboardTime(schedule.scheduledDateTime),
      schedule.status
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
  table.append(thead, body);
  wrapper.appendChild(table);
  host.replaceChildren(wrapper);
}

function renderDashboardList(host, items, formatter, emptyMessage) {
  if (!items.length) {
    dashboardEmpty(host, emptyMessage);
    return;
  }
  const list = document.createElement('div');
  list.className = 'dashboard-list';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'dashboard-list-item';
    const primary = document.createElement('span');
    primary.textContent = formatter(item);
    const time = document.createElement('time');
    time.dateTime = item.scheduledDateTime || item.occurredAt || item.createdAt || '';
    time.textContent = formatDashboardTime(time.dateTime);
    row.append(primary, time);
    list.appendChild(row);
  }
  host.replaceChildren(list);
}

function renderAdministrationChart(host, counts) {
  const labels = [
    ['Administered', 'Administered'],
    ['Delayed', 'Delayed'],
    ['Missed', 'Missed'],
    ['Refused', 'Refused'],
    ['Withheld', 'Withheld']
  ];
  const values = labels.map(([key]) => Number(counts[key] || 0));
  const max = Math.max(1, ...values);
  const chart = document.createElement('div');
  chart.className = 'dashboard-chart';
  for (const [key, label] of labels) {
    const value = Number(counts[key] || 0);
    const row = document.createElement('div');
    row.className = 'chart-row';
    const text = document.createElement('span');
    text.textContent = label;
    const track = document.createElement('div');
    track.className = 'chart-track';
    track.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.width = `${Math.max(0, (value / max) * 100)}%`;
    track.appendChild(bar);
    const number = document.createElement('strong');
    number.textContent = String(value);
    row.append(text, track, number);
    chart.appendChild(row);
  }
  host.replaceChildren(chart);
}

async function loadDashboard() {
  try {
    const [data, alerts] = await Promise.all([
      apiFetch('/api/v1/dashboard/summary'),
      apiFetch('/api/v1/medication-alerts')
    ]);

    document.querySelectorAll('[data-stat]').forEach((card) => {
      const key = card.dataset.stat;
      card.textContent = data[key] == null ? '0' : String(data[key]);
    });

    const dateNode = document.getElementById('dashboard-date');
    dateNode.textContent = new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'full',
      timeZone: 'Asia/Manila'
    }).format(new Date());
    const timezone = document.getElementById('dashboard-timezone');
    timezone.textContent = `Dashboard date and counts use ${data.timeZone || 'the configured server timezone'}.`;

    renderDashboardTable(document.getElementById('today-schedule'), data.todaySchedule || []);
    renderDashboardList(
      document.getElementById('upcoming-doses'),
      data.upcomingDoses || [],
      (item) => `${item.patientName || item.patientId} · ${item.medicationName} · ${item.prescribedDose}`,
      'No upcoming medication doses today.'
    );
    renderDashboardList(
      document.getElementById('dashboard-alerts'),
      (alerts || []).slice(0, 6),
      (item) => `${item.patientId ? `${item.patientId} · ` : ''}${item.message || item.alertType}`,
      'No current medication alerts.'
    );
    renderDashboardList(
      document.getElementById('recent-activities'),
      data.recentActivities || [],
      (item) => `${item.label} · ${item.patientName || item.patientId || 'Medication activity'} · ${item.status}`,
      'No recent medication activity.'
    );
    renderAdministrationChart(
      document.getElementById('administration-overview'),
      data.administrationCounts || {}
    );
  } catch (error) {
    showAlert(error.message || 'Dashboard failed to load.');
  }
}

if (document.getElementById('dashboard-root')) loadDashboard();
