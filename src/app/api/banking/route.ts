import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'

// Mock bank account data
const accounts = new Map([
  ['user123', { balance: 5420.50, accountNumber: '****1234', name: 'John Doe' }],
  ['user456', { balance: 10000.00, accountNumber: '****5678', name: 'Jane Smith' }],
])

const transactions: any[] = [
  { id: '1', date: '2025-02-11', description: 'Salary Deposit', amount: 3500.00, type: 'credit' },
  { id: '2', date: '2025-02-10', description: 'Coffee Shop', amount: -12.50, type: 'debit' },
  { id: '3', date: '2025-02-09', description: 'Grocery Store', amount: -145.30, type: 'debit' },
  { id: '4', date: '2025-02-08', description: 'Transfer to Savings', amount: -500.00, type: 'debit' },
  { id: '5', date: '2025-02-07', description: 'Freelance Payment', amount: 750.00, type: 'credit' },
]

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
      case 'getBalance': {
        const duration = Date.now() - startTime

        // Simulate slow query sometimes (for performance monitoring)
        if (Math.random() < 0.2) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          Sentry.captureMessage('Slow balance query detected', {
            level: 'warning',
            tags: { performance: 'slow_query' },
            contexts: {
              timing: { duration: Date.now() - startTime }
            }
          })
        }

        const account = accounts.get(userId)
        if (!account) {
          throw new Error('Account not found')
        }

        return Response.json({
          success: true,
          data: account,
          duration
        })
      }

      case 'getTransactions': {
        // Simulate occasional database timeout
        if (Math.random() < 0.1) {
          const error = new Error('Database connection timeout')
          error.name = 'DatabaseTimeoutError'
          Sentry.captureException(error, {
            tags: { error_type: 'database_timeout' },
            level: 'error'
          })
          throw error
        }

        return Response.json({
          success: true,
          data: transactions
        })
      }

      case 'transfer': {
        // Start a transaction for performance monitoring
        const transaction = Sentry.startTransaction({
          op: 'banking.transfer',
          name: 'Money Transfer',
          tags: { amount: amount?.toString() }
        })

        try {
          // Validation errors
          if (!amount || amount <= 0) {
            const error = new Error('Invalid transfer amount')
            error.name = 'ValidationError'
            Sentry.captureException(error, {
              tags: {
                error_type: 'validation',
                validation_field: 'amount'
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
            Sentry.captureException(error, {
              tags: {
                error_type: 'validation',
                validation_field: 'recipient'
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

          // Capture successful transfer event
          Sentry.captureMessage('Transfer completed successfully', {
            level: 'info',
            tags: {
              event_type: 'transfer_success',
              amount: amount.toString()
            },
            contexts: {
              transfer: {
                from: userId,
                to: recipient,
                amount,
                newBalance: account.balance
              }
            }
          })

          transaction.setStatus('ok')
          transaction.finish()

          return Response.json({
            success: true,
            data: {
              transactionId: newTransaction.id,
              newBalance: account.balance,
              transaction: newTransaction
            }
          })

        } catch (error) {
          transaction.setStatus('internal_error')
          transaction.finish()
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
