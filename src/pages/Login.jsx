import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Award, ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1); // 1: Escolher tipo, 2: Login
  const [userType, setUserType] = useState(null); // 'client' ou 'professional'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const navigate = useNavigate();

  const handleTypeSelection = (type) => {
    setUserType(type);
    setStep(2);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Autenticar no Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Buscar tipo de usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('type')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      // Verificar se o tipo corresponde
      if (userData.type !== userType) {
        setError(`Esta conta é de ${userData.type === 'client' ? 'cliente' : 'profissional'}. Volte e selecione o tipo correto.`);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Login bem-sucedido
      onLogin(authData.user, userData.type);
      
      if (userData.type === 'professional') {
        navigate('/dashboard');
      } else {
        navigate('/minha-area');
      }

    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError(err.message || 'Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupRedirect = () => {
    if (userType === 'client') {
      navigate('/cadastro/cliente');
    } else {
      navigate('/cadastro/profissional');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-yellow-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Home
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
              <span className="text-black font-black text-2xl sm:text-3xl">H</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">HAKON</h1>
              <p className="text-xs text-primary font-bold -mt-1">BARBEARIA ELITE</p>
            </div>
          </div>

          {/* STEP 1: Escolher tipo de usuário */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-xl sm:text-2xl font-black text-center mb-3 sm:mb-4">
                Como você deseja entrar?
              </h2>
              <p className="text-sm sm:text-base text-gray-400 text-center mb-6 sm:mb-8">
                Selecione o tipo de conta
              </p>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Cliente */}
                <button
                  onClick={() => handleTypeSelection('client')}
                  className="group bg-dark-200 border-2 border-gray-800 hover:border-blue-500 rounded-custom p-4 sm:p-6 transition-all hover:scale-105"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 rounded-custom flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-blue-500/30 transition-all">
                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-white mb-1">CLIENTE</div>
                  <div className="text-xs sm:text-sm text-gray-500 font-bold">Agendar serviços</div>
                </button>

                {/* Profissional */}
                <button
                  onClick={() => handleTypeSelection('professional')}
                  className="group bg-dark-200 border-2 border-gray-800 hover:border-primary rounded-custom p-4 sm:p-6 transition-all hover:scale-105"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/20 rounded-custom flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-primary/30 transition-all">
                    <Award className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-white mb-1">PROFISSIONAL</div>
                  <div className="text-xs sm:text-sm text-gray-500 font-bold">Gerenciar barbearia</div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Formulário de login */}
          {step === 2 && (
            <div className="animate-fade-in">
              {/* Voltar */}
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors mb-4 font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                Trocar tipo de conta
              </button>

              {/* Título */}
              <div className="text-center mb-6 sm:mb-8">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-button mb-3 ${
                  userType === 'client' 
                    ? 'bg-blue-500/20 border border-blue-500/30' 
                    : 'bg-primary/20 border border-primary/30'
                }`}>
                  {userType === 'client' ? (
                    <>
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 font-bold text-sm">CLIENTE</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-primary" />
                      <span className="text-primary font-bold text-sm">PROFISSIONAL</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black">Entrar na Conta</h2>
              </div>

              {/* Formulário */}
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-sm sm:text-base font-bold text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                      className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-sm sm:text-base font-bold text-gray-300 mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-12 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Erro */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-custom p-3 text-red-400 text-sm font-bold animate-fade-in">
                    {error}
                  </div>
                )}

                {/* Botão de Login */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-4 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-base sm:text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </button>

                {/* Link para Cadastro */}
                <div className="text-center pt-4 border-t border-gray-800">
                  <p className="text-sm sm:text-base text-gray-400 mb-3">
                    Não tem uma conta?
                  </p>
                  <button
                    type="button"
                    onClick={handleSignupRedirect}
                    className="text-primary hover:text-yellow-500 font-black text-sm sm:text-base transition-colors"
                  >
                    CRIAR CONTA {userType === 'client' ? 'DE CLIENTE' : 'PROFISSIONAL'} →
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <p className="text-center text-xs sm:text-sm text-gray-600 mt-6 font-bold">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="text-primary hover:text-yellow-500 transition-colors">
            Termos de Uso
          </a>{' '}
          e{' '}
          <a href="#" className="text-primary hover:text-yellow-500 transition-colors">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
