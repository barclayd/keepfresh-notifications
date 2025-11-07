export const truncate = (str: string): string =>
  str.length > 35 ? `${str.slice(0, 32)}...` : str;
