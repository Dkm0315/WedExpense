import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsPlus,
  BsCalendarHeart,
  BsGeoAlt,
  BsCurrencyRupee,
  BsXLg,
  BsPeopleFill,
  BsReceiptCutoff,
  BsHeart,
  BsBriefcase,
  BsGraphUpArrow,
  BsGraphDownArrow,
  BsCashCoin,
  BsGearFill,
} from 'react-icons/bs';
import Layout from '../components/Layout';
import BudgetBar from '../components/BudgetBar';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { getWeddings, createWedding, getCurrentUser, getOrgSettings, createOnboarding, getPlannerSummary } from '../api/client';
import { formatDate, formatDateRange, formatINR } from '../utils/format';

declare const catalyst: any;

interface WeddingForm {
  wedding_name: string;
  bride_name: string;
  groom_name: string;
  start_date: string;
  end_date: string;
  total_budget: string;
  venue_city: string;
}

const INITIAL_FORM: WeddingForm = {
  wedding_name: '',
  bride_name: '',
  groom_name: '',
  start_date: '',
  end_date: '',
  total_budget: '',
  venue_city: '',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [weddings, setWeddings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<WeddingForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState('');

  // Onboarding & mode state
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'select' | 'planner-setup'>('select');
  const [orgName, setOrgName] = useState('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  // Planner summary
  const [plannerSummary, setPlannerSummary] = useState<any>(null);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [modeSwitching, setModeSwitching] = useState(false);

  const isPlanner = orgSettings?.account_type === 'planner';

  const fetchWeddings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWeddings();
      setWeddings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load weddings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load org settings first to decide which dashboard to show
    const init = async () => {
      try {
        const user = await getCurrentUser().catch(() => null);
        if (user?.first_name) setUserName(user.first_name);
      } catch {}

      try {
        const settings = await getOrgSettings();
        setOrgSettings(settings);
        setNeedsOnboarding(false);
        // If planner, fetch planner summary
        if (settings?.account_type === 'planner') {
          getPlannerSummary().then(setPlannerSummary).catch(() => {});
        }
      } catch {
        // 404 = not onboarded
        setNeedsOnboarding(true);
      }

      fetchWeddings();
    };
    init();
  }, [fetchWeddings]);

  const handleLogout = () => {
    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        catalyst.auth.signOut('/app/index.html');
      }
    } catch {
      window.location.href = '/app/index.html';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wedding_name.trim()) return;

    try {
      setSubmitting(true);
      await createWedding({
        ...form,
        total_budget: parseFloat(form.total_budget) || 0,
        is_planner_mode: isPlanner,
      });
      setForm(INITIAL_FORM);
      setShowModal(false);
      await fetchWeddings();
      if (isPlanner) getPlannerSummary().then(setPlannerSummary).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to create wedding');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnboarding = async (type: 'family' | 'planner') => {
    if (type === 'planner') {
      setOnboardingStep('planner-setup');
      return;
    }
    try {
      setOnboardingSubmitting(true);
      const settings = await createOnboarding({ account_type: 'family' });
      setOrgSettings(settings);
      setNeedsOnboarding(false);
    } catch (err: any) {
      setError(err.message || 'Failed to set up account');
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const handlePlannerSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOnboardingSubmitting(true);
      const settings = await createOnboarding({ account_type: 'planner', org_name: orgName });
      setOrgSettings(settings);
      setNeedsOnboarding(false);
      getPlannerSummary().then(setPlannerSummary).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to set up business');
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // ─── Onboarding Screen ───
  if (needsOnboarding && !loading) {
    return (
      <Layout userName={userName} onLogout={handleLogout}>
        <motion.div
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4 }}
          className="max-w-2xl mx-auto py-12"
        >
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
                <button onClick={() => setError('')} className="ml-2 hover:text-red-300"><BsXLg /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {onboardingStep === 'select' ? (
            <>
              <div className="text-center mb-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Welcome to WedExpense!
                </h1>
                <p className="text-white/50 text-lg">How will you use WedExpense?</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <motion.button
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOnboarding('family')}
                  disabled={onboardingSubmitting}
                  className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8 text-left hover:border-primary/40 hover:bg-white/[0.07] transition-all group disabled:opacity-50"
                >
                  <BsHeart className="text-4xl text-pink-400 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary-300 transition-colors">
                    Family / Couple
                  </h3>
                  <p className="text-sm text-white/50">
                    Track expenses for YOUR wedding. Invite family members to collaborate on budgets and vendors.
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOnboarding('planner')}
                  disabled={onboardingSubmitting}
                  className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8 text-left hover:border-accent/40 hover:bg-white/[0.07] transition-all group disabled:opacity-50"
                >
                  <BsBriefcase className="text-4xl text-accent mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-accent transition-colors">
                    Wedding Planner
                  </h3>
                  <p className="text-sm text-white/50">
                    Manage multiple client weddings. Track income, expenses, and profit per client.
                  </p>
                </motion.button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-md mx-auto"
            >
              <button
                onClick={() => setOnboardingStep('select')}
                className="text-sm text-white/40 hover:text-white mb-6 flex items-center gap-1"
              >
                &larr; Back
              </button>
              <h2 className="text-2xl font-bold text-white mb-2">Set Up Your Business</h2>
              <p className="text-white/50 text-sm mb-6">Tell us about your wedding planning business.</p>
              <form onSubmit={handlePlannerSetup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Business Name *
                  </label>
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Royal Events Pvt Ltd"
                    required
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={onboardingSubmitting || !orgName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-accent to-yellow-600 text-dark-100 font-bold rounded-xl shadow-lg shadow-accent/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {onboardingSubmitting ? 'Setting up...' : 'Continue'}
                </motion.button>
              </form>
            </motion.div>
          )}
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout userName={userName} onLogout={handleLogout}>
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.4 }}
      >
        {/* Welcome + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            {userName && (
              <p className="text-sm text-white/50 mb-1">
                Welcome back, {userName}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {isPlanner ? (orgSettings?.org_name || 'Your Business') : 'Your Weddings'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModeSwitch(true)}
              className="p-2.5 bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Switch mode"
            >
              <BsGearFill />
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all"
            >
              <BsPlus className="text-xl" />
              {isPlanner ? 'New Client Wedding' : 'New Wedding'}
            </motion.button>
          </div>
        </div>

        {/* Planner Summary Cards */}
        {isPlanner && plannerSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <BsGraphUpArrow className="text-green-400" />
                <span className="text-sm text-white/50">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatINR(plannerSummary.total_revenue || 0)}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <BsGraphDownArrow className="text-red-400" />
                <span className="text-sm text-white/50">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatINR(plannerSummary.total_expenses || 0)}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <BsCashCoin className={(plannerSummary.profit || 0) >= 0 ? 'text-accent' : 'text-red-400'} />
                <span className="text-sm text-white/50">Profit</span>
              </div>
              <p className={`text-2xl font-bold ${(plannerSummary.profit || 0) >= 0 ? 'text-accent' : 'text-red-400'}`}>
                {(plannerSummary.profit || 0) < 0 ? '-' : ''}{formatINR(Math.abs(plannerSummary.profit || 0))}
              </p>
            </div>
          </div>
        )}

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

        {/* Loading */}
        {loading && <LoadingSpinner message="Loading your weddings..." />}

        {/* Empty State */}
        {!loading && weddings.length === 0 && (
          <EmptyState
            title={isPlanner ? 'No client weddings yet' : 'No weddings yet'}
            description={isPlanner
              ? 'Add your first client wedding to start tracking income and expenses.'
              : 'Create your first wedding to start tracking expenses, events, and budgets.'}
            icon={<BsCalendarHeart />}
            action={
              <button
                onClick={() => setShowModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25"
              >
                {isPlanner ? 'Add First Client Wedding' : 'Create Your First Wedding'}
              </button>
            }
          />
        )}

        {/* Wedding Grid */}
        {!loading && weddings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {weddings.map((wedding: any, index: number) => {
              const budget = parseFloat(wedding.total_budget || '0');
              const spent = parseFloat(wedding.total_spent || '0');
              // Planner: show per-wedding revenue and profit
              const perWedding = isPlanner && plannerSummary?.per_wedding?.[wedding.ROWID];
              const wRevenue = perWedding?.income || 0;
              const wExpenses = perWedding?.expenses || 0;
              const wProfit = wRevenue - wExpenses;

              return (
                <motion.div
                  key={wedding.ROWID}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/wedding/${wedding.ROWID}`)}
                  className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 cursor-pointer hover:border-primary-400/30 hover:bg-white/[0.07] transition-colors group"
                >
                  {/* Wedding name */}
                  <h2 className="text-xl font-bold text-white group-hover:text-primary-300 transition-colors mb-1">
                    {wedding.wedding_name}
                  </h2>

                  {/* Couple names */}
                  {(wedding.bride_name || wedding.groom_name) && (
                    <p className="text-sm text-white/50 mb-3">
                      {[wedding.bride_name, wedding.groom_name]
                        .filter(Boolean)
                        .join(' & ')}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-sm text-white/50 mb-4">
                    {(wedding.start_date || wedding.wedding_date) && (
                      <div className="flex items-center gap-2">
                        <BsCalendarHeart className="text-accent text-xs" />
                        <span>{formatDateRange(wedding.start_date, wedding.end_date, wedding.wedding_date)}</span>
                      </div>
                    )}
                    {wedding.venue_city && (
                      <div className="flex items-center gap-2">
                        <BsGeoAlt className="text-accent text-xs" />
                        <span>{wedding.venue_city}</span>
                      </div>
                    )}
                  </div>

                  {/* Planner: Revenue / Expense / Profit row */}
                  {isPlanner && perWedding && (
                    <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                      <div className="bg-green-500/10 rounded-lg p-2 text-center">
                        <p className="text-green-400 font-semibold">{formatINR(wRevenue)}</p>
                        <p className="text-white/40">Revenue</p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-2 text-center">
                        <p className="text-red-400 font-semibold">{formatINR(wExpenses)}</p>
                        <p className="text-white/40">Expenses</p>
                      </div>
                      <div className={`${wProfit >= 0 ? 'bg-accent/10' : 'bg-red-500/10'} rounded-lg p-2 text-center`}>
                        <p className={`font-semibold ${wProfit >= 0 ? 'text-accent' : 'text-red-400'}`}>{wProfit < 0 ? '-' : ''}{formatINR(Math.abs(wProfit))}</p>
                        <p className="text-white/40">Profit</p>
                      </div>
                    </div>
                  )}

                  {/* Budget bar */}
                  {budget > 0 && (
                    <div className="mb-4">
                      <BudgetBar spent={spent} budget={budget} label="Budget" />
                    </div>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center gap-4 pt-3 border-t border-white/5 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <BsPeopleFill className="text-[10px]" />
                      {wedding.event_count || 0} events
                    </span>
                    <span className="flex items-center gap-1">
                      <BsReceiptCutoff className="text-[10px]" />
                      {wedding.expense_count || 0} expenses
                    </span>
                    {budget > 0 && (
                      <span className="flex items-center gap-1 ml-auto">
                        <BsCurrencyRupee className="text-[10px]" />
                        {formatINR(budget)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── New Wedding Modal ── */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-dark-200 border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    Create New Wedding
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <BsXLg />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Wedding Name */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Wedding Name *
                    </label>
                    <input
                      name="wedding_name"
                      value={form.wedding_name}
                      onChange={handleChange}
                      placeholder="e.g. Sharma-Patel Wedding"
                      required
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  {/* Bride + Groom names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Bride's Name
                      </label>
                      <input
                        name="bride_name"
                        value={form.bride_name}
                        onChange={handleChange}
                        placeholder="Bride's name"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Groom's Name
                      </label>
                      <input
                        name="groom_name"
                        value={form.groom_name}
                        onChange={handleChange}
                        placeholder="Groom's name"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        From Date
                      </label>
                      <input
                        type="date"
                        name="start_date"
                        value={form.start_date}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        To Date
                      </label>
                      <input
                        type="date"
                        name="end_date"
                        value={form.end_date}
                        onChange={handleChange}
                        min={form.start_date}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Total Budget
                    </label>
                    <input
                      type="number"
                      name="total_budget"
                      value={form.total_budget}
                      onChange={handleChange}
                      placeholder="e.g. 2500000"
                      min="0"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  {/* Venue City */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Venue City
                    </label>
                    <input
                      name="venue_city"
                      value={form.venue_city}
                      onChange={handleChange}
                      placeholder="e.g. Jaipur"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
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
                      {submitting ? 'Creating...' : 'Create Wedding'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mode Switch Modal */}
      <AnimatePresence>
        {showModeSwitch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModeSwitch(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-dark-100 border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white">Account Mode</h2>
                <button onClick={() => setShowModeSwitch(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                  <BsXLg />
                </button>
              </div>

              <p className="text-sm text-white/50 mb-4">
                Current mode: <span className="text-white font-medium">{isPlanner ? 'Wedding Planner' : 'Family / Couple'}</span>
              </p>

              {isPlanner ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                  <p className="text-sm text-white/70">Switch to <span className="text-white font-medium">Family / Couple</span> mode?</p>
                  <p className="text-xs text-white/40 mt-1">Income tracking and activity logs will be hidden. Your data is preserved.</p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                  <p className="text-sm text-white/70">Switch to <span className="text-white font-medium">Wedding Planner</span> mode?</p>
                  <p className="text-xs text-white/40 mt-1">Unlocks income tracking, client management, and activity logs.</p>
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Your business name"
                    className="w-full mt-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModeSwitch(false)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={async () => {
                    setModeSwitching(true);
                    try {
                      const newType = isPlanner ? 'family' : 'planner';
                      const settings = await createOnboarding({
                        account_type: newType,
                        ...(newType === 'planner' && orgName.trim() ? { org_name: orgName.trim() } : {}),
                      });
                      setOrgSettings(settings);
                      setShowModeSwitch(false);
                      if (newType === 'planner') {
                        getPlannerSummary().then(setPlannerSummary).catch(() => {});
                      }
                      await fetchWeddings();
                    } catch (err: any) {
                      setError(err.message || 'Failed to switch mode');
                    } finally {
                      setModeSwitching(false);
                    }
                  }}
                  disabled={modeSwitching || (!isPlanner && !orgName.trim())}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {modeSwitching ? 'Switching...' : `Switch to ${isPlanner ? 'Family' : 'Planner'}`}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Dashboard;
