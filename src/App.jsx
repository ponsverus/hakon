import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

// Importação das páginas
import Home from './pages/Home';
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
    // Verifica a sessão atual ao carregar
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await fetchUserType(session.user.id);
      } else {
        setLoading(false);
      }
    };

    getInitialSession();

    // Monitora mudanças (Login/Logout)
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

  async function fetchUserType(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('type')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setUserType(data.type);
      } else {
        setUserType('client');
      }
    } catch (err) {
      console.error("Erro ao buscar tipo:", err);
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

  // Enquanto verifica o banco, mostra um fundo preto para não dar "flash" branco
  if (loading) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home user={user} userType={userType} onLogout={handleLogout} />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to={userType === 'professional' ? "/dashboard" : "/minha-area"} />} />
      <Route path="/signup" element={<SignupClient />} />
      <Route path="/signup-pro" element={<SignupProfessional />} />
      <Route path="/v/:slug" element={<Vitrine />} />

      {/* Rota Protegida: Dashboard */}
      <Route 
        path="/dashboard" 
        element={user && userType === 'professional' ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
      />

      {/* Rota Protegida: Área do Cliente */}
      <Route 
        path="/minha-area" 
        element={user && userType === 'client' ? <ClientArea user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
