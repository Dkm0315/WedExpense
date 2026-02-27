import React from 'react';
import { motion } from 'framer-motion';
import { BsInboxes } from 'react-icons/bs';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  actionLabel,
  onAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        {icon ? (
          <span className="text-3xl text-white/20">{icon}</span>
        ) : (
          <BsInboxes className="text-3xl text-white/20" />
        )}
      </div>

      <h3 className="text-xl font-semibold text-white/70 mb-2">{title}</h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">{description}</p>

      {action && <div>{action}</div>}

      {!action && actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary/25"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;
