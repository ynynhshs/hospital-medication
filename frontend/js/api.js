async function apiFetch(path, options = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const response = await fetch(path, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    },
    credentials: 'include'
  });

  const payload = await response.json().catch(() => ({ success: false, message: 'Request failed.' }));
  if (!response.ok) {
    if (response.status === 401 && !path.endsWith('/auth/login')) {
      window.location.replace('/pages/login.html');
    }
    const error = new Error(payload.message || 'Request failed.');
    error.errors = payload.errors || [];
    error.status = response.status;
    throw error;
  }
  const data = payload.data ?? payload;
  if (payload.pagination && Array.isArray(data)) data.pagination = payload.pagination;
  return data;
}

function showAlert(message, type = 'error') {
  const node = document.createElement('div');
  node.className = `app-alert app-alert-${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  node.textContent = message;
  const host = document.querySelector('.app-content') || document.body;
  host.prepend(node);
  setTimeout(() => node.remove(), 5000);
}

if (!document.body.classList.contains('auth-page')) {
  const appShellScript = document.createElement('script');
  appShellScript.src = '/js/app-shell.js';
  document.head.appendChild(appShellScript);
}
