import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'

// SLO Definitions (Service Level Objectives)
const SLO_CONFIG = {
  'account.create': {
    errorBudget: 0.01, // 99% success rate
    p95Latency: 500, // 500ms
    p99Latency: 1000, // 1000ms
  },
  'account.balance': {
    errorBudget: 0.005, // 99.5% success rate
    p95Latency: 200, // 200ms
    p99Latency: 400, // 400ms
  },
  'transaction.list': {
    errorBudget: 0.01, // 99% success rate
    p95Latency: 300, // 300ms
    p99Latency: 600, // 600ms
  },
  'transaction.transfer': {
    errorBudget: 0.02, // 98% success rate (more tolerance for complex operation)
    p95Latency: 1000, // 1000ms
    p99Latency: 2000, // 2000ms
  },
}

// Mock bank account data
const accounts = new Map([
  ['user123', {
    userId: 'user123',
    balance: 5420.50,
    accountNumber: '****1234',
    name: 'John Doe',
    email: 'john.doe@example.com',
    createdAt: '2024-01-15',
    status: 'active'
  }],
  ['user456', {
    userId: 'user456',
    balance: 10000.00,
    accountNumber: '****5678',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    createdAt: '2024-03-20',
    status: 'active'
  }],
])

const transactions: any[] = [
  { id: '1', date: '2025-02-11', description: 'Salary Deposit', amount: 3500.00, type: 'credit' },
  { id: '2', date: '2025-02-10', description: 'Coffee Shop', amount: -12.50, type: 'debit' },
  { id: '3', date: '2025-02-09', description: 'Grocery Store', amount: -145.30, type: 'debit' },
  { id: '4', date: '2025-02-08', description: 'Transfer to Savings', amount: -500.00, type: 'debit' },
  { id: '5', date: '2025-02-07', description: 'Freelance Payment', amount: 750.00, type: 'credit' },
]

