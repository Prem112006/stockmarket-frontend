const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

const getTokenFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
};

const resetForm = document.getElementById('resetForm');
const resetTokenInput = document.getElementById('resetToken');

if (resetForm && resetTokenInput) {
  // Set token from URL
  resetTokenInput.value = getTokenFromURL();

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('resetMsg');
    setMsg(msg, 'Resetting password...');
    const formData = new FormData(resetForm);
    const payload = {
      token: formData.get('token'),
      password: formData.get('password')
    };
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(msg, data.message || 'Failed to reset password', 'error');
        return;
      }
      setMsg(msg, 'Password reset successful! You can now log in.', 'success');
    } catch (err) {
      setMsg(msg, 'Network error. Is the backend running?', 'error');
    }
  });
}
