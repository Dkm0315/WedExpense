import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsStars, BsCheckCircleFill, BsXLg } from 'react-icons/bs';

declare const catalyst: any;

const Login: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupForm, setSignupForm] = useState({ first_name: '', last_name: '', email: '' });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  useEffect(() => {
    if (mode !== 'signin') return;

    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        const container = document.getElementById('login-container');
        if (container) container.innerHTML = '';

        catalyst.auth.signIn('login-container', {
          service_url: '/app/index.html',
        });
      } else {
        // SDK not loaded — show dev hint
        const container = document.getElementById('login-container');
        if (container) {
          container.innerHTML = '<div style="text-align:center;padding:32px;color:#666;font-size:14px;">Catalyst SDK not loaded.<br/>Use <code>catalyst serve</code> or append <code>?dev=1</code> to bypass auth.</div>';
        }
      }
    } catch (err) {
      console.error('Failed to initialize Catalyst auth:', err);
    }

    const style = document.createElement('style');
    style.textContent = `
      #login-container iframe {
        width: 100% !important;
        min-height: 380px !important;
        border: none !important;
        border-radius: 12px !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [mode]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupForm.email.trim() || !signupForm.last_name.trim()) return;

    try {
      setSignupLoading(true);
      setSignupError('');
      setSignupSuccess('');

      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        // Intercept fetch to capture signup response status
        let signupStatus = 0;
        const origFetch = window.fetch.bind(window);
        (window as any).fetch = async function (input: any, init?: any) {
          const resp = await origFetch(input, init);
          const url = typeof input === 'string' ? input : input?.url || '';
          if (url.includes('/auth/signup')) signupStatus = resp.status;
          return resp;
        };

        try {
          await catalyst.auth.signUp({
            first_name: signupForm.first_name.trim(),
            last_name: signupForm.last_name.trim(),
            email_id: signupForm.email.trim(),
            platform_type: 'web',
            redirect_url: window.location.origin + '/app/index.html',
          });

          if (signupStatus >= 400) {
            setSignupError(
              signupStatus === 409
                ? 'This email is already registered. Please sign in instead.'
                : 'This email is already registered. Please sign in instead.'
            );
          } else {
            setSignupSuccess('Account created! Check your email for a verification link, then sign in.');
            setSignupForm({ first_name: '', last_name: '', email: '' });
          }
        } finally {
          window.fetch = origFetch;
        }
      } else {
        setSignupError('Authentication SDK not loaded. Please refresh and try again.');
      }
    } catch (err: any) {
      const msg = err?.message || err?.toString() || 'Signup failed. Please try again.';
      setSignupError(msg);
    } finally {
      setSignupLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-dark to-dark-100" />

      {/* Decorative orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl">
          {/* Sparkle icon */}
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
              <BsStars className="text-white text-2xl" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-center bg-gradient-to-r from-primary-300 to-accent bg-clip-text text-transparent mb-1"
          >
            WedExpense
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center text-white/50 text-sm mb-6"
          >
            Track Every Rupee of Your Dream Wedding
          </motion.p>

          {/* Sign-in: Zoho embedded iframe — always in DOM, hidden when signup */}
          <div
            id="login-container"
            className="rounded-xl overflow-hidden"
            style={{ minHeight: mode === 'signin' ? 380 : 0, display: mode === 'signin' ? 'block' : 'none' }}
          />

          {mode === 'signup' && (
            /* Sign-up: Custom form */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-white mb-4">Create your account</h2>

              <AnimatePresence>
                {signupError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center justify-between"
                  >
                    {signupError}
                    <button onClick={() => setSignupError('')} className="ml-2"><BsXLg /></button>
                  </motion.div>
                )}
                {signupSuccess && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2"
                  >
                    <BsCheckCircleFill className="flex-shrink-0" />
                    {signupSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">First Name</label>
                    <input
                      value={signupForm.first_name}
                      onChange={(e) => setSignupForm(p => ({ ...p, first_name: e.target.value }))}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">Last Name *</label>
                    <input
                      value={signupForm.last_name}
                      onChange={(e) => setSignupForm(p => ({ ...p, last_name: e.target.value }))}
                      placeholder="Last name"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1">Email *</label>
                  <input
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                    className={inputClass}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={signupLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {signupLoading ? 'Creating account...' : 'Sign Up'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* Toggle Sign In / Sign Up */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-4"
          >
            {mode === 'signin' ? (
              <p className="text-white/40 text-sm">
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-primary-300 hover:text-primary-200 font-medium transition-colors"
                >
                  Sign up for free
                </button>
              </p>
            ) : (
              <p className="text-white/40 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setSignupError(''); setSignupSuccess(''); }}
                  className="text-primary-300 hover:text-primary-200 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </motion.div>
        </div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-white/30 text-xs mt-6"
        >
          Powered by Zoho Catalyst
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
