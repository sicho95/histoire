let timeout;
export function showToast(message, duration = 3200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(timeout);
  timeout = setTimeout(() => toast.classList.add('hidden'), duration);
}
