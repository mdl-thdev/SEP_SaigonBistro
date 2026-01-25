// SEP_SaigonBistro/frontend/public/js/utils.js

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `$${n.toFixed(2)}`;
}

export function capitalize(text) {
  const s = String(text || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
