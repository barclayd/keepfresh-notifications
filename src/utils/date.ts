export const calculateDaysBetween = (
  startDate: string | null,
  endDate: string | null,
): number | null => {
  if (!startDate || !endDate) {
    return null;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const getRelativeExpiry = (
  daysOffset: number,
  locale: string = 'en-GB',
): string => {
  switch (daysOffset) {
    case 0:
      return 'today';
    case 1:
      return 'tomorrow';
    default: {
      const date = new Date();
      date.setDate(date.getDate() + daysOffset);
      const dayOfWeek = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
      }).format(date);
      return `on ${dayOfWeek}`;
    }
  }
};
