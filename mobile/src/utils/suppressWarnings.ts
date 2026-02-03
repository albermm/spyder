/**
 * Suppress known non-critical warnings
 */

const originalConsoleError = console.error;

console.error = (...args: any[]) => {
  // Suppress background processing warning (non-critical)
  const message = args[0]?.toString() || '';
  if (message.includes('Background procssing task was not registered')) {
    return; // Suppress this specific warning
  }
  
  // Let other errors through
  originalConsoleError.apply(console, args);
};

export {};
