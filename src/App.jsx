import React, { useState, useEffect, useRef } from 'react';
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

const withTimeout = (promise, ms, label = 'timeout') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${label}) em ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

async function fetchType(userId) {
  const { data, error } = await withTimeout(
    supabase.from('users').select('type').eq('id', userId).maybeSingle(),
    6000,
    'fetchType'
  );
  if (error) return null;
  return isValidType(data?.type) ? data.type : null;
}

async function ensureProfileRow(authUser) {
  // se o trigger já cria, isso só “garante”
  try {
    const userId = authUser.id;
    const email = authUser.email || '';
    const meta = authUser.user_metadata || {};
    const type = isValidType(meta.type) ? meta.type : 'client';
    const nome = meta.nome || null;

    await withTimeout(
      supabase.from('users').upsert([{ id: userId, email, type, nome }], { onConflict: 'id' }),
      6000,
      'ensureProfileRow'
    );
  } catch {
    // não derruba o app
  }
}

async function getUserTypeSafe(authUser) {
  const t1 = await fetchType(authUser.id);
  if (t1) return t1;

  await ensureProfileRow(authUser);

  const t2 = await fetchType(authUser.id);
  if (t2) return t2;

  return null;
}

function FullScreenLoading({ text = 'Carregando...' }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-primary text-xl font-bold">{text}</div>
      </div>
    </div>
  );
}

function FullScreenError({ message, onRetry }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-100 border border-red-500/40 rounded-custom p-8 text-center">
        <h1 className="text-2xl font-black text-white mb-2">Algo deu errado</h1>
        <p className="text-gray-400 mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // evita reentrância em DEV (especialmente se você esquecer o StrictMode)
  const hydratingRef = useRef(false);

  const hydrate = async () => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;

    setLoading(true);
    setFatalError(null);

    try {
      const { data, error } = await withTimeout(supabase.auth.getSession(), 8000, 'getSession');
      if (error) throw error;

      const sessionUser = data?.session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        return;
      }

      setUser(sessionUser);

      const type = await getUserTypeSafe(sessionUser);
      if (!type) {
        // NÃO faz signOut aqui (isso cria loop). Só mostra erro e deixa tentar de novo.
        setUser(sessionUser);
        setUserType(null);
        setFatalError(
          'Seu perfil não foi encontrado no banco (public.users.type). ' +
          'Verifique trigger/policies e tente novamente.'
        );
        return;
      }

      setUserType(type);
    } catch (e) {
      setUser(null);
      setUserType(null);
      setFatalError(e?.message || 'Falha ao iniciar sessão.');
    } finally {
      setLoading(false);
      hydratingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      if (!mounted) return;
      await hydrate();
    };

    start();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const sessionUser = session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        return;
      }

      setUser(sessionUser);

      const type = await getUserTypeSafe(sessionUser);
      if (!type) {
        setUserType(null);
        setFatalError(
          'Seu perfil não foi encontrado no banco após login. ' +
          'Verifique trigger/policies (public.users) e tente novamente.'
        );
        return;
      }

      setUserType(type);
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(isValidType(type) ? type : null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
  };

  // ✅ aqui é CRÍTICO:
  const isLoggedIn = !!user && !!userType;

  if (loading) return <FullScreenLoading />;

  if (fatalError) {
    return <FullScreenError message={fatalError} onRetry={hydrate} />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<Home user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} onLogout={handleLogout} />}
        />

        <Route
          path="/login"
          element={
            isLoggedIn
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} replace />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={
            isLoggedIn
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} replace />
              : <SignupChoice />
          }
        />

        <Route
          path="/cadastro/cliente"
          element={
            isLoggedIn && userType === 'client'
              ? <Navigate to="/minha-area" replace />
              : <SignupClient onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro/profissional"
          element={
            isLoggedIn && userType === 'professional'
              ? <Navigate to="/dashboard" replace />
              : <SignupProfessional onLogin={handleLogin} />
          }
        />

        <Route
          path="/dashboard"
          element={
            isLoggedIn && userType === 'professional'
              ? <Dashboard user={user} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/minha-area"
          element={
            isLoggedIn && userType === 'client'
              ? <ClientArea user={user} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />

        {/* VITRINE SEMPRE PÚBLICA */}
        <Route
          path="/v/:slug"
          element={<Vitrine user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
