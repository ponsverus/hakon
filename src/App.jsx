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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event);

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const type = await getUserTypeWithRetry(session.user.id);

        // ❌ Se não existe perfil no public.users, não pode manter sessão
        if (!isValidType(type)) {
          console.error('❌ Perfil public.users não encontrado. Deslogando...');
          await supabase.auth.signOut();
          setUser(null);
          setUserType(null);
          return;
        }

        setUser(session.user);
        setUserType(type);
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const type = await getUserTypeWithRetry(session.user.id);

        if (!isValidType(type)) {
          console.error('❌ Sessão existe, mas perfil não. Deslogando...');
          await supabase.auth.signOut();
          setUser(null);
          setUserType(null);
        } else {
          setUser(session.user);
          setUserType(type);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeWithRetry = async (userId) => {
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase
        .from('users')
        .select('type')
        .eq('id', userId)
        .maybeSingle();

      if (!error && isValidType(data?.type)) return data.type;
      await sleep(250);
    }
    return null;
  };

  const handleLogin = async (userData, type) => {
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
          element={user
            ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
            : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro"
          element={user
            ? <Navigate to={userType === 'professional' ? '/dashboard' : '/minha-area'} />
            : <SignupChoice />
          }
        />

        <Route path="/cadastro/cliente" element={user ? <Navigate to="/minha-area" /> : <SignupClient onLogin={handleLogin} />} />
        <Route path="/cadastro/profissional" element={user ? <Navigate to="/dashboard" /> : <SignupProfessional onLogin={handleLogin} />} />

        <Route
          path="/dashboard"
          element={user && userType === 'professional'
            ? <Dashboard user={user} onLogout={handleLogout} />
            : <Navigate to="/login" />
          }
        />

        <Route
          path="/minha-area"
          element={user && userType === 'client'
            ? <ClientArea user={user} onLogout={handleLogout} />
            : <Navigate to="/login" />
          }
        />

        <Route path="/v/:slug" element={<Vitrine user={user} userType={userType} />} />
      </Routes>
    </Router>
  );
}
