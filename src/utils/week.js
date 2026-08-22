const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function toValidDate(value) {
  if (typeof value === 'string' && DATE_KEY_PATTERN.test(value)) {
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

export function normalizeDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) {
    return '';
  }

  const parsedDate = parseDateKey(value);

  return formatDateKey(parsedDate) === value ? value : '';
}

export function formatDateLabel(dateKey) {
  const normalizedDateKey = normalizeDateKey(dateKey);

  if (!normalizedDateKey) {
    return '';
  }

  return DATE_LABEL_FORMATTER.format(parseDateKey(normalizedDateKey));
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

export function getCurrentWeekFridayKey(value = new Date()) {
  const weekFriday = parseDateKey(getMondayWeekStartKey(value));
  weekFriday.setDate(weekFriday.getDate() + 4);

  return formatDateKey(weekFriday);
}

export function formatWeekLabel(weekStartKey) {
  const weekStart = parseDateKey(weekStartKey);

  return `Week ${getIsoWeekNumber(weekStart)}, ${DATE_LABEL_FORMATTER.format(weekStart)}`;
}
