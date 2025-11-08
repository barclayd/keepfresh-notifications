export const truncate = (str: string, characterLimit: number = 35): string =>
  str.length > characterLimit ? `${str.slice(0, characterLimit - 3)}...` : str;
