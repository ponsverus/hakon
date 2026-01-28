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

export default function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'client' ou 'professional'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        // Buscar tipo de usuário
        const { data: profile } = await supabase
          .from('users')
          .select('type')
          .eq('id', session.user.id)
          .single();
        
        setUserType(profile?.type || 'client');
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
    } finally {
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
        <div className="text-primary text-2xl font-bold animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} userType={userType} onLogout={handleLogout} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/cadastro" element={<SignupChoice />} />
        <Route path="/cadastro/cliente" element={<SignupClient onLogin={handleLogin} />} />
        <Route path="/cadastro/profissional" element={<SignupProfessional onLogin={handleLogin} />} />
        
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
        
        <Route path="/v/:slug" element={<Vitrine user={user} />} />
      </Routes>
    </Router>
  );
}
