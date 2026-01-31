import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, X, ExternalLink, Eye, Copy, Check, Calendar, DollarSign,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock
} from 'lucide-react';
import { supabase } from '../supabase';

const toNumberOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const sameDay = (a, b) => String(a || '') === String(b || '');

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h * 60) + (m || 0);
}

function getNowSP() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type)?.value;
  const y = get('year');
  const mo = get('month');
  const d = get('day');
  const hh = get('hour');
  const mm = get('minute');

  const date = `${y}-${mo}-${d}`;
  const minutes = (Number(hh) * 60) + Number(mm);

  // weekday em SP:
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short'
  }).format(new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday] ?? new Date().getDay();

  return { date, minutes, dow };
}

const WEEKDAYS = [
  { i: 0, label: 'DOM' },
  { i: 1, label: 'SEG' },
  { i: 2, label: 'TER' },
  { i: 3, label: 'QUA' },
  { i: 4, label: 'QUI' },
  { i: 5, label: 'SEX' },
  { i: 6, label: 'SÁB' },
];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('visao-geral');

  const [barbearia, setBarbearia] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [copied, setCopied] = useState(false);

  // Histórico (data selecionada)
  const hoje = new Date().toISOString().split('T')[0];
  const [historicoData, setHistoricoData] = useState(hoje);

  // Modais
  const [showNovoServico, setShowNovoServico] = useState(false);
  const [showNovoProfissional, setShowNovoProfissional] = useState(false);

  // Edição
  const [editingServicoId, setEditingServicoId] = useState(null);
  const [editingProfissional, setEditingProfissional] = useState(null);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);

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
    horario_fim: '18:00',
    dias_semana: [1, 2, 3, 4, 5, 6] // default SEG-SÁB
  });

  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais]);

  // detecta se existe a coluna dias_semana (pra não quebrar se não tiver)
  const supportsDiasSemana = useMemo(() => {
    return profissionais.some(p => Object.prototype.hasOwnProperty.call(p, 'dias_semana'));
  }, [profissionais]);

  useEffect(() => {
    if (user?.id) loadData();
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
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setError('Nenhuma barbearia cadastrada.');
        setLoading(false);
        return;
      }

      setBarbearia(barbeariaData);

      // Profissionais
      const { data: profissionaisData, error: profErr } = await supabase
        .from('profissionais')
        .select('*')
        .eq('barbearia_id', barbeariaData.id)
        .order('created_at', { ascending: false });

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

      // Serviços
      const { data: servicosData, error: servErr } = await supabase
        .from('servicos')
        .select('*, profissionais (nome)')
        .in('profissional_id', ids)
        .order('created_at', { ascending: false });

      if (servErr) throw servErr;
      setServicos(servicosData || []);

      // Agendamentos (traz recente, UI filtra por data)
      const { data: ags, error: agErr } = await supabase
        .from('agendamentos')
        .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
        .in('profissional_id', ids)
        .order('data', { ascending: false })
        .limit(300);

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
          ).then(() => {
            supabase
              .from('agendamentos')
              .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
              .in('profissional_id', ids)
              .order('data', { ascending: false })
              .limit(300)
              .then(({ data }) => setAgendamentos(data || []));
          });
        }
      }

      setAgendamentos(ags || []);
    } catch (e) {
      console.error('Erro ao carregar:', e);
      setError(e?.message || 'Erro inesperado.');
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

  // ===================== LOGO (upload + salvar URL) =====================
  const uploadLogoBarbearia = async (file) => {
    if (!file) return;
    if (!user?.id) return alert('Sessão inválida.');
    if (!barbearia?.id) return alert('Barbearia não carregada.');

    try {
      setLogoUploading(true);

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${user.id}/logo-${Date.now()}.${ext}`; // <= precisa cair na policy own_folder

      const { error: upErr } = await supabase
        .storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/png'
        });

      if (upErr) throw upErr;

      const { data: pub } = supabase
        .storage
        .from('logos')
        .getPublicUrl(filePath);

      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Não foi possível gerar a URL pública da logo.');

      const { error: dbErr } = await supabase
        .from('barbearias')
        .update({ logo_url: publicUrl })
        .eq('id', barbearia.id);

      if (dbErr) throw dbErr;

      alert('✅ Logo atualizada!');
      await loadData();
    } catch (e) {
      console.error('Erro ao atualizar logo:', e);
      alert('❌ Erro ao atualizar logo: ' + (e?.message || ''));
    } finally {
      setLogoUploading(false);
    }
  };

  // ===================== SERVIÇOS =====================
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
        barbearia_id: barbearia.id,
      };

      if (!payload.nome) throw new Error('Nome do serviço é obrigatório.');
      if (!payload.profissional_id) throw new Error('Selecione um profissional.');
      if (!payload.duracao_minutos) throw new Error('Duração inválida.');
      if (payload.preco == null) throw new Error('Preço inválido.');

      const { error } = await supabase.from('servicos').insert([payload]);
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

      const { error } = await supabase
        .from('servicos')
        .update(payload)
        .eq('id', editingServicoId);

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
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;
      alert('✅ Serviço excluído!');
      await loadData();
    } catch (e2) {
      console.error('deleteServico error:', e2);
      alert('❌ Erro ao excluir serviço: ' + (e2?.message || ''));
    }
  };

  // ===================== PROFISSIONAIS =====================
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

      // só tenta salvar dias_semana se a coluna existir (pra não quebrar)
      if (supportsDiasSemana) {
        payload.dias_semana = Array.isArray(formProfissional.dias_semana) ? formProfissional.dias_semana : [1,2,3,4,5,6];
      }

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await supabase.from('profissionais').insert([payload]);
      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setEditingProfissional(null);
      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_semana: [1,2,3,4,5,6] });
      await loadData();
    } catch (e2) {
      console.error('createProfissional error:', e2);
      alert('❌ Erro ao adicionar profissional: ' + (e2?.message || ''));
    }
  };

  const updateProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!editingProfissional?.id) throw new Error('Profissional inválido.');

      const payload = {
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
      };

      if (supportsDiasSemana) {
        payload.dias_semana = Array.isArray(formProfissional.dias_semana) ? formProfissional.dias_semana : [1,2,3,4,5,6];
      }

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await supabase
        .from('profissionais')
        .update(payload)
        .eq('id', editingProfissional.id);

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

  // ✅ Ativar / Inativar + motivo
  const toggleAtivoProfissional = async (p) => {
    try {
      if (p.ativo === undefined) {
        alert('⚠️ Falta a coluna "ativo" na tabela profissionais.');
        return;
      }

      const novoAtivo = !p.ativo;

      let motivo = null;
      if (!novoAtivo) motivo = prompt('Motivo (opcional) para inativar este profissional:') || null;

      const { error } = await supabase
        .from('profissionais')
        .update({
          ativo: novoAtivo,
          motivo_inativo: novoAtivo ? null : motivo
        })
        .eq('id', p.id);

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
      const { error } = await supabase
        .from('profissionais')
        .delete()
        .eq('id', p.id);

      if (error) throw error;

      alert('✅ Profissional excluído!');
      await loadData();
    } catch (e) {
      console.error('excluirProfissional:', e);
      alert('❌ Erro ao excluir: ' + (e?.message || ''));
    }
  };

  // ===================== AGENDAMENTOS =====================
  const confirmarAtendimento = async (id) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Atendimento confirmado!');
      await loadData();
    } catch (e2) {
      console.error('confirmarAtendimento error:', e2);
      alert('❌ Erro: ' + (e2?.message || ''));
    }
  };

  // ======= Visão Geral + Histórico =======
  const agendamentosHoje = useMemo(
    () => agendamentos.filter(a => sameDay(a.data, hoje)),
    [agendamentos, hoje]
  );

  const hojeValidos = useMemo(
    () => agendamentosHoje.filter(a => !String(a.status || '').includes('cancelado')),
    [agendamentosHoje]
  );

  const hojeCancelados = useMemo(
    () => agendamentosHoje.filter(a => String(a.status || '').includes('cancelado')),
    [agendamentosHoje]
  );

  const hojeConcluidos = useMemo(
    () => agendamentosHoje.filter(a => a.status === 'concluido'),
    [agendamentosHoje]
  );

  const faturamentoHoje = useMemo(
    () => hojeConcluidos.reduce((sum, a) => sum + Number(a.servicos?.preco || 0), 0),
    [hojeConcluidos]
  );

  const ticketMedioHoje = useMemo(
    () => (hojeConcluidos.length ? (faturamentoHoje / hojeConcluidos.length) : 0),
    [faturamentoHoje, hojeConcluidos.length]
  );

  const cancelRateHoje = useMemo(() => {
    const total = agendamentosHoje.length || 0;
    const canc = hojeCancelados.length || 0;
    return total ? (canc / total) * 100 : 0;
  }, [agendamentosHoje.length, hojeCancelados.length]);

  const proximoAgendamento = useMemo(() => {
    const now = new Date();
    const nowTime = now.toTimeString().slice(0, 5);

    const futuros = hojeValidos
      .filter(a => String(a.hora_inicio || '') >= nowTime)
      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));

    return futuros[0] || null;
  }, [hojeValidos]);

  const agendamentosDiaSelecionado = useMemo(() => {
    return agendamentos
      .filter(a => sameDay(a.data, historicoData))
      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }, [agendamentos, historicoData]);

  // ======= Status do profissional (luz verde/vermelha) =======
  const getProfStatus = (p) => {
    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
    if (!ativo) return { label: 'INATIVO', color: 'bg-red-500' };

    const now = getNowSP();
    const ini = timeToMinutes(p.horario_inicio || '08:00');
    const fim = timeToMinutes(p.horario_fim || '18:00');

    // se não tiver dias_semana, assume todos
    const dias = (Array.isArray(p.dias_semana) && p.dias_semana.length)
      ? p.dias_semana
      : [0,1,2,3,4,5,6];

    const trabalhaHoje = dias.includes(now.dow);
    const dentroHorario = now.minutes >= ini && now.minutes < fim;

    if (trabalhaHoje && dentroHorario) return { label: 'ABERTO', color: 'bg-green-500' };
    return { label: 'FECHADO', color: 'bg-yellow-500' };
  };

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
              {/* Logo redonda no header */}
              <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-800 bg-dark-200 flex items-center justify-center">
                {barbearia.logo_url ? (
                  <img src={barbearia.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center">
                    <Award className="w-7 h-7 text-black" />
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-xl font-black">{barbearia.nome}</h1>
                <p className="text-xs text-gray-500 font-bold -mt-1">DASHBOARD</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to={`/v/${barbearia.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button font-bold text-sm"
              >
                <Eye className="w-4 h-4" />Ver Vitrine
              </Link>

              {/* Botão LOGO no header (pequeno no mobile) */}
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadLogoBarbearia(e.target.files?.[0])}
                  disabled={logoUploading}
                />
                <span
                  className={`inline-block rounded-button font-black border transition-all ${
                    logoUploading
                      ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary cursor-pointer'
                  }
                  px-3 py-2 text-[11px]
                  sm:px-4 sm:py-2 sm:text-sm
                  `}
                >
                  {/* Mobile: curto e discreto / Desktop: mais explícito */}
                  <span className="sm:hidden">{logoUploading ? '...' : 'LOGO'}</span>
                  <span className="hidden sm:inline">{logoUploading ? 'ENVIANDO...' : 'ALTERAR LOGO'}</span>
                </span>
              </label>

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
        {/* Stats do topo */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-custom p-6">
            <DollarSign className="w-8 h-8 text-green-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">R$ {faturamentoHoje.toFixed(2)}</div>
            <div className="text-sm text-green-300 font-bold">Faturamento Hoje</div>
          </div>
          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Calendar className="w-8 h-8 text-blue-400 mb-2" />
            <div className="text-3xl font-black text-white mb-1">{hojeValidos.length}</div>
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
            <div className="text-sm text-gray-400 font-bold">Serviços (total)</div>
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
            {['visao-geral', 'agendamentos', 'cancelados', 'historico', 'servicos', 'profissionais'].map(tab => (
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
            {/* VISÃO GERAL */}
            {activeTab === 'visao-geral' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">Cancelamentos Hoje</div>
                    <div className="text-3xl font-black text-white">{hojeCancelados.length}</div>
                    <div className="text-sm text-gray-400 font-bold mt-1">
                      Taxa: <span className="text-primary">{cancelRateHoje.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">Concluídos Hoje</div>
                    <div className="text-3xl font-black text-white">{hojeConcluidos.length}</div>
                    <div className="text-sm text-gray-400 font-bold mt-1">
                      Ticket médio: <span className="text-primary">R$ {ticketMedioHoje.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 font-bold mb-2">Próximo agendamento</div>
                    {proximoAgendamento ? (
                      <>
                        <div className="text-3xl font-black text-primary">{proximoAgendamento.hora_inicio}</div>
                        <div className="text-sm text-gray-300 font-bold mt-1">
                          {proximoAgendamento.users?.nome || 'Cliente'} • {proximoAgendamento.profissionais?.nome}
                        </div>
                        <div className="text-xs text-gray-500 font-bold mt-1">
                          {proximoAgendamento.servicos?.nome}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 font-bold">Nenhum futuro hoje</div>
                    )}
                  </div>
                </div>

                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <h3 className="text-lg font-black mb-3">Resumo rápido</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 font-bold">Total hoje</div>
                      <div className="text-2xl font-black">{agendamentosHoje.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-bold">Válidos hoje</div>
                      <div className="text-2xl font-black">{hojeValidos.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-bold">Cancelados hoje</div>
                      <div className="text-2xl font-black">{hojeCancelados.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-bold">Faturamento hoje</div>
                      <div className="text-2xl font-black">R$ {faturamentoHoje.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-500 font-bold">
                  Dica: essa visão geral “reflete movimento real” e te ajuda a bater o olho e entender o dia.
                </div>
              </div>
            )}

            {/* AGENDAMENTOS (HOJE) */}
            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos de Hoje</h2>
                {hojeValidos.length > 0 ? (
                  <div className="space-y-4">
                    {hojeValidos
                      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
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

            {/* CANCELADOS */}
            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos Cancelados (Hoje)</h2>
                {hojeCancelados.length > 0 ? (
                  <div className="space-y-4">
                    {hojeCancelados
                      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
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
                  <p className="text-gray-500 text-center py-12">Nenhum cancelamento hoje</p>
                )}
              </div>
            )}

            {/* HISTÓRICO */}
            {activeTab === 'historico' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <h2 className="text-2xl font-black">Histórico de Agendamentos</h2>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 font-bold">Dia:</span>
                    <input
                      type="date"
                      value={historicoData}
                      onChange={(e) => setHistoricoData(e.target.value)}
                      className="px-3 py-2 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    />
                  </div>
                </div>

                {agendamentosDiaSelecionado.length > 0 ? (
                  <div className="space-y-3">
                    {agendamentosDiaSelecionado.map(a => {
                      const isCancel = String(a.status || '').includes('cancelado');
                      const isDone = a.status === 'concluido';

                      return (
                        <div
                          key={a.id}
                          className={`bg-dark-200 border rounded-custom p-4 ${
                            isCancel ? 'border-red-500/30' : 'border-gray-800'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-black text-lg">{a.users?.nome || 'Cliente'}</div>
                              <div className="text-sm text-gray-400 font-bold">
                                {a.hora_inicio} • {a.servicos?.nome} • {a.profissionais?.nome}
                              </div>
                            </div>

                            <div className={`px-3 py-1 rounded-button text-xs font-bold ${
                              isCancel ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                              : isDone ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                              : 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                            }`}>
                              {isCancel ? 'Cancelado' : isDone ? 'Concluído' : 'Agendado'}
                            </div>
                          </div>

                          <div className="text-sm text-gray-300 font-bold">
                            Valor: <span className="text-primary">R$ {a.servicos?.preco ?? '0.00'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-12 font-bold">
                    Nenhum agendamento neste dia.
                  </div>
                )}
              </div>
            )}

            {/* SERVIÇOS */}
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
                      onClick={() => {
                        setShowNovoServico(true);
                        setEditingServicoId(null);
                        setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                    >
                      Adicionar Primeiro Serviço
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PROFISSIONAIS */}
            {activeTab === 'profissionais' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Profissionais</h2>
                  <button
                    onClick={() => {
                      setShowNovoProfissional(true);
                      setEditingProfissional(null);
                      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_semana: [1,2,3,4,5,6] });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-bold"
                  >
                    <Plus className="w-5 h-5" />Adicionar
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profissionais.map(p => {
                    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
                    const status = getProfStatus(p);

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

                            {/* luz status */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                              <span className="text-xs text-gray-400 font-bold">{status.label}</span>
                            </div>

                            {p.anos_experiencia != null && (
                              <p className="text-xs text-gray-500 font-bold mt-1">{p.anos_experiencia} anos</p>
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

                        {/* ✅ Ativar / Inativar / Excluir */}
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => toggleAtivoProfissional(p)}
                            className={`flex-1 py-2 rounded-custom font-bold text-sm border ${
                              ativo
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                : 'bg-green-500/10 border-green-500/30 text-green-300'
                            }`}
                          >
                            {ativo ? 'Inativar' : 'Ativar'}
                          </button>

                          <button
                            onClick={() => excluirProfissional(p)}
                            className="flex-1 py-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-custom font-bold text-sm"
                          >
                            Excluir
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
                              horario_fim: p.horario_fim || '18:00',
                              dias_semana: Array.isArray(p.dias_semana) && p.dias_semana.length ? p.dias_semana : [1,2,3,4,5,6],
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

                {!supportsDiasSemana && (
                  <div className="mt-6 text-xs text-gray-500 font-bold bg-dark-200 border border-gray-800 rounded-custom p-4">
                    Observação: “Dias de trabalho” está pronto no painel, mas sua tabela <b>profissionais</b> ainda não tem a coluna <b>dias_semana</b>.
                    Quando você criar essa coluna, o painel passa a salvar e refletir automaticamente.
                  </div>
                )}
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
                    .filter(p => (p.ativo === undefined ? true : !!p.ativo))
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
                  setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_semana: [1,2,3,4,5,6] });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* ✅ FIX do bug: submit correto (SALVAR quando editando, ADICIONAR quando novo) */}
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

              {/* Dias de trabalho (só “ativa de verdade” quando existir coluna dias_semana) */}
              <div>
                <label className="block text-sm font-bold mb-2">Dias de trabalho</label>
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAYS.map(d => {
                    const active = (formProfissional.dias_semana || []).includes(d.i);
                    return (
                      <button
                        type="button"
                        key={d.i}
                        onClick={() => {
                          const cur = Array.isArray(formProfissional.dias_semana) ? [...formProfissional.dias_semana] : [];
                          const next = active ? cur.filter(x => x !== d.i) : [...cur, d.i];
                          setFormProfissional(prev => ({ ...prev, dias_semana: next.sort((a,b)=>a-b) }));
                        }}
                        className={`py-2 rounded-custom border font-black text-xs transition-all ${
                          active
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-dark-200 border-gray-800 text-gray-500'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-gray-500 font-bold mt-2">
                  Se a coluna <b>dias_semana</b> ainda não existir no banco, isso fica só no visual por enquanto.
                </p>
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
