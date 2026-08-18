function toValidDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateKey(value);
  }

  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

function getIsoWeekNumber(date) {
  const currentDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  currentDate.setUTCDate(currentDate.getUTCDate() + 4 - (currentDate.getUTCDay() || 7));

  const yearStart = new Date(Date.UTC(currentDate.getUTCFullYear(), 0, 1));
  const dayDifference = Math.floor((currentDate - yearStart) / 86400000) + 1;

  return Math.ceil(dayDifference / 7);
}

export function getMondayWeekStartKey(value = new Date()) {
  const date = toValidDate(value);
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = weekStart.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setDate(weekStart.getDate() - daysSinceMonday);

  return formatDateKey(weekStart);
}

export function formatWeekLabel(weekStartKey) {
  const weekStart = parseDateKey(weekStartKey);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `Week ${getIsoWeekNumber(weekStart)}, ${formatter.format(weekStart)}`;
}
