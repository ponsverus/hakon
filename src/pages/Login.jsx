import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Award, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';

const isValidType = (t) => t === 'client' || t === 'professional';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchProfileType(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('type')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return isValidType(data?.type) ? data.type : null;
}

// ✅ AUTO-HEAL: se o trigger falhar, cria/atualiza o perfil usando user_metadata
async function ensureProfileRow(authUser) {
  const userId = authUser.id;
  const email = authUser.email || '';
  const meta = authUser.user_metadata || {};
  const type = isValidType(meta.type) ? meta.type : 'client';
  const nome = meta.nome || null;

  // precisa da policy users_insert_self / users_update_self
  await supabase
    .from('users')
    .upsert(
      [{ id: userId, email, type, nome }],
      { onConflict: 'id' }
    );
}

async function fetchProfileTypeWithRetryAndHeal(authUser) {
  // tenta pegar normalmente
  for (let i = 0; i < 6; i++) {
    const t = await fetchProfileType(authUser.id);
    if (t) return t;
    await sleep(300);
  }

  // ✅ se não achou, tenta “auto-curar”
  await ensureProfileRow(authUser);

  // tenta de novo depois do heal
  for (let i = 0; i < 10; i++) {
    const t = await fetchProfileType(authUser.id);
    if (t) return t;
    await sleep(400);
  }

  return null;
}

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1); // 1=tipo, 2=login, 3=recuperar, 4=atualizar senha
  const [userType, setUserType] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPassword2, setShowNewPassword2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [formData, setFormData] = useState({ email: '', password: '' });

  // recuperação
  const [recoverEmail, setRecoverEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const navigate = useNavigate();

  const handleTypeSelection = (type) => {
    setUserType(type);
    setStep(2);
    setError('');
    setInfo('');
  };

  // ✅ Detecta retorno do link de recuperação e habilita tela de trocar senha
  useEffect(() => {
    const checkRecovery = async () => {
      try {
        // se o usuário chegou aqui via link do Supabase, normalmente vem com tokens na URL
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        // heurística segura: se tem sessão e a URL contém "type=recovery" ou "access_token"
        const href = window.location.href || '';
        const isRecoveryUrl =
          href.includes('type=recovery') || href.includes('access_token') || href.includes('refresh_token');

        if (session && isRecoveryUrl) {
          setStep(4);
          setError('');
          setInfo('');
        }
      } catch {
        // silencioso
      }
    };

    checkRecovery();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error('Falha ao autenticar.');

      const dbType = await fetchProfileTypeWithRetryAndHeal(authData.user);

      if (!dbType) {
        await supabase.auth.signOut();
        throw new Error(
          'Seu perfil ainda não foi criado no banco. ' +
          'Execute o SQL V2 (com users_insert_self) e tente novamente.'
        );
      }

      // validar tipo selecionado
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
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupRedirect = () => {
    if (userType === 'client') navigate('/cadastro/cliente');
    else navigate('/cadastro/profissional');
  };

  // ✅ Envia email de recuperação de senha
  const handleRecoverPassword = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const email = String(recoverEmail || formData.email || '').trim();
      if (!email) throw new Error('Informe seu email.');

      // IMPORTANTE: adicione esta URL em Auth > URL Configuration (Redirect URLs) no Supabase
      const redirectTo = `${window.location.origin}/login`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetErr) throw resetErr;

      setInfo('ENVIAMOS UM LINK PARA O SEU EMAIL. ABRA E FINALIZE A TROCA DE SENHA.');
    } catch (err) {
      setError(err.message || 'Erro ao enviar link de recuperação');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Atualiza a senha após abrir o link de recuperação
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres.');
      }
      if (newPassword !== newPassword2) {
        throw new Error('As senhas não coincidem.');
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;

      setInfo('SENHA ATUALIZADA COM SUCESSO. FAÇA LOGIN NOVAMENTE.');
      setNewPassword('');
      setNewPassword2('');

      // encerra sessão de recovery e volta pro login
      await supabase.auth.signOut();
      setStep(userType ? 2 : 1);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-primary mb-6 font-bold">
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
                  className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-blue-500 transition-all"
                >
                  <User className="mx-auto mb-2 text-blue-400" />
                  <div className="font-black">CLIENTE</div>
                </button>

                <button
                  onClick={() => handleTypeSelection('professional')}
                  className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-primary transition-all"
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
                onClick={() => {
                  setStep(1);
                  setError('');
                  setInfo('');
                }}
                className="text-sm text-gray-400 mb-4 flex items-center gap-1 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Trocar tipo
              </button>

              <h2 className="text-xl font-black mb-6 text-center">
                Entrar como {userType === 'client' ? 'CLIENTE' : 'PROFISSIONAL'}
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-bold mb-2 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all pr-12"
                      placeholder="••••••••"
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

                  <button
                    type="button"
                    onClick={() => {
                      setRecoverEmail(formData.email || '');
                      setStep(3);
                      setError('');
                      setInfo('');
                    }}
                    className="mt-2 text-xs text-gray-400 hover:text-primary transition-colors font-bold"
                  >
                    ESQUECI A SENHA
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom font-bold">
                    {error}
                  </div>
                )}

                {info && (
                  <div className="bg-green-500/10 border border-green-500/40 p-3 text-green-300 text-sm rounded-custom font-bold">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-black rounded-button disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </button>

                <div className="text-center pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-2">Não tem conta?</p>
                  <button
                    type="button"
                    onClick={handleSignupRedirect}
                    className="text-primary font-black hover:text-yellow-500 transition-colors"
                  >
                    CRIAR CONTA →
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ✅ Recuperar senha (envio de link) */}
          {step === 3 && (
            <>
              <button
                onClick={() => {
                  setStep(2);
                  setError('');
                  setInfo('');
                }}
                className="text-sm text-gray-400 mb-4 flex items-center gap-1 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>

              <h2 className="text-xl font-black mb-6 text-center">
                RECUPERAR SENHA
              </h2>

              <form onSubmit={handleRecoverPassword} className="space-y-4">
                <div>
                  <label className="text-sm font-bold mb-2 block">Email</label>
                  <input
                    type="email"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom font-bold">
                    {error}
                  </div>
                )}

                {info && (
                  <div className="bg-green-500/10 border border-green-500/40 p-3 text-green-300 text-sm rounded-custom font-bold">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-black rounded-button disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  {loading ? 'ENVIANDO...' : 'ENVIAR LINK'}
                </button>
              </form>
            </>
          )}

          {/* ✅ Atualizar senha (após clicar no link) */}
          {step === 4 && (
            <>
              <h2 className="text-xl font-black mb-6 text-center">
                TROCAR SENHA
              </h2>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="text-sm font-bold mb-2 block">Nova senha</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Confirmar nova senha</label>
                  <div className="relative">
                    <input
                      type={showNewPassword2 ? 'text' : 'password'}
                      value={newPassword2}
                      onChange={(e) => setNewPassword2(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword2(!showNewPassword2)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showNewPassword2 ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom font-bold">
                    {error}
                  </div>
                )}

                {info && (
                  <div className="bg-green-500/10 border border-green-500/40 p-3 text-green-300 text-sm rounded-custom font-bold">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-black rounded-button disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
