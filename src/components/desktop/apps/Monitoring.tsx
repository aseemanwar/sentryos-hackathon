'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TransactionHealth {
  name: string
  operation: string
  status: 'healthy' | 'warning' | 'critical' | 'no_data'
  currentPerformance: number
  sloTarget: number
  errorRate: number
  avgDuration: number
  p95Duration: number
  p99Duration: number
  requestCount: number
  trend: 'up' | 'down' | 'stable'
}

const mockData: TransactionHealth[] = [
  {
    name: 'Account Creation',
    operation: 'account.create',
    status: 'healthy',
    currentPerformance: 98,
    sloTarget: 99,
    errorRate: 2,
    avgDuration: 450,
    p95Duration: 480,
    p99Duration: 850,
    requestCount: 156,
    trend: 'stable'
  },
  {
    name: 'Get Balance',
    operation: 'account.balance',
    status: 'warning',
    currentPerformance: 94,
    sloTarget: 99.5,
    errorRate: 6,
    avgDuration: 180,
    p95Duration: 420,
    p99Duration: 2200,
    requestCount: 2341,
    trend: 'down'
  },
  {
    name: 'List Transactions',
    operation: 'transaction.list',
    status: 'healthy',
    currentPerformance: 99.2,
    sloTarget: 99,
    errorRate: 0.8,
    avgDuration: 280,
    p95Duration: 290,
    p99Duration: 580,
    requestCount: 892,
    trend: 'up'
  },
  {
    name: 'Transfer Funds',
    operation: 'transaction.transfer',
    status: 'critical',
    currentPerformance: 85,
    sloTarget: 98,
    errorRate: 15,
    avgDuration: 950,
    p95Duration: 1800,
    p99Duration: 2400,
    requestCount: 445,
    trend: 'down'
  },
]

const StatusIcon = ({ status }: { status: TransactionHealth['status'] }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    case 'critical':
      return <XCircle className="w-4 h-4 text-red-400" />
    default:
      return <Minus className="w-4 h-4 text-[#9086a3]" />
  }
}

const TrendIcon = ({ trend }: { trend: TransactionHealth['trend'] }) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-3 h-3 text-green-400" />
    case 'down':
      return <TrendingDown className="w-3 h-3 text-red-400" />
    default:
      return <Minus className="w-3 h-3 text-[#9086a3]" />
  }
}

const getStatusColor = (status: TransactionHealth['status']) => {
  switch (status) {
    case 'healthy':
      return 'text-green-400 border-green-400/30 bg-green-400/10'
    case 'warning':
      return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
    case 'critical':
      return 'text-red-400 border-red-400/30 bg-red-400/10'
    default:
      return 'text-[#9086a3] border-[#362552] bg-[#2a2438]'
  }
}

const getStatusText = (status: TransactionHealth['status']) => {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'warning':
      return 'SLO Breach (Warning)'
    case 'critical':
      return 'SLO Breach (Critical)'
    default:
      return 'No Data'
  }
}

export function Monitoring() {
  const [transactions, setTransactions] = useState<TransactionHealth[]>(mockData)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    // Simulate real-time updates every 5 seconds
    const interval = setInterval(() => {
      setTransactions(prev => prev.map(tx => ({
        ...tx,
        // Randomly fluctuate performance
        currentPerformance: Math.min(100, Math.max(70, tx.currentPerformance + (Math.random() - 0.5) * 5)),
        requestCount: tx.requestCount + Math.floor(Math.random() * 10),
      })))
      setLastUpdate(new Date())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const overallHealth = transactions.filter(t => t.status === 'healthy').length
  const warnings = transactions.filter(t => t.status === 'warning').length
  const critical = transactions.filter(t => t.status === 'critical').length

  return (
    <div className="h-full flex flex-col bg-[#1e1a2a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#362552] bg-[#2a2438]">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#7553ff]" />
          <div>
            <div className="text-sm font-medium text-[#e8e4f0]">Production Transaction Health</div>
            <div className="text-[10px] text-[#9086a3]">Real Bank - Live Monitoring</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-[#9086a3]">{overallHealth} Healthy</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            <span className="text-[#9086a3]">{warnings} Warning</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-[#9086a3]">{critical} Critical</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {transactions.map((tx) => (
            <div
              key={tx.operation}
              className={`border rounded-lg p-3 ${getStatusColor(tx.status)}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs font-medium text-[#e8e4f0] mb-1">{tx.name}</div>
                  <div className="flex items-center gap-1">
                    <StatusIcon status={tx.status} />
                    <span className="text-[10px]">{getStatusText(tx.status)}</span>
                  </div>
                </div>
                <TrendIcon trend={tx.trend} />
              </div>

              {/* SLO Progress */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-[#9086a3]">SLO: {tx.sloTarget}% Uptime</span>
                  <span className={tx.currentPerformance >= tx.sloTarget ? 'text-green-400' : 'text-red-400'}>
                    {tx.currentPerformance.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1 bg-[#1e1a2a] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      tx.currentPerformance >= tx.sloTarget ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(100, tx.currentPerformance)}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[#9086a3]">Requests:</span>
                  <span className="text-[#e8e4f0]">{tx.requestCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9086a3]">Error Rate:</span>
                  <span className={tx.errorRate > 5 ? 'text-red-400' : 'text-[#e8e4f0]'}>
                    {tx.errorRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9086a3]">Avg Duration:</span>
                  <span className="text-[#e8e4f0]">{tx.avgDuration}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9086a3]">P95:</span>
                  <span className="text-[#e8e4f0]">{tx.p95Duration}ms</span>
                </div>
              </div>

              {/* Time Period */}
              <div className="mt-2 pt-2 border-t border-[#362552]/50">
                <div className="text-[9px] text-[#9086a3]">Last Hour</div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="bg-[#2a2438] rounded-lg p-3 border border-[#362552]">
          <div className="text-xs font-medium text-[#e8e4f0] mb-2">System Overview</div>
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <div className="text-[#9086a3]">Total Requests</div>
              <div className="text-[#e8e4f0] font-medium">
                {transactions.reduce((sum, tx) => sum + tx.requestCount, 0)}
              </div>
            </div>
            <div>
              <div className="text-[#9086a3]">Avg Success Rate</div>
              <div className="text-green-400 font-medium">
                {(transactions.reduce((sum, tx) => sum + tx.currentPerformance, 0) / transactions.length).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[#9086a3]">SLO Breaches</div>
              <div className="text-red-400 font-medium">{warnings + critical}</div>
            </div>
            <div>
              <div className="text-[#9086a3]">Last Update</div>
              <div className="text-[#e8e4f0] font-medium">
                {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-3 bg-[#7553ff]/10 border border-[#7553ff]/30 rounded p-2 text-[10px] text-[#c4b5fd]">
          <strong>Live Monitoring:</strong> Tracks RED metrics (Rate, Errors, Duration) and SLO compliance for all Real Bank business transactions.
          Data refreshes every 5 seconds.
        </div>
      </div>
    </div>
  )
}
