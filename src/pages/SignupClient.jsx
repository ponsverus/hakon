import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { supabase } from '../supabase';

const isValidType = (t) => t === 'client' || t === 'professional';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchProfileTypeWithRetry(userId) {
  // ✅ AUMENTADO: 15 tentativas com delay maior
  for (let i = 0; i < 15; i++) {
    const { data, error } = await supabase
      .from('users')
      .select('type')
      .eq('id', userId)
      .maybeSingle();

    if (!error && isValidType(data?.type)) {
      console.log(`✅ Perfil encontrado na tentativa ${i + 1}`);
      return data.type;
    }

    console.log(`⏳ Aguardando perfil... tentativa ${i + 1}/15`);
    await sleep(500); // ✅ 500ms entre tentativas
  }
  return null;
}

export default function SignupClient({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ nome: '', email: '', password: '' });

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      console.log('📝 Iniciando cadastro de cliente...');

      // 1) signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { type: 'client', nome: formData.nome },
        },
      });

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error('Usuário não retornado pelo Supabase.');

      console.log('✅ Conta criada no Auth:', authData.user.id);

      // 2) ✅ AGUARDAR trigger criar perfil
      console.log('⏳ Aguardando criação do perfil no banco...');
      await sleep(1500); // 1.5 segundos

      // 3) Fazer login se não veio sessão
      if (!authData.session) {
        console.log('🔑 Fazendo login...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          throw new Error(
            'Conta criada, mas não foi possível iniciar sessão. ' +
            'Tente fazer login manualmente.'
          );
        }

        console.log('✅ Login realizado');

        // Buscar tipo com retry
        const dbType = await fetchProfileTypeWithRetry(signInData.user.id);
        
        if (!dbType) {
          throw new Error(
            'Perfil não foi criado no banco. ' +
            'Tente fazer login novamente em alguns segundos.'
          );
        }

        console.log('✅ Perfil validado:', dbType);
        onLogin(signInData.user, dbType);
        navigate('/minha-area');
        return;
      }

      // 4) Sessão OK → buscar tipo no DB
      console.log('⏳ Buscando perfil do usuário...');
      const dbType = await fetchProfileTypeWithRetry(authData.user.id);
      
      if (!dbType) {
        throw new Error(
          'Perfil não foi criado no banco. ' +
          'Tente fazer login novamente em alguns segundos.'
        );
      }

      console.log('✅ Perfil validado:', dbType);
      console.log('🎉 Cadastro completo! Redirecionando...');

      onLogin(authData.user, dbType);
      navigate('/minha-area');

    } catch (err) {
      console.error('❌ Erro no cadastro:', err);
      
      // ✅ NÃO deslogar se o erro for só de perfil não encontrado
      if (!err.message.includes('Perfil não foi criado')) {
        await supabase.auth.signOut();
      }

      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Login
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-custom flex items-center justify-center">
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">CADASTRO</h1>
              <p className="text-xs text-blue-400 font-bold -mt-1">CLIENTE</p>
            </div>
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-black mb-2">Criar Conta de Cliente</h2>
            <p className="text-sm sm:text-base text-gray-400">Agende serviços em segundos</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-custom p-3 text-red-400 text-sm font-bold animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-button font-black text-base sm:text-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'CRIANDO CONTA...' : 'CRIAR CONTA'}
            </button>

            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-sm sm:text-base text-gray-400 mb-2">Já tem uma conta?</p>
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-black text-sm sm:text-base transition-colors"
              >
                FAZER LOGIN →
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
          <p className="text-xs sm:text-sm text-blue-300 font-bold text-center">
            ✨ Como cliente, você pode agendar serviços, favoritar barbearias e avaliar profissionais
          </p>
        </div>
      </div>
    </div>
  );
}
