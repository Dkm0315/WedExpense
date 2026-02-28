import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsPlus,
  BsXLg,
  BsCalendarEvent,
  BsSearch,
  BsBarChartFill,
  BsPersonPlusFill,
  BsCurrencyRupee,
  BsWallet2,
  BsGraphUpArrow,
  BsListCheck,
  BsPencilSquare,
  BsArrowLeft,
  BsShareFill,
  BsClipboard2Check,
  BsClockHistory,
} from 'react-icons/bs';
import Layout from '../components/Layout';
import EventCard from '../components/EventCard';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import BudgetSummaryContent from '../components/BudgetSummaryContent';
import SearchExpensesContent from '../components/SearchExpensesContent';
import EditIncomeModal from '../components/EditIncomeModal';
import EditWeddingModal from '../components/EditWeddingModal';
import {
  getWedding,
  getEvents,
  createEvent,
  getWeddingSummary,
  getCurrentUser,
  getOrgSettings,
  getIncomes,
  createIncome,
  deleteIncome,
  generateShareLink,
  getAuditLogs,
} from '../api/client';
import { formatINR, formatDate } from '../utils/format';

declare const catalyst: any;

const EVENT_TEMPLATES = [
  'Mehendi',
  'Haldi',
  'Sangeet',
  'Wedding',
  'Reception',
  'Engagement',
  'Cocktail Party',
  'Bridal Shower',
  'Bachelor Party',
];

type Tab = 'events' | 'income' | 'budget' | 'search' | 'activity';

interface EventForm {
  event_name: string;
  event_date: string;
  event_budget: string;
  venue: string;
}

const INITIAL_EVENT_FORM: EventForm = {
  event_name: '',
  event_date: '',
  event_budget: '',
  venue: '',
};

const WeddingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [wedding, setWedding] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [showModal, setShowModal] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>(INITIAL_EVENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [isPlanner, setIsPlanner] = useState(false);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ amount: '', amount_received: '', description: '', payment_status: 'pending', payment_date: '', client_name: '' });
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);
  const [editingIncome, setEditingIncome] = useState<any>(null);
  const [editingWedding, setEditingWedding] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [weddingData, eventsData, summaryData] = await Promise.all([
        getWedding(id),
        getEvents(id),
        getWeddingSummary(id).catch(() => null),
      ]);
      setWedding(weddingData);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Failed to load wedding details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    getCurrentUser()
      .then((user) => {
        if (user?.first_name) setUserName(user.first_name);
      })
      .catch(() => {});
    getOrgSettings()
      .then((settings) => {
        if (settings?.account_type === 'planner') {
          setIsPlanner(true);
          if (id) getIncomes(id).then(data => setIncomes(Array.isArray(data) ? data : [])).catch(() => {});
        }
      })
      .catch(() => {});
  }, [fetchData, id]);

  const handleLogout = () => {
    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        catalyst.auth.signOut('/app/index.html');
      }
    } catch {
      window.location.href = '/app/index.html';
    }
  };

  const handleEventFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEventForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !eventForm.event_name.trim()) return;

    try {
      setSubmitting(true);
      await createEvent(id, {
        ...eventForm,
        event_budget: parseFloat(eventForm.event_budget) || 0,
      });
      setEventForm(INITIAL_EVENT_FORM);
      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const selectTemplate = (name: string) => {
    setEventForm((prev) => ({ ...prev, event_name: name }));
  };

  const totalBudget = parseFloat(wedding?.total_budget || '0');
  const plannedBudget = parseFloat(summary?.planned_budget || '0');
  const totalSpent = parseFloat(summary?.total_spent || wedding?.total_spent || '0');
  const remaining = totalBudget - totalSpent;
  const allocatedPct = totalBudget > 0 ? Math.round((plannedBudget / totalBudget) * 100) : 0;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'events', label: 'Events', icon: <BsCalendarEvent /> },
    ...(isPlanner ? [{ key: 'income' as Tab, label: 'Income', icon: <BsCurrencyRupee /> }] : []),
    { key: 'budget', label: 'Budget', icon: <BsBarChartFill /> },
    { key: 'search', label: 'Search', icon: <BsSearch /> },
    ...(isPlanner ? [{ key: 'activity' as Tab, label: 'Activity', icon: <BsClockHistory /> }] : []),
  ];

  const handleGenerateShare = async () => {
    if (!id) return;
    setShareLoading(true);
    try {
      const data = await generateShareLink(id);
      setShareToken(data.share_token);
    } catch (err: any) {
      setError(err.message || 'Failed to generate share link');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/app/index.html?shared=${shareToken}`;
    navigator.clipboard.writeText(link);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const loadAuditLogs = async () => {
    if (!id) return;
    setAuditLoading(true);
    try {
      const data = await getAuditLogs(id);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (_) {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Income helpers
  const totalIncome = incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalReceived = incomes.reduce((s, i) => s + (parseFloat(i.amount_received) || 0), 0);
  const pendingIncome = totalIncome - totalReceived;

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIncomeSubmitting(true);
      await createIncome(id, {
        ...incomeForm,
        amount: parseFloat(incomeForm.amount) || 0,
        amount_received: parseFloat(incomeForm.amount_received) || 0,
        client_name: wedding?.wedding_name || '',
      });
      setIncomeForm({ amount: '', amount_received: '', description: '', payment_status: 'pending', payment_date: '', client_name: '' });
      setShowIncomeModal(false);
      const data = await getIncomes(id);
      setIncomes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to add income');
    } finally {
      setIncomeSubmitting(false);
    }
  };

  const handleDeleteIncome = async (incomeId: string) => {
    if (!id) return;
    try {
      await deleteIncome(incomeId);
      const data = await getIncomes(id);
      setIncomes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to delete income');
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
        <LoadingSpinner message="Loading wedding details..." />
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
        {/* Breadcrumb with back button */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors"
            title="Back to Weddings"
          >
            <BsArrowLeft className="text-lg" />
          </Link>
          <div className="text-sm text-white/40">
            <Link to="/" className="hover:text-white/60 transition-colors">
              Weddings
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">{wedding?.wedding_name || 'Wedding'}</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {wedding?.wedding_name}
              </h1>
              <button
                onClick={() => setEditingWedding(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                title="Edit wedding details"
              >
                <BsPencilSquare className="text-sm" />
              </button>
            </div>
            {(wedding?.bride_name || wedding?.groom_name) && (
              <p className="text-sm text-white/50 mt-1">
                {[wedding?.bride_name, wedding?.groom_name].filter(Boolean).join(' & ')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setShowShareModal(true); if (!shareToken) handleGenerateShare(); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-sm font-medium transition-colors"
            >
              <BsShareFill />
              Share
            </button>
            <Link
              to={`/wedding/${id}/invite`}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-sm font-medium transition-colors"
            >
              <BsPersonPlusFill />
              Invite
            </Link>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 text-sm"
            >
              <BsPlus className="text-lg" />
              Add Event
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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
            transition={{ delay: 0.15 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <BsListCheck className="text-blue-400 text-lg" />
              </div>
              <span className="text-sm text-white/50">Planned</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatINR(plannedBudget)}</p>
            <p className="text-xs text-white/40 mt-1">{allocatedPct}% allocated</p>
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
            <p className="text-2xl font-bold text-white">{formatINR(totalSpent)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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
            <p
              className={`text-2xl font-bold ${
                remaining >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatINR(Math.abs(remaining))}
              {remaining < 0 && (
                <span className="text-sm font-normal ml-1">over budget</span>
              )}
            </p>
          </motion.div>
        </div>

        {/* Budget Progress Bar — Planned vs Actual */}
        {totalBudget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 mb-8"
          >
            <div className="flex items-center justify-between text-xs text-white/50 mb-2">
              <span>Budget Utilization</span>
              <span>{spentPct}% spent · {allocatedPct}% planned</span>
            </div>
            {/* Planned bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-1.5">
              <div
                className="absolute inset-y-0 left-0 bg-blue-500/40 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(allocatedPct, 100)}%` }}
              />
            </div>
            {/* Spent bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                  spentPct > 100
                    ? 'bg-gradient-to-r from-red-500 to-red-400'
                    : 'bg-gradient-to-r from-primary to-accent'
                }`}
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500/50 inline-block" /> Planned ({allocatedPct}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-accent inline-block" /> Spent ({spentPct}%)
              </span>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'activity') loadAuditLogs();
                setActiveTab(tab.key as Tab);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary-300'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Events Tab Content */}
        {activeTab === 'events' && (
          <>
            {events.length === 0 ? (
              <EmptyState
                title="No events yet"
                description="Add your first event like Mehendi, Sangeet, or Reception to start tracking expenses."
                icon={<BsCalendarEvent />}
                action={
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25"
                  >
                    Add Your First Event
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {events.map((event: any, index: number) => (
                  <motion.div
                    key={event.ROWID}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <EventCard
                      event={event}
                      spent={parseFloat(event.total_spent || '0')}
                      expenseCount={parseInt(event.expense_count || '0', 10)}
                      onClick={() =>
                        navigate(`/wedding/${id}/event/${event.ROWID}`)
                      }
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Income Tab Content */}
        {activeTab === 'income' && isPlanner && (
          <>
            {/* Income summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Total Contract</p>
                <p className="text-xl font-bold text-white">{formatINR(totalIncome)}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Received</p>
                <p className="text-xl font-bold text-green-400">{formatINR(totalReceived)}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Pending</p>
                <p className="text-xl font-bold text-accent">{formatINR(pendingIncome)}</p>
              </div>
            </div>

            {/* Progress bar */}
            {totalIncome > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>{Math.round((totalReceived / totalIncome) * 100)}% received</span>
                  <span>{formatINR(totalReceived)} / {formatINR(totalIncome)}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all" style={{ width: `${Math.min(100, (totalReceived / totalIncome) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className="flex justify-end mb-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowIncomeModal(true)}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold rounded-xl shadow-lg text-sm"
              >
                <BsPlus className="text-lg" />
                Add Income Entry
              </motion.button>
            </div>

            {incomes.length === 0 ? (
              <EmptyState
                title="No income entries"
                description="Track payments received from this client."
                icon={<BsCurrencyRupee />}
                action={
                  <button onClick={() => setShowIncomeModal(true)} className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold rounded-xl shadow-lg">
                    Add First Income
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {incomes.map((income: any, index: number) => (
                  <motion.div
                    key={income.ROWID}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium">{income.description || 'Payment'}</p>
                      <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                        {income.payment_date && <span>{formatDate(income.payment_date)}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          income.payment_status === 'received' ? 'bg-green-500/20 text-green-400' :
                          income.payment_status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-white/10 text-white/50'
                        }`}>
                          {income.payment_status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-lg font-bold text-white">{formatINR(parseFloat(income.amount) || 0)}</p>
                        {parseFloat(income.amount_received) > 0 && parseFloat(income.amount_received) !== parseFloat(income.amount) && (
                          <p className="text-xs text-green-400">Received: {formatINR(parseFloat(income.amount_received) || 0)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingIncome(income)}
                        className="p-2 text-white/30 hover:text-primary-300 transition-colors"
                        title="Edit payment status"
                      >
                        <BsPencilSquare className="text-xs" />
                      </button>
                      <button
                        onClick={() => handleDeleteIncome(income.ROWID)}
                        className="p-2 text-white/30 hover:text-red-400 transition-colors"
                      >
                        <BsXLg className="text-xs" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Budget Tab Content (Inline) */}
        {activeTab === 'budget' && id && (
          <BudgetSummaryContent weddingId={id} />
        )}

        {/* Search Tab Content (Inline) */}
        {activeTab === 'search' && id && (
          <SearchExpensesContent weddingId={id} />
        )}

        {/* Activity Tab Content (Audit Logs) */}
        {activeTab === 'activity' && isPlanner && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Activity Log</h2>
              <button
                onClick={loadAuditLogs}
                className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white/70 transition-colors"
              >
                Refresh
              </button>
            </div>
            {auditLoading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-white/40 text-sm mt-3">Loading activity...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <BsClockHistory className="text-4xl text-white/10 mx-auto mb-3" />
                <p className="text-white/40">No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log: any, index: number) => (
                  <motion.div
                    key={log.ROWID}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-start gap-3"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      log.action === 'created' ? 'bg-green-500/20' :
                      log.action === 'deleted' ? 'bg-red-500/20' :
                      'bg-yellow-500/20'
                    }`}>
                      <BsClipboard2Check className={`text-xs ${
                        log.action === 'created' ? 'text-green-400' :
                        log.action === 'deleted' ? 'text-red-400' :
                        'text-yellow-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="text-white/50">{log.user_email}</span>
                        {' '}
                        <span className={`font-semibold ${
                          log.action === 'created' ? 'text-green-400' :
                          log.action === 'deleted' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>{log.action}</span>
                        {' '}
                        {log.entity_type}
                        {' '}
                        <span className="text-white font-medium">{log.entity_name}</span>
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{timeAgo(log.CREATEDTIME)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Share Modal ── */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
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
                  <h2 className="text-lg font-bold text-white">Share with Client</h2>
                  <button onClick={() => setShowShareModal(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <BsXLg />
                  </button>
                </div>
                <p className="text-sm text-white/50 mb-4">
                  Generate a read-only link to share budget details with your client. They won't need to log in.
                </p>
                {shareLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : shareToken ? (
                  <div>
                    <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg mb-3">
                      <input
                        readOnly
                        value={`${window.location.origin}/app/index.html?shared=${shareToken}`}
                        className="flex-1 bg-transparent text-white text-xs focus:outline-none truncate"
                      />
                      <button
                        onClick={handleCopyShareLink}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          shareCopied
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-primary/20 text-primary-300 hover:bg-primary/30'
                        }`}
                      >
                        {shareCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-white/30">
                      Anyone with this link can view the wedding budget (no income/profit data shown).
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateShare}
                    className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl"
                  >
                    Generate Share Link
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Income Modal ── */}
        <AnimatePresence>
          {showIncomeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowIncomeModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-dark-200 border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Add Income Entry</h2>
                  <button onClick={() => setShowIncomeModal(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <BsXLg />
                  </button>
                </div>
                <form onSubmit={handleIncomeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">Description *</label>
                    <input
                      value={incomeForm.description}
                      onChange={(e) => setIncomeForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Advance Payment"
                      required
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">Amount *</label>
                      <input
                        type="number"
                        value={incomeForm.amount}
                        onChange={(e) => setIncomeForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="e.g. 500000"
                        required min="0"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">Amount Received</label>
                      <input
                        type="number"
                        value={incomeForm.amount_received}
                        onChange={(e) => setIncomeForm(p => ({ ...p, amount_received: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">Payment Date</label>
                      <input
                        type="date"
                        value={incomeForm.payment_date}
                        onChange={(e) => setIncomeForm(p => ({ ...p, payment_date: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
                      <select
                        value={incomeForm.payment_status}
                        onChange={(e) => setIncomeForm(p => ({ ...p, payment_status: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors"
                      >
                        <option value="pending">Pending</option>
                        <option value="received">Received</option>
                        <option value="partial">Partial</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowIncomeModal(false)} className="px-5 py-2.5 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={incomeSubmitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {incomeSubmitting ? 'Adding...' : 'Add Income'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Event Modal ── */}
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
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Add Event</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <BsXLg />
                  </button>
                </div>

                {/* Template suggestions */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-white/50 mb-2">
                    Quick Templates
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl}
                        type="button"
                        onClick={() => selectTemplate(tmpl)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          eventForm.event_name === tmpl
                            ? 'bg-primary/20 border-primary/40 text-primary-300'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                        }`}
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleEventSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Event Name *
                    </label>
                    <input
                      name="event_name"
                      value={eventForm.event_name}
                      onChange={handleEventFormChange}
                      placeholder="e.g. Mehendi Ceremony"
                      required
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Event Date
                      </label>
                      <input
                        type="date"
                        name="event_date"
                        value={eventForm.event_date}
                        onChange={handleEventFormChange}
                        min={wedding?.start_date || wedding?.wedding_date || ''}
                        max={wedding?.end_date || wedding?.start_date || ''}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors [color-scheme:dark]"
                      />
                      {(wedding?.start_date || wedding?.wedding_date) && (
                        <p className="text-xs text-white/30 mt-1">
                          Must be between {formatDate(wedding?.start_date || wedding?.wedding_date)} and {formatDate(wedding?.end_date || wedding?.start_date || wedding?.wedding_date)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Event Budget
                      </label>
                      <input
                        type="number"
                        name="event_budget"
                        value={eventForm.event_budget}
                        onChange={handleEventFormChange}
                        placeholder="e.g. 500000"
                        min="0"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Venue
                    </label>
                    <input
                      name="venue"
                      value={eventForm.venue}
                      onChange={handleEventFormChange}
                      placeholder="e.g. Grand Palace Hall, Jaipur"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>

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
                      {submitting ? 'Creating...' : 'Create Event'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Edit Income Modal */}
      {editingIncome && (
        <EditIncomeModal
          income={editingIncome}
          isOpen={!!editingIncome}
          onClose={() => setEditingIncome(null)}
          onSaved={() => fetchData()}
        />
      )}

      {/* Edit Wedding Modal */}
      {editingWedding && wedding && (
        <EditWeddingModal
          wedding={wedding}
          isOpen={editingWedding}
          onClose={() => setEditingWedding(false)}
          onSaved={() => fetchData()}
        />
      )}
    </Layout>
  );
};

export default WeddingDetail;
