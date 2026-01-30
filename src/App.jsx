import React, { useState, useEffect, useMemo } from 'react';
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

const withTimeout = (promise, ms, label = 'request') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout em ${label} (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

async function retry(fn, { tries = 4, baseDelay = 250, label = 'retry' } = {}) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      const wait = baseDelay * Math.pow(2, i);
      // eslint-disable-next-line no-console
      console.warn(`[${label}] tentativa ${i + 1}/${tries} falhou:`, e?.message || e);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function fetchType(userId) {
  // importante: timeout pra não “pendurar”
  const { data, error } = await withTimeout(
    supabase.from('users').select('type').eq('id', userId).maybeSingle(),
    6000,
    'fetchType(users)'
  );

  if (error) return null;
  return isValidType(data?.type) ? data.type : null;
}

async function ensureProfileRow(authUser) {
  const userId = authUser.id;
  const email = authUser.email || '';
  const meta = authUser.user_metadata || {};
  const type = isValidType(meta.type) ? meta.type : 'client';
  const nome = meta.nome || null;

  const { error } = await withTimeout(
    supabase.from('users').upsert([{ id: userId, email, type, nome }], { onConflict: 'id' }),
    6000,
    'ensureProfileRow(upsert users)'
  );

  if (error) throw error;
}

async function getUserTypeReliable(authUser, setBootStep) {
  // 1) tenta buscar type (normal)
  setBootStep('Buscando tipo do usuário...');
  const type1 = await retry(() => fetchType(authUser.id), { tries: 3, baseDelay: 200, label: 'fetchType' });
  if (type1) return type1;

  // 2) se não existe/está vazio, tenta “curar” (criar/atualizar row users)
  setBootStep('Reparando perfil do usuário...');
  await retry(() => ensureProfileRow(authUser), { tries: 2, baseDelay: 300, label: 'ensureProfileRow' });

  // 3) tenta buscar novamente
  setBootStep('Confirmando tipo do usuário...');
  const type2 = await retry(() => fetchType(authUser.id), { tries: 5, baseDelay: 250, label: 'fetchType-after-heal' });
  return type2 || null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);

  const [loading, setLoading] = useState(true);

  // diagnóstico real (para você ver em tela onde travou)
  const [bootStep, setBootStep] = useState('Iniciando...');
  const [bootError, setBootError] = useState(null);

  const isLoggedIn = useMemo(() => !!user && !!userType, [user, userType]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      setBootError(null);

      try {
        setBootStep('Lendo sessão...');
        const sessionRes = await withTimeout(supabase.auth.getSession(), 7000, 'auth.getSession');
        const session = sessionRes?.data?.session;

        if (!mounted) return;

        if (!session?.user) {
          setUser(null);
          setUserType(null);
          setBootStep('Sem sessão (deslogado).');
          return;
        }

        setBootStep('Sessão encontrada. Validando tipo...');
        const type = await getUserTypeReliable(session.user, setBootStep);

        if (!mounted) return;

        // se não conseguir o type, NÃO trava o app: desloga estado local
        if (!type) {
          setUser(null);
          setUserType(null);
          setBootStep('Falha ao validar tipo. Estado limpo.');
          return;
        }

        setUser(session.user);
        setUserType(type);
        setBootStep('Pronto ✅');
      } catch (e) {
        if (!mounted) return;
        setUser(null);
        setUserType(null);
        setBootError(e?.message || 'Erro desconhecido no boot');
        setBootStep('Falha no boot.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // SIGNED_OUT: limpa
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
        return;
      }

      // SIGNED_IN / TOKEN_REFRESHED: valida tipo
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        try {
          setBootError(null);
          setBootStep('Auth mudou. Validando tipo...');
          const type = await getUserTypeReliable(session.user, setBootStep);

          if (!type) {
            setUser(null);
            setUserType(null);
            setBootStep('Auth mudou, mas tipo falhou. Estado limpo.');
            return;
          }

          setUser(session.user);
          setUserType(type);
          setBootStep('Pronto ✅');
        } catch (e) {
          setUser(null);
          setUserType(null);
          setBootError(e?.message || 'Erro ao validar após auth change');
          setBootStep('Falha pós-auth.');
        }
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

  // Se estiver carregando, MOSTRA STATUS REAL. Isso mata “infinito” sem mascarar causa.
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-dark-100 border border-gray-800 rounded-custom p-8 text-center">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-lg font-black mb-2">Carregando sessão...</div>
          <div className="text-gray-400 text-sm font-bold">{bootStep}</div>

          {bootError && (
            <div className="mt-4 text-left bg-red-500/10 border border-red-500/30 rounded-custom p-4">
              <div className="text-red-400 font-black mb-1">Erro detectado:</div>
              <div className="text-red-200 text-sm">{bootError}</div>
              <div className="text-gray-400 text-xs mt-2">
                Isso indica que a app NÃO está conseguindo completar uma etapa (sessão, users.type, etc.).
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* páginas públicas SEM depender do userType */}
        <Route path="/" element={<Home user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} onLogout={handleLogout} />} />
        <Route path="/v/:slug" element={<Vitrine user={isLoggedIn ? user : null} userType={isLoggedIn ? userType : null} />} />

        {/* auth */}
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

        {/* privadas */}
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

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
