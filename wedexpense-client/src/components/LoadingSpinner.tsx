import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  message?: string;
}

const SIZES = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-[3px]',
  lg: 'w-14 h-14 border-4',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, message }) => {
  const displayText = text || message;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 gap-4"
    >
      <div
        className={`${SIZES[size]} rounded-full border-primary/30 border-t-primary animate-spin`}
      />
      {displayText && <p className="text-sm text-white/40">{displayText}</p>}
    </motion.div>
  );
};

export default LoadingSpinner;
