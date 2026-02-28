import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsXLg } from 'react-icons/bs';
import { updateExpense } from '../api/client';
import { formatINR } from '../utils/format';

interface Props {
  expense: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EditExpenseModal: React.FC<Props> = ({ expense, isOpen, onClose, onSaved }) => {
  const [paymentStatus, setPaymentStatus] = useState(expense?.payment_status || 'Pending');
  const [amountPaid, setAmountPaid] = useState(expense?.amount_paid?.toString() || '0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await updateExpense(expense.ROWID, {
        payment_status: paymentStatus,
        amount_paid: parseFloat(amountPaid) || 0,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update expense');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-dark-100 border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Edit Payment Status</h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <BsXLg />
              </button>
            </div>

            {/* Expense reference */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-white">{expense?.vendor_name}</p>
              <p className="text-xs text-white/50 mt-1">Total: {formatINR(parseFloat(expense?.amount || 0))}</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Payment Status */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-white/70 mb-2">Payment Status</label>
              <div className="flex flex-wrap items-center gap-3">
                {['Paid', 'Pending', 'Partial'].map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      paymentStatus === opt
                        ? 'bg-primary/20 border-primary/40 text-primary-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_status"
                      value={opt}
                      checked={paymentStatus === opt}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/70 mb-1.5">Amount Paid</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className={inputClass}
                min="0"
                step="0.01"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditExpenseModal;
