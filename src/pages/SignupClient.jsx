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
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      // Signup no Supabase Auth
      // ⚠️ O trigger cria o registro em public.users automaticamente
      const { data, error: authError } = await supabase.auth.signUp({
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
      if (!data?.user) {
        throw new Error('Usuário não retornado pelo Supabase');
      }

      // Login local
      onLogin(data.user, 'client');
      navigate('/minha-area');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Login
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-custom flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black">CADASTRO</h1>
              <p className="text-xs text-blue-400 font-bold -mt-1">CLIENTE</p>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block font-bold mb-2">Nome Completo</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-custom text-red-400 text-sm font-bold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-button font-black text-lg"
            >
              {loading ? 'CRIANDO CONTA...' : 'CRIAR CONTA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
