import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, FileText, Calendar } from 'lucide-react';
import { supabase } from '../supabase';

export default function SignupProfessional({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    telefone: '',
    nomeBarbearia: '',
    urlBarbearia: '',
    anosExperiencia: '',
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      if (!formData.urlBarbearia || formData.urlBarbearia.length < 3) {
        throw new Error('URL da barbearia inválida');
      }

      // 1️⃣ Verificar slug
      const { data: existingBarbearia } = await supabase
        .from('barbearias')
        .select('id')
        .eq('slug', formData.urlBarbearia)
        .maybeSingle();

      if (existingBarbearia) {
        throw new Error('Esta URL já está em uso.');
      }

      // 2️⃣ Criar auth
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
      if (!authData?.user) {
        throw new Error('Usuário não retornado pelo Supabase');
      }

      const userId = authData.user.id;

      // 3️⃣ Criar barbearia
      const { data: barbearia, error: barbeariaError } = await supabase
        .from('barbearias')
        .insert({
          owner_id: userId,
          nome: formData.nomeBarbearia,
          slug: formData.urlBarbearia,
          descricao: formData.descricao,
          telefone: formData.telefone,
          endereco: formData.endereco
        })
        .select()
        .single();

      if (barbeariaError) throw barbeariaError;

      // 4️⃣ Criar profissional
      const { error: profissionalError } = await supabase
        .from('profissionais')
        .insert({
          barbearia_id: barbearia.id,
          user_id: userId,
          nome: formData.nome,
          anos_experiencia: Number(formData.anosExperiencia) || 0
        });

      if (profissionalError) throw profissionalError;

      // 5️⃣ Login
      onLogin(authData.user, 'professional');
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="text-gray-400 font-bold mb-6 inline-block">
          ← Voltar para Login
        </Link>

        <form onSubmit={handleSignup} className="bg-dark-100 border border-gray-800 p-8 rounded-custom space-y-4">
          <h1 className="text-2xl font-black text-center">Cadastro Profissional</h1>

          <input placeholder="Nome" onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
          <input placeholder="Email" type="email" onChange={e => setFormData({ ...formData, email: e.target.value })} required />
          <input placeholder="Senha" type="password" onChange={e => setFormData({ ...formData, password: e.target.value })} required />
          <input placeholder="Nome da Barbearia" onChange={e => setFormData({ ...formData, nomeBarbearia: e.target.value, urlBarbearia: generateSlug(e.target.value) })} required />
          <input placeholder="Slug" value={formData.urlBarbearia} readOnly />
          <textarea placeholder="Descrição" onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
          <input placeholder="Telefone" onChange={e => setFormData({ ...formData, telefone: e.target.value })} />
          <input placeholder="Endereço" onChange={e => setFormData({ ...formData, endereco: e.target.value })} />
          <input placeholder="Anos de experiência" type="number" onChange={e => setFormData({ ...formData, anosExperiencia: e.target.value })} />

          {error && <p className="text-red-400 font-bold">{error}</p>}

          <button disabled={loading} className="bg-yellow-500 text-black py-3 rounded-button font-black">
            {loading ? 'CRIANDO...' : 'CRIAR VITRINE'}
          </button>
        </form>
      </div>
    </div>
  );
}
