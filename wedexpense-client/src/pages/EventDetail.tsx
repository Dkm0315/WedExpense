import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsPlus,
  BsXLg,
  BsCamera,
  BsFunnel,
  BsCalendarEvent,
} from 'react-icons/bs';
import Layout from '../components/Layout';
import ExpenseCard from '../components/ExpenseCard';
import BudgetBar from '../components/BudgetBar';
import ReceiptScanner from '../components/ReceiptScanner';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getWedding,
  getEvents,
  getExpenses,
  createExpense,
  deleteExpense,
  getCategories,
  getCurrentUser,
} from '../api/client';
import { formatDate } from '../utils/format';

declare const catalyst: any;

interface ExpenseForm {
  vendor_name: string;
  amount: string;
  amount_paid: string;
  category: string;
  paid_by: string;
  payment_status: string;
  description: string;
  expense_date: string;
  receipt_url: string;
}

const INITIAL_EXPENSE_FORM: ExpenseForm = {
  vendor_name: '',
  amount: '',
  amount_paid: '',
  category: '',
  paid_by: 'shared',
  payment_status: 'pending',
  description: '',
  expense_date: '',
  receipt_url: '',
};

const EventDetail: React.FC = () => {
  const { wid, eid } = useParams<{ wid: string; eid: string }>();

  const [wedding, setWedding] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(INITIAL_EXPENSE_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaidBy, setFilterPaidBy] = useState('');

  const fetchData = useCallback(async () => {
    if (!wid || !eid) return;
    try {
      setLoading(true);
      const [weddingData, eventsData, expensesData, categoriesData] = await Promise.all([
        getWedding(wid),
        getEvents(wid),
        getExpenses(wid, { event_id: eid }),
        getCategories().catch(() => []),
      ]);
      setWedding(weddingData);
      const matchedEvent = Array.isArray(eventsData)
        ? eventsData.find((e: any) => e.ROWID === eid)
        : null;
      setEvent(matchedEvent);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  }, [wid, eid]);

  useEffect(() => {
    fetchData();
    getCurrentUser()
      .then((user) => {
        if (user?.first_name) setUserName(user.first_name);
      })
      .catch(() => {});
  }, [fetchData]);

  const handleLogout = () => {
    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        catalyst.auth.signOut('/app/index.html');
      }
    } catch {
      window.location.href = '/app/index.html';
    }
  };

  const handleExpenseChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setExpenseForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wid || !eid || !expenseForm.vendor_name.trim()) return;

    try {
      setSubmitting(true);
      await createExpense(wid, {
        ...expenseForm,
        event_id: eid,
        amount: parseFloat(expenseForm.amount) || 0,
        amount_paid: parseFloat(expenseForm.amount_paid) || 0,
      });
      setExpenseForm(INITIAL_EXPENSE_FORM);
      setShowExpenseModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanComplete = (result: any) => {
    setExpenseForm((prev) => ({
      ...prev,
      vendor_name: result.vendor_name || prev.vendor_name,
      amount: result.amount ? String(result.amount) : prev.amount,
      category: result.category || prev.category,
      expense_date: result.date || prev.expense_date,
      receipt_url: result.receipt_url || prev.receipt_url,
    }));
    setShowScannerModal(false);
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteExpense(expenseId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense');
    }
  };

  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    if (filterCategory && exp.category !== filterCategory) return false;
    if (filterStatus && exp.payment_status !== filterStatus) return false;
    if (filterPaidBy && exp.paid_by !== filterPaidBy) return false;
    return true;
  });

  const eventBudget = parseFloat(event?.event_budget || '0');
  const eventSpent = expenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amount || '0'),
    0
  );

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (loading) {
    return (
      <Layout userName={userName} onLogout={handleLogout} weddingName={wedding?.wedding_name}>
        <LoadingSpinner message="Loading event details..." />
      </Layout>
    );
  }

  return (
    <Layout userName={userName} onLogout={handleLogout} weddingName={wedding?.wedding_name}>
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.4 }}
      >
        {/* Breadcrumb */}
        <div className="text-sm text-white/40 mb-4">
          <Link to="/" className="hover:text-white/60 transition-colors">
            Weddings
          </Link>
          <span className="mx-2">/</span>
          <Link
            to={`/wedding/${wid}`}
            className="hover:text-white/60 transition-colors"
          >
            {wedding?.wedding_name || 'Wedding'}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/70">{event?.event_name || 'Event'}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {event?.event_name || 'Event'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-white/50 mt-1">
              {event?.event_date && (
                <span className="flex items-center gap-1">
                  <BsCalendarEvent className="text-accent text-xs" />
                  {formatDate(event.event_date)}
                </span>
              )}
              {event?.venue && <span>{event.venue}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowScannerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 rounded-xl text-sm font-medium transition-colors"
            >
              <BsCamera />
              Scan Receipt
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 text-sm"
            >
              <BsPlus className="text-lg" />
              Add Expense
            </motion.button>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between"
            >
              {error}
              <button onClick={() => setError('')} className="ml-2 hover:text-red-300">
                <BsXLg />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Budget Bar */}
        {eventBudget > 0 && (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 mb-6">
            <BudgetBar spent={eventSpent} budget={eventBudget} label="Event Budget" />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Expenses ({filteredExpenses.length})
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showFilters
                ? 'bg-primary/20 text-primary-300'
                : 'bg-white/5 text-white/50 hover:text-white/70'
            }`}
          >
            <BsFunnel className="text-xs" />
            Filters
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category filter */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat: any) => (
                      <option key={cat.ROWID || cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
                  >
                    <option value="">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>

                {/* Paid by filter */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Paid By</label>
                  <select
                    value={filterPaidBy}
                    onChange={(e) => setFilterPaidBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
                  >
                    <option value="">All</option>
                    <option value="bride_side">Bride Side</option>
                    <option value="groom_side">Groom Side</option>
                    <option value="shared">Shared</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expense List */}
        {filteredExpenses.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            description="Add your first expense or scan a receipt to get started."
            action={
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowScannerModal(true)}
                  className="px-4 py-2 bg-accent/20 border border-accent/30 text-accent rounded-xl text-sm font-medium"
                >
                  Scan Receipt
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25"
                >
                  Add Expense
                </button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense: any, index: number) => (
              <motion.div
                key={expense.ROWID}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <ExpenseCard
                  expense={expense}
                  onDelete={() => handleDeleteExpense(expense.ROWID)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Add Expense Modal ── */}
        <AnimatePresence>
          {showExpenseModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowExpenseModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-dark-200 border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Add Expense</h2>
                  <button
                    onClick={() => setShowExpenseModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <BsXLg />
                  </button>
                </div>

                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  {/* Vendor Name */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Vendor Name *
                    </label>
                    <input
                      name="vendor_name"
                      value={expenseForm.vendor_name}
                      onChange={handleExpenseChange}
                      placeholder="e.g. Royal Caterers"
                      required
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  {/* Amount + Amount Paid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Amount *
                      </label>
                      <input
                        type="number"
                        name="amount"
                        value={expenseForm.amount}
                        onChange={handleExpenseChange}
                        placeholder="e.g. 50000"
                        min="0"
                        required
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Amount Paid
                      </label>
                      <input
                        type="number"
                        name="amount_paid"
                        value={expenseForm.amount_paid}
                        onChange={handleExpenseChange}
                        placeholder="e.g. 25000"
                        min="0"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Category + Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Category
                      </label>
                      <select
                        name="category"
                        value={expenseForm.category}
                        onChange={handleExpenseChange}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat: any) => (
                          <option
                            key={cat.ROWID || cat.name}
                            value={cat.name}
                          >
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Date
                      </label>
                      <input
                        type="date"
                        name="expense_date"
                        value={expenseForm.expense_date}
                        onChange={handleExpenseChange}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Paid By */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Paid By
                    </label>
                    <div className="flex items-center gap-3">
                      {[
                        { value: 'bride_side', label: 'Bride Side' },
                        { value: 'groom_side', label: 'Groom Side' },
                        { value: 'shared', label: 'Shared' },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                            expenseForm.paid_by === opt.value
                              ? 'bg-primary/20 border-primary/40 text-primary-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paid_by"
                            value={opt.value}
                            checked={expenseForm.paid_by === opt.value}
                            onChange={handleExpenseChange}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Payment Status
                    </label>
                    <div className="flex items-center gap-3">
                      {[
                        { value: 'Paid', label: 'Paid' },
                        { value: 'Pending', label: 'Pending' },
                        { value: 'Partial', label: 'Partial' },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                            expenseForm.payment_status === opt.value
                              ? 'bg-primary/20 border-primary/40 text-primary-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment_status"
                            value={opt.value}
                            checked={expenseForm.payment_status === opt.value}
                            onChange={handleExpenseChange}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={expenseForm.description}
                      onChange={handleExpenseChange as any}
                      placeholder="Optional notes about this expense..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExpenseModal(false)}
                      className="px-5 py-2.5 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {submitting ? 'Saving...' : 'Save Expense'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scanner Modal ── */}
        <AnimatePresence>
          {showScannerModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowScannerModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-dark-200 border border-white/10 rounded-xl p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Scan Receipt</h2>
                  <button
                    onClick={() => setShowScannerModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <BsXLg />
                  </button>
                </div>
                <ReceiptScanner onScanComplete={handleScanComplete} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
};

export default EventDetail;
