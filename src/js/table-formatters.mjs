// ===== table-formatters.mjs — shared helpers for table cell formatting =====

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function toNumber(value) {
  if (isBlank(value)) return NaN;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : NaN;
}

export function formatInteger(value) {
  const num = toNumber(value);
  if (Number.isNaN(num)) return '';
  return Math.round(num).toString();
}

export function formatDecimal(value, decimals) {
  const num = toNumber(value);
  if (Number.isNaN(num)) return '';
  return num.toFixed(decimals);
}

export function formatMeters(value) {
  return formatInteger(value);
}

export function formatInches(value) {
  return formatDecimal(value, 1);
}

export function formatSpeed(value) {
  return formatDecimal(value, 1);
}

export function formatRpm(value) {
  return formatDecimal(value, 1);
}

export function formatTorqueKnmFromNm(value) {
  const num = toNumber(value);
  if (Number.isNaN(num)) return '';
  return (num / 1000).toFixed(1);
}

export function formatMotorTorque(value) {
  return formatInteger(value);
}

export function formatHp(value) {
  return formatInteger(value);
}

export function formatPsi(value) {
  return formatInteger(value);
}

export function formatKgf(value) {
  return formatInteger(value);
}
