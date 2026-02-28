import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsPersonPlusFill,
  BsXLg,
  BsCheckCircleFill,
  BsEnvelopeFill,
  BsArrowLeft,
} from 'react-icons/bs';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { getWedding, inviteUser, getCurrentUser } from '../api/client';

declare const catalyst: any;

interface InviteForm {
  email: string;
  first_name: string;
  last_name: string;
}

const INITIAL_FORM: InviteForm = {
  email: '',
  first_name: '',
  last_name: '',
};

const InviteMembers: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();
  const navigate = useNavigate();

  const [wedding, setWedding] = useState<any>(null);
  const [form, setForm] = useState<InviteForm>(INITIAL_FORM);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!wid) return;
    Promise.all([
      getWedding(wid),
      getCurrentUser().catch(() => null),
    ])
      .then(([w, u]) => {
        setWedding(w);
        if (u?.first_name) setUserName(u.first_name);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setPageLoading(false));
  }, [wid]);

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
    if (!form.email.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await inviteUser({
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        wedding_id: wid,
      });
      setSuccess(`Invitation sent to ${form.email}!`);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (pageLoading) {
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
        className="max-w-lg mx-auto"
      >
        {/* Breadcrumb with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors"
            title="Go back"
          >
            <BsArrowLeft className="text-lg" />
          </button>
          <div className="text-sm text-white/40">
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
            <span className="text-white/70">Invite Members</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <BsPersonPlusFill className="text-primary-300 text-xl" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Invite Members
            </h1>
            <p className="text-sm text-white/50">
              Invite family members or coordinators to collaborate
            </p>
          </div>
        </div>

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
              <BsCheckCircleFill />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invite Form */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <BsEnvelopeFill className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="member@example.com"
                  required
                  className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  First Name
                </label>
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Last Name
                </label>
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                'Sending...'
              ) : (
                <>
                  <BsPersonPlusFill />
                  Send Invitation
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
          <p className="text-xs text-white/40 leading-relaxed">
            The invited member will receive an email with a link to join this wedding's expense tracking.
            They will be able to view and add expenses but won't have admin access.
          </p>
        </div>
      </motion.div>
    </Layout>
  );
};

export default InviteMembers;
