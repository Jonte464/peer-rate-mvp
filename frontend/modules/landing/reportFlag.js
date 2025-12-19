// frontend/modules/landing/reportFlag.js
export function initReportFlagToggle() {
  const flag = document.getElementById('reportFlag');
  const box = document.getElementById('reportDetails');
  if (!flag || !box) return;

  const sync = () => { box.style.display = flag.checked ? 'block' : 'none'; };
  flag.addEventListener('change', sync);
  sync();
}
