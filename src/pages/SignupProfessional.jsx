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

  const generateSlug = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleBarbeariaNameChange = (value) => {
    setFormData({
      ...formData,
      nomeBarbearia: value,
      urlBarbearia: generateSlug(value)
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validações
      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      if (!formData.urlBarbearia || formData.urlBarbearia.length < 3) {
        throw new Error('URL da barbearia inválida');
      }

      // Verificar se URL já existe
      const { data: existingBarbearia } = await supabase
        .from('barbearias')
        .select('slug')
        .eq('slug', formData.urlBarbearia)
        .single();

      if (existingBarbearia) {
        throw new Error('Esta URL já está em uso. Escolha outro nome para a barbearia.');
      }

      // Criar conta no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Criar registro na tabela users
      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: formData.email,
            type: 'professional',
            nome: formData.nome
          }
        ]);

      if (userError) throw userError;

      // Criar barbearia
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .insert([
          {
            owner_id: authData.user.id,
            nome: formData.nomeBarbearia,
            slug: formData.urlBarbearia,
            descricao: formData.descricao,
            telefone: formData.telefone,
            endereco: formData.endereco
          }
        ])
        .select()
        .single();

      if (barbeariaError) throw barbeariaError;

      // Criar profissional (ele mesmo)
      const { error: profissionalError } = await supabase
        .from('profissionais')
        .insert([
          {
            barbearia_id: barbeariaData.id,
            user_id: authData.user.id,
            nome: formData.nome,
            anos_experiencia: parseInt(formData.anosExperiencia) || 0
          }
        ]);

      if (profissionalError) throw profissionalError;

      // Login automático
      onLogin(authData.user, 'professional');
      navigate('/dashboard');

    } catch (err) {
      console.error('Erro ao criar conta:', err);
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-yellow-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Back Button */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Login
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
              <Award className="w-7 h-7 sm:w-8 sm:h-8 text-black" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">CADASTRO</h1>
              <p className="text-xs text-primary font-bold -mt-1">PROFISSIONAL</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-black mb-2">Criar Sua Vitrine</h2>
            <p className="text-sm sm:text-base text-gray-400">
              Comece a receber agendamentos hoje
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
            {/* Grid 2 colunas em desktop */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="João Silva"
                    className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                    required
                  />
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Telefone (WhatsApp) *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Nome da Barbearia */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Nome da Barbearia *
              </label>
              <input
                type="text"
                value={formData.nomeBarbearia}
                onChange={(e) => handleBarbeariaNameChange(e.target.value)}
                placeholder="Barbearia Elite"
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                required
              />
            </div>

            {/* URL da Barbearia */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                URL Única (não pode repetir) *
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm font-bold">hakon.app/v/</span>
                <input
                  type="text"
                  value={formData.urlBarbearia}
                  onChange={(e) => setFormData({ ...formData, urlBarbearia: generateSlug(e.target.value) })}
                  placeholder="barbearia-elite"
                  className="flex-1 px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 font-bold">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>

            {/* Anos de Experiência */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Anos de Experiência *
              </label>
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

            {/* Descrição */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Descrição do Negócio *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Especialista em cortes clássicos e modernos, atendimento de qualidade..."
                  rows="3"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Endereço */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Endereço da Barbearia *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua Exemplo, 123 - Centro, São Paulo"
                  className="w-full pl-11 pr-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Email *
              </label>
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

            {/* Senha */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Senha *
              </label>
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
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-base sm:text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'CRIANDO VITRINE...' : 'CRIAR MINHA VITRINE'}
            </button>

            {/* Link para Login */}
            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 mb-2">
                Já tem uma conta?
              </p>
              <Link
                to="/login"
                className="text-primary hover:text-yellow-500 font-black text-sm transition-colors"
              >
                FAZER LOGIN →
              </Link>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-primary/10 border border-primary/30 rounded-custom p-4">
          <p className="text-xs sm:text-sm text-primary font-bold text-center">
            🔥 Após criar sua conta, você terá acesso ao dashboard completo para gerenciar serviços, agendamentos e profissionais
          </p>
        </div>
      </div>
    </div>
  );
}
