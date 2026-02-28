import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BsStars, BsPersonCircle, BsBoxArrowRight, BsList, BsX } from 'react-icons/bs';
import AIFloatingChat from './AIFloatingChat';

interface LayoutProps {
  children: React.ReactNode;
  userName?: string;
  onLogout?: () => void;
  weddingName?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, userName, onLogout, weddingName }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get wedding ID from any route that has :id or :wid
  const params = useParams<{ id?: string; wid?: string }>();
  const weddingId = params.id || params.wid;

  return (
    <div className="min-h-screen bg-dark text-white font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/5 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo — clickable, goes to Dashboard */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <BsStars className="text-accent text-2xl" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary-300 to-accent bg-clip-text text-transparent">
                WedExpense
              </span>
            </Link>

            {/* Desktop profile button */}
            <div className="hidden sm:block relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <BsPersonCircle className="text-primary-300 text-xl" />
                {userName && (
                  <span className="text-sm text-white/80">{userName}</span>
                )}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-dark-200 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg overflow-hidden"
                  >
                    {userName && (
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-medium text-white">{userName}</p>
                      </div>
                    )}
                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <BsBoxArrowRight />
                        Sign out
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {mobileMenuOpen ? (
                <BsX className="text-xl" />
              ) : (
                <BsList className="text-xl" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden overflow-hidden border-t border-white/10"
            >
              <div className="px-4 py-3 space-y-2">
                {userName && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <BsPersonCircle className="text-primary-300 text-xl" />
                    <span className="text-sm text-white/80">{userName}</span>
                  </div>
                )}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <BsBoxArrowRight />
                    Sign out
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* ── Floating AI Chat ── */}
      <AIFloatingChat weddingId={weddingId} weddingName={weddingName} />
    </div>
  );
};

export default Layout;
