const exceptionRows = document.getElementById('exception-rows');
const exceptionMessage = document.getElementById('page-message');

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value == null ? '' : String(value);
  row.appendChild(cell);
  return cell;
}

async function loadExceptions() {
  try {
    const [userData, exceptions] = await Promise.all([
      apiFetch('/api/v1/auth/me'),
      apiFetch('/api/v1/medication-exceptions')
    ]);
    const canReview = ['medication_admin', 'pharmacist'].includes(userData.user.role);
    exceptionRows.replaceChildren();

    for (const exception of exceptions) {
      const row = document.createElement('tr');
      addCell(row, new Date(exception.dateTime).toLocaleString());
      addCell(row, exception.patientId);
      addCell(row, exception.medicationName);
      addCell(row, exception.exceptionType);
      addCell(row, exception.reason);
      addCell(row, exception.reviewStatus);
      const actionCell = document.createElement('td');

      if (canReview && exception.reviewStatus === 'Open') {
        const notes = document.createElement('textarea');
        notes.rows = 2;
        notes.placeholder = 'Follow-up notes (optional)';
        notes.setAttribute('aria-label', `Follow-up notes for ${exception.medicationName}`);
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Mark reviewed';
        button.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/v1/medication-exceptions/${encodeURIComponent(exception._id)}/review`, {
              method: 'POST',
              body: JSON.stringify({ followUpNotes: notes.value.trim() })
            });
            exceptionMessage.textContent = 'Exception review saved.';
            await loadExceptions();
          } catch (error) {
            exceptionMessage.textContent = error.message || 'Unable to save exception review.';
          }
        });
        actionCell.append(notes, button);
      } else {
        actionCell.textContent = exception.followUpNotes || '—';
      }

      row.appendChild(actionCell);
      exceptionRows.appendChild(row);
    }

    if (exceptions.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'No medication exceptions found.';
      row.appendChild(cell);
      exceptionRows.appendChild(row);
    }
  } catch (error) {
    exceptionMessage.textContent = error.message || 'Unable to load medication exceptions.';
  }
}

loadExceptions();
