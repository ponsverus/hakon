import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, FileText, Calendar
} from 'lucide-react';
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

  // se não achou, tenta auto-curar
  await ensureProfileRow(authUser);

  // tenta de novo
  for (let i = 0; i < 10; i++) {
    const t = await fetchProfileType(authUser.id);
    if (t) return t;
    await sleep(400);
  }

  return null;
}

function onlyTrim(v) {
  return String(v || '').trim();
}

function montarEnderecoUnico({ rua, numero, bairro, cidade, estado }) {
  // Formato final:
  // Rua Serra do Sincorá, 1038 - Bairro X - Belo Horizonte, Minas Gerais
  return `${onlyTrim(rua)}, ${onlyTrim(numero)} - ${onlyTrim(bairro)} - ${onlyTrim(cidade)}, ${onlyTrim(estado)}`;
}

export default function SignupProfessional({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    telefone: '',
    nomeNegocio: '',
    urlNegocio: '',
    tipoNegocio: '',
    anosExperiencia: '',
    descricao: '',

    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: ''
  });

  const navigate = useNavigate();

  const generateSlug = (text) => {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNegocioNameChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      nomeNegocio: value,
      urlNegocio: generateSlug(value)
    }));
  };

  const validarEnderecoCompleto = () => {
    const rua = onlyTrim(formData.rua);
    const numero = onlyTrim(formData.numero);
    const bairro = onlyTrim(formData.bairro);
    const cidade = onlyTrim(formData.cidade);
    const estado = onlyTrim(formData.estado);

    if (!rua) return 'Informe a RUA do negócio.';
    if (!numero) return 'Informe o NÚMERO do endereço.';
    if (!bairro) return 'Informe o BAIRRO.';
    if (!cidade) return 'Informe a CIDADE.';
    if (!estado) return 'Informe o ESTADO.';
    return null;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres');

      if (!formData.urlNegocio || formData.urlNegocio.length < 3) {
        throw new Error('URL do negócio inválida');
      }

      if (!String(formData.tipoNegocio || '').trim()) {
        throw new Error('Tipo de negócio é obrigatório');
      }

      const enderecoMsg = validarEnderecoCompleto();
      if (enderecoMsg) throw new Error(enderecoMsg);

      const enderecoUnico = montarEnderecoUnico({
        rua: formData.rua,
        numero: formData.numero,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado
      });

      // 1) Verificar se slug já existe
      const { data: existingNegocio, error: slugError } = await supabase
        .from('negocios')
        .select('id')
        .eq('slug', formData.urlNegocio)
        .maybeSingle();

      if (slugError) throw slugError;
      if (existingNegocio) throw new Error('Esta URL já está em uso. Escolha outro nome para o negócio.');

      // 2) Criar conta no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { type: 'professional', nome: formData.nome } }
      });

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error('Usuário não retornado pelo Supabase.');

      // 3) Aguardar trigger criar perfil
      await sleep(1200);

      // 4) Garantir sessão
      let sessionUser = authData.user;
      let hasSession = !!authData.session;

      if (!hasSession) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          throw new Error('Conta criada, mas não foi possível iniciar sessão. Tente fazer login manualmente.');
        }

        sessionUser = signInData.user;
        hasSession = true;
      }

      if (!hasSession) throw new Error('Não foi possível iniciar sessão. Tente fazer login manualmente.');

      // 5) Buscar tipo com retry + heal
      const dbType = await fetchProfileTypeWithRetryAndHeal(sessionUser);

      if (!dbType) {
        throw new Error('Perfil não foi criado no banco. Verifique policies/RLS (users_insert_self).');
      }
      if (dbType !== 'professional') {
        throw new Error('Perfil criado com tipo incorreto. Verifique o cadastro.');
      }

      const userId = sessionUser.id;

      // 6) Criar NEGÓCIO
      const { data: negocioInserted, error: negocioError } = await supabase
        .from('negocios')
        .insert([{
          owner_id: userId,
          nome: String(formData.nomeNegocio || '').trim(),
          slug: String(formData.urlNegocio || '').trim(),
          tipo_negocio: String(formData.tipoNegocio || '').trim(),
          descricao: String(formData.descricao || '').trim(),
          telefone: String(formData.telefone || '').trim(),
          endereco: enderecoUnico
        }])
        .select('id')
        .maybeSingle();

      if (negocioError) throw new Error('Erro ao criar negócio: ' + negocioError.message);

      const negocioId = negocioInserted?.id;
      if (!negocioId) throw new Error('Negócio criado mas ID não retornado. Verifique policies/RLS.');

      // 7) Criar profissional
      const { error: profissionalError } = await supabase
        .from('profissionais')
        .insert([{
          negocio_id: negocioId,
          user_id: userId,
          nome: String(formData.nome || '').trim(),
          anos_experiencia: parseInt(formData.anosExperiencia, 10) || 0
        }]);

      if (profissionalError) throw new Error('Erro ao criar profissional: ' + profissionalError.message);

      // 8) Login no app
      onLogin(sessionUser, 'professional');
      navigate('/dashboard');
    } catch (err) {
      if (!String(err?.message || '').includes('Perfil não foi criado')) {
        await supabase.auth.signOut();
      }
      setError(err?.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-yellow-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          VOLTAR PARA LOGIN
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
              <Award className="w-7 h-7 sm:w-8 sm:h-8 text-black" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-normal">CADASTRO</h1>
              <p className="text-xs text-primary -mt-1">PROFISSIONAL</p>
            </div>
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-normal mb-2">CRIAR SUA VITRINE</h2>
            <p className="text-sm sm:text-base text-gray-400">
              Comece a receber agendamentos hoje :)
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Seu Nome Completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Pedro Gomes"
                    className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Telefone (WhatsApp) *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 99999 - 9999"
                    className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Nome do Negócio *</label>
              <input
                type="text"
                value={formData.nomeNegocio}
                onChange={(e) => handleNegocioNameChange(e.target.value)}
                placeholder="Ex: Elite Barbers"
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">URL Única (não pode repetir) *</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">hakon.app/v/</span>
                <input
                  type="text"
                  value={formData.urlNegocio}
                  onChange={(e) =>
                    setFormData({ ...formData, urlNegocio: generateSlug(e.target.value) })
                  }
                  placeholder="elite-barbers"
                  className="flex-1 px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Tipo de Negócio *</label>
              <input
                type="text"
                value={formData.tipoNegocio}
                onChange={(e) => setFormData({ ...formData, tipoNegocio: e.target.value })}
                placeholder="Ex: barbearia, manicure, clínica..."
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Anos de Experiência *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  value={formData.anosExperiencia}
                  onChange={(e) => setFormData({ ...formData, anosExperiencia: e.target.value })}
                  placeholder="5"
                  min="0"
                  max="50"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Sobre seus Serviços *</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Oferecemos serviços completos de barbearia: do corte clássico ao degradê..."
                  rows={3}
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none text-sm"
                  required
                />
              </div>
            </div>

            {/* ✅ ENDEREÇO COMPLETO */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Endereço Completo do Negócio *</label>

              <div className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Rua *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={formData.rua}
                        onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                        placeholder="Rua Serra do Sincorá"
                        className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Número *</label>
                    <input
                      type="text"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      placeholder="1038"
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Bairro *</label>
                    <input
                      type="text"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      placeholder="Centro"
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Cidade *</label>
                    <input
                      type="text"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="Belo Horizonte"
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-400 mb-2">Estado *</label>
                    <input
                      type="text"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      placeholder="Minas Gerais"
                      className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-3">
                  Assim vai aparecer no dashboard/vitrine:
                  <span className="text-gray-300">
                    {' '}
                    {formData.rua || 'Rua X'}, {formData.numero || '000'} - {formData.bairro || 'Bairro Y'} - {formData.cidade || 'Cidade'}, {formData.estado || 'Estado'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Senha *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-11 pr-12 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
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
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-custom p-3 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal text-base sm:text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'CRIANDO VITRINE...' : 'CRIAR MINHA VITRINE'}
            </button>

            <div className="text-center pt-4 border-gray-800">
              <p className="text-sm text-gray-400 mb-2">OU</p>
              <Link
                to="/login"
                className="text-primary hover:text-yellow-500 font-normal text-sm transition-colors"
              >
                FAZER LOGIN
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-primary/10 border border-primary/30 rounded-custom p-4">
          <p className="text-xs sm:text-sm text-primary text-center">
            Após criar sua conta, você terá acesso ao dashboard completo para gerenciar serviços, agendamentos e profissionais.
          </p>
        </div>
      </div>
    </div>
  );
}
