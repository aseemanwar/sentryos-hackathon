'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { logger, metrics } from '@/lib/sentry-utils'

const Desktop = dynamic(
  () => import('@/components/desktop/Desktop').then(mod => mod.Desktop),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#0f0c14] flex items-center justify-center">
        <div className="text-[#7553ff] text-xl animate-pulse">Loading SentryOS...</div>
      </div>
    )
  }
)

export default function Home() {
  useEffect(() => {
    const pageLoadTime = Date.now()

    logger.info('SentryOS page loaded', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    })

    metrics.increment('page.loads', 1, {
      tags: { page: 'home' }
    })

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.info('Page became visible')
        metrics.increment('page.visibility.visible', 1)
      } else {
        logger.info('Page became hidden')
        metrics.increment('page.visibility.hidden', 1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      const sessionDuration = Date.now() - pageLoadTime

      logger.info('Page unloading', {
        sessionDuration,
      })

      metrics.distribution('page.session.duration', sessionDuration, {
        tags: { page: 'home' },
        unit: 'millisecond'
      })

      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return <Desktop />
}
