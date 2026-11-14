const auditRows = document.getElementById('audit-rows');
const auditMessage = document.getElementById('audit-message');

function addAuditCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value == null || value === '' ? '—' : String(value);
  row.appendChild(cell);
}

async function loadAuditLogs() {
  auditMessage.textContent = '';
  auditRows.replaceChildren();

  try {
    const userData = await apiFetch('/api/v1/auth/me');
    if (!['medication_admin', 'medication_auditor'].includes(userData.user.role)) {
      auditMessage.textContent = 'You do not have permission to view audit logs.';
      return;
    }

    const logs = await apiFetch('/api/v1/audit-logs');
    for (const log of logs) {
      const row = document.createElement('tr');
      const date = new Date(log.createdAt);
      addAuditCell(row, Number.isNaN(date.getTime()) ? '—' : date.toLocaleString());
      addAuditCell(row, log.username);
      addAuditCell(row, log.role);
      addAuditCell(row, log.action);
      addAuditCell(row, log.module);
      addAuditCell(row, log.Details);
      auditRows.appendChild(row);
    }

    if (logs.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No audit events found.';
      row.appendChild(cell);
      auditRows.appendChild(row);
    }
  } catch (error) {
    auditMessage.textContent = error.message || 'Unable to load audit logs.';
  }
}

document.getElementById('refresh-audit-logs').addEventListener('click', loadAuditLogs);
loadAuditLogs();
