const reportFilter = document.getElementById('report-filter');
const reportMessage = document.getElementById('report-message');

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadReport() {
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  const params = new URLSearchParams({ from, to });
  reportMessage.textContent = '';

  try {
    const report = await apiFetch(`/api/v1/reports?${params.toString()}`);
    document.querySelectorAll('[data-report]').forEach((element) => {
      element.textContent = report[element.dataset.report] ?? 0;
    });
    document.getElementById('report-timezone').textContent = `Dates use ${report.timeZone}.`;
  } catch (error) {
    reportMessage.textContent = error.message || 'Unable to load medication reports.';
  }
}

const today = new Date();
document.getElementById('report-from').value = formatLocalDate(today);
document.getElementById('report-to').value = formatLocalDate(today);
reportFilter.addEventListener('submit', (event) => {
  event.preventDefault();
  loadReport();
});
loadReport();
