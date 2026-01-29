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

    // ✅ Fallback: nunca ficar preso no loading infinito
    const hardStop = setTimeout(() => {
      if (!mounted) return;
      console.warn('⚠️ hardStop: forçando fim do loading para evitar loop infinito');
      setLoading(false);
    }, 8000);

    const getUserType = async (userId) => {
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

        return isValidType(data?.type) ? data.type : null;
      } catch (e) {
        console.error('❌ Erro ao buscar tipo (catch):', e);
        return null;
      }
    };

    const safeInit = async () => {
      try {
        // ✅ Timeout do getSession (evita travar se algo ficar pendente)
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 5000)
        );

        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        const session = data?.session;

        if (!mounted) return;

        if (session?.user) {
          const type = await getUserType(session.user.id);

          // ✅ Se existe sessão mas não existe perfil em public.users, desloga para não bugar UI
          if (!type) {
            console.warn('⚠️ Sessão existe, mas perfil users não encontrado. Fazendo signOut()');
            await supabase.auth.signOut();
            if (!mounted) return;
            setUser(null);
            setUserType(null);
          } else {
            setUser(session.user);
            setUserType(type);
          }
        } else {
          setUser(null);
          setUserType(null);
        }
      } catch (e) {
        console.error('❌ safeInit erro:', e);
        // Em erro, libera a Home deslogada (melhor do que travar)
        if (!mounted) return;
        setUser(null);
        setUserType(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    safeInit();

    // ✅ Listener de Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event);

      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        const type = await getUserType(session.user.id);

        // Se logou mas não tem perfil, desloga pra não ficar “meio logado”
        if (!type) {
          console.warn('⚠️ SIGNED_IN mas perfil users não encontrado. Fazendo signOut()');
          await supabase.auth.signOut();
          if (!mounted) return;
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
        return;
      }
    });

    return () => {
      mounted = false;
      clearTimeout(hardStop);
      subscription?.unsubscribe();
    };
  }, []);

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
