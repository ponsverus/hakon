import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { User } from 'lucide-react';

export default function SignupClient() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Cria o cliente enviando o nome e o tipo para a Trigger do SQL
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nome: formData.nome,
            type: 'client' // Garante que seja criado como cliente
          }
        }
      });

      if (error) throw error;

      alert('Conta criada com sucesso!');
      navigate('/minha-area');

    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 bg-dark-100 p-8 rounded-custom border border-gray-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-dark-200 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
             <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black">Criar Conta Cliente</h1>
          <p className="text-gray-400">Agende cortes de forma rápida</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Seu Nome</label>
            <input
              type="text"
              placeholder="Como quer ser chamado"
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
        </div>

        <button
          disabled={loading}
          className="w-full py-4 mt-6 bg-white text-black font-black rounded-button hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'CRIANDO...' : 'CRIAR CONTA GRÁTIS'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta? <Link to="/login" className="text-white hover:underline font-bold">Entrar</Link>
        </p>
        <p className="text-center text-sm text-gray-500">
           É barbeiro? <Link to="/signup-pro" className="text-primary hover:underline font-bold">Criar conta profissional</Link>
        </p>
      </form>
    </div>
  );
}
