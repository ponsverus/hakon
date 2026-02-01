import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, X, ExternalLink, Eye, Copy, Check, Calendar,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock, Image as ImageIcon, Save
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

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short'
  }).format(new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday] ?? new Date().getDay();

  return { date, minutes, dow };
}

// ✅ DOM=0 ... SÁB=6
const WEEKDAYS = [
  { i: 0, label: 'DOM' },
  { i: 1, label: 'SEG' },
  { i: 2, label: 'TER' },
  { i: 3, label: 'QUA' },
  { i: 4, label: 'QUI' },
  { i: 5, label: 'SEX' },
  { i: 6, label: 'SÁB' },
];

// ✅ Normaliza e GARANTE que domingo seja 0 (e não 7)
function normalizeDiasTrabalho(arr) {
  const base = Array.isArray(arr) ? arr : [];
  const cleaned = base
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .map(n => (n === 7 ? 0 : n))
    .filter(n => n >= 0 && n <= 6);

  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

// ✅ Data segura: YYYY-MM-DD -> DD/MM/YYYY (sem Date/UTC)
function formatDateBRFromISO(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
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

  // Histórico (data selecionada)
  const hoje = new Date().toISOString().split('T')[0];
  const [historicoData, setHistoricoData] = useState(hoje);

  // ✅ Data do filtro de faturamento (agora usado na VISÃO GERAL)
  const [faturamentoData, setFaturamentoData] = useState(hoje);

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

  // ✅ agora é dias_trabalho (coluna real)
  const [formProfissional, setFormProfissional] = useState({
    nome: '',
    anos_experiencia: '',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_trabalho: [1, 2, 3, 4, 5, 6] // default SEG-SÁB
  });

  // ✅ Info do negócio (barbearias)
  const [infoSaving, setInfoSaving] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [formInfo, setFormInfo] = useState({
    nome: '',
    descricao: '',
    telefone: '',
    endereco: '',
    instagram: '',
    facebook: '',
    galerias: [] // array de URLs
  });

  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais]);

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

      setFormInfo({
        nome: barbeariaData.nome || '',
        descricao: barbeariaData.descricao || '',
        telefone: barbeariaData.telefone || '',
        endereco: barbeariaData.endereco || '',
        instagram: barbeariaData.instagram || '',
        facebook: barbeariaData.facebook || '',
        galerias: Array.isArray(barbeariaData.galerias) ? barbeariaData.galerias : []
      });

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

      const { data: servicosData, error: servErr } = await supabase
        .from('servicos')
        .select('*, profissionais (nome)')
        .in('profissional_id', ids)
        .order('created_at', { ascending: false });

      if (servErr) throw servErr;
      setServicos(servicosData || []);

      const { data: ags, error: agErr } = await supabase
        .from('agendamentos')
        .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
        .in('profissional_id', ids)
        .order('data', { ascending: false })
        .limit(300);

      if (agErr) throw agErr;

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

  // ===================== LOGO =====================
  const uploadLogoBarbearia = async (file) => {
    if (!file) return;
    if (!user?.id) return alert('Sessão inválida.');
    if (!barbearia?.id) return alert('Barbearia não carregada.');

    try {
      setLogoUploading(true);

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${user.id}/logo-${Date.now()}.${ext}`;

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

  // ===================== INFO NEGÓCIO =====================
  const salvarInfoNegocio = async () => {
    if (!barbearia?.id) return alert('Barbearia não carregada.');
    try {
      setInfoSaving(true);

      const payload = {
        nome: String(formInfo.nome || '').trim(),
        descricao: String(formInfo.descricao || '').trim(),
        telefone: String(formInfo.telefone || '').trim(),
        endereco: String(formInfo.endereco || '').trim(),
        instagram: String(formInfo.instagram || '').trim() || null,
        facebook: String(formInfo.facebook || '').trim() || null,
        galerias: Array.isArray(formInfo.galerias) ? formInfo.galerias : []
      };

      const { error: updErr } = await supabase
        .from('barbearias')
        .update(payload)
        .eq('id', barbearia.id);

      if (updErr) throw updErr;

      alert('✅ Informações atualizadas!');
      await loadData();
    } catch (e) {
      console.error('Erro ao salvar info:', e);
      alert('❌ Erro ao salvar informações: ' + (e?.message || ''));
    } finally {
      setInfoSaving(false);
    }
  };

  const uploadGaleria = async (files) => {
    if (!files?.length) return;
    if (!barbearia?.id) return alert('Barbearia não carregada.');

    const maxMb = 4;
    const okTypes = ['image/png', 'image/jpeg', 'image/webp'];

    try {
      setGalleryUploading(true);

      const urlsNovas = [];

      for (const file of Array.from(files)) {
        if (!okTypes.includes(file.type)) {
          alert('❌ Formato inválido. Use PNG, JPG ou WEBP.');
          continue;
        }
        if (file.size > maxMb * 1024 * 1024) {
          alert(`❌ Imagem muito grande (máx ${maxMb}MB).`);
          continue;
        }

        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const path = `${barbearia.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

        const { error: upErr } = await supabase
          .storage
          .from('galerias')
          .upload(path, file, { upsert: true, contentType: file.type });

        if (upErr) {
          console.error('upload galeria error:', upErr);
          alert('❌ Erro ao enviar imagem: ' + upErr.message);
          continue;
        }

        const { data: pub } = supabase.storage.from('galerias').getPublicUrl(path);
        const url = pub?.publicUrl;
        if (url) urlsNovas.push(url);
      }

      if (urlsNovas.length) {
        const next = Array.isArray(formInfo.galerias) ? [...formInfo.galerias, ...urlsNovas] : [...urlsNovas];
        setFormInfo(prev => ({ ...prev, galerias: next }));

        const { error: updErr } = await supabase
          .from('barbearias')
          .update({ galerias: next })
          .eq('id', barbearia.id);

        if (updErr) throw updErr;

        alert('✅ Galeria atualizada!');
        await loadData();
      }
    } catch (e) {
      console.error('Erro uploadGaleria:', e);
      alert('❌ Erro ao atualizar galeria: ' + (e?.message || ''));
    } finally {
      setGalleryUploading(false);
    }
  };

  const removerImagemGaleria = async (url) => {
    if (!barbearia?.id) return;
    const ok = confirm('Remover esta imagem da galeria?');
    if (!ok) return;

    try {
      const cur = Array.isArray(formInfo.galerias) ? formInfo.galerias : [];
      const next = cur.filter(x => x !== url);

      setFormInfo(prev => ({ ...prev, galerias: next }));

      const { error: updErr } = await supabase
        .from('barbearias')
        .update({ galerias: next })
        .eq('id', barbearia.id);

      if (updErr) throw updErr;

      alert('✅ Imagem removida!');
      await loadData();
    } catch (e) {
      console.error('Erro removerImagemGaleria:', e);
      alert('❌ Erro ao remover: ' + (e?.message || ''));
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

      const dias = normalizeDiasTrabalho(formProfissional.dias_trabalho);

      const payload = {
        barbearia_id: barbearia.id,
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
        dias_trabalho: dias.length ? dias : [1,2,3,4,5,6],
      };

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await supabase.from('profissionais').insert([payload]);
      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setEditingProfissional(null);
      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_trabalho: [1,2,3,4,5,6] });
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

      const dias = normalizeDiasTrabalho(formProfissional.dias_trabalho);

      const payload = {
        nome: String(formProfissional.nome || '').trim(),
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
        dias_trabalho: dias, // ✅ NÃO MEXIDO
      };

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

  // ✅ Ativar / Inativar + motivo (cancelar não executa)
  const toggleAtivoProfissional = async (p) => {
    try {
      if (p.ativo === undefined) {
        alert('⚠️ Falta a coluna "ativo" na tabela profissionais.');
        return;
      }

      const novoAtivo = !p.ativo;

      const ok = confirm(novoAtivo ? 'Ativar este profissional?' : 'Inativar este profissional?');
      if (!ok) return;

      let motivo = null;

      if (!novoAtivo) {
        const resp = prompt('Motivo (opcional) para inativar este profissional:');
        if (resp === null) return; // ✅ cancelou o prompt => aborta
        motivo = resp.trim() || null;
      }

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

  // ======= Cálculos =======
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

  const ticketMedioHoje = useMemo(
    () => (hojeConcluidos.length ? (hojeConcluidos.reduce((s, a) => s + Number(a.servicos?.preco || 0), 0) / hojeConcluidos.length) : 0),
    [hojeConcluidos]
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

  // ✅ faturamento do DIA selecionado (VISÃO GERAL)
  const concluidosDoDiaFaturamento = useMemo(() => {
    return agendamentos
      .filter(a => sameDay(a.data, faturamentoData))
      .filter(a => a.status === 'concluido');
  }, [agendamentos, faturamentoData]);

  const faturamentoDoDia = useMemo(() => {
    return concluidosDoDiaFaturamento.reduce((sum, a) => sum + Number(a.servicos?.preco || 0), 0);
  }, [concluidosDoDiaFaturamento]);

  // ✅ destrincha faturamento por profissional (só usado se profissionais >= 2)
  const faturamentoPorProfissional = useMemo(() => {
    const map = new Map();

    for (const a of concluidosDoDiaFaturamento) {
      const pid = a.profissional_id;
      const nome = a.profissionais?.nome || 'Profissional';
      const val = Number(a.servicos?.preco || 0);

      if (!map.has(pid)) map.set(pid, { profissional_id: pid, nome, total: 0, qtd: 0 });
      const cur = map.get(pid);
      cur.total += val;
      cur.qtd += 1;
    }

    return Array.from(map.values()).sort((x, y) => y.total - x.total);
  }, [concluidosDoDiaFaturamento]);

  const agendamentosDiaSelecionado = useMemo(() => {
    return agendamentos
      .filter(a => sameDay(a.data, historicoData))
      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }, [agendamentos, historicoData]);

  // ✅ lista de agendamentos (aba) com HOJE + FUTURO (válidos)
  const agendamentosAba = useMemo(() => {
    const validos = agendamentos.filter(a => !String(a.status || '').includes('cancelado'));
    const hojeOuFuturo = validos.filter(a => String(a.data || '') >= String(hoje));
    return hojeOuFuturo.sort((a, b) => {
      const d = String(a.data).localeCompare(String(b.data));
      if (d !== 0) return d;
      return String(a.hora_inicio).localeCompare(String(b.hora_inicio));
    });
  }, [agendamentos, hoje]);

  // ======= Status do profissional (luz verde/vermelha) =======
  const getProfStatus = (p) => {
    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
    if (!ativo) return { label: 'FECHADO', color: 'bg-red-500' };

    const now = getNowSP();
    const ini = timeToMinutes(p.horario_inicio || '08:00');
    const fim = timeToMinutes(p.horario_fim || '18:00');

    const dias = (Array.isArray(p.dias_trabalho) && p.dias_trabalho.length)
      ? p.dias_trabalho
      : [0,1,2,3,4,5,6];

    const trabalhaHoje = dias.includes(now.dow);
    const dentroHorario = now.minutes >= ini && now.minutes < fim;

    if (trabalhaHoje && dentroHorario) return { label: 'ABERTO', color: 'bg-green-500' };
    return { label: 'FECHADO', color: 'bg-red-500' };
  };

  // ✅ serviços agrupados por profissional
  const servicosPorProf = useMemo(() => {
    const map = new Map();
    for (const p of profissionais) map.set(p.id, []);
    for (const s of servicos) {
      if (!map.has(s.profissional_id)) map.set(s.profissional_id, []);
      map.get(s.profissional_id).push(s);
    }
    return map;
  }, [profissionais, servicos]);

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
      {/* ✅ CSS local para remover seta do date */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; display: none; }
        input[type="date"]::-webkit-inner-spin-button,
        input[type="date"]::-webkit-clear-button { display: none; }
      `}</style>

      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
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

              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadLogoBarbearia(e.target.files?.[0])}
                  disabled={logoUploading}
                />
                <span
                  className={`inline-flex items-center justify-center leading-none rounded-button font-black border transition-all ${
                    logoUploading
                      ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary cursor-pointer'
                  }
                  px-3 h-8 text-[11px]
                  sm:px-4 sm:h-9 sm:text-sm
                  `}
                >
                  <span className="sm:hidden">{logoUploading ? '...' : 'LOGO'}</span>
                  <span className="hidden sm:inline">{logoUploading ? 'ENVIANDO...' : 'ALTERAR LOGO'}</span>
                </span>
              </label>

              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-button font-bold text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">SAIR</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats do topo */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* ✅ Faturamento SEM filtro aqui */}
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-custom p-6">
            <span
              className="text-green-400 mb-2 block"
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: 34, lineHeight: 1 }}
            >
              $
            </span>

            <div className="text-3xl font-black text-white mb-1">R$ {faturamentoDoDia.toFixed(2)}</div>
            <div className="text-sm text-green-300 font-bold">
              Faturamento • {formatDateBRFromISO(faturamentoData)}
            </div>
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
            {['visao-geral', 'agendamentos', 'cancelados', 'historico', 'servicos', 'profissionais', 'info-negocio'].map(tab => (
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
                {/* ✅ Filtro de data do faturamento AGORA AQUI (igual histórico) */}
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500 font-bold">Faturamento por data</div>
                      <div className="text-2xl font-black mt-1">
                        R$ {faturamentoDoDia.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 font-bold mt-1">
                        {formatDateBRFromISO(faturamentoData)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 font-bold">Dia:</span>
                      <input
                        type="date"
                        value={faturamentoData}
                        onChange={(e) => setFaturamentoData(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className="bg-dark-100 border border-gray-800 rounded-button text-white font-bold text-sm cursor-pointer appearance-none"
                        style={{
                          width: 'auto',
                          padding: '8px 12px',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* ✅ Destrinchamento por profissional: só se tiver 2+ profissionais */}
                  {profissionais.length >= 2 && (
                    <div className="mt-5">
                      <div className="text-sm text-gray-300 font-black mb-3">
                        Faturamento por profissional
                      </div>

                      {faturamentoPorProfissional.length ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {faturamentoPorProfissional.map((p) => (
                            <div key={p.profissional_id} className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                              <div className="font-black text-white">{p.nome}</div>
                              <div className="text-2xl font-black text-primary mt-1">
                                R$ {p.total.toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500 font-bold mt-1">
                                {p.qtd} concluído(s)
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 font-bold">
                          Nenhum faturamento concluído nessa data.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ✅ resto da visão geral (intacto) */}
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
                      <div className="text-2xl font-black">
                        R$ {agendamentosHoje.filter(a => a.status === 'concluido').reduce((s, a) => s + Number(a.servicos?.preco || 0), 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-500 font-bold">
                  Dica: essa visão geral “reflete movimento real” e te ajuda a bater o olho e entender o dia.
                </div>
              </div>
            )}

            {/* AGENDAMENTOS (HOJE + FUTURO) */}
            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos</h2>
                {agendamentosAba.length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosAba.map(a => {
                      const isDone = a.status === 'concluido';
                      const isFuture = String(a.data || '') > String(hoje);

                      return (
                        <div key={a.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-lg">{a.users?.nome || 'Cliente'}</p>
                              <p className="text-sm text-gray-400">
                                {a.servicos?.nome} • {a.profissionais?.nome}
                              </p>
                              <p className="text-xs text-gray-500 font-bold mt-1">
                                {formatDateBRFromISO(a.data)} • {a.hora_inicio}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className={`px-3 py-1 rounded-button text-xs font-bold ${
                                isDone ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {isDone ? 'Concluído' : 'Agendado'}
                              </div>

                              {!isDone && isFuture && (
                                <div className="px-3 py-1 rounded-button text-xs font-bold bg-yellow-500/20 border border-yellow-500/40 text-yellow-300">
                                  Futuro
                                </div>
                              )}
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

                          {!isDone && (
                            <button
                              onClick={() => confirmarAtendimento(a.id)}
                              className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-custom font-bold text-sm"
                            >
                              ✓ Confirmar Atendimento
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Nenhum agendamento</p>
                )}
              </div>
            )}

            {/* CANCELADOS */}
            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-black mb-6">Agendamentos Cancelados (Hoje)</h2>
                {agendamentosHoje.filter(a => String(a.status || '').includes('cancelado')).length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosHoje
                      .filter(a => String(a.status || '').includes('cancelado'))
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
                              <div className="text-white font-bold">{formatDateBRFromISO(a.data)}</div>
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
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="bg-dark-200 border border-gray-800 rounded-button text-white font-bold text-sm cursor-pointer appearance-none"
                      style={{
                        width: 'auto',
                        padding: '8px 12px',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none'
                      }}
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

                {profissionais.length === 0 ? (
                  <div className="text-gray-500 font-bold">Nenhum profissional cadastrado.</div>
                ) : (
                  <div className="space-y-4">
                    {profissionais.map(p => {
                      const lista = (servicosPorProf.get(p.id) || [])
                        .slice()
                        .sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));

                      return (
                        <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="font-black text-lg">{p.nome}</div>
                            <div className="text-xs text-gray-500 font-bold">{lista.length} serviço(s)</div>
                          </div>

                          {lista.length ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {lista.map(s => (
                                <div key={s.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h3 className="text-lg font-black">{s.nome}</h3>
                                      <p className="text-xs text-gray-500 font-bold">{p.nome}</p>
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
                            <p className="text-gray-500 font-bold">Sem serviços ativos para este profissional.</p>
                          )}
                        </div>
                      );
                    })}
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
                      setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_trabalho: [1,2,3,4,5,6] });
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
                              dias_trabalho: Array.isArray(p.dias_trabalho) && p.dias_trabalho.length ? p.dias_trabalho : [1,2,3,4,5,6],
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

            {/* INFO NEGÓCIO */}
            {activeTab === 'info-negocio' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">Informações do Negócio</h2>

                  <button
                    onClick={salvarInfoNegocio}
                    disabled={infoSaving}
                    className={`px-5 py-2.5 rounded-button font-black border flex items-center gap-2 ${
                      infoSaving
                        ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-primary/20 hover:bg-primary/30 border-primary/50 text-primary'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    {infoSaving ? 'SALVANDO...' : 'SALVAR'}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm font-bold mb-2">Nome da Barbearia</label>
                    <input
                      value={formInfo.nome}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="Nome"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm font-bold mb-2">Telefone</label>
                    <input
                      value={formInfo.telefone}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, telefone: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="(xx) xxxxx-xxxx"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5 md:col-span-2">
                    <label className="block text-sm font-bold mb-2">Endereço</label>
                    <input
                      value={formInfo.endereco}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, endereco: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="Rua, número, bairro..."
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5 md:col-span-2">
                    <label className="block text-sm font-bold mb-2">Descrição</label>
                    <textarea
                      value={formInfo.descricao}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, descricao: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white resize-none"
                      placeholder="Sobre o negócio..."
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm font-bold mb-2">Instagram (ID ou @)</label>
                    <input
                      value={formInfo.instagram}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, instagram: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="@seuinstagram"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm font-bold mb-2">Facebook (ID ou nome)</label>
                    <input
                      value={formInfo.facebook}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, facebook: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="facebook.com/..."
                    />
                  </div>
                </div>

                {/* ✅ GALERIAS */}
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-black flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        Galerias
                      </h3>
                      <p className="text-xs text-gray-500 font-bold mt-2">
                        Adicione fotos do seu negócio. Isso será exibido na vitrine quando a gente atualizar a vitrine.
                      </p>
                    </div>

                    <label className="inline-block">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadGaleria(e.target.files)}
                        disabled={galleryUploading}
                      />
                      <span
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-button font-black border cursor-pointer transition-all ${
                          galleryUploading
                            ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                            : 'bg-primary/20 hover:bg-primary/30 border-primary/50 text-primary'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        {galleryUploading ? 'ENVIANDO...' : 'ADICIONAR'}
                      </span>
                    </label>
                  </div>

                  {Array.isArray(formInfo.galerias) && formInfo.galerias.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {formInfo.galerias.map((url) => (
                        <div key={url} className="relative bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
                          <img src={url} alt="Galeria" className="w-full h-28 object-cover" />
                          <button
                            onClick={() => removerImagemGaleria(url)}
                            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 border border-gray-700 flex items-center justify-center hover:border-red-400"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4 text-red-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 font-bold">Nenhuma imagem ainda.</div>
                  )}
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
                  setFormProfissional({ nome: '', anos_experiencia: '', horario_inicio: '08:00', horario_fim: '18:00', dias_trabalho: [1,2,3,4,5,6] });
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

              {/* ✅ Dias de trabalho REAL (dias_trabalho) - NÃO MEXIDO */}
              <div>
                <label className="block text-sm font-bold mb-2">Dias de trabalho</label>
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAYS.map(d => {
                    const active = (formProfissional.dias_trabalho || []).includes(d.i);
                    return (
                      <button
                        type="button"
                        key={d.i}
                        onClick={() => {
                          const cur = Array.isArray(formProfissional.dias_trabalho) ? [...formProfissional.dias_trabalho] : [];
                          const next = active ? cur.filter(x => x !== d.i) : [...cur, d.i];
                          setFormProfissional(prev => ({ ...prev, dias_trabalho: normalizeDiasTrabalho(next) }));
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
                  Domingo = 0, Segunda = 1, ... Sábado = 6.
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
