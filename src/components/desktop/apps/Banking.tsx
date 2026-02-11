'use client'

import { useState, useEffect } from 'react'
import { DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Account {
  balance: number
  accountNumber: string
  name: string
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  recipient?: string
}

export function Banking() {
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transfer form state
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadAccountData()
    loadTransactions()
  }, [])

  const loadAccountData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getBalance', userId: 'user123' })
      })
      const result = await response.json()
      if (result.success) {
        setAccount(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load account data')
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async () => {
    try {
      const response = await fetch('/api/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTransactions', userId: 'user123' })
      })
      const result = await response.json()
      if (result.success) {
        setTransactions(result.data)
      }
    } catch (err) {
      console.error('Failed to load transactions', err)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferLoading(true)
    setTransferResult(null)
    setError(null)

    try {
      const response = await fetch('/api/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          userId: 'user123',
          amount: parseFloat(amount),
          recipient,
          description
        })
      })

      const result = await response.json()

      if (result.success) {
        setTransferResult({
          success: true,
          message: `Successfully transferred $${amount} to ${recipient}`
        })
        setAmount('')
        setRecipient('')
        setDescription('')
        // Reload account data
        loadAccountData()
        loadTransactions()
      } else {
        setTransferResult({
          success: false,
          message: result.error || 'Transfer failed'
        })
      }
    } catch (err) {
      setTransferResult({
        success: false,
        message: 'Network error - please try again'
      })
    } finally {
      setTransferLoading(false)
    }
  }

  const triggerBuggyFeature = async () => {
    try {
      await fetch('/api/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buggyFeature', userId: 'user123' })
      })
    } catch (err) {
      // Error will be captured by Sentry
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1a2a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#362552] bg-[#2a2438]">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#7553ff]" />
          <span className="text-sm font-medium text-[#e8e4f0]">Real Bank</span>
        </div>
        <Button
          onClick={loadAccountData}
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#9086a3] hover:text-[#e8e4f0]"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Account Balance Card */}
        <div className="bg-gradient-to-br from-[#7553ff] to-[#ff45a8] rounded-lg p-4">
          <div className="text-xs text-white/80 mb-1">Available Balance</div>
          {loading ? (
            <div className="text-3xl font-bold text-white">Loading...</div>
          ) : account ? (
            <>
              <div className="text-3xl font-bold text-white mb-2">
                ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>{account.name}</span>
                <span>{account.accountNumber}</span>
              </div>
            </>
          ) : (
            <div className="text-white">Account not found</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => document.getElementById('transfer-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 px-3 py-2 bg-[#2a2438] hover:bg-[#362552] rounded border border-[#362552] transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 text-[#7553ff]" />
            <span className="text-xs text-[#e8e4f0]">Send Money</span>
          </button>
          <button
            onClick={triggerBuggyFeature}
            className="flex items-center gap-2 px-3 py-2 bg-[#2a2438] hover:bg-[#ff45a8]/20 rounded border border-[#362552] transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-[#ff45a8]" />
            <span className="text-xs text-[#e8e4f0]">Test Error</span>
          </button>
        </div>

        {/* Transfer Form */}
        <div id="transfer-section" className="bg-[#2a2438] rounded-lg p-4 border border-[#362552]">
          <h3 className="text-sm font-medium text-[#e8e4f0] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#7553ff]" />
            Transfer Money
          </h3>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div>
              <Label htmlFor="recipient" className="text-xs text-[#9086a3]">Recipient</Label>
              <Input
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Account number or name"
                className="mt-1 bg-[#1e1a2a] border-[#362552] text-[#e8e4f0] text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="amount" className="text-xs text-[#9086a3]">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 bg-[#1e1a2a] border-[#362552] text-[#e8e4f0] text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-xs text-[#9086a3]">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this for?"
                className="mt-1 bg-[#1e1a2a] border-[#362552] text-[#e8e4f0] text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={transferLoading}
              className="w-full bg-[#7553ff] hover:bg-[#8c6fff] text-white"
            >
              {transferLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Send Transfer
                </>
              )}
            </Button>
          </form>

          {transferResult && (
            <div className={`mt-3 p-2 rounded text-xs ${
              transferResult.success
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {transferResult.message}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-[#2a2438] rounded-lg p-4 border border-[#362552]">
          <h3 className="text-sm font-medium text-[#e8e4f0] mb-3">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-xs text-[#9086a3] text-center py-4">No transactions yet</div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-[#362552] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${
                      tx.type === 'credit' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {tx.type === 'credit' ? (
                        <ArrowDownLeft className="w-3 h-3 text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-[#e8e4f0]">{tx.description}</div>
                      <div className="text-[10px] text-[#9086a3]">{tx.date}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    tx.type === 'credit' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {tx.type === 'credit' ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Demo Info */}
        <div className="bg-[#7553ff]/10 border border-[#7553ff]/30 rounded p-3">
          <div className="text-xs text-[#c4b5fd]">
            <strong>Demo Mode:</strong> This app generates various Sentry events:
            <ul className="mt-1 space-y-0.5 ml-4 list-disc text-[10px]">
              <li>Try transfers over $5000 (rate limit error)</li>
              <li>Transfer more than your balance (insufficient funds)</li>
              <li>Click "Test Error" for random error scenarios</li>
              <li>All actions generate performance metrics & breadcrumbs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
