import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { supabase } from '../supabase';

export default function SignupClient({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: ''
  });

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validações
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      // Criar conta no Supabase Auth (trigger cria user automaticamente)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            type: 'client',
            nome: formData.nome
          }
        }
      });

      if (authError) throw authError;

      // Login automático
      onLogin(authData.user, 'client');
      navigate('/minha-area');

    } catch (err) {
      console.error('Erro ao criar conta:', err);
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back Button */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Login
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-custom flex items-center justify-center">
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">CADASTRO</h1>
              <p className="text-xs text-blue-400 font-bold -mt-1">CLIENTE</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-black mb-2">Criar Conta de Cliente</h2>
            <p className="text-sm sm:text-base text-gray-400">
              Agende serviços em segundos
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
            {/* Nome */}
            <div>
              <label className="block text-sm sm:text-base font-bold text-gray-300 mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
            </div>

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
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
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
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-11 pr-12 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-bold">
                Use uma senha forte com números e símbolos
              </p>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-custom p-3 text-red-400 text-sm font-bold animate-fade-in">
                {error}
              </div>
            )}

            {/* Botão de Cadastro */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-button font-black text-base sm:text-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'CRIANDO CONTA...' : 'CRIAR CONTA'}
            </button>

            {/* Link para Login */}
            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-sm sm:text-base text-gray-400 mb-2">
                Já tem uma conta?
              </p>
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-black text-sm sm:text-base transition-colors"
              >
                FAZER LOGIN →
              </Link>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
          <p className="text-xs sm:text-sm text-blue-300 font-bold text-center">
            ✨ Como cliente, você pode agendar serviços, favoritar barbearias e avaliar profissionais
          </p>
        </div>
      </div>
    </div>
  );
}
