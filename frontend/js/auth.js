const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const result = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('medilink-user', JSON.stringify(result.user || {}));
      window.location.href = '/pages/dashboard.html';
    } catch (error) {
      showAlert(error.message || 'Login failed.', 'error');
    }
  });

  const toggle = document.getElementById('toggle-password');
  toggle.addEventListener('click', () => {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}
