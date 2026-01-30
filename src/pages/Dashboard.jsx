// Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, X, ExternalLink, Eye, Copy, Check, Calendar, DollarSign,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock
} from 'lucide-react';
import { supabase } from '../supabase';

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
  const [editingServico, setEditingServico] = useState(null);
  const [editingProfissional, setEditingProfissional] = useState(null);

  // Forms
  const [formServico, setFormServico] = useState({
    nome: '',
    duracao_minutos: '',
    preco: '',
    profissional_id: ''
  });

  const [formProfissional, setFormProfissional] = useState({
    nome: '',
    anos_experiencia: '',
    horario_inicio: '08:00',
    horario_fim: '18:00'
  });

  const mountedRef = useRef(true);

  const ensureSessionAndGetUser = useCallback(async () => {
    // 1) Preferir auth session no refresh
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;

    if (session?.user?.id) return session.user;

    // 2) fallback para props (quando já vem preenchido)
    if (user?.id) return user;

    return null;
  }, [user]);

  const loadData = useCallback(async (authUserParam) => {
    setLoading(true);
    setError(null);

    try {
      const authUser = authUserParam || (await ensureSessionAndGetUser());
      if (!authUser?.id) {
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setError('Sessão expirada. Faça login novamente.');
        return;
      }

      // BARBEARIA DO DONO
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('owner_id', authUser.id)
        .maybeSingle();

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setError('Nenhuma barbearia cadastrada para este usuário.');
        return;
      }

      setBarbearia(barbeariaData);

      // PROFISSIONAIS DA BARBEARIA
      const { data: profissionaisData, error: profError } = await supabase
        .from('profissionais')
        .select('*')
        .eq('barbearia_id', barbeariaData.id)
        .order('created_at', { ascending: true });

      if (profError) throw profError;

      const profs = profissionaisData || [];
      setProfissionais(profs);

      if (profs.length === 0) {
        setServicos([]);
        setAgendamentos([]);
        return;
      }

      const profissionalIds = profs.map(p => p.id);

      // SERVIÇOS
      const { data: servicosData, error: servErr } = await supabase
        .from('servicos')
        .select('*, profissionais (nome)')
        .in('profissional_id', profissionalIds)
        .order('created_at', { ascending: false });

      if (servErr) throw servErr;
      setServicos(servicosData || []);

      // AGENDAMENTOS
      // ⚠️ Importante: essa parte depende da FK do cliente_id -> users(id).
      // Se a sua FK tiver um nome diferente, troque "agendamentos_cliente_id_fkey" pelo nome real no Supabase.
      const agSelect = `
        *,
        servicos (nome, preco),
        profissionais (nome),
        users!agendamentos_cliente_id_fkey (nome)
      `;

      const { data: agData, error: agErr } = await supabase
        .from('agendamentos')
        .select(agSelect)
        .in('profissional_id', profissionalIds)
        .order('data', { ascending: false })
        .limit(100);

      if (agErr) throw agErr;

      const ags = agData || [];

      // ✅ AUTO-CONCLUIR agendamentos passados (evita travar UI)
      // Observação: isso faz updates em lote; se sua RLS não permitir update do dono, vai falhar e a gente ajusta no SQL.
      const agora = new Date();
      const toAutoConclude = ags.filter(a => {
        if (!(a.status === 'agendado' || a.status === 'confirmado')) return false;
        const dataHoraFim = new Date(`${a.data}T${a.hora_fim}`);
        return dataHoraFim < agora;
      });

      if (toAutoConclude.length > 0) {
        // atualiza em paralelo, com limite simples
        await Promise.all(
          toAutoConclude.map(a =>
            supabase
              .from('agendamentos')
              .update({ status: 'concluido', concluido_em: new Date().toISOString() })
              .eq('id', a.id)
          )
        );

        // refetch depois do auto-conclude
        const { data: agUpdated, error: agUpdatedErr } = await supabase
          .from('agendamentos')
          .select(agSelect)
          .in('profissional_id', profissionalIds)
          .order('data', { ascending: false })
          .limit(100);

        if (agUpdatedErr) throw agUpdatedErr;
        setAgendamentos(agUpdated || []);
      } else {
        setAgendamentos(ags);
      }

    } catch (err) {
      console.error('Erro ao carregar:', err);

      // Erros comuns no seu caso: 401/403 (RLS), 404/relacionamento, etc.
      const msg =
        err?.message ||
        err?.error_description ||
        'Erro desconhecido ao carregar dados';

      setError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [ensureSessionAndGetUser]);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      const authUser = await ensureSessionAndGetUser();
      await loadData(authUser);
    })();

    return () => { mountedRef.current = false; };
  }, [ensureSessionAndGetUser, loadData]);

  const handleRetry = async () => {
    const authUser = await ensureSessionAndGetUser();
    await loadData(authUser);
  };

  const copyLink = () => {
    if (!barbearia) return;
    navigator.clipboard.writeText(`${window.location.origin}/v/${barbearia.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // CRUD SERVIÇOS
  const createServico = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formServico.nome,
        duracao_minutos: Number(formServico.duracao_minutos),
        preco: Number(formServico.preco),
        profissional_id: formServico.profissional_id
      };

      const { error: insErr } = await supabase.from('servicos').insert([payload]);
      if (insErr) throw insErr;

      alert('✅ Serviço criado!');
      setShowNovoServico(false);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao criar serviço'));
    }
  };

  const updateServico = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formServico.nome,
        duracao_minutos: Number(formServico.duracao_minutos),
        preco: Number(formServico.preco),
        profissional_id: formServico.profissional_id
      };

      const { error: upErr } = await supabase
        .from('servicos')
        .update(payload)
        .eq('id', editingServico);

      if (upErr) throw upErr;

      alert('✅ Atualizado!');
      setEditingServico(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao atualizar serviço'));
    }
  };

  const deleteServico = async (id) => {
    if (!confirm('Excluir serviço?')) return;
    try {
      const { error: delErr } = await supabase.from('servicos').delete().eq('id', id);
      if (delErr) throw delErr;

      alert('✅ Excluído!');
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao excluir serviço'));
    }
  };

  // CRUD PROFISSIONAIS (empregado: user_id = null)
  const createProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!barbearia?.id) throw new Error('Barbearia não carregada.');

      const payload = {
        barbearia_id: barbearia.id,
        user_id: null, // ✅ empregado, NÃO dono
        nome: formProfissional.nome,
        anos_experiencia: formProfissional.anos_experiencia ? Number(formProfissional.anos_experiencia) : 0,
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim
      };

      const { error: insErr } = await supabase.from('profissionais').insert([payload]);
      if (insErr) throw insErr;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao adicionar profissional'));
    }
  };

  const updateProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!editingProfissional?.id) throw new Error('Profissional inválido.');

      const payload = {
        nome: formProfissional.nome,
        anos_experiencia: formProfissional.anos_experiencia ? Number(formProfissional.anos_experiencia) : 0,
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim
      };

      const { error: upErr } = await supabase
        .from('profissionais')
        .update(payload)
        .eq('id', editingProfissional.id);

      if (upErr) throw upErr;

      alert('✅ Horários atualizados!');
      setEditingProfissional(null);
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao atualizar profissional'));
    }
  };

  const confirmarAtendimento = async (id) => {
    try {
      const { error: upErr } = await supabase
        .from('agendamentos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', id);

      if (upErr) throw upErr;

      alert('✅ Confirmado!');
      await handleRetry();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || 'Falha ao confirmar'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-xl font-bold">Carregando...</div>
        </div>
      </div>
    );
  }

  if (error || !barbearia) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-100 border border-red-500/50 rounded-custom p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white mb-2">Erro ao carregar</h1>
          <p className="text-gray-400 mb-6">{error || 'Barbearia não encontrada'}</p>
          <button
            onClick={handleRetry}
            className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold mb-3"
          >
            Tentar Novamente
          </button>
          <button
            onClick={onLogout}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-button font-bold"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const hoje = new Date().toISOString().split('T')[0];
  const agendamentosHoje = agendamentos.filter(a => a.data === hoje && !String(a.status || '').includes('cancelado'));
  const concluidos = agendamentosHoje.filter(a => a.status === 'concluido');
  const faturamentoHoje = concluidos.reduce((sum, a) => sum + Number(a.servicos?.preco || 0), 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
                <Award className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-black">{barbearia.nome}</h1>
                <p className="text-xs text-gray-500 font-bold -mt-1">DASHBOARD</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/v/${barbearia.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button font-bold text-sm"
              >
                <Eye className="w-4 h-4" />Ver Vitrine
              </Link>

              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-button font-bold text-sm"
              >
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sair</span>
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
            <ExternalLink className="w-5 h-5 text-primary" />Link da Sua Vitrine
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
            {/* Visão Geral */}
            {activeTab === 'visao-geral' && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Bem-vindo ao seu dashboard!</p>
                <p className="text-sm text-gray-500">Use as abas acima para gerenciar tudo.</p>

                <button
                  onClick={handleRetry}
                  className="mt-6 px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold"
                >
                  Recarregar Dados
                </button>
              </div>
            )}

            {/* Agendamentos */}
            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos de Hoje</h2>
                {agendamentosHoje.length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosHoje.map(a => (
                      <div key={a.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-black text-lg">
                              {a.users?.nome || 'Cliente'}
                            </p>
                            <p className="text-sm text-gray-400">
                              {a.servicos?.nome} • {a.profissionais?.nome}
                            </p>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-button text-xs font-bold ${
                              a.status === 'concluido'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {a.status === 'concluido' ? 'Concluído' : 'Agendado'}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Horário</div>
                            <div className="text-sm font-bold">{a.hora_inicio}</div>
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

            {/* Cancelados */}
            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos Cancelados</h2>
                {agendamentos.filter(a => String(a.status || '').includes('cancelado')).length > 0 ? (
                  <div className="space-y-4">
                    {agendamentos
                      .filter(a => String(a.status || '').includes('cancelado'))
                      .map(a => (
                        <div key={a.id} className="bg-dark-200 border border-red-500/30 rounded-custom p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-lg text-white">{a.users?.nome || 'Cliente'}</p>
                              <p className="text-sm text-gray-400">{a.servicos?.nome} • {a.profissionais?.nome}</p>
                            </div>
                            <div className="px-3 py-1 rounded-button text-xs font-bold bg-red-500/20 border border-red-500/50 text-red-400">
                              Cancelado
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-gray-500 font-bold">Data</div>
                              <div className="text-white font-bold">{new Date(a.data).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-bold">Horário</div>
                              <div className="text-white font-bold">{a.hora_inicio}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-bold">Valor</div>
                              <div className="text-white font-bold">R$ {a.servicos?.preco}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Nenhum cancelamento</p>
                )}
              </div>
            )}

            {/* Serviços */}
            {activeTab === 'servicos' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Serviços</h2>
                  <button
                    onClick={() => setShowNovoServico(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />Novo Serviço
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingServico(s.id);
                              setFormServico({
                                nome: s.nome,
                                duracao_minutos: s.duracao_minutos,
                                preco: s.preco,
                                profissional_id: s.profissional_id
                              });
                              setShowNovoServico(true);
                            }}
                            className="flex-1 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-custom font-bold text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteServico(s.id)}
                            className="flex-1 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-custom font-bold text-sm"
                          >
                            Excluir
                          </button>
                        </div>
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

            {/* Profissionais */}
            {activeTab === 'profissionais' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Profissionais</h2>
                  <button
                    onClick={() => setShowNovoProfissional(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />Adicionar
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profissionais.map(p => (
                    <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-black font-black text-xl">
                          {String(p.nome || '?')[0]}
                        </div>
                        <div>
                          <h3 className="font-black">{p.nome}</h3>
                          {!!p.anos_experiencia && (
                            <p className="text-xs text-gray-500 font-bold">{p.anos_experiencia} anos</p>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-gray-400 mb-3">
                        {servicos.filter(s => s.profissional_id === p.id).length} serviços
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {p.horario_inicio} - {p.horario_fim}
                      </div>

                      <button
                        onClick={() => {
                          setEditingProfissional(p);
                          setFormProfissional({
                            nome: p.nome,
                            anos_experiencia: p.anos_experiencia || '',
                            horario_inicio: p.horario_inicio,
                            horario_fim: p.horario_fim
                          });
                        }}
                        className="w-full py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-custom font-bold text-sm"
                      >
                        Editar Horários
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo/Editar Serviço */}
      {showNovoServico && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">
                {editingServico ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button
                onClick={() => {
                  setShowNovoServico(false);
                  setEditingServico(null);
                  setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingServico ? updateServico : createServico} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Profissional</label>
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
                <label className="block text-sm font-bold mb-2">Nome</label>
                <input
                  type="text"
                  value={formServico.nome}
                  onChange={(e) => setFormServico({ ...formServico, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Duração (min)</label>
                <input
                  type="number"
                  value={formServico.duracao_minutos}
                  onChange={(e) => setFormServico({ ...formServico, duracao_minutos: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Preço (R$)</label>
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
                {editingServico ? 'SALVAR' : 'CRIAR SERVIÇO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Profissional */}
      {showNovoProfissional && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Novo Profissional</h3>
              <button
                onClick={() => {
                  setShowNovoProfissional(false);
                  setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createProfissional} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Nome</label>
                <input
                  type="text"
                  value={formProfissional.nome}
                  onChange={(e) => setFormProfissional({ ...formProfissional, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Anos de Experiência</label>
                <input
                  type="number"
                  value={formProfissional.anos_experiencia}
                  onChange={(e) => setFormProfissional({ ...formProfissional, anos_experiencia: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Início</label>
                  <input
                    type="time"
                    value={formProfissional.horario_inicio}
                    onChange={(e) => setFormProfissional({ ...formProfissional, horario_inicio: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Fim</label>
                  <input
                    type="time"
                    value={formProfissional.horario_fim}
                    onChange={(e) => setFormProfissional({ ...formProfissional, horario_fim: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    required
                  />
                </div>
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

      {/* Modal Editar Profissional */}
      {editingProfissional && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Editar Horários</h3>
              <button onClick={() => setEditingProfissional(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={updateProfissional} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Nome</label>
                <input
                  type="text"
                  value={formProfissional.nome}
                  onChange={(e) => setFormProfissional({ ...formProfissional, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Anos de Experiência</label>
                <input
                  type="number"
                  value={formProfissional.anos_experiencia}
                  onChange={(e) => setFormProfissional({ ...formProfissional, anos_experiencia: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Horário Início</label>
                  <input
                    type="time"
                    value={formProfissional.horario_inicio}
                    onChange={(e) => setFormProfissional({ ...formProfissional, horario_inicio: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Horário Fim</label>
                  <input
                    type="time"
                    value={formProfissional.horario_fim}
                    onChange={(e) => setFormProfissional({ ...formProfissional, horario_fim: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
              >
                SALVAR HORÁRIOS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
