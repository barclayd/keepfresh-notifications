export const truncate = (str: string): string =>
  str.length > 23 ? `${str.slice(0, 20)}...` : str;
