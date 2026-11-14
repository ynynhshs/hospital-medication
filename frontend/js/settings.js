const settingsForm = document.getElementById('settings-form');
const settingsMessage = document.getElementById('settings-message');

function populateSettings(settings) {
  document.getElementById('setting-hospital-name').value = settings.hospitalName || '';
  document.getElementById('setting-contact-info').value = settings.contactInfo || '';
  document.getElementById('setting-timezone').value = settings.timezone || '';
  document.getElementById('setting-dose-reminder-lead').value = settings.doseReminderLeadMinutes ?? 0;
  document.getElementById('setting-delay-threshold').value = settings.delayWarningThreshold ?? 30;
  document.getElementById('setting-missed-threshold').value = settings.missedDoseReviewThreshold ?? 120;
}

async function loadSettings() {
  settingsMessage.textContent = '';
  try {
    const [userData, settings] = await Promise.all([
      apiFetch('/api/v1/auth/me'),
      apiFetch('/api/v1/settings')
    ]);
    if (userData.user.role !== 'medication_admin') {
      settingsMessage.textContent = 'Only medication administrators can manage facility settings.';
      return;
    }

    populateSettings(settings);
    settingsForm.hidden = false;
  } catch (error) {
    settingsMessage.textContent = error.message || 'Unable to load facility settings.';
  }
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    contactInfo: document.getElementById('setting-contact-info').value.trim()
  };
  const hospitalName = document.getElementById('setting-hospital-name').value.trim();
  const timezone = document.getElementById('setting-timezone').value.trim();
  const doseReminderLead = document.getElementById('setting-dose-reminder-lead').value;
  const delayThreshold = document.getElementById('setting-delay-threshold').value;
  const missedThreshold = document.getElementById('setting-missed-threshold').value;

  if (hospitalName) payload.hospitalName = hospitalName;
  if (timezone) payload.timezone = timezone;
  if (doseReminderLead !== '') payload.doseReminderLeadMinutes = Number(doseReminderLead);
  if (delayThreshold !== '') payload.delayWarningThreshold = Number(delayThreshold);
  if (missedThreshold !== '') payload.missedDoseReviewThreshold = Number(missedThreshold);

  settingsMessage.textContent = '';
  try {
    await apiFetch('/api/v1/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    settingsMessage.textContent = 'Settings saved.';
    await loadSettings();
  } catch (error) {
    settingsMessage.textContent = error.message || 'Unable to save facility settings.';
  }
});

loadSettings();
