import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, X, ExternalLink, Eye, Copy, Check,
  Calendar, DollarSign, Users, TrendingUp, Award, LogOut, AlertCircle, Save
} from 'lucide-react';
import { supabase } from '../supabase';

const DIAS = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

function nowSaoPauloIsoDate() {
  // sua base usa timezone('America/Sao_Paulo', now()) no banco;
  // aqui usamos a data local do navegador como "hoje".
  return new Date().toISOString().split('T')[0];
}

function timeToMinutes(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [barbearia, setBarbearia] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Modais
  const [showNovoServico, setShowNovoServico] = useState(false);
  const [showNovoProfissional, setShowNovoProfissional] = useState(false);

  // Edição horários
  const [editingHorarioProf, setEditingHorarioProf] = useState(null); // profissional inteiro
  const [formHorario, setFormHorario] = useState({
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_trabalho: {
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
    }
  });

  // Forms
  const [formServico, setFormServico] = useState({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
  const [formProfissional, setFormProfissional] = useState({ nome: '', anos_experiencia: '' });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setError('Nenhuma barbearia cadastrada. Entre em contato com o suporte.');
        setLoading(false);
        return;
      }

      setBarbearia(barbeariaData);

      const { data: profissionaisData, error: profError } = await supabase
        .from('profissionais')
        .select('*')
        .eq('barbearia_id', barbeariaData.id);

      if (profError) throw profError;
      setProfissionais(profissionaisData || []);

      const profissionalIds = (profissionaisData || []).map(p => p.id);

      if (profissionalIds.length > 0) {
        const { data: servicosData, error: servError } = await supabase
          .from('servicos')
          .select('*, profissionais (nome)')
          .in('profissional_id', profissionalIds);

        if (servError) throw servError;
        setServicos(servicosData || []);

        const { data: agendamentosData, error: agendError } = await supabase
          .from('agendamentos')
          .select(`
            *,
            servicos (nome, preco, duracao_minutos),
            profissionais (nome),
            users (nome)
          `)
          .in('profissional_id', profissionalIds)
          .order('data', { ascending: false })
          .limit(200);

        if (agendError) throw agendError;
        setAgendamentos(agendamentosData || []);
      } else {
        setServicos([]);
        setAgendamentos([]);
      }
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e);
      setError(e.message || 'Erro desconhecido ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!barbearia) return;
    const url = `${window.location.origin}/v/${barbearia.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createServico = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formServico.nome,
        duracao_minutos: Number(formServico.duracao_minutos),
        preco: Number(formServico.preco),
        profissional_id: formServico.profissional_id,
        ativo: true
      };

      const { error } = await supabase.from('servicos').insert([payload]);
      if (error) throw error;

      alert('✅ Serviço criado!');
      setShowNovoServico(false);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      loadData();
    } catch (error) {
      console.error(error);
      alert('❌ Erro ao criar serviço: ' + error.message);
    }
  };

  const deleteServico = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    try {
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Serviço excluído!');
      loadData();
    } catch (error) {
      alert('❌ Erro ao excluir: ' + error.message);
    }
  };

  const createProfissional = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formProfissional.nome,
        anos_experiencia: formProfissional.anos_experiencia ? Number(formProfissional.anos_experiencia) : null,
        barbearia_id: barbearia.id,
        // defaults
        horario_inicio: '08:00',
        horario_fim: '18:00',
        dias_trabalho: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
      };

      const { error } = await supabase.from('profissionais').insert([payload]);
      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setFormProfissional({ nome: '', anos_experiencia: '' });
      loadData();
    } catch (error) {
      alert('❌ Erro ao adicionar profissional: ' + error.message);
    }
  };

  const confirmarAtendimento = async (agendamentoId) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', agendamentoId);

      if (error) throw error;

      alert('✅ Atendimento confirmado!');
      loadData();
    } catch (error) {
      alert('❌ Erro ao confirmar: ' + error.message);
    }
  };

  const abrirEditarHorario = (prof) => {
    setEditingHorarioProf(prof);

    const dias = prof.dias_trabalho && typeof prof.dias_trabalho === 'object'
      ? prof.dias_trabalho
      : { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };

    setFormHorario({
      horario_inicio: prof.horario_inicio || '08:00',
      horario_fim: prof.horario_fim || '18:00',
      dias_trabalho: {
        mon: !!dias.mon, tue: !!dias.tue, wed: !!dias.wed, thu: !!dias.thu,
        fri: !!dias.fri, sat: !!dias.sat, sun: !!dias.sun,
      }
    });
  };

  const salvarHorario = async () => {
    try {
      const hi = formHorario.horario_inicio;
      const hf = formHorario.horario_fim;

      if (timeToMinutes(hi) >= timeToMinutes(hf)) {
        alert('Horário inválido: início deve ser menor que fim.');
        return;
      }

      const { error } = await supabase
        .from('profissionais')
        .update({
          horario_inicio: hi,
          horario_fim: hf,
          dias_trabalho: formHorario.dias_trabalho
        })
        .eq('id', editingHorarioProf.id);

      if (error) throw error;

      alert('✅ Horários atualizados!');
      setEditingHorarioProf(null);
      loadData();
    } catch (e) {
      alert('❌ Erro ao salvar horários: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-xl font-bold">Carregando dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !barbearia) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-100 border border-red-500/50 rounded-custom p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white mb-2">Erro ao carregar barbearia</h1>
          <p className="text-gray-400 mb-6">{error || 'Barbearia não encontrada'}</p>
          <div className="space-y-3">
            <button
              onClick={loadData}
              className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold hover:bg-primary/30 transition-all"
            >
              Tentar Novamente
            </button>
            <button
              onClick={onLogout}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-button font-bold transition-all"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hoje = nowSaoPauloIsoDate();

  const agendamentosHoje = agendamentos.filter(a =>
    a.data === hoje && !String(a.status || '').includes('cancelado')
  );

  // ✅ faturamento: concluiu OU já passou do horário final (sem cancelamento)
  const agora = new Date();
  const faturamentoHoje = agendamentosHoje.reduce((sum, a) => {
    const preco = Number(a.servicos?.preco || 0);

    const isCancelado = String(a.status || '').includes('cancelado');
    if (isCancelado) return sum;

    const jaConcluiu = a.status === 'concluido';

    // já passou do horário final?
    let passou = false;
    if (a.data && a.hora_fim) {
      const dt = new Date(`${a.data}T${a.hora_fim}`);
      passou = dt.getTime() < agora.getTime();
    }

    if (jaConcluiu || passou) return sum + preco;
    return sum;
  }, 0);

  const cancelados = agendamentos.filter(a => String(a.status || '').includes('cancelado'));

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
                <Award className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black">{barbearia.nome}</h1>
                <p className="text-xs text-gray-500 font-bold -mt-1">DASHBOARD</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/v/${barbearia.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button font-bold text-sm transition-all"
              >
                <Eye className="w-4 h-4" />
                Ver Vitrine
              </Link>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-button font-bold text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-custom p-6">
            <DollarSign className="w-8 h-8 text-green-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">R$ {faturamentoHoje.toFixed(2)}</div>
            <div className="text-sm text-green-300 font-bold">Faturamento Hoje</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Calendar className="w-8 h-8 text-blue-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">{agendamentosHoje.length}</div>
            <div className="text-sm text-gray-400 font-bold">Agendamentos Hoje</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Users className="w-8 h-8 text-purple-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">{profissionais.length}</div>
            <div className="text-sm text-gray-400 font-bold">Profissionais</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <TrendingUp className="w-8 h-8 text-primary mb-2" />
            <div className="text-3xl font-black text-white mb-1">{servicos.length}</div>
            <div className="text-sm text-gray-400 font-bold">Serviços Ativos</div>
          </div>
        </div>

        {/* Link Vitrine */}
        <div className="bg-primary/10 border border-primary/30 rounded-custom p-6 mb-8">
          <h3 className="text-lg font-black mb-3 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-primary" />
            Link da Sua Vitrine
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${window.location.origin}/v/${barbearia.slug}`}
              readOnly
              className="flex-1 px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white text-sm"
            />
            <button
              onClick={copyLink}
              className="px-6 py-3 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-button font-bold text-sm flex items-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-800">
            {['visao-geral', 'agendamentos', 'cancelados', 'servicos', 'profissionais'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-6 py-4 font-black text-sm transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-primary/20 text-primary border-b-2 border-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'visao-geral' && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Bem-vindo ao seu dashboard!</p>
                <p className="text-sm text-gray-500">Use as abas acima para gerenciar serviços, profissionais e agendamentos.</p>
              </div>
            )}

            {activeTab === 'servicos' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Serviços</h2>
                  <button
                    onClick={() => setShowNovoServico(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Serviço
                  </button>
                </div>

                {servicos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servicos.map(s => (
                      <div key={s.id} className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-black">{s.nome}</h3>
                            <p className="text-xs text-gray-500 font-bold">{s.profissionais?.nome}</p>
                          </div>
                          <div className="text-2xl font-black text-primary">R$ {s.preco}</div>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{s.duracao_minutos} min</p>
                        <button
                          onClick={() => deleteServico(s.id)}
                          className="w-full py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-custom font-bold text-sm"
                        >
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">Nenhum serviço cadastrado</p>
                    <button
                      onClick={() => setShowNovoServico(true)}
                      className="px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                    >
                      Adicionar Primeiro Serviço
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profissionais' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Profissionais</h2>
                  <button
                    onClick={() => setShowNovoProfissional(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profissionais.map(p => (
                    <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-black font-black text-xl">
                          {p.nome?.[0] || 'P'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black">{p.nome}</h3>
                          {p.anos_experiencia != null && (
                            <p className="text-xs text-gray-500 font-bold">{p.anos_experiencia} anos</p>
                          )}
                          <p className="text-xs text-gray-500 font-bold mt-1">
                            {p.horario_inicio || '08:00'} - {p.horario_fim || '18:00'}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm text-gray-400 mb-4">
                        {servicos.filter(s => s.profissional_id === p.id).length} serviços
                      </div>

                      <button
                        onClick={() => abrirEditarHorario(p)}
                        className="w-full py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-custom font-bold text-sm"
                      >
                        Editar Horários
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos de Hoje</h2>
                {agendamentosHoje.length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosHoje.map(a => (
                      <div key={a.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-black text-lg">{a.users?.nome || 'Cliente'}</p>
                            <p className="text-sm text-gray-400">{a.servicos?.nome} • {a.profissionais?.nome}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-button text-xs font-bold ${
                            a.status === 'concluido' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {a.status === 'concluido' ? 'Concluído' : 'Agendado'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Horário</div>
                            <div className="text-sm font-bold">{a.hora_inicio} - {a.hora_fim}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Valor</div>
                            <div className="text-sm font-bold">R$ {a.servicos?.preco}</div>
                          </div>
                        </div>
                        {a.status !== 'concluido' && (
                          <button
                            onClick={() => confirmarAtendimento(a.id)}
                            className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-custom font-bold text-sm"
                          >
                            ✓ Confirmar Atendimento
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Nenhum agendamento hoje</p>
                )}
              </div>
            )}

            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Cancelados</h2>

                {cancelados.length > 0 ? (
                  <div className="space-y-4">
                    {cancelados.map(a => (
                      <div key={a.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-black text-lg">{a.users?.nome || 'Cliente'}</p>
                            <p className="text-sm text-gray-400">{a.servicos?.nome} • {a.profissionais?.nome}</p>
                            <p className="text-xs text-gray-500 font-bold mt-1">
                              {new Date(a.data).toLocaleDateString('pt-BR')} • {a.hora_inicio}
                            </p>
                          </div>
                          <div className="px-3 py-1 rounded-button text-xs font-bold bg-red-500/20 text-red-400">
                            {a.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Nenhum cancelamento ainda</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo Serviço */}
      {showNovoServico && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Novo Serviço</h3>
              <button onClick={() => setShowNovoServico(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createServico} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Profissional</label>
                <select
                  value={formServico.profissional_id}
                  onChange={(e) => setFormServico({ ...formServico, profissional_id: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                >
                  <option value="">Selecione</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={formServico.nome}
                  onChange={(e) => setFormServico({ ...formServico, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Duração (min)</label>
                <input
                  type="number"
                  value={formServico.duracao_minutos}
                  onChange={(e) => setFormServico({ ...formServico, duracao_minutos: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formServico.preco}
                  onChange={(e) => setFormServico({ ...formServico, preco: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
              >
                CRIAR SERVIÇO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Profissional */}
      {showNovoProfissional && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Novo Profissional</h3>
              <button onClick={() => setShowNovoProfissional(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createProfissional} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={formProfissional.nome}
                  onChange={(e) => setFormProfissional({ ...formProfissional, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Anos de Experiência</label>
                <input
                  type="number"
                  value={formProfissional.anos_experiencia}
                  onChange={(e) => setFormProfissional({ ...formProfissional, anos_experiencia: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
              >
                ADICIONAR
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Horários */}
      {editingHorarioProf && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Horários • {editingHorarioProf.nome}</h3>
              <button onClick={() => setEditingHorarioProf(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Início</label>
                  <input
                    type="time"
                    value={formHorario.horario_inicio}
                    onChange={(e) => setFormHorario(prev => ({ ...prev, horario_inicio: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Fim</label>
                  <input
                    type="time"
                    value={formHorario.horario_fim}
                    onChange={(e) => setFormHorario(prev => ({ ...prev, horario_fim: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Dias de trabalho</label>
                <div className="grid grid-cols-7 gap-2">
                  {DIAS.map(d => (
                    <button
                      key={d.key}
                      onClick={() => setFormHorario(prev => ({
                        ...prev,
                        dias_trabalho: { ...prev.dias_trabalho, [d.key]: !prev.dias_trabalho[d.key] }
                      }))}
                      className={`py-2 rounded-custom font-black text-xs border transition-all ${
                        formHorario.dias_trabalho[d.key]
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-dark-200 border-gray-800 text-gray-500'
                      }`}
                      type="button"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={salvarHorario}
                className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                SALVAR
              </button>
              <p className="text-xs text-gray-500 font-bold">
                Esses horários controlam os horários disponíveis na vitrine e no agendamento inteligente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
