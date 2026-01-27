import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Save, X, ExternalLink, Settings, 
  DollarSign, Calendar, Users, TrendingUp, Eye, Copy, Check 
} from 'lucide-react';
import { supabase } from './supabase';

export default function Dashboard() {
  const [barbearia, setBarbearia] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servicos');
  
  // Form states
  const [showNewBarbearia, setShowNewBarbearia] = useState(false);
  const [showNewServico, setShowNewServico] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [copied, setCopied] = useState(false);

  const [formBarbearia, setFormBarbearia] = useState({
    nome: '',
    slug: ''
  });

  const [formServico, setFormServico] = useState({
    nome: '',
    preco: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Buscar barbearia (pegar a primeira por enquanto)
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .limit(1)
        .single();

      if (barbeariaData) {
        setBarbearia(barbeariaData);
        
        // Buscar serviços
        const { data: servicosData } = await supabase
          .from('servicos')
          .select('*')
          .eq('barbearia_id', barbeariaData.id);
        
        setServicos(servicosData || []);
      }
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBarbearia = async (e) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('barbearias')
        .insert([formBarbearia])
        .select()
        .single();

      if (error) throw error;

      setBarbearia(data);
      setShowNewBarbearia(false);
      setFormBarbearia({ nome: '', slug: '' });
      alert('✅ Barbearia criada com sucesso!');
    } catch (error) {
      if (error.code === '23505') {
        alert('❌ Esta URL já está em uso. Escolha outra.');
      } else {
        alert('❌ Erro ao criar barbearia: ' + error.message);
      }
    }
  };

  const createServico = async (e) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('servicos')
        .insert([{
          ...formServico,
          barbearia_id: barbearia.id
        }])
        .select()
        .single();

      if (error) throw error;

      setServicos([...servicos, data]);
      setShowNewServico(false);
      setFormServico({ nome: '', preco: '' });
      alert('✅ Serviço adicionado!');
    } catch (error) {
      alert('❌ Erro ao criar serviço: ' + error.message);
    }
  };

  const updateServico = async (e) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('servicos')
        .update(formServico)
        .eq('id', editingServico);

      if (error) throw error;

      setServicos(servicos.map(s => 
        s.id === editingServico ? { ...s, ...formServico } : s
      ));
      setEditingServico(null);
      setFormServico({ nome: '', preco: '' });
      alert('✅ Serviço atualizado!');
    } catch (error) {
      alert('❌ Erro ao atualizar: ' + error.message);
    }
  };

  const deleteServico = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    
    try {
      const { error } = await supabase
        .from('servicos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServicos(servicos.filter(s => s.id !== id));
      alert('✅ Serviço excluído!');
    } catch (error) {
      alert('❌ Erro ao excluir: ' + error.message);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/v/${barbearia.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-yellow-400 text-2xl font-bold animate-pulse">Carregando...</div>
      </div>
    );
  }

  // Se não tem barbearia, mostrar tela de criação
  if (!barbearia && !showNewBarbearia) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="text-7xl mb-6">💈</div>
          <h1 className="text-5xl font-black mb-4 text-yellow-400">HAKON</h1>
          <p className="text-xl text-slate-400 mb-8">
            Você ainda não tem uma vitrine. Vamos criar agora!
          </p>
          <button
            onClick={() => setShowNewBarbearia(true)}
            className="px-10 py-5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-full font-black text-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-105"
          >
            CRIAR MINHA VITRINE AGORA
          </button>
        </div>
      </div>
    );
  }

  if (showNewBarbearia) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <form onSubmit={createBarbearia} className="bg-zinc-900 border border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-black mb-6 text-yellow-400">Criar Vitrine</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Nome da Barbearia</label>
                <input
                  type="text"
                  value={formBarbearia.nome}
                  onChange={(e) => setFormBarbearia({...formBarbearia, nome: e.target.value})}
                  placeholder="Ex: Barbearia Elite"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-2 font-semibold">URL Única (slug)</label>
                <input
                  type="text"
                  value={formBarbearia.slug}
                  onChange={(e) => setFormBarbearia({...formBarbearia, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  placeholder="barbearia-elite"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Sua vitrine será: /v/{formBarbearia.slug || 'seu-slug'}
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-black hover:shadow-lg transition-all"
            >
              CRIAR VITRINE
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard principal
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-white/10 sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-yellow-400">HAKON</h1>
              <p className="text-sm text-slate-400">{barbearia.nome}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                to={`/v/${barbearia.slug}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-semibold transition-all text-sm"
              >
                <Eye className="w-4 h-4" />
                Ver Vitrine
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-3xl font-black text-white mb-1">R$ 0</div>
            <div className="text-sm text-green-300">Faturamento Hoje</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="text-3xl font-black text-white mb-1">0</div>
            <div className="text-sm text-slate-400">Agendamentos Hoje</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white mb-1">0</div>
            <div className="text-sm text-slate-400">Clientes Ativos</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
            <div className="text-3xl font-black text-white mb-1">{servicos.length}</div>
            <div className="text-sm text-slate-400">Serviços Ativos</div>
          </div>
        </div>

        {/* Link da Vitrine */}
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-yellow-400" />
            Link da Sua Vitrine
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${window.location.origin}/v/${barbearia.slug}`}
              readOnly
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
            />
            <button
              onClick={copyLink}
              className="px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('servicos')}
              className={`flex-1 py-4 font-bold transition-all ${
                activeTab === 'servicos'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Serviços ({servicos.length})
            </button>
            <button
              onClick={() => setActiveTab('agendamentos')}
              className={`flex-1 py-4 font-bold transition-all ${
                activeTab === 'agendamentos'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-4 font-bold transition-all ${
                activeTab === 'config'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Configurações
            </button>
          </div>

          <div className="p-6">
            {/* Tab Serviços */}
            {activeTab === 'servicos' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-white">Meus Serviços</h2>
                  <button
                    onClick={() => setShowNewServico(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-bold hover:shadow-lg transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Serviço
                  </button>
                </div>

                {servicos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servicos.map(servico => (
                      <div
                        key={servico.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-bold text-white">{servico.nome}</h3>
                          <div className="text-2xl font-black text-yellow-400">
                            R$ {Number(servico.preco).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingServico(servico.id);
                              setFormServico({
                                nome: servico.nome,
                                preco: servico.preco
                              });
                            }}
                            className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => deleteServico(servico.id)}
                            className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">✂️</div>
                    <p className="text-slate-400 mb-6">Você ainda não tem serviços cadastrados</p>
                    <button
                      onClick={() => setShowNewServico(true)}
                      className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-full font-bold hover:shadow-lg transition-all"
                    >
                      Adicionar Primeiro Serviço
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab Agendamentos */}
            {activeTab === 'agendamentos' && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-slate-400">Nenhum agendamento ainda</p>
              </div>
            )}

            {/* Tab Configurações */}
            {activeTab === 'config' && (
              <div>
                <h2 className="text-2xl font-black text-white mb-6">Configurações</h2>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <p className="text-slate-400">Configurações em breve...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo Serviço */}
      {showNewServico && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white">Novo Serviço</h3>
              <button
                onClick={() => setShowNewServico(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createServico} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Nome do Serviço</label>
                <input
                  type="text"
                  value={formServico.nome}
                  onChange={(e) => setFormServico({...formServico, nome: e.target.value})}
                  placeholder="Ex: Corte Masculino"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formServico.preco}
                  onChange={(e) => setFormServico({...formServico, preco: e.target.value})}
                  placeholder="35.00"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-black hover:shadow-lg transition-all"
              >
                ADICIONAR SERVIÇO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Serviço */}
      {editingServico && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white">Editar Serviço</h3>
              <button
                onClick={() => {
                  setEditingServico(null);
                  setFormServico({ nome: '', preco: '' });
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={updateServico} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Nome do Serviço</label>
                <input
                  type="text"
                  value={formServico.nome}
                  onChange={(e) => setFormServico({...formServico, nome: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formServico.preco}
                  onChange={(e) => setFormServico({...formServico, preco: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-black hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                SALVAR ALTERAÇÕES
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
