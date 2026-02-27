import React from 'react';
import { motion } from 'framer-motion';
import { formatINR } from '../utils/format';

interface BudgetBarProps {
  spent: number;
  budget: number;
  label?: string;
}

const BudgetBar: React.FC<BudgetBarProps> = ({ spent, budget, label }) => {
  const percent = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;

  const barColor =
    percent >= 90
      ? 'bg-red-500'
      : percent >= 70
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const glowColor =
    percent >= 90
      ? 'shadow-red-500/30'
      : percent >= 70
      ? 'shadow-yellow-500/30'
      : 'shadow-green-500/30';

  return (
    <div className="w-full space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between text-sm">
        {label && <span className="text-white/60 font-medium">{label}</span>}
        <span className="text-white/80 ml-auto">
          {formatINR(spent)} / {formatINR(budget)}{' '}
          <span
            className={`font-semibold ${
              percent >= 90
                ? 'text-red-400'
                : percent >= 70
                ? 'text-yellow-400'
                : 'text-green-400'
            }`}
          >
            ({percent}%)
          </span>
        </span>
      </div>

      {/* Bar track */}
      <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor} shadow-lg ${glowColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default BudgetBar;
