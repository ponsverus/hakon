import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, FileText, Calendar, Briefcase } from 'lucide-react';
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
      return data.type;
    }

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
    tipoNegocio: '',
    urlNegocio: '',
    anosExperiencia: '',
    especialidade: '',
    descricao: '',
    endereco: ''
  });

  const navigate = useNavigate();

  const generateSlug = (text) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleNegocioNameChange = (value) => {
    setFormData({
      ...formData,
      nomeNegocio: value,
      urlNegocio: generateSlug(value)
    });
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

      // 1) Verificar slug
      const { data: existing, error: slugError } = await supabase
        .from('barbearias')
        .select('id')
        .eq('slug', formData.urlNegocio)
        .maybeSingle();

      if (slugError) throw slugError;
      if (existing) throw new Error('Esta URL já está em uso.');

      // 2) Criar Auth
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

      if (authError) throw authError;

      await sleep(1500);

      const userId = authData.user.id;

      // 3) Validar perfil
      const dbType = await fetchProfileTypeWithRetry(userId);
      if (dbType !== 'professional') {
        throw new Error('Perfil inválido.');
      }

      // 4) Criar negócio
      const { data: negocioRows, error: negocioError } = await supabase
        .from('barbearias')
        .insert([{
          owner_id: userId,
          nome: formData.nomeNegocio,
          slug: formData.urlNegocio,
          tipo_negocio: formData.tipoNegocio,
          descricao: formData.descricao,
          telefone: formData.telefone,
          endereco: formData.endereco
        }])
        .select('id')
        .limit(1);

      if (negocioError) throw negocioError;

      const negocioId = negocioRows[0].id;

      // 5) Criar profissional
      const { error: profissionalError } = await supabase
        .from('profissionais')
        .insert([{
          barbearia_id: negocioId,
          user_id: userId,
          nome: formData.nome,
          especialidade: formData.especialidade,
          anos_experiencia: parseInt(formData.anosExperiencia) || 0
        }]);

      if (profissionalError) throw profissionalError;

      onLogin(authData.user, 'professional');
      navigate('/dashboard');

    } catch (err) {
      await supabase.auth.signOut();
      setError(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 shadow-2xl">
          <h1 className="text-3xl font-black text-center mb-6">CADASTRO PROFISSIONAL</h1>

          <form onSubmit={handleSignup} className="space-y-4">

            {/* Nome */}
            <input
              placeholder="Seu nome completo"
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              className="input"
              required
            />

            {/* Tipo de negócio */}
            <input
              placeholder="Tipo do negócio (ex: Barbearia, Salão, Manicure)"
              value={formData.tipoNegocio}
              onChange={e => setFormData({ ...formData, tipoNegocio: e.target.value })}
              className="input"
              required
            />

            {/* Nome do negócio */}
            <input
              placeholder="Nome do seu negócio"
              value={formData.nomeNegocio}
              onChange={e => handleNegocioNameChange(e.target.value)}
              className="input"
              required
            />

            {/* Especialidade */}
            <input
              placeholder="Sua especialidade (ex: Barbeiro, Manicure)"
              value={formData.especialidade}
              onChange={e => setFormData({ ...formData, especialidade: e.target.value })}
              className="input"
              required
            />

            {/* Restante */}
            <input placeholder="Telefone" value={formData.telefone}
              onChange={e => setFormData({ ...formData, telefone: e.target.value })} className="input" />

            <textarea placeholder="Descrição dos serviços"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              className="input" />

            <input placeholder="Endereço"
              value={formData.endereco}
              onChange={e => setFormData({ ...formData, endereco: e.target.value })}
              className="input" />

            <input type="email" placeholder="Email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="input" required />

            <input type="password" placeholder="Senha"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="input" required />

            {error && <div className="text-red-400">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black">
              {loading ? 'CRIANDO...' : 'CRIAR CONTA'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
