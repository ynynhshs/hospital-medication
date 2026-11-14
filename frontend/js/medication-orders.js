const orderForm = document.getElementById('order-form');
const orderList = document.getElementById('orders-list');
const pageMessage = document.getElementById('page-message');
const prnCheckbox = document.getElementById('prnIndicator');
const prnIndication = document.getElementById('prnIndication');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
let currentRole = '';

function formatLocalDateTime(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function addText(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text == null ? '' : String(text);
  parent.appendChild(element);
  return element;
}

async function loadOrders() {
  try {
    const [userData, orders] = await Promise.all([
      apiFetch('/api/v1/auth/me'),
      apiFetch('/api/v1/medication-orders')
    ]);
    currentRole = userData.user.role;
    orderList.replaceChildren();
    for (const order of orders) {
      const card = document.createElement('article');
      card.className = 'card';
      addText(card, 'strong', `${order.orderNumber} — ${order.medicationName}`);
      addText(card, 'p', `${order.patientName || order.patientId} | ${order.prescribedDose} ${order.doseUnit} | ${order.route}`);
      addText(card, 'p', `${order.frequency} | ${order.orderStatus} | ${order.verificationStatus}`);
      if (order.prnIndicator) addText(card, 'p', `PRN indication: ${order.prnIndication || 'Not specified'}`);
      if (
        order.orderStatus === 'Pending Verification' &&
        ['pharmacist', 'medication_admin'].includes(currentRole)
      ) {
        const verifyButton = document.createElement('button');
        verifyButton.type = 'button';
        verifyButton.textContent = 'Verify order';
        verifyButton.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/v1/medication-orders/${encodeURIComponent(order._id)}/verify`, { method: 'POST' });
            pageMessage.textContent = 'Order verified and activated.';
            await loadOrders();
          } catch (error) {
            pageMessage.textContent = error.message || 'Unable to verify this order.';
          }
        });
        card.appendChild(verifyButton);
      }
      if (
        order.orderStatus === 'Active' &&
        ['prescriber', 'pharmacist', 'medication_admin'].includes(currentRole)
      ) {
        const discontinueButton = document.createElement('button');
        discontinueButton.type = 'button';
        discontinueButton.className = 'danger';
        discontinueButton.textContent = 'Discontinue order';
        discontinueButton.addEventListener('click', async () => {
          if (!window.confirm(`Discontinue ${order.medicationName} for ${order.patientName || order.patientId}?`)) return;
          try {
            await apiFetch(`/api/v1/medication-orders/${encodeURIComponent(order._id)}/discontinue`, {
              method: 'POST'
            });
            pageMessage.textContent = 'Order discontinued and open schedules closed.';
            await loadOrders();
          } catch (error) {
            pageMessage.textContent = error.message || 'Unable to discontinue this order.';
          }
        });
        card.appendChild(discontinueButton);
      }
      orderList.appendChild(card);
    }
    if (orders.length === 0) addText(orderList, 'p', 'No medication orders found.');
  } catch (error) {
    pageMessage.textContent = error.message || 'Unable to load medication orders.';
  }
}

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prnIndicator = document.getElementById('prnIndicator').checked;
  const payload = {
    patientId: document.getElementById('patientId').value.trim(),
    medicationName: document.getElementById('medicationName').value.trim(),
    prescribedDose: document.getElementById('prescribedDose').value.trim(),
    doseUnit: document.getElementById('doseUnit').value.trim(),
    route: document.getElementById('route').value,
    frequency: document.getElementById('frequency').value.trim(),
    prnIndicator,
    prnIndication: document.getElementById('prnIndication').value.trim(),
    startDate: new Date(startDateInput.value).toISOString()
  };
  if (endDateInput.value) payload.endDate = new Date(endDateInput.value).toISOString();
  try {
    await apiFetch('/api/v1/medication-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    pageMessage.textContent = 'Order created and sent for verification.';
    orderForm.reset();
    document.getElementById('doseUnit').value = 'mg';
    startDateInput.value = formatLocalDateTime(new Date());
    endDateInput.min = startDateInput.value;
    prnIndication.required = false;
    await loadOrders();
  } catch (error) {
    pageMessage.textContent = error.message || 'Failed to create order.';
  }
});

prnCheckbox.addEventListener('change', () => {
  prnIndication.required = prnCheckbox.checked;
});

startDateInput.value = formatLocalDateTime(new Date());
endDateInput.min = startDateInput.value;
startDateInput.addEventListener('change', () => {
  endDateInput.min = startDateInput.value;
});

loadOrders();
