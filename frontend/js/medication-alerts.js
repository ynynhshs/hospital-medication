const alertsList = document.getElementById('alerts-list');
const alertsMessage = document.getElementById('alerts-message');
let loadingAlerts = false;

function appendAlertText(alert, label, value) {
  const row = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = `${label}: `;
  row.append(heading, document.createTextNode(value || '—'));
  alert.appendChild(row);
}

async function loadMedicationAlerts() {
  if (loadingAlerts) return;
  loadingAlerts = true;
  alertsMessage.textContent = '';
  alertsList.replaceChildren();

  try {
    const alerts = await apiFetch('/api/v1/medication-alerts');
    for (const item of alerts) {
      const card = document.createElement('article');
      card.className = 'card';
      appendAlertText(card, 'Alert', item.alertType);
      appendAlertText(card, 'Severity', item.severity);
      appendAlertText(card, 'Patient ID', item.patientId);
      appendAlertText(card, 'Details', item.message);
      appendAlertText(card, 'Status', item.reviewed ? 'Reviewed' : 'Open');
      if (item.createdAt) appendAlertText(card, 'Date', new Date(item.createdAt).toLocaleString());
      if (item.generated) {
        const orderLink = document.createElement('a');
        orderLink.href = item.scheduleId ? '/pages/medication-schedules.html' : '/pages/medication-orders.html';
        orderLink.textContent = item.scheduleId ? 'Open schedules' : 'Open pending orders';
        card.appendChild(orderLink);
      }
      alertsList.appendChild(card);
    }
    if (alerts.length === 0) alertsMessage.textContent = 'No active medication alerts.';
  } catch (error) {
    alertsMessage.textContent = error.message || 'Unable to load medication alerts.';
  } finally {
    loadingAlerts = false;
  }
}

document.getElementById('refresh-alerts').addEventListener('click', loadMedicationAlerts);
loadMedicationAlerts();
window.setInterval(() => {
  if (document.visibilityState === 'visible') loadMedicationAlerts();
}, 60000);
