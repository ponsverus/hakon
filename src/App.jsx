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

    const getUserType = async (userId, retries = 10) => {
      // ✅ AUMENTADO: 10 tentativas com intervalo maior
      for (let i = 0; i < retries; i++) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('type')
            .eq('id', userId)
            .maybeSingle();

          if (error) {
            console.error(`❌ Tentativa ${i + 1}/${retries} - Erro ao buscar tipo:`, error);
          }

          if (data && isValidType(data.type)) {
            console.log(`✅ Tipo encontrado na tentativa ${i + 1}:`, data.type);
            return data.type;
          }

          // ✅ Aguardar mais tempo entre tentativas (500ms)
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.error(`❌ Tentativa ${i + 1}/${retries} - Exceção:`, e);
        }
      }

      console.error('❌ Tipo não encontrado após todas as tentativas');
      return null;
    };

    const initSession = async () => {
      try {
        console.log('🔄 Iniciando verificação de sessão...');
        
        // ✅ Buscar sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Erro ao buscar sessão:', error);
          if (mounted) {
            setUser(null);
            setUserType(null);
            setLoading(false);
          }
          return;
        }

        if (!session?.user) {
          console.log('ℹ️ Nenhuma sessão ativa');
          if (mounted) {
            setUser(null);
            setUserType(null);
            setLoading(false);
          }
          return;
        }

        console.log('✅ Sessão encontrada:', session.user.email);

        // ✅ Buscar tipo do usuário (com retry aprimorado)
        const type = await getUserType(session.user.id);

        if (!mounted) return;

        if (!type) {
          // ⚠️ IMPORTANTE: NÃO deslogar automaticamente
          // Apenas avisar no console e deixar o usuário na Home
          console.warn('⚠️ Sessão existe mas perfil não foi encontrado ainda.');
          console.warn('⚠️ Isso pode acontecer logo após o cadastro. Aguarde alguns segundos e recarregue.');
          
          // Manter sessão mas sem definir tipo (usuário ficará na Home)
          setUser(session.user);
          setUserType(null);
        } else {
          console.log('✅ Login completo:', type);
          setUser(session.user);
          setUserType(type);
        }

      } catch (e) {
        console.error('❌ Erro na inicialização:', e);
        if (mounted) {
          setUser(null);
          setUserType(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    // ✅ Listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event);

      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ SIGNED_IN detectado');
        
        // Buscar tipo com retry
        const type = await getUserType(session.user.id);

        if (!type) {
          console.warn('⚠️ SIGNED_IN mas perfil não encontrado. Mantendo sessão...');
          setUser(session.user);
          setUserType(null);
          return;
        }

        setUser(session.user);
        setUserType(type);
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('🚪 SIGNED_OUT detectado');
        setUser(null);
        setUserType(null);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token renovado');
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (userData, type) => {
    console.log('📝 handleLogin chamado:', type);
    setUser(userData);
    setUserType(type);
  };

  const handleLogout = async () => {
    console.log('🚪 Logout iniciado');
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
          element={
            user && userType === 'client'
              ? <Navigate to="/minha-area" />
              : <SignupClient onLogin={handleLogin} />
          }
        />

        <Route
          path="/cadastro/profissional"
          element={
            user && userType === 'professional'
              ? <Navigate to="/dashboard" />
              : <SignupProfessional onLogin={handleLogin} />
          }
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
