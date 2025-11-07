export const sendWithRetry = async (
  fn: () => Promise<void>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<void> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * 2 ** attempt),
      );
    }
  }
};
