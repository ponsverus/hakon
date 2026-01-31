import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, X, ExternalLink, Eye, Copy, Check, Calendar, DollarSign,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock
} from 'lucide-react';
import { supabase } from '../supabase';

const withTimeout = (promise, ms, label = 'timeout') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${label}) em ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

const toNumberOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatBR = (isoDate) => {
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR');
  } catch {
    return isoDate;
  }
};

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

  // Edição
  const [editingServicoId, setEditingServicoId] = useState(null);
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

  // ✅ LOGO barbearia
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ✅ Histórico (data selecionada)
  const hojeISO = new Date().toISOString().split('T')[0];
  const [historicoData, setHistoricoData] = useState(hojeISO);

  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      if (user?.id) await loadData();
      else {
        setError('Sessão inválida. Faça login novamente.');
        setLoading(false);
      }
    };

    run();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) {
      setError('Sessão inválida. Faça login novamente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Barbearia do dono
      const { data: barbeariaData, error: barbeariaError } = await withTimeout(
        supabase
          .from('barbearias')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle(),
        9000,
        'barbearia'
      );

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setError('Nenhuma barbearia cadastrada para este usuário.');
        setLoading(false);
        return;
      }

      setBarbearia(barbeariaData);

      // 2) Profissionais
      const { data: profissionaisData, error: profErr } = await withTimeout(
        supabase
          .from('profissionais')
          .select('*')
          .eq('barbearia_id', barbeariaData.id)
          .order('created_at', { ascending: false }),
        9000,
        'profissionais'
      );

      if (profErr) throw profErr;

      const profs = profissionaisData || [];
      setProfissionais(profs);

      if (profs.length === 0) {
        setServicos([]);
        setAgendamentos([]);
        setLoading(false);
        return;
      }

      const ids = profs.map(p => p.id);

      // 3) Serviços (Dashboard precisa ver ativos e inativos)
      const { data: servicosData, error: servErr } = await withTimeout(
        supabase
          .from('servicos')
          .select('*, profissionais (nome)')
          .in('profissional_id', ids)
          .order('created_at', { ascending: false }),
        9000,
        'servicos'
      );

      if (servErr) throw servErr;
      setServicos(servicosData || []);

      // 4) Agendamentos (últimos 200 pra ter histórico decente)
      const { data: ags, error: agErr } = await withTimeout(
        supabase
          .from('agendamentos')
          .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
          .in('profissional_id', ids)
          .order('data', { ascending: false })
          .limit(200),
        9000,
        'agendamentos'
      );

      if (agErr) throw agErr;

      // Auto-concluir passados (sem travar UI)
      if (ags?.length) {
        const agora = new Date();
        const toUpdate = [];

        for (const a of ags) {
          if (a?.status === 'agendado' || a?.status === 'confirmado') {
            const dataHoraFim = new Date(`${a.data}T${a.hora_fim}`);
            if (dataHoraFim < agora) toUpdate.push(a.id);
          }
        }

        if (toUpdate.length) {
          Promise.allSettled(
            toUpdate.map(id =>
              supabase
                .from('agendamentos')
                .update({ status: 'concluido', concluido_em: new Date().toISOString() })
                .eq('id', id)
            )
          ).then(async () => {
            const { data } = await supabase
              .from('agendamentos')
              .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
              .in('profissional_id', ids)
              .order('data', { ascending: false })
              .limit(200);

            setAgendamentos(data || []);
          });
        }
      }

      setAgendamentos(ags || []);
    } catch (e) {
      console.error('Erro ao carregar:', e);
      setError(e?.message || 'Erro inesperado ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!barbearia) return;
    navigator.clipboard.writeText(`${window.location.origin}/v/${barbearia.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ========= LOGO BARBEARIA =========
  const handleUploadLogo = async (file) => {
    if (!file) return;
    if (!barbearia?.id) {
      alert('Barbearia não carregada.');
      return;
    }

    // validações básicas
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Use PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('Imagem muito grande. Máx 3MB.');
      return;
    }

    setUploadingLogo(true);
    try {
      // Reutiliza bucket avatars (o que você já criou)
      const ext = file.name.split('.').pop() || 'png';
      const path = `barbearias/${barbearia.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const logoUrl = pub?.publicUrl || null;

      const { error: dbErr } = await supabase
        .from('barbearias')
        .update({ logo_url: logoUrl })
        .eq('id', barbearia.id);

      if (dbErr) throw dbErr;

      setBarbearia(prev => prev ? ({ ...prev, logo_url: logoUrl }) : prev);
      alert('✅ Logo atualizada!');
    } catch (e) {
      console.error('Erro logo:', e);
      alert('❌ Erro ao atualizar logo: ' + (e?.message || ''));
    } finally {
      setUploadingLogo(false);
    }
  };

  // ========= SERVIÇOS =========
  const createServico = async (e) => {
    e.preventDefault();
    try {
      if (!barbearia?.id) throw new Error('Barbearia não carregada.');

      const payload = {
        nome: String(formServico.nome || '').trim(),
        profissional_id: formServico.profissional_id,
        duracao_minutos: toNumberOrNull(formServico.duracao_minutos),
        preco: toNumberOrNull(formServico.preco),
        ativo: true,
      };

      if (!payload.nome) throw new Error('Nome do serviço é obrigatório.');
      if (!payload.profissional_id) throw new Error('Selecione um profissional.');
      if (!payload.duracao_minutos) throw new Error('Duração inválida.');
      if (payload.preco == null) throw new Error('Preço inválido.');

      const { error } = await withTimeout(
        supabase.from('servicos').insert([payload]),
        9000,
        'createServico'
      );
      if (error) throw error;

      alert('✅ Serviço criado!');
      setShowNovoServico(false);
      setEditingServicoId(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      await loadData();
    } catch (e2) {
      console.error('createServico error:', e2);
      alert('❌ Erro ao criar serviço: ' + (e2?.message || ''));
    }
  };

  const updateServico = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: String(formServico.nome || '').trim(),
        duracao_minutos: toNumberOrNull(formServico.duracao_minutos),
        preco: toNumberOrNull(formServico.preco),
        profissional_id: formServico.profissional_id
      };

      if (!payload.nome) throw new Error('Nome do serviço é obrigatório.');
      if (!payload.profissional_id) throw new Error('Selecione um profissional.');
      if (!payload.duracao_minutos) throw new Error('Duração inválida.');
      if (payload.preco == null) throw new Error('Preço inválido.');

      const { error } = await withTimeout(
        supabase
          .from('servicos')
          .update(payload)
          .eq('id', editingServicoId),
        9000,
        'updateServico'
      );

      if (error) throw error;

      alert('✅ Serviço atualizado!');
      setShowNovoServico(false);
      setEditingServicoId(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
      await loadData();
    } catch (e2) {
      console.error('updateServico error:', e2);
      alert('❌ Erro ao atualizar serviço: ' + (e2?.message || ''));
    }
  };

  const deleteServico = async (id) => {
    if (!confirm('Excluir serviço?')) return;
    try {
      const { error } = await withTimeout(
        supabase.from('servicos').delete().eq('id', id),
        9000,
        'deleteServico'
      );
      if (error) throw error;
      alert('✅ Serviço excluído!');
      await loadData();
    } catch (e2) {
      console.error('deleteServico error:', e2);
      alert('❌ Erro ao excluir serviço: ' + (e2?.message || ''));
    }
  };

  // ========= PROFISSIONAIS =========
  const createProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!barbearia?.id) throw new Error('Barbearia não carregada.');

      const payload = {
        barbearia_id: barbearia.id,
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
      };

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await withTimeout(
        supabase.from('profissionais').insert([payload]),
        9000,
        'createProfissional'
      );
      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setEditingProfissional(null);
      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
      await loadData();
    } catch (e2) {
      console.error('createProfissional error:', e2);
      alert('❌ Erro ao adicionar profissional: ' + (e2?.message || ''));
    }
  };

  const updateProfissional = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
      };

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await withTimeout(
        supabase
          .from('profissionais')
          .update(payload)
          .eq('id', editingProfissional.id),
        9000,
        'updateProfissional'
      );

      if (error) throw error;

      alert('✅ Profissional atualizado!');
      setShowNovoProfissional(false);
      setEditingProfissional(null);
      await loadData();
    } catch (e2) {
      console.error('updateProfissional error:', e2);
      alert('❌ Erro ao atualizar profissional: ' + (e2?.message || ''));
    }
  };

  // ✅ Ativar / Inativar + motivo (RESPONSIVO + COMPLETO)
  const toggleAtivoProfissional = async (p) => {
    try {
      if (p.ativo === undefined) {
        alert('⚠️ Falta a coluna "ativo" na tabela profissionais.');
        return;
      }

      const novoAtivo = !p.ativo;

      let motivo = null;
      if (!novoAtivo) motivo = prompt('Motivo (opcional) para inativar este profissional:') || null;

      const { error } = await withTimeout(
        supabase
          .from('profissionais')
          .update({
            ativo: novoAtivo,
            motivo_inativo: novoAtivo ? null : motivo
          })
          .eq('id', p.id),
        9000,
        'toggleAtivoProfissional'
      );

      if (error) throw error;

      alert(novoAtivo ? '✅ Profissional ativado!' : '⛔ Profissional inativado!');
      await loadData();
    } catch (e) {
      console.error('toggleAtivoProfissional:', e);
      alert('❌ Erro ao alterar status: ' + (e?.message || ''));
    }
  };

  const excluirProfissional = async (p) => {
    const ok = confirm(`Excluir "${p.nome}"?\n\nATENÇÃO: isso remove o profissional definitivamente.`);
    if (!ok) return;

    try {
      const { error } = await withTimeout(
        supabase
          .from('profissionais')
          .delete()
          .eq('id', p.id),
        9000,
        'excluirProfissional'
      );

      if (error) throw error;

      alert('✅ Profissional excluído!');
      await loadData();
    } catch (e) {
      console.error('excluirProfissional:', e);
      alert('❌ Erro ao excluir: ' + (e?.message || ''));
    }
  };

  // ========= AGENDAMENTOS =========
  const confirmarAtendimento = async (id) => {
    try {
      const { error } = await withTimeout(
        supabase
          .from('agendamentos')
          .update({ status: 'concluido', concluido_em: new Date().toISOString() })
          .eq('id', id),
        9000,
        'confirmarAtendimento'
      );

      if (error) throw error;

      alert('✅ Atendimento confirmado!');
      await loadData();
    } catch (e2) {
      console.error('confirmarAtendimento error:', e2);
      alert('❌ Erro: ' + (e2?.message || ''));
    }
  };

  // ====== DADOS PARA VISÃO GERAL / HISTÓRICO ======
  const agsNaoCancelados = agendamentos.filter(a => !String(a.status || '').includes('cancelado'));
  const agsCancelados = agendamentos.filter(a => String(a.status || '').includes('cancelado'));

  const agsHoje = agendamentos.filter(a => a.data === hojeISO);
  const agsHojeNaoCancelados = agsHoje.filter(a => !String(a.status || '').includes('cancelado'));
  const agsHojeCancelados = agsHoje.filter(a => String(a.status || '').includes('cancelado'));

  const concluidosHoje = agsHojeNaoCancelados.filter(a => a.status === 'concluido');
  const faturamentoHoje = concluidosHoje.reduce((sum, a) => sum + Number(a.servicos?.preco || 0), 0);

  const totalHoje = agsHoje.length;
  const taxaCancelamentoHoje = totalHoje > 0 ? Math.round((agsHojeCancelados.length / totalHoje) * 100) : 0;
  const taxaComparecimentoHoje = totalHoje > 0
    ? Math.round((concluidosHoje.length / totalHoje) * 100)
    : 0;

  const historicoDoDia = agendamentos
    .filter(a => a.data === historicoData)
    .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

  // ====== UI ======
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-primary text-xl font-bold">Carregando...</div>
      </div>
    </div>
  );

  if (error || !barbearia) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-100 border border-red-500/50 rounded-custom p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">Erro ao carregar</h1>
        <p className="text-gray-400 mb-6">{error || 'Barbearia não encontrada'}</p>
        <button onClick={loadData} className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold mb-3">
          Tentar Novamente
        </button>
        <button onClick={onLogout} className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-button font-bold">
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              {/* ✅ LOGO redonda ou fallback */}
              <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-800 bg-dark-200 flex items-center justify-center">
                {barbearia.logo_url ? (
                  <img
                    src={barbearia.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center">
                    <Award className="w-7 h-7 text-black" />
                  </div>
                )}
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
            <div className="text-3xl font-black text-white mb-1">{agsHojeNaoCancelados.length}</div>
            <div className="text-sm text-gray-400 font-bold">Agendamentos Hoje (ativos)</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Users className="w-8 h-8 text-purple-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">{profissionais.length}</div>
            <div className="text-sm text-gray-400 font-bold">Profissionais</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <TrendingUp className="w-8 h-8 text-primary mb-2" />
            <div className="text-3xl font-black text-white mb-1">{servicos.filter(s => s.ativo !== false).length}</div>
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
                  activeTab === tab ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Visão Geral (AGORA TEM CONTEÚDO + LOGO) */}
            {activeTab === 'visao-geral' && (
              <div className="space-y-6">
                {/* Logo uploader */}
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <h2 className="text-xl font-black mb-3">LOGO DA BARBEARIA</h2>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-800 bg-dark-100">
                      {barbearia.logo_url ? (
                        <img src={barbearia.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-dark-100 flex items-center justify-center text-gray-500 font-black">
                          SEM
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-sm text-gray-400 mb-2">
                        Envie uma imagem para aparecer na vitrine (redonda).
                      </p>

                      <label className="inline-block">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => handleUploadLogo(e.target.files?.[0])}
                          disabled={uploadingLogo}
                        />
                        <span className={`inline-block px-6 py-3 rounded-button font-black cursor-pointer transition-all ${
                          uploadingLogo ? 'bg-gray-800 text-gray-400' : 'bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30'
                        }`}>
                          {uploadingLogo ? 'ENVIANDO...' : 'ALTERAR LOGO'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Métricas do dia */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">TOTAL HOJE</div>
                    <div className="text-3xl font-black">{totalHoje}</div>
                    <div className="text-sm text-gray-400 mt-1">Inclui cancelados</div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">CANCELAMENTO HOJE</div>
                    <div className="text-3xl font-black text-red-300">{taxaCancelamentoHoje}%</div>
                    <div className="text-sm text-gray-400 mt-1">{agsHojeCancelados.length} cancelados</div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">COMPARECIMENTO HOJE</div>
                    <div className="text-3xl font-black text-green-300">{taxaComparecimentoHoje}%</div>
                    <div className="text-sm text-gray-400 mt-1">{concluidosHoje.length} concluídos</div>
                  </div>
                </div>

                {/* Histórico por data */}
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-xl font-black">HISTÓRICO DE AGENDAMENTOS</h2>

                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500 font-bold">SELECIONAR DATA</div>
                      <input
                        type="date"
                        value={historicoData}
                        onChange={(e) => setHistoricoData(e.target.value)}
                        className="px-3 py-2 bg-dark-100 border border-gray-800 rounded-custom text-white text-sm"
                      />
                    </div>
                  </div>

                  {historicoDoDia.length > 0 ? (
                    <div className="space-y-3">
                      {historicoDoDia.map(a => {
                        const isCancel = String(a.status || '').includes('cancelado');
                        const isDone = a.status === 'concluido';

                        return (
                          <div
                            key={a.id}
                            className={`border rounded-custom p-4 ${
                              isCancel ? 'border-red-500/30 bg-red-500/5' : 'border-gray-800 bg-dark-100'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div>
                                <div className="font-black text-lg">{a.users?.nome || 'Cliente'}</div>
                                <div className="text-sm text-gray-400">
                                  {a.servicos?.nome} • {a.profissionais?.nome}
                                </div>
                              </div>

                              <div className={`px-3 py-1 rounded-button text-xs font-bold border inline-flex self-start ${
                                isCancel
                                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                  : isDone
                                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                                    : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                              }`}>
                                {isCancel ? 'CANCELADO' : isDone ? 'CONCLUÍDO' : 'ATIVO'}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 font-bold">Data</div>
                                <div className="font-bold">{formatBR(a.data)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 font-bold">Início</div>
                                <div className="font-bold">{a.hora_inicio}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 font-bold">Fim</div>
                                <div className="font-bold">{a.hora_fim}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 font-bold">Valor</div>
                                <div className="font-bold">R$ {a.servicos?.preco ?? '-'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-10">
                      Nenhum agendamento nessa data.
                    </div>
                  )}
                </div>

                {/* Resumo geral */}
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <h2 className="text-xl font-black mb-3">RESUMO GERAL</h2>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 font-bold mb-1">TOTAL (GERAL)</div>
                      <div className="text-2xl font-black">{agendamentos.length}</div>
                    </div>

                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 font-bold mb-1">CANCELADOS (GERAL)</div>
                      <div className="text-2xl font-black text-red-300">{agsCancelados.length}</div>
                    </div>

                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 font-bold mb-1">ATIVOS (GERAL)</div>
                      <div className="text-2xl font-black text-blue-300">{agsNaoCancelados.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agendamentos (HOJE) */}
            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos de Hoje</h2>
                {agsHojeNaoCancelados.length > 0 ? (
                  <div className="space-y-4">
                    {agsHojeNaoCancelados
                      .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
                      .map(a => (
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

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Horário</div>
                            <div className="text-sm font-bold">{a.hora_inicio}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Valor</div>
                            <div className="text-sm font-bold">R$ {a.servicos?.preco}</div>
                          </div>
                          <div className="hidden sm:block">
                            <div className="text-xs text-gray-500 font-bold">Fim</div>
                            <div className="text-sm font-bold">{a.hora_fim}</div>
                          </div>
                        </div>

                        {a.status !== 'concluido' && (
                          <button
                            onClick={() => confirmarAtendimento(a.id)}
                            className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-custom font-bold text-sm"
                          >
                            ✓ CONFIRMAR ATENDIMENTO
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
                {agsCancelados.length > 0 ? (
                  <div className="space-y-4">
                    {agsCancelados.map(a => (
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

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Data</div>
                            <div className="text-white font-bold">{formatBR(a.data)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Horário</div>
                            <div className="text-white font-bold">{a.hora_inicio}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-bold">Profissional</div>
                            <div className="text-white font-bold">{a.profissionais?.nome}</div>
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
                    onClick={() => {
                      setShowNovoServico(true);
                      setEditingServicoId(null);
                      setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
                    }}
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
                            {s.ativo === false && (
                              <div className="text-xs mt-2 inline-block px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 font-bold">
                                INATIVO
                              </div>
                            )}
                          </div>
                          <div className="text-2xl font-black text-primary">R$ {s.preco}</div>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">{s.duracao_minutos} min</p>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingServicoId(s.id);
                              setFormServico({
                                nome: s.nome || '',
                                duracao_minutos: String(s.duracao_minutos ?? ''),
                                preco: String(s.preco ?? ''),
                                profissional_id: s.profissional_id || ''
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
                            <Trash2 className="w-4 h-4 inline mr-1" />
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
                    onClick={() => {
                      setShowNovoProfissional(true);
                      setEditingProfissional(null);
                      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />Adicionar
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profissionais.map(p => {
                    const ativo = (p.ativo === undefined) ? true : !!p.ativo;

                    return (
                      <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-black font-black text-xl">
                            {p.nome?.[0] || 'P'}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-black flex items-center gap-2">
                              {p.nome}
                              {!ativo && (
                                <span className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 font-black">
                                  INATIVO
                                </span>
                              )}
                            </h3>
                            {p.anos_experiencia != null && (
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

                        {/* ✅ Ativar / Inativar / Excluir (RESPONSIVO NO MOBILE) */}
                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
                          <button
                            onClick={() => toggleAtivoProfissional(p)}
                            className={`w-full sm:flex-1 py-2 rounded-custom font-bold text-sm border ${
                              ativo
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                : 'bg-green-500/10 border-green-500/30 text-green-300'
                            }`}
                          >
                            {ativo ? 'INATIVAR' : 'ATIVAR'}
                          </button>

                          <button
                            onClick={() => excluirProfissional(p)}
                            className="w-full sm:flex-1 py-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-custom font-bold text-sm"
                          >
                            EXCLUIR
                          </button>
                        </div>

                        {!ativo && (p.motivo_inativo || p.motivo_inativo === '') && (
                          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-custom p-2 mb-3">
                            INATIVO {p.motivo_inativo ? `• ${p.motivo_inativo}` : ''}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setEditingProfissional(p);
                            setFormProfissional({
                              nome: p.nome || '',
                              anos_experiencia: String(p.anos_experiencia ?? ''),
                              horario_inicio: p.horario_inicio || '08:00',
                              horario_fim: p.horario_fim || '18:00'
                            });
                            setShowNovoProfissional(true);
                          }}
                          className="w-full py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-custom font-bold text-sm"
                        >
                          Editar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Serviço */}
      {showNovoServico && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">{editingServicoId ? 'Editar Serviço' : 'Novo Serviço'}</h3>
              <button
                onClick={() => {
                  setShowNovoServico(false);
                  setEditingServicoId(null);
                  setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingServicoId ? updateServico : createServico} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Profissional</label>
                <select
                  value={formServico.profissional_id}
                  onChange={(e) => setFormServico({ ...formServico, profissional_id: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                >
                  <option value="">Selecione</option>
                  {profissionais
                    .filter(p => (p.ativo === undefined ? true : !!p.ativo)) // ✅ não mostra inativo
                    .map(p => (
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

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black">
                {editingServicoId ? 'SALVAR' : 'CRIAR SERVIÇO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Profissional */}
      {showNovoProfissional && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">{editingProfissional ? 'Editar Profissional' : 'Novo Profissional'}</h3>
              <button
                onClick={() => {
                  setShowNovoProfissional(false);
                  setEditingProfissional(null);
                  setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00' });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingProfissional ? updateProfissional : createProfissional} className="space-y-4">
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

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black">
                {editingProfissional ? 'SALVAR' : 'ADICIONAR'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
