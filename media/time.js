/**
 * Format update times against one clock value, using calendar dates across DST changes.
 * @param {string} locale
 * @param {import('../src/i18n').Localize} t
 */
export function createTimeFormatter(locale, t) {
  const shortDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const fullDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  /** @param {number} seconds @param {number} [clock] */
  return (seconds, clock = Date.now()) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return t('unknownTime');
    const date = new Date(seconds * 1000);
    if (!Number.isFinite(date.getTime())) return t('unknownTime');
    const minutes = Math.max(0, Math.floor((clock - seconds * 1000) / 60000));
    if (minutes < 1) return t('now');
    if (minutes < 60) return t('minutesAgo', { count: minutes });
    const now = new Date(clock);
    /** @param {Date} value */
    const dayNumber = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
    const days = dayNumber(now) - dayNumber(date);
    if (days === 0) return t('hoursAgo', { count: Math.floor(minutes / 60) });
    if (days === 1) return t('yesterday');
    if (days < 7 && days > 1) return t('daysAgo', { count: days });
    if (locale === 'en') return (date.getFullYear() === now.getFullYear() ? shortDate : fullDate).format(date);
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    return date.getFullYear() === now.getFullYear() ? monthDay : `${String(date.getFullYear()).slice(-2)}/${monthDay}`;
  };
}
