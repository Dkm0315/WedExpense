import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BsArrowLeft } from 'react-icons/bs';
import Layout from '../components/Layout';
import BudgetSummaryContent from '../components/BudgetSummaryContent';
import LoadingSpinner from '../components/LoadingSpinner';
import { getWedding, getCurrentUser } from '../api/client';

declare const catalyst: any;

const BudgetSummary: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();
  const navigate = useNavigate();
  const [wedding, setWedding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      .catch(() => {})
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <Layout userName={userName} onLogout={handleLogout} weddingName={wedding?.wedding_name}>
        <LoadingSpinner message="Loading budget summary..." />
      </Layout>
    );
  }

  return (
    <Layout userName={userName} onLogout={handleLogout} weddingName={wedding?.wedding_name}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors"
            title="Go back"
          >
            <BsArrowLeft className="text-lg" />
          </button>
          <div className="text-sm text-white/40">
            <Link to="/" className="hover:text-white/60 transition-colors">Weddings</Link>
            <span className="mx-2">/</span>
            <Link to={`/wedding/${wid}`} className="hover:text-white/60 transition-colors">
              {wedding?.wedding_name || 'Wedding'}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">Budget Summary</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Budget Summary</h1>
        {wid && <BudgetSummaryContent weddingId={wid} />}
      </motion.div>
    </Layout>
  );
};

export default BudgetSummary;
