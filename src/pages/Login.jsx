import React, { useEffect, useMemo, useState } from 'react';
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
    .upsert([{ id: userId, email, type, nome }], { onConflict: 'id' });
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

function isPasswordRecoveryUrl() {
  const href = window.location.href || '';
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    href.includes('type=recovery') ||
    search.includes('type=recovery') ||
    hash.includes('type=recovery') ||
    search.includes('code=') ||
    hash.includes('access_token=')
  );
}

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  // ====== RECOVERY ======
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // ====== RESET EMAIL (ESQUECI) ======
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    // Detecta recovery por URL (hash/query) ou pelo evento do Supabase
    const byUrl = isPasswordRecoveryUrl();
    if (byUrl) {
      setIsRecovery(true);
      setStep(2); // mantém no card
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setStep(2);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

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

  // ✅ envia e-mail de recuperação
  const handleForgotPassword = async () => {
    setResetMsg('');
    setResetLoading(true);

    try {
      const email = String(formData.email || '').trim();
      if (!email) throw new Error('Digite seu e-mail acima para recuperar a senha.');

      // Importante: redirectTo deve apontar para uma rota do seu app.
      // Aqui usamos /login para cair no fluxo de recovery que criamos.
      const redirectTo = `${window.location.origin}/login`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetErr) throw resetErr;

      setResetMsg('✅ Link enviado! Verifique seu e-mail para redefinir a senha.');
    } catch (e) {
      setResetMsg(`❌ ${e?.message || 'Erro ao enviar link de recuperação.'}`);
    } finally {
      setResetLoading(false);
    }
  };

  // ✅ define nova senha durante recovery
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryLoading(true);

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }
      if (newPassword !== newPassword2) {
        throw new Error('As senhas não conferem.');
      }

      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
      if (upErr) throw upErr;

      alert('✅ Senha atualizada! Faça login novamente.');
      await supabase.auth.signOut(); // limpa sessão de recovery
      setIsRecovery(false);
      setNewPassword('');
      setNewPassword2('');
      setStep(1);
      setUserType(null);
      navigate('/login');
    } catch (e) {
      setRecoveryError(e?.message || 'Erro ao atualizar senha.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Se estiver em recovery, não faz sentido escolher tipo (é redefinição)
  const title = useMemo(() => {
    if (isRecovery) return 'Definir Nova Senha';
    if (step === 1) return 'ENTRAR COMO:';
    return `Entrar como ${userType === 'client' ? 'CLIENTE' : 'PROFISSIONAL'}`;
  }, [isRecovery, step, userType]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-primary mb-6">
          <ArrowLeft className="w-4 h-4" />
          VOLTAR PARA HOME
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 shadow-2xl">
          <h2 className="text-xl font-normal text-center mb-6">{title}</h2>

          {/* ====== RECOVERY FORM ====== */}
          {isRecovery ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div>
                <label className="text-sm font-bold mb-2 block">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold mb-2 block">Confirmar nova senha</label>
                <input
                  type="password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {recoveryError && (
                <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom font-bold">
                  {recoveryError}
                </div>
              )}

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-normal rounded-button disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:hover:scale-100"
              >
                {recoveryLoading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setIsRecovery(false);
                  setStep(1);
                  setUserType(null);
                  navigate('/login');
                }}
                className="w-full py-3 bg-dark-200 border border-gray-800 rounded-button font-bold text-gray-300 hover:border-primary transition-all"
              >
                VOLTAR AO LOGIN
              </button>
            </form>
          ) : (
            <>
              {/* ====== STEP 1: ESCOLHER TIPO ====== */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleTypeSelection('client')}
                    className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-blue-500 transition-all"
                  >
                    <User className="mx-auto mb-2 text-blue-400" />
                    <div className="font-normal">CLIENTE</div>
                  </button>

                  <button
                    onClick={() => handleTypeSelection('professional')}
                    className="bg-dark-200 border border-gray-800 rounded-custom p-4 hover:border-primary transition-all"
                  >
                    <Award className="mx-auto mb-2 text-primary" />
                    <div className="font-normal">PROFISSIONAL</div>
                  </button>
                </div>
              )}

              {/* ====== STEP 2: LOGIN ====== */}
              {step === 2 && (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-gray-400 mb-4 flex items-center gap-1 hover:text-gray-300 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    TROCAR TIPO
                  </button>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-sm mb-2 block">EMAIL</label>
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
                      <label className="text-sm mb-2 block">SENHA</label>
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
                    </div>

                    {/* ✅ ESQUECEU A SENHA */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetLoading}
                        className="text-sm text-primary hover:text-yellow-500 transition-colors font-bold"
                      >
                        {resetLoading ? 'ENVIANDO...' : 'ESQUECEU A SENHA?'}
                      </button>

                      {/* mensagem curta do reset */}
                      {resetMsg && (
                        <span className="text-xs text-gray-400 text-right max-w-[60%]">
                          {resetMsg}
                        </span>
                      )}
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/40 p-3 text-red-400 text-sm rounded-custom font-bold">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black font-normal rounded-button disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:hover:scale-100"
                    >
                      {loading ? 'ENTRANDO...' : 'ENTRAR'}
                    </button>

                    <div className="text-center pt-4 border-t border-gray-800">
                      <p className="text-sm text-gray-400 mb-2">OU</p>
                      <button
                        type="button"
                        onClick={handleSignupRedirect}
                        className="text-primary font-normal hover:text-yellow-500 transition-colors"
                      >
                        CRIAR CONTA :)
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
