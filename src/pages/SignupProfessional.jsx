import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, FileText, Calendar
} from 'lucide-react';
import { supabase } from '../supabase';

const isValidType = (t) => t === 'client' || t === 'professional';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchProfileTypeWithRetry(userId) {
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
    await sleep(500);
  }
  return null;
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
    tipoNegocio: '', // coluna tipo_negocio em negocios
    anosExperiencia: '',
    descricao: '',
    endereco: ''
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      if (!formData.urlNegocio || formData.urlNegocio.length < 3) {
        throw new Error('URL do negócio inválida');
      }

      if (!String(formData.tipoNegocio || '').trim()) {
        throw new Error('Tipo de negócio é obrigatório');
      }

      console.log('📝 Iniciando cadastro de profissional...');

      // 1) Verificar se slug já existe
      console.log('🔎 Verificando slug em negocios...');
      const { data: existingNegocio, error: slugError } = await supabase
        .from('negocios')
        .select('id, slug')
        .eq('slug', formData.urlNegocio)
        .maybeSingle();

      console.log('DEBUG existingNegocio:', existingNegocio);
      console.log('DEBUG slugError:', slugError);

      if (slugError) throw slugError;
      if (existingNegocio) {
        throw new Error('Esta URL já está em uso. Escolha outro nome para o negócio.');
      }

      console.log('✅ Slug disponível');

      // 2) Criar conta no Auth
      console.log('🔐 Criando conta no Auth...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            type: 'professional',
            nome: formData.nome
          }
        }
      });

      console.log('DEBUG authError:', authError);
      console.log('DEBUG authData.user.id:', authData?.user?.id);
      console.log('DEBUG authData.session existe?', !!authData?.session);

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error('Usuário não retornado pelo Supabase.');

      console.log('✅ Conta criada no Auth:', authData.user.id);

      // 3) Aguardar trigger criar perfil
      console.log('⏳ Aguardando criação do perfil no banco...');
      await sleep(1500);

      // 4) Garantir sessão
      let sessionUser = authData.user;
      let hasSession = !!authData.session;

      if (!hasSession) {
        console.log('🔑 Fazendo login (signInWithPassword)...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        console.log('DEBUG signInError:', signInError);
        console.log('DEBUG signInData.user.id:', signInData?.user?.id);

        if (signInError) {
          throw new Error(
            'Conta criada, mas não foi possível iniciar sessão. ' +
            'Tente fazer login manualmente.'
          );
        }

        sessionUser = signInData.user;
        hasSession = true;
        console.log('✅ Login realizado');
      }

      if (!hasSession) {
        throw new Error('Não foi possível iniciar sessão. Tente fazer login manualmente.');
      }

      const userId = sessionUser.id;

      console.log('DEBUG sessionUser.id:', userId);
      const { data: me, error: meErr } = await supabase.auth.getUser();
      console.log('DEBUG getUser:', me?.user?.id, meErr);

      // 5) Buscar tipo com retry
      console.log('⏳ Buscando perfil do usuário (users.type)...');
      const dbType = await fetchProfileTypeWithRetry(userId);
      console.log('DEBUG dbType:', dbType);

      if (!dbType) {
        throw new Error(
          'Perfil não foi criado no banco. Verifique se o trigger está ativo. ' +
          'Tente fazer login novamente em alguns segundos.'
        );
      }

      if (dbType !== 'professional') {
        throw new Error('Perfil criado com tipo incorreto. Verifique o cadastro.');
      }

      console.log('✅ Perfil validado:', dbType);

      // 6) Criar NEGÓCIO (com tipo_negocio)
      console.log('🏪 Criando negócio...');
      const payloadNegocio = {
        owner_id: userId,
        nome: String(formData.nomeNegocio || '').trim(),
        slug: String(formData.urlNegocio || '').trim(),
        tipo_negocio: String(formData.tipoNegocio || '').trim(),
        descricao: String(formData.descricao || '').trim(),
        telefone: String(formData.telefone || '').trim(),
        endereco: String(formData.endereco || '').trim()
      };

      console.log('DEBUG payloadNegocio:', payloadNegocio);

      const { data: negocioRows, error: negocioError } = await supabase
        .from('negocios')
        .insert([payloadNegocio])
        .select('id, owner_id, slug')
        .maybeSingle();

      console.log('DEBUG negocioRows:', negocioRows);
      console.log('DEBUG negocioError:', negocioError);

      // pode retornar objeto (maybeSingle) ou array (dependendo do client), então tratamos ambos
      const negocioId = negocioRows?.id || negocioRows?.[0]?.id || null;
      console.log('DEBUG negocioId (do retorno):', negocioId);

      // ✅ Debug definitivo: buscar no banco pelo owner_id+slug (não depende do returning)
      const { data: debugNeg, error: debugNegErr } = await supabase
        .from('negocios')
        .select('id, owner_id, slug')
        .eq('owner_id', userId)
        .eq('slug', payloadNegocio.slug)
        .maybeSingle();

      console.log('DEBUG SELECT negocios por owner+slug:', debugNeg);
      console.log('DEBUG SELECT negocios erro:', debugNegErr);

      const negocioIdFinal = debugNeg?.id || negocioId;

      if (negocioError) {
        // se deu erro real no insert, já quebra aqui (mais claro)
        throw new Error('Erro ao criar negócio: ' + negocioError.message);
      }

      if (!negocioIdFinal) {
        throw new Error('Negócio NÃO foi localizado após o insert (RLS/trigger/policy). Veja DEBUG no console.');
      }

      console.log('✅ Negócio confirmado no banco:', negocioIdFinal);

      // 7) Criar profissional (com negocio_id)
      console.log('👤 Criando profissional...');
      const payloadProf = {
        negocio_id: negocioIdFinal,
        user_id: userId,
        nome: String(formData.nome || '').trim(),
        anos_experiencia: parseInt(formData.anosExperiencia, 10) || 0
      };

      console.log('DEBUG payloadProfissional:', payloadProf);

      const { data: profRows, error: profissionalError } = await supabase
        .from('profissionais')
        .insert([payloadProf])
        .select('id, user_id, negocio_id')
        .maybeSingle();

      console.log('DEBUG profRows:', profRows);
      console.log('DEBUG profissionalError:', profissionalError);

      // ✅ Debug definitivo: buscar profissional por user_id
      const { data: debugProf, error: debugProfErr } = await supabase
        .from('profissionais')
        .select('id, user_id, negocio_id')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('DEBUG SELECT profissionais por user_id:', debugProf);
      console.log('DEBUG SELECT profissionais erro:', debugProfErr);

      if (profissionalError) {
        throw new Error('Erro ao criar profissional: ' + profissionalError.message);
      }

      if (!debugProf?.id) {
        throw new Error('Profissional NÃO foi localizado após o insert (RLS/trigger/policy). Veja DEBUG no console.');
      }

      console.log('✅ Profissional confirmado no banco:', debugProf.id);

      // 8) Login no app
      onLogin(sessionUser, 'professional');
      console.log('🎉 Cadastro completo! Redirecionando...');
      navigate('/dashboard');
    } catch (err) {
      console.error('❌ Erro no cadastro:', err);

      // NÃO deslogar se for apenas timing de perfil
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
                  pattern="[a-z0-9-]+"
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
                  placeholder="Ex: Oferecemos serviços completos..."
                  rows={3}
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Endereço do Negócio *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua Exemplo 123, Centro"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                />
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
