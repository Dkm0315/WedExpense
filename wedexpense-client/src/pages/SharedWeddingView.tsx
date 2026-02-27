import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BsCalendarEvent,
  BsCurrencyRupee,
  BsWallet2,
  BsGraphUpArrow,
  BsGeoAlt,
  BsCalendar3,
} from 'react-icons/bs';
import LoadingSpinner from '../components/LoadingSpinner';
import { getSharedWedding } from '../api/client';
import { formatINR, formatDate } from '../utils/format';

interface SharedWeddingViewProps {
  tokenOverride?: string;
}

const SharedWeddingView: React.FC<SharedWeddingViewProps> = ({ tokenOverride }) => {
  const params = useParams<{ token: string }>();
  const token = tokenOverride || params.token;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    getSharedWedding(token)
      .then(setData)
      .catch((err) => setError(err.message || 'Invalid or expired share link'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <LoadingSpinner message="Loading shared wedding..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <BsWallet2 className="text-red-400 text-2xl" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-white/50 text-sm">{error || 'This share link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { wedding, events, expenses, total_spent, categories } = data;
  const totalBudget = parseFloat(wedding.total_budget) || 0;
  const remaining = totalBudget - total_spent;
  const budgetPercent = totalBudget > 0 ? Math.round((total_spent / totalBudget) * 100) : 0;

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 to-accent/20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {wedding.wedding_name}
            </h1>
            {(wedding.bride_name || wedding.groom_name) && (
              <p className="text-lg text-white/60">
                {[wedding.bride_name, wedding.groom_name].filter(Boolean).join(' & ')}
              </p>
            )}
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-white/40">
              {wedding.venue_city && (
                <span className="flex items-center gap-1">
                  <BsGeoAlt /> {wedding.venue_city}
                </span>
              )}
              {wedding.wedding_date && (
                <span className="flex items-center gap-1">
                  <BsCalendar3 /> {formatDate(wedding.wedding_date)}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Budget Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <BsWallet2 className="text-primary-300 text-lg" />
              </div>
              <span className="text-sm text-white/50">Total Budget</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatINR(totalBudget)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <BsCurrencyRupee className="text-accent text-lg" />
              </div>
              <span className="text-sm text-white/50">Total Spent</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatINR(total_spent)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  remaining >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}
              >
                <BsGraphUpArrow
                  className={`text-lg ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}
                />
              </div>
              <span className="text-sm text-white/50">Remaining</span>
            </div>
            <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatINR(Math.abs(remaining))}
              {remaining < 0 && <span className="text-sm font-normal ml-1">over budget</span>}
            </p>
          </motion.div>
        </div>

        {/* Budget Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>{budgetPercent}% of budget used</span>
            <span>{formatINR(total_spent)} / {formatINR(totalBudget)}</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, budgetPercent)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                budgetPercent >= 90
                  ? 'bg-gradient-to-r from-red-500 to-red-400'
                  : budgetPercent >= 70
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                  : 'bg-gradient-to-r from-primary to-primary-400'
              }`}
            />
          </div>
        </motion.div>

        {/* Category Breakdown */}
        {categories && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Spending by Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((cat: any, i: number) => {
                const pct = total_spent > 0 ? Math.round((cat.total / total_spent) * 100) : 0;
                return (
                  <div
                    key={cat.category}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full bg-primary/60" />
                      <div>
                        <p className="text-sm text-white font-medium">{cat.category}</p>
                        <p className="text-xs text-white/40">{pct}% of total</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white">{formatINR(cat.total)}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Events */}
        {events && events.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((event: any) => {
                const evtBudget = parseFloat(event.event_budget) || 0;
                const evtSpent = parseFloat(event.total_spent) || 0;
                return (
                  <div
                    key={event.ROWID}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                        <BsCalendarEvent className="text-primary-300 text-sm" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{event.event_name}</p>
                        {event.event_date && (
                          <p className="text-xs text-white/40">{formatDate(event.event_date)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Budget: {formatINR(evtBudget)}</span>
                      <span className="text-white font-medium">Spent: {formatINR(evtSpent)}</span>
                    </div>
                    {evtBudget > 0 && (
                      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${Math.min(100, evtBudget > 0 ? (evtSpent / evtBudget) * 100 : 0)}%` }}
                        />
                      </div>
                    )}
                    {event.venue && (
                      <p className="text-xs text-white/30 mt-2 flex items-center gap-1">
                        <BsGeoAlt /> {event.venue}
                      </p>
                    )}
                    {event.expense_count > 0 && (
                      <p className="text-xs text-white/30 mt-1">{event.expense_count} expenses</p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Expenses List */}
        {expenses && expenses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-12"
          >
            <h2 className="text-lg font-semibold text-white mb-4">All Expenses ({expenses.length})</h2>
            <div className="space-y-2">
              {expenses.map((exp: any) => (
                <div
                  key={exp.ROWID}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-white font-medium">{exp.vendor_name || 'Expense'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary-300 border border-primary/20">
                        {exp.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        exp.payment_status === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/40'
                      }`}>
                        {exp.payment_status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">{formatINR(parseFloat(exp.amount) || 0)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer branding */}
        <div className="text-center py-8 border-t border-white/10">
          <p className="text-white/20 text-xs">
            Powered by <span className="text-primary-300/40 font-semibold">WedExpense</span> — AI Wedding Budget Tracker
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedWeddingView;
