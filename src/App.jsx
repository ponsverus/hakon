import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

// Importação das páginas
import Home from './pages/Home'; // <--- ADICIONADO AQUI
import Login from './pages/Login';
import SignupClient from './pages/SignupClient';
import SignupProfessional from './pages/SignupProfessional';
import Dashboard from './pages/Dashboard';
import ClientArea from './pages/ClientArea';
import Vitrine from './pages/Vitrine';

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user);
        await fetchUserType(session.user.id);
      } else {
        setUser(null);
        setUserType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await fetchUserType(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      setLoading(false);
    }
  }

  async function fetchUserType(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('type')
        .eq('id', userId)
        .maybeSingle();

      if (error) console.error('Erro ao buscar tipo:', error);

      if (data) {
        setUserType(data.type);
      } else {
        setUserType('client');
      }
    } catch (err) {
      console.error("Erro geral:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rota Principal (Landing Page) */}
      <Route 
        path="/" 
        element={<Home user={user} userType={userType} onLogout={handleLogout} />} 
      />

      {/* Rotas Públicas */}
      <Route 
        path="/login" 
        element={!user ? <Login /> : <Navigate to={userType === 'professional' ? "/dashboard" : "/minha-area"} />} 
      />
      <Route path="/signup" element={<SignupClient />} />
      <Route path="/signup-pro" element={<SignupProfessional />} />
      
      {/* Rota da Vitrine (Pública) */}
      <Route path="/v/:slug" element={<Vitrine />} />

      {/* Rota Protegida: Dashboard (Profissional) */}
      <Route 
        path="/dashboard" 
        element={
          user && userType === 'professional' ? (
            <Dashboard user={user} onLogout={handleLogout} />
          ) : (
            user ? <Navigate to="/minha-area" /> : <Navigate to="/login" />
          )
        } 
      />

      {/* Rota Protegida: Área do Cliente */}
      <Route 
        path="/minha-area" 
        element={
          user && userType === 'client' ? (
            <ClientArea user={user} onLogout={handleLogout} />
          ) : (
            user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
          )
        } 
      />

      {/* Redirecionamento padrão para Home se não achar nada */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
