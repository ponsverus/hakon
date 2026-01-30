import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
        <p className="text-gray-400 mb-6 whitespace-pre-wrap">{message}</p>
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

// --- BUSCA TIPO COM RETRY + CACHE ---
async function fetchTypeFromDB(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('type')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const t = data?.type;
  return isValidType(t) ? t : null;
}

async function ensureProfileRow(authUser) {
  const userId = authUser.id;
  const email = authUser.email || null;
  const meta = authUser.user_metadata || {};
  const type = isValidType(meta.type) ? meta.type : 'client';
  const nome = meta.nome || null;

  // Observação: email pode ser null em alguns provedores. Se seu schema exige NOT NULL,
  // mantenha como string vazia NÃO, melhor manter o schema aceitando null ou garantir email.
  await supabase
    .from('users')
    .upsert([{ id: userId, email: email || '', type, nome }], { onConflict: 'id' });
}

async function getUserTypeRobust(authUser) {
  const cacheKey = `hakon:type:${authUser.id}`;
  const cached = localStorage.getItem(cacheKey);
  if (isValidType(cached)) return cached;

  // tenta 3 vezes buscar do banco
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const t = await fetchTypeFromDB(authUser.id);
      if (t) {
        localStorage.setItem(cacheKey, t);
        return t;
      }
      // se não achou, tenta criar linha e buscar de novo
      await ensureProfileRow(authUser);
      const t2 = await fetchTypeFromDB(authUser.id);
      if (t2) {
        localStorage.setItem(cacheKey, t2);
        return t2;
      }
      return null;
    } catch (e) {
      lastErr = e;
      // espera um pouco e tenta de novo (evita instabilidade / rede / RLS cache)
      await sleep(400 * (i + 1));
    }
  }

  // se falhar tudo, não desloga, só retorna null e deixa UI decidir
  throw lastErr || new Error('Falha ao obter tipo do usuário.');
}

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);

  const [booting, setBooting] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  const isLoggedIn = !!user;

  const hydrate = async () => {
    setBooting(true);
    setFatalError(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const sessionUser = data?.session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        setBooting(false);
        return;
      }

      setUser(sessionUser);

      // Aqui é a diferença: NÃO fazemos signOut se falhar.
      // Se falhar, mostramos erro e mantemos a sessão.
      try {
        const type = await getUserTypeRobust(sessionUser);
        setUserType(type);
      } catch (e) {
        setUserType(null);
        setFatalError(
          'Sua sessão existe, mas falhou ao carregar seu perfil (type).\n' +
          'Isso geralmente é instabilidade de rede/RLS/timeout.\n\n' +
          `Detalhe: ${e?.message || 'erro desconhecido'}`
        );
      }

      setBooting(false);
    } catch (e) {
      setUser(null);
      setUserType(null);
      setBooting(false);
      setFatalError(e?.message || 'Falha ao iniciar sessão.');
    }
  };

  useEffect(() => {
    let alive = true;

    const start = async () => {
      await hydrate();
    };

    start();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;

      const sessionUser = session?.user || null;

      if (!sessionUser) {
        setUser(null);
        setUserType(null);
        setFatalError(null);
        return;
      }

      setUser(sessionUser);

      // Em SIGNED_IN / TOKEN_REFRESHED, tenta pegar type sem derrubar
      try {
        const type = await getUserTypeRobust(sessionUser);
        setUserType(type);
        setFatalError(null);
      } catch (e) {
        setUserType(null);
        setFatalError(
          'Logado, mas não consegui carregar seu tipo (client/professional).\n\n' +
          `Detalhe: ${e?.message || ''}`
        );
      }
    });

    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(isValidType(type) ? type : null);

    // cache imediato ajuda no F5
    if (userData?.id && isValidType(type)) {
      localStorage.setItem(`hakon:type:${userData.id}`, type);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setUserType(null);
      setFatalError(null);
    }
  };

  if (booting) return <FullScreenLoading />;

  if (fatalError) {
    return <FullScreenError message={fatalError} onRetry={hydrate} />;
  }

  return (
    <Router>
      <ScrollToTopOnRouteChange />
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
