import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BsXLg, BsCheckLg } from 'react-icons/bs';
import Layout from '../components/Layout';
import ReceiptScanner from '../components/ReceiptScanner';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getWedding,
  getEvents,
  createExpense,
  getCategories,
  categorizeExpense,
  getCurrentUser,
} from '../api/client';

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
  event_id: string;
  receipt_url: string;
}

const INITIAL_FORM: ExpenseForm = {
  vendor_name: '',
  amount: '',
  amount_paid: '',
  category: '',
  paid_by: 'shared',
  payment_status: 'Pending',
  description: '',
  expense_date: '',
  event_id: '',
  receipt_url: '',
};

const AddExpense: React.FC = () => {
  const { wid, eid } = useParams<{ wid: string; eid?: string }>();
  const navigate = useNavigate();

  const [wedding, setWedding] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState<ExpenseForm>({
    ...INITIAL_FORM,
    event_id: eid || '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userName, setUserName] = useState('');
  const [suggestingCategory, setSuggestingCategory] = useState(false);

  const fetchData = useCallback(async () => {
    if (!wid) return;
    try {
      setLoading(true);
      const [weddingData, eventsData, categoriesData] = await Promise.all([
        getWedding(wid),
        getEvents(wid),
        getCategories().catch(() => []),
      ]);
      setWedding(weddingData);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [wid]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleScanComplete = (result: any) => {
    setForm((prev) => ({
      ...prev,
      vendor_name: result.vendor_name || prev.vendor_name,
      amount: result.amount ? String(result.amount) : prev.amount,
      category: result.category || prev.category,
      expense_date: result.date || prev.expense_date,
      receipt_url: result.receipt_url || prev.receipt_url,
    }));
    setSuccess('Receipt scanned! Form has been pre-filled.');
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleAutoCategory = async () => {
    if (!form.description.trim() && !form.vendor_name.trim()) return;
    try {
      setSuggestingCategory(true);
      const result = await categorizeExpense(
        form.description || form.vendor_name
      );
      if (result?.category) {
        setForm((prev) => ({ ...prev, category: result.category }));
      }
    } catch {
      // silently fail
    } finally {
      setSuggestingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wid || !form.vendor_name.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      await createExpense(wid, {
        ...form,
        amount: parseFloat(form.amount) || 0,
        amount_paid: parseFloat(form.amount_paid) || 0,
        event_id: form.event_id || undefined,
      });
      setSuccess('Expense added successfully!');

      // Navigate back after short delay
      setTimeout(() => {
        if (eid) {
          navigate(`/wedding/${wid}/event/${eid}`);
        } else {
          navigate(`/wedding/${wid}`);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (loading) {
    return (
      <Layout userName={userName} onLogout={handleLogout} weddingName={wedding?.wedding_name}>
        <LoadingSpinner message="Loading..." />
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
        className="max-w-2xl mx-auto"
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
          <span className="text-white/70">Add Expense</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">
          Add Expense
        </h1>

        {/* Messages */}
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
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-center gap-2"
            >
              <BsCheckLg />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt Scanner */}
        <div className="mb-6">
          <ReceiptScanner onScanComplete={handleScanComplete} />
        </div>

        {/* Expense Form */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-white mb-5">Expense Details</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vendor Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Vendor Name *
              </label>
              <input
                name="vendor_name"
                value={form.vendor_name}
                onChange={handleChange}
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
                  value={form.amount}
                  onChange={handleChange}
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
                  value={form.amount_paid}
                  onChange={handleChange}
                  placeholder="e.g. 25000"
                  min="0"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            {/* Event + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Event
                </label>
                <select
                  name="event_id"
                  value={form.event_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                >
                  <option value="">No specific event</option>
                  {events.map((evt: any) => (
                    <option key={evt.ROWID} value={evt.ROWID}>
                      {evt.event_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Category
                </label>
                <div className="flex items-center gap-2">
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat: any) => (
                      <option
                        key={cat.ROWID || cat.category_name}
                        value={cat.category_name}
                      >
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAutoCategory}
                    disabled={suggestingCategory}
                    className="flex-shrink-0 px-3 py-2.5 bg-accent/20 border border-accent/30 text-accent rounded-lg text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50"
                    title="Auto-suggest category from description"
                  >
                    {suggestingCategory ? '...' : 'AI'}
                  </button>
                </div>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Date
              </label>
              <input
                type="date"
                name="expense_date"
                value={form.expense_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Paid By */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Paid By
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { value: 'bride_side', label: 'Bride Side' },
                  { value: 'groom_side', label: 'Groom Side' },
                  { value: 'shared', label: 'Shared' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.paid_by === opt.value
                        ? 'bg-primary/20 border-primary/40 text-primary-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paid_by"
                      value={opt.value}
                      checked={form.paid_by === opt.value}
                      onChange={handleChange}
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
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { value: 'Paid', label: 'Paid' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Partial', label: 'Partial' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.payment_status === opt.value
                        ? 'bg-primary/20 border-primary/40 text-primary-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_status"
                      value={opt.value}
                      checked={form.payment_status === opt.value}
                      onChange={handleChange}
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
                value={form.description}
                onChange={handleChange}
                placeholder="Optional notes about this expense..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
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
        </div>
      </motion.div>
    </Layout>
  );
};

export default AddExpense;
