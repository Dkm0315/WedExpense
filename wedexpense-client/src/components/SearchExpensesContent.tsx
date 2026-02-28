import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsSearch, BsXLg } from 'react-icons/bs';
import ExpenseCard from './ExpenseCard';
import EmptyState from './EmptyState';
import { getExpenses, searchExpenses } from '../api/client';

interface Props {
  weddingId: string;
  onEditExpense?: (expense: any) => void;
}

const SearchExpensesContent: React.FC<Props> = ({ weddingId, onEditExpense }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getExpenses(weddingId)
      .then((exps) => {
        const expList = Array.isArray(exps) ? exps : [];
        setAllExpenses(expList);
        setResults(expList);
        setHasSearched(true);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setInitialLoading(false));
  }, [weddingId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(allExpenses);
      setHasSearched(true);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const data = await searchExpenses(weddingId, query.trim());
        setResults(Array.isArray(data) ? data : []);
        setHasSearched(true);
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [weddingId, query, allExpenses]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
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

      {/* Live Search Input */}
      <div className="mb-8">
        <div className="flex items-center gap-3 p-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
          <BsSearch className="ml-3 text-white/30 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search vendors, descriptions, categories..."
            autoFocus
            className="flex-1 py-2 bg-transparent text-white placeholder-white/30 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-2 text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
            >
              <BsXLg className="text-sm" />
            </button>
          )}
          {loading && (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0 mr-2" />
          )}
        </div>
        {query.length > 0 && query.length < 2 && (
          <p className="text-xs text-white/30 mt-2 ml-1">Type at least 2 characters to filter</p>
        )}
      </div>

      {/* Results */}
      {!loading && hasSearched && results.length === 0 && query && (
        <EmptyState
          title="No expenses found"
          description={`No results found for "${query}". Try a different search term.`}
          icon={<BsSearch />}
        />
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="text-sm text-white/50 mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-3">
            {results.map((expense: any, index: number) => (
              <motion.div
                key={expense.ROWID}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <ExpenseCard expense={expense} onEdit={onEditExpense ? () => onEditExpense(expense) : undefined} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {!loading && hasSearched && results.length === 0 && !query && (
        <div className="text-center py-16">
          <BsSearch className="text-5xl text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-lg">No expenses recorded yet</p>
        </div>
      )}
    </div>
  );
};

export default SearchExpensesContent;
