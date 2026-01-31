import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Heart, History, User, LogOut, Star, Clock, MapPin, X } from 'lucide-react';
import { supabase } from '../supabase';

export default function ClientArea({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('agendamentos');
  const [agendamentos, setAgendamentos] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Buscar agendamentos
      const { data: agendamentosData } = await supabase
        .from('agendamentos')
        .select(`
          *,
          servicos (*),
          profissionais (
            nome,
            barbearias (nome, slug)
          )
        `)
        .eq('cliente_id', user.id)
        .order('data', { ascending: false });

      setAgendamentos(agendamentosData || []);

      // Buscar favoritos
      const { data: favoritosData } = await supabase
        .from('favoritos')
        .select(`
          *,
          barbearias (nome, slug, logo_url),
          profissionais (nome, barbearias (slug))
        `)
        .eq('cliente_id', user.id);

      setFavoritos(favoritosData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelarAgendamento = async (agendamentoId) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado_cliente' })
        .eq('id', agendamentoId);

      if (error) throw error;

      alert('✅ Agendamento cancelado!');
      loadData();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert('❌ Erro ao cancelar agendamento');
    }
  };

  const removerFavorito = async (favoritoId) => {
    try {
      const { error } = await supabase
        .from('favoritos')
        .delete()
        .eq('id', favoritoId);

      if (error) throw error;

      setFavoritos(favoritos.filter(f => f.id !== favoritoId));
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'agendado':
      case 'confirmado':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'concluido':
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'cancelado_cliente':
      case 'cancelado_profissional':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'agendado': 'Agendado',
      'confirmado': 'Confirmado',
      'concluido': 'Concluído',
      'cancelado_cliente': 'Cancelado',
      'cancelado_profissional': 'Cancelado',
      'nao_compareceu': 'Não compareceu'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-2xl font-bold animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-custom flex items-center justify-center">
                <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-normal">MINHA ÁREA</h1>
                <p className="text-xs text-blue-400 -mt-1">CLIENTE</p>
              </div>
            </Link>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-button text-sm transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">SAIR</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-normal mb-2">Olá, {user.user_metadata?.nome || 'Cliente'} :)</h2>
          <p className="text-gray-400 text-sm sm:text-base">Gerencie seus agendamentos e favoritos</p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Link
            to="/"
            className="bg-gradient-to-r from-primary to-yellow-600 rounded-custom p-6 hover:shadow-lg hover:shadow-primary/50 transition-all group"
          >
            <Calendar className="w-8 h-8 text-black mb-3" />
            <h3 className="text-lg font-normal text-black mb-1">NOVO AGENDAMENTO</h3>
            <p className="text-black/80 text-sm">Buscar profissionais</p>
          </Link>

          <button
            onClick={() => setActiveTab('favoritos')}
            className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all text-left"
          >
            <Heart className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-lg font-normal mb-1">{favoritos.length} FAVORITOS</h3>
            <p className="text-gray-400 text-sm">Suas barbearias preferidas</p>
          </button>

          <button
            onClick={() => setActiveTab('agendamentos')}
            className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all text-left"
          >
            <History className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-lg font-normal mb-1">{agendamentos.length} AGENDAMENTOS</h3>
            <p className="text-gray-400 text-sm">Ver histórico completo</p>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('agendamentos')}
              className={`flex-1 py-4 px-6 font-normal transition-all text-sm sm:text-base ${
                activeTab === 'agendamentos'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              AGENDAMENTOS
            </button>
            <button
              onClick={() => setActiveTab('favoritos')}
              className={`flex-1 py-4 px-6 font-normal transition-all text-sm sm:text-base ${
                activeTab === 'favoritos'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              FAVORITOS
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {/* Tab Agendamentos */}
            {activeTab === 'agendamentos' && (
              <div>
                {agendamentos.length > 0 ? (
                  <div className="space-y-4">
                    {agendamentos.map(agendamento => (
                      <div
                        key={agendamento.id}
                        className="bg-dark-200 border border-gray-800 rounded-custom p-4 sm:p-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-white mb-1">
                              {agendamento.profissionais?.barbearias?.nome}
                            </h3>
                            <p className="text-sm text-gray-400 mb-2">
                              Profissional: {agendamento.profissionais?.nome}
                            </p>
                            <p className="text-sm text-primary font-bold">
                              {agendamento.servicos?.nome}
                            </p>
                          </div>

                          <div className={`inline-flex px-3 py-1 rounded-button text-xs font-bold border ${getStatusColor(agendamento.status)}`}>
                            {getStatusText(agendamento.status)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 font-bold mb-1">Data</div>
                            <div className="text-sm text-white font-bold">
                              {new Date(agendamento.data).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold mb-1">Horário</div>
                            <div className="text-sm text-white font-bold">
                              {agendamento.hora_inicio}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold mb-1">Valor</div>
                            <div className="text-sm text-white font-bold">
                              R$ {agendamento.servicos?.preco}
                            </div>
                          </div>
                        </div>

                        {(agendamento.status === 'agendado' || agendamento.status === 'confirmado') && (
                          <button
                            onClick={() => cancelarAgendamento(agendamento.id)}
                            className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-custom text-sm transition-all"
                          >
                            CANCELAR AGENDAMENTO
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 mb-4">Nenhum agendamento ainda</p>
                    <Link
                      to="/"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold hover:shadow-lg transition-all"
                    >
                      Fazer Primeiro Agendamento
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tab Favoritos */}
            {activeTab === 'favoritos' && (
              <div>
                {favoritos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoritos.map(favorito => {
                      const nome = favorito.tipo === 'barbearia' 
                        ? favorito.barbearias?.nome 
                        : favorito.profissionais?.nome;
                      const slug = favorito.tipo === 'barbearia'
                        ? favorito.barbearias?.slug
                        : favorito.profissionais?.barbearias?.slug;

                      return (
                        <div
                          key={favorito.id}
                          className="bg-dark-200 border border-gray-800 rounded-custom p-4 relative group hover:border-primary/50 transition-all"
                        >
                          <button
                            onClick={() => removerFavorito(favorito.id)}
                            className="absolute top-2 right-2 w-8 h-8 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>

                          <div className="mb-3">
                            <div className="w-12 h-12 bg-primary/20 rounded-custom flex items-center justify-center mb-3">
                              <Heart className="w-6 h-6 text-primary fill-current" />
                            </div>
                            <h3 className="text-lg font-black text-white mb-1">{nome}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase">{favorito.tipo}</p>
                          </div>

                          {slug && (
                            <Link
                              to={`/v/${slug}`}
                              className="block w-full py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-custom font-bold text-sm text-center transition-all"
                            >
                              Ver Vitrine
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 mb-4">Nenhum favorito ainda</p>
                    <Link
                      to="/"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold hover:shadow-lg transition-all"
                    >
                      Explorar Barbearias
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
