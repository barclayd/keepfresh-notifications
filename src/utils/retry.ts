export const sendWithRetry = async (
  fn: () => Promise<void>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<void> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
      // biome-ignore lint/suspicious/noExplicitAny: error is unknown
    } catch (error: any) {
      const statusCode = error?.statusCode;
      const isLastAttempt = attempt === maxRetries;

      const shouldNotRetry =
        statusCode === 400 ||
        statusCode === 410 ||
        statusCode === 403 ||
        statusCode === 413;

      if (shouldNotRetry || isLastAttempt) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * 0.3 * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }
};
