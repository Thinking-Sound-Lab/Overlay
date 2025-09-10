// Utility functions for environment detection
// Available in both main and renderer processes

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV !== 'production';
};

export const shouldTrackAnalytics = (): boolean => {
  return isProduction();
};