// Helper to check SLO breach
function checkSLOBreach(operation: string, duration: number, success: boolean) {
  const slo = SLO_CONFIG[operation as keyof typeof SLO_CONFIG]
  if (!slo) return null

  const breaches = {
    latencyP95: duration > slo.p95Latency,
    latencyP99: duration > slo.p99Latency,
    errorRate: !success,
  }

  if (breaches.latencyP95 || breaches.latencyP99 || breaches.errorRate) {
    Sentry.captureMessage(`SLO Breach: ${operation}`, {
      level: 'warning',
      tags: {
        slo_breach: 'true',
        operation,
        breach_type: breaches.latencyP99 ? 'p99_latency' : breaches.latencyP95 ? 'p95_latency' : 'error_rate',
      },
      contexts: {
        slo: {
          operation,
          duration,
          success,
          p95_threshold: slo.p95Latency,
          p99_threshold: slo.p99Latency,
          error_budget: slo.errorBudget,
          breaches,
        }
      }
    })
  }

  return breaches
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { action, userId = 'user123', amount, recipient, description } = body

    // Add breadcrumb for Sentry
    Sentry.addBreadcrumb({
      category: 'banking',
      message: `Banking action: ${action}`,
      level: 'info',
      data: { userId, action }
    })

    // Set user context
    Sentry.setUser({
      id: userId,
      username: accounts.get(userId)?.name || 'Unknown',
    })

    // Add custom tags
    Sentry.setTag('banking.action', action)
    Sentry.setTag('banking.user_id', userId)

    switch (action) {
      case 'createAccount': {
        // Start Sentry transaction for RED metrics
        const transaction = Sentry.startTransaction({
          op: 'banking.account.create',
          name: 'Create Bank Account',
          tags: { business_transaction: 'account_creation' }
        })

        const operationStart = Date.now()
        let success = false

        try {
          const { name, email, initialDeposit = 0 } = body

          // Structured logging
          console.log('[BANKING] Account creation started', {
            timestamp: new Date().toISOString(),
            operation: 'account.create',
            email,
            initialDeposit,
          })

          // Validation
          if (!name || !email) {
            const error = new Error('Name and email are required')
            error.name = 'ValidationError'

            console.error('[BANKING] Account creation validation failed', {
              timestamp: new Date().toISOString(),
              operation: 'account.create',
              error: 'missing_fields',
              name: !!name,
              email: !!email,
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'validation',
                operation: 'account.create',
              }
            })
            throw error
          }

          // Check if email already exists
          const existingAccount = Array.from(accounts.values()).find(acc => acc.email === email)
          if (existingAccount) {
            const error = new Error('Account with this email already exists')
            error.name = 'DuplicateAccountError'

            console.error('[BANKING] Account creation failed - duplicate', {
              timestamp: new Date().toISOString(),
              operation: 'account.create',
              email,
              error: 'duplicate_account',
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'duplicate_account',
                operation: 'account.create',
              }
            })
            throw error
          }

          // Simulate occasional service unavailability
          if (Math.random() < 0.1) {
            const error = new Error('Account creation service temporarily unavailable')
            error.name = 'ServiceUnavailableError'

            console.error('[BANKING] Account creation service unavailable', {
              timestamp: new Date().toISOString(),
              operation: 'account.create',
              error: 'service_unavailable',
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'service_unavailable',
                operation: 'account.create',
              }
            })
            throw error
          }

          // Simulate slow account creation sometimes
          if (Math.random() < 0.3) {
            await new Promise(resolve => setTimeout(resolve, 800))
          }

          // Create account
          const newUserId = `user${Date.now()}`
          const accountNumber = `****${Math.floor(1000 + Math.random() * 9000)}`

          const newAccount = {
            userId: newUserId,
            balance: initialDeposit,
            accountNumber,
            name,
            email,
            createdAt: new Date().toISOString(),
            status: 'active'
          }

          accounts.set(newUserId, newAccount)

          success = true
          const duration = Date.now() - operationStart

          // Structured logging - success
          console.log('[BANKING] Account created successfully', {
            timestamp: new Date().toISOString(),
            operation: 'account.create',
            userId: newUserId,
            accountNumber,
            duration,
          })

          // RED Metrics
          Sentry.captureMessage('Account created', {
            level: 'info',
            tags: {
              operation: 'account.create',
              success: 'true',
              business_event: 'account_created',
            },
            contexts: {
              RED: {
                rate: 1,
                error: 0,
                duration,
              },
              account: {
                userId: newUserId,
                initialDeposit,
              }
            }
          })

          // Check SLO
          checkSLOBreach('account.create', duration, success)

          transaction.setStatus('ok')
          transaction.setMeasurement('duration', duration, 'millisecond')
          transaction.finish()

          return Response.json({
            success: true,
            data: newAccount,
            metrics: {
              duration,
              operation: 'account.create',
            }
          })

        } catch (error) {
          const duration = Date.now() - operationStart

          transaction.setStatus('internal_error')
          transaction.finish()

          // Check SLO
          checkSLOBreach('account.create', duration, success)

          throw error
        }
      }

      case 'getBalance': {
        const transaction = Sentry.startTransaction({
          op: 'banking.account.balance',
          name: 'Get Account Balance',
          tags: { business_transaction: 'balance_check' }
        })

        const operationStart = Date.now()
        let success = false

        try {
          console.log('[BANKING] Balance check started', {
            timestamp: new Date().toISOString(),
            operation: 'account.balance',
            userId,
          })

          // Simulate slow query sometimes (for performance monitoring)
          if (Math.random() < 0.2) {
            await new Promise(resolve => setTimeout(resolve, 2000))

            console.warn('[BANKING] Slow balance query detected', {
              timestamp: new Date().toISOString(),
              operation: 'account.balance',
              userId,
            })
          }

          const account = accounts.get(userId)
          if (!account) {
            console.error('[BANKING] Account not found', {
              timestamp: new Date().toISOString(),
              operation: 'account.balance',
              userId,
              error: 'account_not_found',
            })
            throw new Error('Account not found')
          }

          success = true
          const duration = Date.now() - operationStart

          console.log('[BANKING] Balance retrieved successfully', {
            timestamp: new Date().toISOString(),
            operation: 'account.balance',
            userId,
            duration,
          })

          // RED Metrics
          Sentry.captureMessage('Balance checked', {
            level: 'info',
            tags: {
              operation: 'account.balance',
              success: 'true',
            },
            contexts: {
              RED: { rate: 1, error: 0, duration }
            }
          })

          checkSLOBreach('account.balance', duration, success)

          transaction.setStatus('ok')
          transaction.setMeasurement('duration', duration, 'millisecond')
          transaction.finish()

          return Response.json({
            success: true,
            data: account,
            metrics: { duration, operation: 'account.balance' }
          })
        } catch (error) {
          const duration = Date.now() - operationStart
          transaction.setStatus('internal_error')
          transaction.finish()
          checkSLOBreach('account.balance', duration, success)
          throw error
        }
      }

      case 'getTransactions': {
        const transaction = Sentry.startTransaction({
          op: 'banking.transaction.list',
          name: 'List Transactions',
          tags: { business_transaction: 'transaction_list' }
        })

        const operationStart = Date.now()
        let success = false

        try {
          console.log('[BANKING] Transaction list requested', {
            timestamp: new Date().toISOString(),
            operation: 'transaction.list',
            userId,
          })

          // Simulate occasional database timeout
          if (Math.random() < 0.1) {
            const error = new Error('Database connection timeout')
            error.name = 'DatabaseTimeoutError'

            console.error('[BANKING] Database timeout', {
              timestamp: new Date().toISOString(),
              operation: 'transaction.list',
              userId,
              error: 'database_timeout',
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'database_timeout',
                operation: 'transaction.list',
              }
            })
            throw error
          }

          success = true
          const duration = Date.now() - operationStart

          console.log('[BANKING] Transactions retrieved', {
            timestamp: new Date().toISOString(),
            operation: 'transaction.list',
            userId,
            count: transactions.length,
            duration,
          })

          // RED Metrics
          Sentry.captureMessage('Transactions listed', {
            level: 'info',
            tags: {
              operation: 'transaction.list',
              success: 'true',
            },
            contexts: {
              RED: { rate: 1, error: 0, duration },
              data: { count: transactions.length }
            }
          })

          checkSLOBreach('transaction.list', duration, success)

          transaction.setStatus('ok')
          transaction.setMeasurement('duration', duration, 'millisecond')
          transaction.finish()

          return Response.json({
            success: true,
            data: transactions,
            metrics: { duration, operation: 'transaction.list' }
          })
        } catch (error) {
          const duration = Date.now() - operationStart
          transaction.setStatus('internal_error')
          transaction.finish()
          checkSLOBreach('transaction.list', duration, success)
          throw error
        }
      }

      case 'transfer': {
        // Start a transaction for performance monitoring
        const transaction = Sentry.startTransaction({
          op: 'banking.transaction.transfer',
          name: 'Money Transfer',
          tags: {
            amount: amount?.toString(),
            business_transaction: 'money_transfer'
          }
        })

        const operationStart = Date.now()
        let success = false

        try {
          console.log('[BANKING] Transfer initiated', {
            timestamp: new Date().toISOString(),
            operation: 'transaction.transfer',
            userId,
            recipient,
            amount,
          })
          // Validation errors
          if (!amount || amount <= 0) {
            const error = new Error('Invalid transfer amount')
            error.name = 'ValidationError'

            console.error('[BANKING] Transfer validation failed - amount', {
              timestamp: new Date().toISOString(),
              operation: 'transaction.transfer',
              userId,
              amount,
              error: 'invalid_amount',
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'validation',
                validation_field: 'amount',
                operation: 'transaction.transfer',
              },
              contexts: {
                validation: { amount, reason: 'must be positive' }
              }
            })
            throw error
          }

          if (!recipient) {
            const error = new Error('Recipient is required')
            error.name = 'ValidationError'

            console.error('[BANKING] Transfer validation failed - recipient', {
              timestamp: new Date().toISOString(),
              operation: 'transaction.transfer',
              userId,
              error: 'missing_recipient',
            })

            Sentry.captureException(error, {
              tags: {
                error_type: 'validation',
                validation_field: 'recipient',
                operation: 'transaction.transfer',
              }
            })
            throw error
          }

          const account = accounts.get(userId)
          if (!account) {
            throw new Error('Account not found')
          }

          // Insufficient funds
          if (account.balance < amount) {
            const error = new Error('Insufficient funds')
            error.name = 'InsufficientFundsError'
            Sentry.captureException(error, {
              tags: {
                error_type: 'insufficient_funds',
                severity: 'high'
              },
              contexts: {
                account: {
                  balance: account.balance,
                  requested: amount,
                  shortfall: amount - account.balance
                }
              }
            })

            return Response.json({
              success: false,
              error: 'Insufficient funds',
              details: {
                balance: account.balance,
                requested: amount,
                shortfall: amount - account.balance
              }
            }, { status: 400 })
          }

          // Simulate rate limiting
          if (amount > 5000) {
            const error = new Error('Transfer amount exceeds daily limit')
            error.name = 'RateLimitError'
            Sentry.captureException(error, {
              tags: {
                error_type: 'rate_limit',
                limit_type: 'daily_transfer'
              },
              contexts: {
                limits: {
                  daily_limit: 5000,
                  requested: amount
                }
              }
            })

            return Response.json({
              success: false,
              error: 'Transfer amount exceeds daily limit of $5000'
            }, { status: 429 })
          }

          // Simulate occasional network failure
          if (Math.random() < 0.15) {
            const error = new Error('Payment gateway timeout')
            error.name = 'NetworkError'
            Sentry.captureException(error, {
              tags: {
                error_type: 'network',
                gateway: 'payment_processor'
              },
              level: 'error'
            })
            throw error
          }

          // Successful transfer
          account.balance -= amount

          // Add transaction to history
          const newTransaction = {
            id: `tx_${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            description: description || `Transfer to ${recipient}`,
            amount: -amount,
            type: 'debit',
            recipient
          }
          transactions.unshift(newTransaction)

          success = true
          const duration = Date.now() - operationStart

          console.log('[BANKING] Transfer completed successfully', {
            timestamp: new Date().toISOString(),
            operation: 'transaction.transfer',
            userId,
            recipient,
            amount,
            transactionId: newTransaction.id,
            newBalance: account.balance,
            duration,
          })

          // RED Metrics
          Sentry.captureMessage('Transfer completed successfully', {
            level: 'info',
            tags: {
              event_type: 'transfer_success',
              operation: 'transaction.transfer',
              success: 'true',
              amount: amount.toString()
            },
            contexts: {
              RED: {
                rate: 1,
                error: 0,
                duration,
              },
              transfer: {
                from: userId,
                to: recipient,
                amount,
                newBalance: account.balance
              }
            }
          })

          // Check SLO
          checkSLOBreach('transaction.transfer', duration, success)

          transaction.setStatus('ok')
          transaction.setMeasurement('duration', duration, 'millisecond')
          transaction.finish()

          return Response.json({
            success: true,
            data: {
              transactionId: newTransaction.id,
              newBalance: account.balance,
              transaction: newTransaction
            },
            metrics: {
              duration,
              operation: 'transaction.transfer',
            }
          })

        } catch (error) {
          const duration = Date.now() - operationStart

          console.error('[BANKING] Transfer failed', {
            timestamp: new Date().toISOString(),
            operation: 'transaction.transfer',
            userId,
            recipient,
            amount,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
          })

          transaction.setStatus('internal_error')
          transaction.finish()

          // Check SLO
          checkSLOBreach('transaction.transfer', duration, success)

          throw error
        }
      }

      case 'buggyFeature': {
        // Intentional bug for demo purposes
        Sentry.addBreadcrumb({
          category: 'banking',
          message: 'User clicked buggy feature',
          level: 'warning'
        })

        // Simulate different types of errors
        const errorTypes = [
          () => {
            // Null reference error
            const obj: any = null
            return obj.property
          },
          () => {
            // Array index out of bounds
            const arr = [1, 2, 3]
            return arr[10].toString()
          },
          () => {
            // Type error
            const num: any = "not a number"
            return num.toFixed(2)
          },
          () => {
            // Custom business logic error
            throw new Error('Critical: Account verification failed - please contact support')
          }
        ]

        const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)]
        randomError()
      }

      default:
        return Response.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 })
    }

  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        api_endpoint: 'banking',
        error_caught: 'true'
      }
    })

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 })
  }
}
