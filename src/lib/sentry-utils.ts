import * as Sentry from '@sentry/nextjs'

/**
 * Safe wrapper for Sentry logger that falls back gracefully
 */
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    try {
      if (typeof Sentry.logger?.info === 'function') {
        Sentry.logger.info(message, context)
      } else {
        console.log(`[Sentry Log] ${message}`, context)
      }
    } catch (error) {
      console.log(`[Sentry Log] ${message}`, context)
    }
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    try {
      if (typeof Sentry.logger?.warn === 'function') {
        Sentry.logger.warn(message, context)
      } else {
        console.warn(`[Sentry Log] ${message}`, context)
      }
    } catch (error) {
      console.warn(`[Sentry Log] ${message}`, context)
    }
  },

  error: (message: string, context?: Record<string, unknown>) => {
    try {
      if (typeof Sentry.logger?.error === 'function') {
        Sentry.logger.error(message, context)
      } else {
        console.error(`[Sentry Log] ${message}`, context)
      }
    } catch (error) {
      console.error(`[Sentry Log] ${message}`, context)
    }
  },
}

/**
 * Safe wrapper for Sentry metrics that falls back gracefully
 */
export const metrics = {
  increment: (name: string, value: number, options?: { tags?: Record<string, string> }) => {
    try {
      if (typeof Sentry.metrics?.increment === 'function') {
        Sentry.metrics.increment(name, value, options)
      }
      // Silently fail if metrics not available
    } catch (error) {
      // Silently fail
    }
  },

  distribution: (
    name: string,
    value: number,
    options?: { tags?: Record<string, string>; unit?: string }
  ) => {
    try {
      if (typeof Sentry.metrics?.distribution === 'function') {
        Sentry.metrics.distribution(name, value, options)
      }
      // Silently fail if metrics not available
    } catch (error) {
      // Silently fail
    }
  },

  gauge: (name: string, value: number, options?: { tags?: Record<string, string> }) => {
    try {
      if (typeof Sentry.metrics?.gauge === 'function') {
        Sentry.metrics.gauge(name, value, options)
      }
      // Silently fail if metrics not available
    } catch (error) {
      // Silently fail
    }
  },
}

/**
 * Capture exceptions with Sentry
 */
export const captureException = (error: unknown) => {
  try {
    Sentry.captureException(error)
  } catch (e) {
    console.error('Failed to capture exception:', error)
  }
}
