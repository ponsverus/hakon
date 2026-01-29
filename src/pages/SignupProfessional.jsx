import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Scissors } from 'lucide-react';

export default function SignupProfessional() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    nomeBarbearia: '',
    slug: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Validação simples do slug
      const slugFormatado = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // 2. Criar usuário no Auth
      // IMPORTANTE: Enviamos 'type' e 'nome' no metadata para a Trigger do SQL usar
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nome: formData.nome,
            type: 'professional'
          }
        }
      });

      if (authError) throw authError;

      // 3. Criar a Barbearia
      // O usuário na tabela 'users' é criado automaticamente pela Trigger do SQL
      // então podemos inserir direto na tabela 'barbearias' usando o ID do auth.
      if (authData.user) {
        const { error: barbError } = await supabase.from('barbearias').insert([
          {
            owner_id: authData.user.id,
            nome: formData.nomeBarbearia,
            slug: slugFormatado
          }
        ]);

        if (barbError) throw barbError;

        alert('Conta profissional criada com sucesso!');
        navigate('/dashboard');
      }

    } catch (error) {
      console.error(error);
      alert('Erro ao criar conta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 bg-dark-100 p-8 rounded-custom border border-gray-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
             <Scissors className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-black">Sou Profissional</h1>
          <p className="text-gray-400">Crie sua conta para gerenciar atendimentos</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Seu Nome</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none"
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              placeholder="******"
              className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white focus:border-primary focus:outline-none"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-sm font-bold text-gray-400 mb-1">Nome da Barbearia</label>
            <input
              type="text"
              placeholder="Ex: Barbearia do João"
              className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white mb-3 focus:border-primary focus:outline-none"
              onChange={(e) => setFormData({...formData, nomeBarbearia: e.target.value})}
              required
            />
            
            <label className="block text-sm font-bold text-gray-400 mb-1">Link Personalizado (Slug)</label>
            <div className="flex items-center bg-dark-200 border border-gray-800 rounded-custom px-4 py-3">
               <span className="text-gray-500 mr-1">hakon.app/v/</span>
               <input
                type="text"
                placeholder="barbearia-do-joao"
                className="bg-transparent border-none text-white focus:outline-none w-full"
                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Sem espaços ou caracteres especiais.</p>
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full py-4 mt-6 bg-primary text-black font-black rounded-button hover:bg-yellow-500 transition-colors disabled:opacity-50"
        >
          {loading ? 'CRIANDO CONTA...' : 'CRIAR CONTA PROFISSIONAL'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta? <Link to="/login" className="text-primary hover:underline font-bold">Entrar</Link>
        </p>
        <p className="text-center text-sm text-gray-500">
           Quer agendar um corte? <Link to="/signup" className="text-white hover:underline font-bold">Sou Cliente</Link>
        </p>
      </form>
    </div>
  );
}
