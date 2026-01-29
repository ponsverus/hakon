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

const withTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout no Supabase')), ms)),
  ]);

async function getUserType(userId, sessionUser) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('type')
      .eq('id', userId)
      .maybeSingle();

    if (!error && isValidType(data?.type)) return data.type;

    const metaType = sessionUser?.user_metadata?.type;
    if (isValidType(metaType)) return metaType;

    return null;
  } catch (e) {
    console.error('❌ Erro ao buscar tipo:', e);
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event, 'session?', !!session);

      try {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const type = await getUserType(session.user.id, session.user);
          setUser(session.user);
          setUserType(type);
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserType(null);
        }
      } catch (e) {
        console.error('❌ onAuthStateChange crash:', e);
      }
    });

    return () => data?.subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    console.log('🟡 checkUser() start');
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000);
      const session = data?.session;

      console.log('🟢 getSession ok | has session?', !!session);

      if (session?.user) {
        const type = await getUserType(session.user.id, session.user);
        setUser(session.user);
        setUserType(type);
      } else {
        setUser(null);
        setUserType(null);
      }
    } catch (error) {
      console.error('❌ Erro ao verificar usuário:', error);
      setUser(null);
      setUserType(null);
    } finally {
      console.log('✅ checkUser() end -> loading false');
      setLoading(false);
    }
  };

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

  const loggedAndTyped = !!user && isValidType(userType);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} userType={userType} onLogout={handleLogout} />} />

        <Route
          path="/login"
          element={
            loggedAndTyped
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route path="/cadastro" element={loggedAndTyped ? <Navigate to="/" /> : <SignupChoice />} />
        <Route path="/cadastro/cliente" element={loggedAndTyped ? <Navigate to="/minha-area" /> : <SignupClient onLogin={handleLogin} />} />
        <Route path="/cadastro/profissional" element={loggedAndTyped ? <Navigate to="/dashboard" /> : <SignupProfessional onLogin={handleLogin} />} />

        <Route
          path="/dashboard"
          element={loggedAndTyped && userType === 'professional' ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />

        <Route
          path="/minha-area"
          element={loggedAndTyped && userType === 'client' ? <ClientArea user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />

        <Route path="/v/:slug" element={<Vitrine user={user} userType={userType} />} />
      </Routes>
    </Router>
  );
}
