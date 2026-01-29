import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';

import Home from './pages/Home';
import Login from './pages/Login';
import SignupChoice from './pages/SignupChoice';
import SignupClient from './pages/SignupClient';
import SignupProfessional from './pages/SignupProfessional';
import Dashboard from './pages/Dashboard';
import Vitrine from './pages/Vitrine';
import ClientArea from './pages/ClientArea';

const isValidType = (t) => t === 'client' || t === 'professional';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchType(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('type')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return isValidType(data?.type) ? data.type : null;
}

async function ensureProfileRow(authUser) {
  const userId = authUser.id;
  const email = authUser.email || '';
  const meta = authUser.user_metadata || {};
  const type = isValidType(meta.type) ? meta.type : 'client';
  const nome = meta.nome || null;

  await supabase
    .from('users')
    .upsert([{ id: userId, email, type, nome }], { onConflict: 'id' });
}

async function getUserTypeWithRetryAndHeal(authUser) {
  for (let i = 0; i < 6; i++) {
    const t = await fetchType(authUser.id);
    if (t) return t;
    await sleep(300);
  }

  await ensureProfileRow(authUser);

  for (let i = 0; i < 10; i++) {
    const t = await fetchType(authUser.id);
    if (t) return t;
    await sleep(400);
  }

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!session?.user) {
          if (!mounted) return;
          setUser(null);
          setUserType(null);
          setLoading(false);
          return;
        }

        const type = await getUserTypeWithRetryAndHeal(session.user);

        if (!mounted) return;

        // ✅ aqui é o ponto: se não tiver type, NÃO fica "meio logado"
        if (!type) {
          setUser(null);
          setUserType(null);
        } else {
          setUser(session.user);
          setUserType(type);
        }
      } catch (e) {
        if (!mounted) return;
        setUser(null);
        setUserType(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        const type = await getUserTypeWithRetryAndHeal(session.user);

        if (!type) {
          setUser(null);
          setUserType(null);
          return;
        }

        setUser(session.user);
        setUserType(type);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
      }
    });

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

  const isLoggedIn = !!user && !!userType;

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
        <Route path="/" element={<Home user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} onLogout={handleLogout} />} />

        <Route
          path="/login"
          element={
            isLoggedIn
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={
            isLoggedIn
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <SignupChoice />
          }
        />

        <Route
          path="/cadastro/cliente"
          element={
            isLoggedIn && userType === 'client'
              ? <Navigate to="/minha-area" />
              : <SignupClient onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro/profissional"
          element={
            isLoggedIn && userType === 'professional'
              ? <Navigate to="/dashboard" />
              : <SignupProfessional onLogin={handleLogin} />
          }
        />

        <Route
          path="/dashboard"
          element={
            isLoggedIn && userType === 'professional'
              ? <Dashboard user={user} onLogout={handleLogout} />
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/minha-area"
          element={
            isLoggedIn && userType === 'client'
              ? <ClientArea user={user} onLogout={handleLogout} />
              : <Navigate to="/login" />
          }
        />

        <Route path="/v/:slug" element={<Vitrine user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} />} />
      </Routes>
    </Router>
  );
}
