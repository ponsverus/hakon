import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, X, ExternalLink, Eye, Copy, Check, Calendar, DollarSign,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock
} from 'lucide-react';
import { supabase } from '../supabase';

function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
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

  useEffect(() => {
    if (user?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!user?.id) {
        setError('Sessão inválida. Faça login novamente.');
        setLoading(false);
        return;
      }

      const { data: barbeariaData, error: barbeariaError } = await withTimeout(
        supabase
          .from('barbearias')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle(),
        8000,
        'Timeout carregando barbearia'
      );

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setError('Nenhuma barbearia cadastrada.');
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setLoading(false);
        return;
      }

      setBarbearia(barbeariaData);

      // Profissionais
      const { data: profissionaisData, error: profErr } = await withTimeout(
        supabase
          .from('profissionais')
          .select('*')
          .eq('barbearia_id', barbeariaData.id),
        8000,
        'Timeout carregando profissionais'
      );

      if (profErr) throw profErr;

      const profs = profissionaisData || [];
      setProfissionais(profs);

      // Serviços + agendamentos
      if (profs.length > 0) {
        const profissionalIds = profs.map(p => p.id);

        const { data: servicosData, error: servErr } = await withTimeout(
          supabase
            .from('servicos')
            .select('*, profissionais (nome)')
            .in('profissional_id', profissionalIds),
          8000,
          'Timeout carregando serviços'
        );

        if (servErr) throw servErr;
        setServicos(servicosData || []);

        const { data: agendamentosData, error: agErr } = await withTimeout(
          supabase
            .from('agendamentos')
            .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
            .in('profissional_id', profissionalIds)
            .order('data', { ascending: false })
            .limit(100),
          8000,
          'Timeout carregando agendamentos'
        );

        if (agErr) throw agErr;
        setAgendamentos(agendamentosData || []);
      } else {
        setServicos([]);
        setAgendamentos([]);
      }
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e);
      setError(e?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!barbearia) return;
    navigator.clipboard.writeText(`${window.location.origin}/v/${barbearia.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ Normaliza payload (evita falhas por tipo string)
  const buildServicoPayload = () => {
    const dur = Number(formServico.duracao_minutos);
    const preco = Number(formServico.preco);

    return {
      nome: String(formServico.nome || '').trim(),
      duracao_minutos: Number.isFinite(dur) ? dur : null,
      preco: Number.isFinite(preco) ? preco : null,
      profissional_id: formServico.profissional_id || null,
      ativo: true
    };
  };

  const createServico = async (e) => {
    e.preventDefault();
    try {
      const payload = buildServicoPayload();

      if (!payload.profissional_id) throw new Error('Selecione um profissional.');
      if (!payload.nome) throw new Error('Informe o nome do serviço.');
      if (!payload.duracao_minutos) throw new Error('Informe a duração.');
      if (payload.preco == null) throw new Error('Informe o preço.');

      const { error } = await withTimeout(
        supabase.from('servicos').insert([payload]),
        8000,
        'Timeout ao criar serviço'
      );

      if (error) throw error;

      alert('✅ Serviço criado!');
      setShowNovoServico(false);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao criar serviço: ' + (err?.message || ''));
    }
  };

  const updateServico = async (e) => {
    e.preventDefault();
    try {
      if (!editingServico) throw new Error('Serviço inválido.');

      const payload = buildServicoPayload();
      delete payload.ativo; // não precisa mexer aqui se você não quiser

      const { error } = await withTimeout(
        supabase.from('servicos').update(payload).eq('id', editingServico),
        8000,
        'Timeout ao atualizar serviço'
      );

      if (error) throw error;

      alert('✅ Atualizado!');
      setEditingServico(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      loadData();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || ''));
    }
  };

  const deleteServico = async (id) => {
    if (!confirm('Excluir serviço?')) return;
    try {
      const { error } = await withTimeout(
        supabase.from('servicos').delete().eq('id', id),
        8000,
        'Timeout ao excluir serviço'
      );
      if (error) throw error;
      alert('✅ Excluído!');
      loadData();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || ''));
    }
  };

  const createProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!barbearia?.id) throw new Error('Barbearia inválida.');

      const payload = {
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: formProfissional.anos_experiencia === '' ? 0 : Number(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio || '08:00',
        horario_fim: formProfissional.horario_fim || '18:00',
        barbearia_id: barbearia.id
      };

      if (!payload.nome) throw new Error('Informe o nome do profissional.');

      const { error } = await withTimeout(
        supabase.from('profissionais').insert([payload]),
        8000,
        'Timeout ao adicionar profissional'
      );

      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('❌ Erro: ' + (err?.message || ''));
    }
  };

  const updateProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!editingProfissional?.id) throw new Error('Profissional inválido.');

      const payload = {
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: formProfissional.anos_experiencia === '' ? 0 : Number(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio || '08:00',
        horario_fim: formProfissional.horario_fim || '18:00'
      };

      const { error } = await withTimeout(
        supabase.from('profissionais').update(payload).eq('id', editingProfissional.id),
        8000,
        'Timeout ao atualizar profissional'
      );

      if (error) throw error;

      alert('✅ Horários atualizados!');
      setEditingProfissional(null);
      loadData();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || ''));
    }
  };

  const confirmarAtendimento = async (id) => {
    try {
      const { error } = await withTimeout(
        supabase
          .from('agendamentos')
          .update({ status: 'concluido', concluido_em: new Date().toISOString() })
          .eq('id', id),
        8000,
        'Timeout ao confirmar atendimento'
      );

      if (error) throw error;

      alert('✅ Confirmado!');
      loadData();
    } catch (err) {
      alert('❌ Erro: ' + (err?.message || ''));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-primary text-xl font-bold">Carregando...</div>
          <div className="text-gray-500 text-sm mt-2">Se demorar, vai aparecer erro automaticamente.</div>
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
            onClick={loadData}
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
            {activeTab === 'visao-geral' && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Bem-vindo ao seu dashboard!</p>
                <p className="text-sm text-gray-500">Use as abas acima para gerenciar tudo.</p>
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
                            a.status === 'concluido'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
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

            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos Cancelados</h2>
                {agendamentos.filter(a => String(a.status || '').includes('cancelado')).length > 0 ? (
                  <div className="space-y-4">
                    {agendamentos.filter(a => String(a.status || '').includes('cancelado')).map(a => (
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
                  <div className="grid
