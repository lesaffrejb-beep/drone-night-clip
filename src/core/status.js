export function showStatus(message, duration) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  if (statusEl && statusText) {
    statusText.textContent = message;
    statusEl.classList.add('visible');

    if (duration > 0) {
      setTimeout(() => {
        statusEl.classList.remove('visible');
      }, duration);
    }
  }
}

export function hideStatus() {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.classList.remove('visible');
  }
}
