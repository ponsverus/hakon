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

function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function fetchType(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('type')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return isValidType(data?.type) ? data.type : null;
}

/**
 * IMPORTANTE:
 * Se sua RLS em public.users NÃO permite insert/upsert pelo cliente,
 * este "heal" pode falhar (e tudo bem).
 * O ideal é o trigger do auth.users criar a linha.
 */
async function ensureProfileRow(authUser) {
  const userId = authUser.id;
  const email = authUser.email || '';
  const meta = authUser.user_metadata || {};
  const type = isValidType(meta.type) ? meta.type : 'client';
  const nome = meta.nome || null;

  // tentamos, mas se RLS bloquear, não trava o app
  try {
    await supabase
      .from('users')
      .upsert([{ id: userId, email, type, nome }], { onConflict: 'id' });
  } catch {
    // ignora
  }
}

async function getUserTypeWithRetryAndHeal(authUser) {
  // 1) tenta achar type por alguns ciclos
  for (let i = 0; i < 6; i++) {
    const t = await fetchType(authUser.id);
    if (t) return t;
    await sleep(250);
  }

  // 2) tenta “curar” criando linha (pode falhar por RLS)
  await ensureProfileRow(authUser);

  // 3) tenta novamente
  for (let i = 0; i < 10; i++) {
    const t = await fetchType(authUser.id);
    if (t) return t;
    await sleep(350);
  }

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);

  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      setBootError(null);

      try {
        // ✅ Watchdog: se auth travar, cai fora
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'Falha ao carregar sessão (timeout)'
        );

        if (error) throw error;

        const session = data?.session;

        if (!session?.user) {
          if (!mounted) return;
          setUser(null);
          setUserType(null);
          setLoading(false);
          return;
        }

        // ✅ Watchdog: se buscar type travar, cai fora
        const type = await withTimeout(
          getUserTypeWithRetryAndHeal(session.user),
          8000,
          'Falha ao carregar tipo do usuário (timeout)'
        );

        if (!mounted) return;

        // Se não achou type, não deixa “meio logado”
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
        setBootError(e?.message || 'Erro ao iniciar o app');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          const type = await withTimeout(
            getUserTypeWithRetryAndHeal(session.user),
            8000,
            'Falha ao carregar tipo após login (timeout)'
          );

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
      } catch (e) {
        setUser(null);
        setUserType(null);
        setBootError(e?.message || 'Erro no estado de autenticação');
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

  // ✅ Nunca trava: ou mostra carregando, ou mostra erro, ou mostra app
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-xl font-bold">Carregando...</div>
          <div className="text-gray-500 text-sm mt-2">Se demorar, vai aparecer erro automaticamente.</div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-100 border border-red-500/40 rounded-custom p-6 text-center">
          <h1 className="text-2xl font-black text-white mb-2">Erro ao iniciar</h1>
          <p className="text-gray-400 mb-4">{bootError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={isLoggedIn ? user : null}
              userType={isLoggedIn ? userType : null}
              onLogout={handleLogout}
            />
          }
        />

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

        {/* Vitrine é pública: logado ou não, entra */}
        <Route
          path="/v/:slug"
          element={<Vitrine user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} />}
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
