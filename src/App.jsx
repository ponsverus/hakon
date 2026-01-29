import React, { useState, useEffect, useCallback } from 'react';
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

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  const getUserType = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('type')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar tipo:', error);
        return null;
      }

      return data?.type || null;
    } catch (err) {
      console.error('❌ Erro inesperado ao buscar tipo:', err);
      return null;
    }
  }, []);

  const applySession = useCallback(async (session) => {
    try {
      if (!session?.user) {
        setUser(null);
        setUserType(null);
        return;
      }

      const u = session.user;
      setUser(u);

      const type = await getUserType(u.id);

      // ✅ IMPORTANTÍSSIMO: NÃO “chutar client”
      // Se não achou tipo, deixa null e força login (rotas protegem)
      setUserType(type);
    } catch (err) {
      console.error('❌ Erro no applySession:', err);
      setUser(null);
      setUserType(null);
    }
  }, [getUserType]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) console.error('❌ getSession error:', error);

        if (!mounted) return;
        await applySession(session);
      } catch (err) {
        console.error('❌ init error:', err);
        if (!mounted) return;
        setUser(null);
        setUserType(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event);

        // ✅ Se o app ainda tá carregando, garante que vai destravar
        if (mounted && loading) setLoading(false);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserType(null);
          return;
        }

        await applySession(session);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [applySession, loading]);

  const handleLogin = async (userData, type) => {
    // Mantém o que você já fazia
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
            user && userType
              ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
              : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={
            user && userType
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
