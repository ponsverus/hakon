import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Award, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';

const isValidType = (t) => t === 'client' || t === 'professional';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchProfileTypeWithRetry(userId) {
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
}

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1); // 1 = escolher tipo | 2 = login
  const [userType, setUserType] = useState(null); // 'client' | 'professional'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ email: '', password: '' });

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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error('Falha ao autenticar.');

      const dbType = await fetchProfileTypeWithRetry(authData.user.id);

      if (!dbType) {
        await supabase.auth.signOut();
        throw new Error(
          'Conta existe no Auth, mas o perfil do app (public.users) não foi encontrado. ' +
          'Isso indica trigger/policy/rollback no banco.'
        );
      }

      if (dbType !== userType) {
        await supabase.auth.signOut();
        throw new Error(
          `Esta conta é de ${dbType === 'client' ? 'CLIENTE' : 'PROFISSIONAL'}. ` +
          'Volte e selecione o tipo correto.'
        );
      }

      onLogin(authData.user, dbType);

      navigate(dbType === 'professional' ? '/dashboard' : '/minha-area');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupRedirect = () => {
    if (userType === 'client') navigate('/cadastro/cliente');
    else navigate('/cadastro/profissional');
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-400 hover:text-primary mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Home
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 shadow-2xl">
          {step === 1 && (
            <>
              <h2 className="text-xl font-black text-center mb-6">Entrar como:</h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleTypeSelection('client')}
                  className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-blue-500"
                >
                  <User className="mx-auto mb-2 text-blue-400" />
                  <div className="font-black">CLIENTE</div>
                </button>

                <button
                  onClick={() => handleTypeSelection('professional')}
                  className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-primary"
                >
                  <Award className="mx-auto mb-2 text-primary" />
                  <div className="font-black">PROFISSIONAL</div>
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-gray-400 mb-4 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Trocar tipo
              </button>

              <h2 className="text-xl font-black mb-6 text-center">
                Entrar como {userType === 'client' ? 'CLIENTE' : 'PROFISSIONAL'}
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-bold">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-bold">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom"
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
                  <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-black rounded-button disabled:opacity-60"
                >
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </button>

                <div className="text-center pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-2">Não tem conta?</p>
                  <button
                    type="button"
                    onClick={handleSignupRedirect}
                    className="text-primary font-black"
                  >
                    CRIAR CONTA →
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
