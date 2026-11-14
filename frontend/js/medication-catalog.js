const catalogForm = document.getElementById('catalog-form');
const catalogList = document.getElementById('catalog-list');
const catalogMessage = document.getElementById('catalog-message');

async function loadCatalog() {
  catalogMessage.textContent = '';
  catalogList.replaceChildren();

  try {
    const medications = await apiFetch('/api/v1/medication-catalog');
    for (const medication of medications) {
      const card = document.createElement('article');
      card.className = 'card';
      const name = document.createElement('strong');
      name.textContent = medication.genericName;
      const details = document.createElement('p');
      details.textContent = `${medication.medicationCode} | ${medication.brandName || 'Generic'}`;
      card.append(name, details);
      catalogList.appendChild(card);
    }

    if (medications.length === 0) catalogMessage.textContent = 'No medications found.';
  } catch (error) {
    catalogMessage.textContent = error.message || 'Unable to load the medication catalog.';
  }
}

catalogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    medicationCode: document.getElementById('medicationCode').value.trim(),
    genericName: document.getElementById('genericName').value.trim(),
    brandName: document.getElementById('brandName').value.trim()
  };

  catalogMessage.textContent = '';
  try {
    await apiFetch('/api/v1/medication-catalog', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    catalogForm.reset();
    catalogMessage.textContent = 'Medication added to the catalog.';
    await loadCatalog();
  } catch (error) {
    catalogMessage.textContent = error.message || 'Failed to add medication.';
  }
});

loadCatalog();
