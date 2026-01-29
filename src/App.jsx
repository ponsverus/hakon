import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';

// Páginas
import Home from './pages/Home';
import Login from './pages/Login';
import SignupChoice from './pages/SignupChoice';
import SignupClient from './pages/SignupClient';
import SignupProfessional from './pages/SignupProfessional';
import Dashboard from './pages/Dashboard';
import Vitrine from './pages/Vitrine';
import ClientArea from './pages/ClientArea';

const isValidType = (t) => t === 'client' || t === 'professional';

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setUserType(null);
        return;
      }

      const u = session.user;
      setUser(u);

      // ✅ Fonte primária: metadata (não depende de RLS)
      const metaType = u.user_metadata?.type;
      if (isValidType(metaType)) {
        setUserType(metaType);
        return;
      }

      // ✅ Fallback: tabela public.users
      try {
        const { data, error } = await supabase
          .from('users')
          .select('type')
          .eq('id', u.id)
          .maybeSingle();

        if (!error && isValidType(data?.type)) {
          setUserType(data.type);
        } else {
          setUserType(null);
        }
      } catch {
        setUserType(null);
      }
    };

    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ✅ garante que refresh/initial não bagunça o estado
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserType(null);
          return;
        }

        // SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION
        await applySession(session);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(type);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-xl font-bold">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} userType={userType} onLogout={handleLogout} />} />

        <Route
          path="/login"
          element={
            user
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={
            user
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <SignupChoice />
          }
        />

        <Route
          path="/cadastro/cliente"
          element={user ? <Navigate to="/minha-area" /> : <SignupClient onLogin={handleLogin} />}
        />

        <Route
          path="/cadastro/profissional"
          element={user ? <Navigate to="/dashboard" /> : <SignupProfessional onLogin={handleLogin} />}
        />

        <Route
          path="/dashboard"
          element={
            user && userType === 'professional'
              ? <Dashboard user={user} onLogout={handleLogout} />
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/minha-area"
          element={
            user && userType === 'client'
              ? <ClientArea user={user} onLogout={handleLogout} />
              : <Navigate to="/login" />
          }
        />

        <Route path="/v/:slug" element={<Vitrine user={user} userType={userType} />} />
      </Routes>
    </Router>
  );
}
