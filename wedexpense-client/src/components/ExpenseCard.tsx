import React from 'react';
import { motion } from 'framer-motion';
import { BsPencilSquare, BsTrash3, BsLink45Deg } from 'react-icons/bs';
import CategoryBadge from './CategoryBadge';
import { formatINR } from '../utils/format';

interface ExpenseData {
  ROWID: string;
  vendor_name: string;
  description?: string;
  category: string;
  amount: number;
  payment_status: string;
  paid_by?: string;
  receipt_url?: string;
  expense_date?: string;
  event_id?: string;
  wedding_id?: string;
  notes?: string;
}

interface ExpenseCardProps {
  expense: ExpenseData;
  onEdit?: () => void;
  onDelete?: () => void;
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  Paid: 'bg-green-500/20 text-green-400',
  Pending: 'bg-yellow-500/20 text-yellow-400',
  Partial: 'bg-orange-500/20 text-orange-400',
};

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, onEdit, onDelete }) => {
  const statusStyle =
    PAYMENT_STATUS_STYLES[expense.payment_status] ||
    'bg-white/10 text-white/60';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors group"
    >
      {/* Top row: vendor + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-white truncate">
            {expense.vendor_name}
          </h4>
          {expense.description && (
            <p className="text-sm text-white/50 mt-0.5 truncate">
              {expense.description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Edit expense"
            >
              <BsPencilSquare className="text-sm" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
              title="Delete expense"
            >
              <BsTrash3 className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Middle row: category + amount + status */}
      <div className="flex items-center justify-between mt-3 gap-3">
        <CategoryBadge category={expense.category} />

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            {formatINR(expense.amount)}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle}`}
          >
            {expense.payment_status}
          </span>
        </div>
      </div>

      {/* Bottom row: paid_by + receipt */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        {expense.paid_by ? (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-500/15 text-primary-300 font-medium">
            {expense.paid_by}
          </span>
        ) : (
          <span />
        )}

        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-300 transition-colors"
          >
            <BsLink45Deg className="text-sm" />
            View Receipt
          </a>
        )}
      </div>
    </motion.div>
  );
};

export default ExpenseCard;
