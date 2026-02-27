import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WeddingDetail from './pages/WeddingDetail';
import EventDetail from './pages/EventDetail';
import AddExpense from './pages/AddExpense';
import BudgetSummary from './pages/BudgetSummary';
import SearchExpenses from './pages/SearchExpenses';
import InviteMembers from './pages/InviteMembers';
import SharedWeddingView from './pages/SharedWeddingView';

declare const catalyst: any;

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sharedToken, setSharedToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Shared link: ?shared=TOKEN — works even without SPA routing
    const shared = params.get('shared');
    if (shared) {
      setSharedToken(shared);
      setAuthChecked(true);
      return;
    }

    // Dev bypass: ?dev=1 skips auth check for local testing
    if (params.get('dev') === '1') {
      setIsAuthenticated(true);
      setAuthChecked(true);
      return;
    }
    // Check if user is authenticated via Catalyst SDK
    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        catalyst.auth
          .isUserAuthenticated()
          .then(() => {
            setIsAuthenticated(true);
            setAuthChecked(true);
          })
          .catch(() => {
            setIsAuthenticated(false);
            setAuthChecked(true);
          });
      } else {
        // SDK not loaded (local dev without catalyst serve auth)
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    } catch {
      setIsAuthenticated(false);
      setAuthChecked(true);
    }
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="text-white/50 text-lg">Loading...</div>
      </div>
    );
  }

  // Shared link via query param — render directly without router
  if (sharedToken) {
    return <SharedWeddingView tokenOverride={sharedToken} />;
  }

  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:id"
          element={
            isAuthenticated ? <WeddingDetail /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/event/:eid"
          element={
            isAuthenticated ? <EventDetail /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/add-expense"
          element={
            isAuthenticated ? <AddExpense /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/event/:eid/add-expense"
          element={
            isAuthenticated ? <AddExpense /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/budget"
          element={
            isAuthenticated ? <BudgetSummary /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/search"
          element={
            isAuthenticated ? <SearchExpenses /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/wedding/:wid/invite"
          element={
            isAuthenticated ? <InviteMembers /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/shared/:token"
          element={<SharedWeddingView />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
