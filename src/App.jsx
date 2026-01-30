import React, { useEffect, useRef, useState } from 'react';
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

        <button
          onClick={() => window.location.href = '/login'}
          className="w-full mt-3 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-button font-bold"
        >
          Ir para Login
        </button>
      </div>
    </div>
  );
}

/**
 * getSession robusto:
 * - tenta 2 vezes
 * - timeout maior
 * - se falhar, não derruba tudo, só volta como "sem sessão"
 */
async function safeGetSession() {
  const attempt = async (ms) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      // supabase-js não aceita AbortController diretamente aqui,
      // então usamos apenas timeout lógico por Promise.race:
      const p = supabase.auth.getSession();
      const r = await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('getSession_timeout')), ms)),
      ]);
      return r;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await attempt(12000);
  } catch {
    // segunda tentativa curta
    try {
      return await attempt(6000);
    } catch {
      return { data: { session: null }, error: null };
    }
  }
}

async function fetchUserType(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('type')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return isValidType(data?.type) ? data.type : null;
  } catch {
    return null;
  }
}

async function ensureProfileRow(authUser) {
  try {
    const userId = authUser.id;
    const email = authUser.email || '';
    const meta = authUser.user_metadata || {};
    const type = isValidType(meta.type) ? meta.type : 'client';
    const nome = meta.nome || null;

    await supabase
      .from('users')
      .upsert([{ id: userId, email, type, nome }], { onConflict: 'id' });
  } catch {
    // silencioso: não derruba o app
  }
}

async function getUserTypeSafe(authUser) {
  const t1 = await fetchUserType(authUser.id);
  if (t1) return t1;

  await ensureProfileRow(authUser);

  const t2 = await fetchUserType(authUser.id);
  if (t2) return t2;

  // se não achou, devolve null (mas não dá signOut automático aqui)
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  const hydratingRef = useRef(false);

  const hydrate = async () => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;

    setLoading(true);
    setFatalError(null);

    try {
      const { data, error } = await safeGetSession();
      if (error) throw error;

      const sessionUser = data?.session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        setLoading(false);
        hydratingRef.current = false;
        return;
      }

      setUser(sessionUser);

      const type = await getUserTypeSafe(sessionUser);

      // Se não achou type, ainda assim mantém logado, mas manda pro login quando tentar rotas privadas
      setUserType(type);
      setLoading(false);
    } catch (e) {
      setUser(null);
      setUserType(null);
      setLoading(false);
      setFatalError(e?.message || 'Timeout ao iniciar sessão.');
    } finally {
      hydratingRef.current = false;
    }
  };

  useEffect(() => {
    hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        return;
      }

      setUser(sessionUser);
      const type = await getUserTypeSafe(sessionUser);
      setUserType(type);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(isValidType(type) ? type : null);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setUserType(null);
    }
  };

  const isLoggedIn = !!user;

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
            isLoggedIn && userType
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={
            isLoggedIn && userType
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

        <Route
          path="/v/:slug"
          element={<Vitrine user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} />}
        />
      </Routes>
    </Router>
  );
}
