import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, X, ExternalLink, Eye, Copy, Check, Calendar,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock,
  Image as ImageIcon, Save
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

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

// ✅ INPUT DATE "BOTÃO" (sem setinha) + bolinha amarela só visual
function DateFilterButton({ value, onChange, title }) {
  return (
    <div className="relative inline-flex">
      <input
        type="date"
        value={value}
        onChange={onChange}
        title={title}
        className="date-no-arrow px-4 py-2 bg-dark-200 border border-gray-800 rounded-button text-white text-base text-center pr-10 w-[160px] cursor-pointer"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-yellow-400" />
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('visao-geral');

  const [negocio, setNegocio] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [copied, setCopied] = useState(false);

  // ✅ FIX CRÍTICO: usar getNowSP() ao invés de new Date().toISOString()
  const hoje = useMemo(() => getNowSP().date, []);

  // Histórico (data selecionada)
  const [historicoData, setHistoricoData] = useState(hoje);

  // ✅ Filtro de faturamento (usado na VISÃO GERAL)
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

  // ✅ dias_trabalho (coluna real) — NÃO MEXIDO
  // ✅ adicionados: especialidade, almoco_inicio, almoco_fim
  const [formProfissional, setFormProfissional] = useState({
    nome: '',
    especialidade: '',
    anos_experiencia: '',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    almoco_inicio: '',
    almoco_fim: '',
    dias_trabalho: [1, 2, 3, 4, 5, 6] // default SEG-SÁB
  });

  // ✅ Info do negócio
  const [infoSaving, setInfoSaving] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // ✅ galeria (singular)
  const [formInfo, setFormInfo] = useState({
    nome: '',
    descricao: '',
    telefone: '',
    endereco: '',
    instagram: '',
    facebook: '',
    galeria: [] // array de URLs
  });

  useEffect(() => {
    if (user?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ✅ comparação “passado” sempre em SP
  const isAgendamentoPassadoSP = (a) => {
    const now = getNowSP();
    const d = String(a?.data || '');
    const hi = String(a?.hora_inicio || '');
    const hf = String(a?.hora_fim || '');

    if (!d || !hf) return false;

    if (d < now.date) return true;
    if (d > now.date) return false;

    // mesmo dia: compara fim vs agora
    return timeToMinutes(hf) <= now.minutes;
  };

  const loadData = async () => {
    if (!user?.id) {
      setError('Sessão inválida. Faça login novamente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ negócios
      const { data: negocioData, error: negocioError } = await supabase
        .from('negocios')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (negocioError) throw negocioError;

      if (!negocioData) {
        setNegocio(null);
        setProfissionais([]);
        setServicos([]);
        setAgendamentos([]);
        setError('Nenhum negócio cadastrado.');
        setLoading(false);
        return;
      }

      setNegocio(negocioData);

      // ✅ preenche form de info (galeria singular)
      setFormInfo({
        nome: negocioData.nome || '',
        descricao: negocioData.descricao || '',
        telefone: negocioData.telefone || '',
        endereco: negocioData.endereco || '',
        instagram: negocioData.instagram || '',
        facebook: negocioData.facebook || '',
        galeria: Array.isArray(negocioData.galeria) ? negocioData.galeria : []
      });

      // Profissionais por negocio_id
      const { data: profissionaisData, error: profErr } = await supabase
        .from('profissionais')
        .select('*')
        .eq('negocio_id', negocioData.id)
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

      // Agendamentos
      const { data: ags, error: agErr } = await supabase
        .from('agendamentos')
        .select(`*, servicos (nome, preco), profissionais (nome), users (nome)`)
        .in('profissional_id', ids)
        .order('data', { ascending: false })
        .limit(300);

      if (agErr) throw agErr;

      // Auto-concluir passados (sem travar UI) — usando SP
      if (ags?.length) {
        const toUpdate = [];
        for (const a of ags) {
          if (a?.status === 'agendado' || a?.status === 'confirmado') {
            if (isAgendamentoPassadoSP(a)) toUpdate.push(a.id);
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
    if (!negocio) return;
    navigator.clipboard.writeText(`${window.location.origin}/v/${negocio.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tipoLabel = useMemo(() => {
    const t = String(negocio?.tipo_negocio || '').trim().toLowerCase();
    if (!t) return null;
    // ✅ “barbearia” só aparece se for o tipo do negócio
    return t === 'barbearia' ? 'BARBEARIA' : 'NEGÓCIO';
  }, [negocio?.tipo_negocio]);

  // ===================== LOGO (upload + salvar URL) =====================
  const uploadLogoNegocio = async (file) => {
    if (!file) return;
    if (!user?.id) return alert('Sessão inválida.');
    if (!negocio?.id) return alert('Negócio não carregado.');

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

      const { data: pub } = supabase.storage.from('logos').getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Não foi possível gerar a URL pública da logo.');

      const { error: dbErr } = await supabase
        .from('negocios')
        .update({ logo_url: publicUrl })
        .eq('id', negocio.id);

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

  // ===================== INFO DO NEGÓCIO =====================
  const salvarInfoNegocio = async () => {
    if (!negocio?.id) return alert('Negócio não carregado.');
    try {
      setInfoSaving(true);

      const payload = {
        nome: String(formInfo.nome || '').trim(),
        descricao: String(formInfo.descricao || '').trim(),
        telefone: String(formInfo.telefone || '').trim(),
        endereco: String(formInfo.endereco || '').trim(),
        instagram: String(formInfo.instagram || '').trim() || null,
        facebook: String(formInfo.facebook || '').trim() || null,
        galeria: Array.isArray(formInfo.galeria) ? formInfo.galeria : []
      };

      const { error: updErr } = await supabase
        .from('negocios')
        .update(payload)
        .eq('id', negocio.id);

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
    if (!negocio?.id) return alert('Negócio não carregado.');

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
        const path = `${negocio.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

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
        const next = Array.isArray(formInfo.galeria)
          ? [...formInfo.galeria, ...urlsNovas]
          : [...urlsNovas];

        setFormInfo(prev => ({ ...prev, galeria: next }));

        const { error: updErr } = await supabase
          .from('negocios')
          .update({ galeria: next })
          .eq('id', negocio.id);

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
    if (!negocio?.id) return;
    const ok = confirm('Remover esta imagem da galeria?');
    if (!ok) return;

    try {
      const cur = Array.isArray(formInfo.galeria) ? formInfo.galeria : [];
      const next = cur.filter(x => x !== url);

      setFormInfo(prev => ({ ...prev, galeria: next }));

      const { error: updErr } = await supabase
        .from('negocios')
        .update({ galeria: next })
        .eq('id', negocio.id);

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
      if (!negocio?.id) throw new Error('Negócio não carregado.');

      const payload = {
        nome: String(formServico.nome || '').trim(),
        profissional_id: formServico.profissional_id,
        duracao_minutos: toNumberOrNull(formServico.duracao_minutos),
        preco: toNumberOrNull(formServico.preco),
        ativo: true,
        negocio_id: negocio.id,
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
      if (!negocio?.id) throw new Error('Negócio não carregado.');

      const dias = normalizeDiasTrabalho(formProfissional.dias_trabalho);

      const payload = {
        negocio_id: negocio.id,
        nome: String(formProfissional.nome || '').trim(),
        especialidade: String(formProfissional.especialidade || '').trim() || null,
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
        almoco_inicio: String(formProfissional.almoco_inicio || '').trim() || null,
        almoco_fim: String(formProfissional.almoco_fim || '').trim() || null,
        dias_trabalho: dias.length ? dias : [1, 2, 3, 4, 5, 6],
      };

      if (!payload.nome) throw new Error('Nome é obrigatório.');

      const { error } = await supabase.from('profissionais').insert([payload]);
      if (error) throw error;

      alert('✅ Profissional adicionado!');
      setShowNovoProfissional(false);
      setEditingProfissional(null);
      setFormProfissional({
        nome: '',
        especialidade: '',
        anos_experiencia: '',
        horario_inicio: '08:00',
        horario_fim: '18:00',
        almoco_inicio: '',
        almoco_fim: '',
        dias_trabalho: [1, 2, 3, 4, 5, 6]
      });
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
        especialidade: String(formProfissional.especialidade || '').trim() || null,
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
        almoco_inicio: String(formProfissional.almoco_inicio || '').trim() || null,
        almoco_fim: String(formProfissional.almoco_fim || '').trim() || null,
        dias_trabalho: dias, // ✅ salva domingo=0
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

      // ✅ Mensagem clara quando bater no bloqueio do almoço
      const msg = String(e2?.message || '');
      if (msg.toLowerCase().includes('almoço') || msg.toLowerCase().includes('almoco')) {
        alert('❌ Não foi possível alterar o almoço porque existem agendamentos futuros afetados.');
      } else {
        alert('❌ Erro ao atualizar profissional: ' + (e2?.message || ''));
      }
    }
  };

  // ✅ Ativar / Inativar + motivo (corrigido: CANCELAR não aplica)
  const toggleAtivoProfissional = async (p) => {
    try {
      if (p.ativo === undefined) {
        alert('⚠️ Falta a coluna "ativo" na tabela profissionais.');
        return;
      }

      const novoAtivo = !p.ativo;
      let motivo = null;

      if (!novoAtivo) {
        const r = prompt('Motivo (opcional) para inativar este profissional:');
        if (r === null) return; // cancelou
        motivo = r || null;
      }

      const { error: upErr } = await supabase
        .from('profissionais')
        .update({
          ativo: novoAtivo,
          motivo_inativo: novoAtivo ? null : motivo
        })
        .eq('id', p.id);

      if (upErr) throw upErr;

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
      const { error: delErr } = await supabase
        .from('profissionais')
        .delete()
        .eq('id', p.id);

      if (delErr) throw delErr;

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
      const { error: updErr } = await supabase
        .from('agendamentos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', id);

      if (updErr) throw updErr;

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

  // ✅ faturamento por data escolhida (VISÃO GERAL)
  const agendamentosDoDiaFaturamento = useMemo(
    () => agendamentos.filter(a => sameDay(a.data, faturamentoData)),
    [agendamentos, faturamentoData]
  );

  const concluidosDoDiaFaturamento = useMemo(
    () => agendamentosDoDiaFaturamento.filter(a => a.status === 'concluido'),
    [agendamentosDoDiaFaturamento]
  );

  const faturamentoDoDiaSelecionado = useMemo(
    () => concluidosDoDiaFaturamento.reduce((sum, a) => sum + Number(a.servicos?.preco || 0), 0),
    [concluidosDoDiaFaturamento]
  );

  const totalDoDiaFaturamento = useMemo(
    () => agendamentosDoDiaFaturamento.length,
    [agendamentosDoDiaFaturamento]
  );

  const canceladosDoDiaFaturamento = useMemo(
    () => agendamentosDoDiaFaturamento.filter(a => String(a.status || '').includes('cancelado')),
    [agendamentosDoDiaFaturamento]
  );

  const taxaCancelamentoDoDiaFaturamento = useMemo(() => {
    const total = totalDoDiaFaturamento || 0;
    const canc = canceladosDoDiaFaturamento.length || 0;
    return total ? (canc / total) * 100 : 0;
  }, [totalDoDiaFaturamento, canceladosDoDiaFaturamento.length]);

  const taxaConversaoDoDiaFaturamento = useMemo(() => {
    const total = totalDoDiaFaturamento || 0;
    const conv = concluidosDoDiaFaturamento.length || 0;
    return total ? (conv / total) * 100 : 0;
  }, [totalDoDiaFaturamento, concluidosDoDiaFaturamento.length]);

  const ticketMedioDoDiaFaturamento = useMemo(() => {
    const qtd = concluidosDoDiaFaturamento.length || 0;
    return qtd ? (faturamentoDoDiaSelecionado / qtd) : 0;
  }, [concluidosDoDiaFaturamento.length, faturamentoDoDiaSelecionado]);

  const faturamentoPorProfissional = useMemo(() => {
    const map = new Map();
    for (const a of concluidosDoDiaFaturamento) {
      const nome = a.profissionais?.nome || 'Profissional';
      const v = Number(a.servicos?.preco || 0);
      map.set(nome, (map.get(nome) || 0) + v);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [concluidosDoDiaFaturamento]);

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
    () => (
      hojeConcluidos.length
        ? (hojeConcluidos.reduce((s, a) => s + Number(a.servicos?.preco || 0), 0) / hojeConcluidos.length)
        : 0
    ),
    [hojeConcluidos]
  );

  const cancelRateHoje = useMemo(() => {
    const total = agendamentosHoje.length || 0;
    const canc = hojeCancelados.length || 0;
    return total ? (canc / total) * 100 : 0;
  }, [agendamentosHoje.length, hojeCancelados.length]);

  const proximoAgendamento = useMemo(() => {
    const now = getNowSP();
    const nowTime = minutesToTime(now.minutes);

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

  // ✅ Agendamentos: incluir HOJE + FUTUROS (não cancelados)
  const agendamentosHojeEFuturos = useMemo(() => {
    return agendamentos
      .filter(a => !String(a.status || '').includes('cancelado'))
      .filter(a => String(a.data || '') >= String(hoje || ''))
      .sort((a, b) => {
        const d = String(a.data || '').localeCompare(String(b.data || ''));
        if (d !== 0) return d;
        return String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
      });
  }, [agendamentos, hoje]);

  // ======= Status do profissional (verde/vermelho/amarelo almoço) =======
  const getProfStatus = (p) => {
    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
    if (!ativo) return { label: 'FECHADO', color: 'bg-red-500' };

    const now = getNowSP();
    const ini = timeToMinutes(p.horario_inicio || '08:00');
    const fim = timeToMinutes(p.horario_fim || '18:00');

    // ✅ usa dias_trabalho (se vazio, assume todos) — NÃO MEXIDO
    const dias = (Array.isArray(p.dias_trabalho) && p.dias_trabalho.length)
      ? p.dias_trabalho
      : [0, 1, 2, 3, 4, 5, 6];

    const trabalhaHoje = dias.includes(now.dow);
    const dentroHorario = now.minutes >= ini && now.minutes < fim;

    if (!(trabalhaHoje && dentroHorario)) return { label: 'FECHADO', color: 'bg-red-500' };

    const li = p.almoco_inicio;
    const lf = p.almoco_fim;

    if (li && lf) {
      const a = timeToMinutes(li);
      const b = timeToMinutes(lf);
      if (now.minutes >= a && now.minutes < b) {
        return { label: 'ALMOÇO', color: 'bg-yellow-400' };
      }
    }

    return { label: 'ABERTO', color: 'bg-green-500' };
  };

  const servicosPorProf = useMemo(() => {
    const map = new Map();
    for (const p of profissionais) map.set(p.id, []);
    for (const s of servicos) {
      if (!map.has(s.profissional_id)) map.set(s.profissional_id, []);
      map.get(s.profissional_id).push(s);
    }
    return map;
  }, [profissionais, servicos]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-primary text-xl">CARREGANDO...</div>
      </div>
    </div>
  );

  if (error || !negocio) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-100 border border-red-500/50 rounded-custom p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">ERRO AO CARREGAR</h1>
        <p className="text-gray-400 mb-6">{error || 'Negócio não encontrado'}</p>
        <button
          onClick={loadData}
          className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button mb-3 uppercase font-normal"
        >
          TENTAR NOVAMENTE
        </button>
        <button
          onClick={onLogout}
          className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-button uppercase font-normal"
        >
          SAIR
        </button>
      </div>
    </div>
  );

  const TAB_LABELS = {
    'visao-geral': 'GERAL',
    'agendamentos': 'AGENDAMENTOS',
    'cancelados': 'CANCELADOS',
    'historico': 'HISTÓRICO',
    'servicos': 'SERVIÇOS',
    'profissionais': 'PROFISSIONAIS',
    'info-negocio': 'INFO DO NEGÓCIO',
  };

  const tabButtonClass = (key) => (
    `px-4 py-2 rounded-button border text-sm transition-all uppercase font-normal ${
      activeTab === key
        ? 'bg-primary/20 border-primary/50 text-primary'
        : 'bg-dark-200 border-gray-800 text-gray-300 hover:border-primary/30'
    }`
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .date-no-arrow { appearance: none; -webkit-appearance: none; -moz-appearance: none; }
        .date-no-arrow::-webkit-inner-spin-button,
        .date-no-arrow::-webkit-clear-button { display: none; -webkit-appearance: none; }
        .date-no-arrow::-webkit-calendar-picker-indicator { opacity: 0; cursor: pointer; }
      `}</style>

      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-800 bg-dark-200 flex items-center justify-center">
                {negocio.logo_url ? (
                  <img src={negocio.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center">
                    <Award className="w-7 h-7 text-black" />
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-xl font-black">{negocio.nome}</h1>
                <div className="flex items-center gap-2 -mt-1">
                  <p className="text-xs text-gray-500">DASHBOARD</p>
                  {tipoLabel && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 uppercase font-normal">
                      {tipoLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to={`/v/${negocio.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button text-sm uppercase font-normal"
              >
                <Eye className="w-4 h-4" />
                VER VITRINE
              </Link>

              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button text-sm uppercase font-normal"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                {copied ? 'COPIADO' : 'COPIAR LINK'}
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button text-sm cursor-pointer uppercase font-normal">
                <ImageIcon className="w-4 h-4" />
                {logoUploading ? 'ENVIANDO...' : 'LOGO'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoUploading}
                  onChange={(e) => uploadLogoNegocio(e.target.files?.[0])}
                />
              </label>

              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-button text-sm uppercase font-normal"
              >
                <LogOut className="w-4 h-4" />
                SAIR
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="pb-4 flex flex-wrap gap-2">
            {Object.keys(TAB_LABELS).map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={tabButtonClass(key)}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* VISÃO GERAL */}
        {activeTab === 'visao-geral' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black">VISÃO GERAL</h2>

            <div className="flex flex-wrap items-center gap-3">
              <DateFilterButton
                value={faturamentoData}
                onChange={(e) => setFaturamentoData(e.target.value)}
                title="Selecionar data"
              />

              <div className="text-sm text-gray-400">
                DATA: <span className="text-gray-200">{formatDateBRFromISO(faturamentoData)}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm uppercase font-normal">
                  <TrendingUp className="w-4 h-4" />
                  FATURAMENTO
                </div>
                <div className="text-3xl font-black text-primary mt-2">
                  R$ {Number(faturamentoDoDiaSelecionado || 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm uppercase font-normal">
                  <Calendar className="w-4 h-4" />
                  TOTAL
                </div>
                <div className="text-3xl font-black mt-2">{totalDoDiaFaturamento}</div>
              </div>

              <div className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm uppercase font-normal">
                  <Users className="w-4 h-4" />
                  CONVERSÃO
                </div>
                <div className="text-3xl font-black mt-2">{taxaConversaoDoDiaFaturamento.toFixed(1)}%</div>
              </div>

              <div className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm uppercase font-normal">
                  <X className="w-4 h-4" />
                  CANCELAMENTO
                </div>
                <div className="text-3xl font-black mt-2">{taxaCancelamentoDoDiaFaturamento.toFixed(1)}%</div>
              </div>
            </div>

            <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
              <h3 className="text-lg font-black mb-4">DESTAQUE POR PROFISSIONAL</h3>
              {faturamentoPorProfissional.length ? (
                <div className="space-y-2">
                  {faturamentoPorProfissional.map(([nome, v]) => (
                    <div key={nome} className="flex justify-between text-sm">
                      <span className="text-gray-300 font-normal">{nome}</span>
                      <span className="text-primary font-black">R$ {Number(v || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 font-normal">Sem dados de faturamento para esta data.</p>
              )}
            </div>

            <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
              <h3 className="text-lg font-black mb-4">HOJE</h3>
              {proximoAgendamento ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-sm uppercase font-normal">PRÓXIMO</div>
                    <div className="text-xl font-black mt-1">
                      {proximoAgendamento.hora_inicio} • {proximoAgendamento.users?.nome || 'Cliente'}
                    </div>
                    <div className="text-sm text-gray-500 font-normal">
                      {proximoAgendamento.profissionais?.nome || 'Profissional'} • {proximoAgendamento.servicos?.nome || 'Serviço'}
                    </div>
                  </div>
                  <div className="text-primary font-black text-2xl">
                    R$ {Number(proximoAgendamento.servicos?.preco || 0).toFixed(2)}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 font-normal">Nenhum agendamento restante hoje.</p>
              )}

              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                  <div className="text-gray-500 text-xs uppercase font-normal">AGENDADOS</div>
                  <div className="text-2xl font-black mt-1">{agendamentosHoje.length}</div>
                </div>
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                  <div className="text-gray-500 text-xs uppercase font-normal">TICKET MÉDIO</div>
                  <div className="text-2xl font-black text-primary mt-1">R$ {ticketMedioHoje.toFixed(2)}</div>
                </div>
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                  <div className="text-gray-500 text-xs uppercase font-normal">CANCELAMENTO</div>
                  <div className="text-2xl font-black mt-1">{cancelRateHoje.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AGENDAMENTOS */}
        {activeTab === 'agendamentos' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black">AGENDAMENTOS</h2>

            {agendamentosHojeEFuturos.length ? (
              <div className="space-y-3">
                {agendamentosHojeEFuturos.map(a => (
                  <div key={a.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-normal">
                          {formatDateBRFromISO(a.data)} • {a.hora_inicio} - {a.hora_fim}
                        </div>
                        <div className="text-xl font-black mt-1">
                          {a.users?.nome || 'Cliente'}
                        </div>
                        <div className="text-sm text-gray-500 font-normal">
                          {a.profissionais?.nome || 'Profissional'} • {a.servicos?.nome || 'Serviço'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-primary font-black text-xl">
                          R$ {Number(a.servicos?.preco || 0).toFixed(2)}
                        </div>

                        {a.status !== 'concluido' && (
                          <button
                            onClick={() => confirmarAtendimento(a.id)}
                            className="px-4 py-2 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal"
                          >
                            CONCLUIR
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 font-normal">Nenhum agendamento hoje ou futuro.</p>
            )}
          </section>
        )}

        {/* CANCELADOS */}
        {activeTab === 'cancelados' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black">CANCELADOS</h2>

            {agendamentos.filter(a => String(a.status || '').includes('cancelado')).length ? (
              <div className="space-y-3">
                {agendamentos
                  .filter(a => String(a.status || '').includes('cancelado'))
                  .map(a => (
                    <div key={a.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                      <div className="text-xs text-gray-500 uppercase font-normal">
                        {formatDateBRFromISO(a.data)} • {a.hora_inicio} - {a.hora_fim}
                      </div>
                      <div className="text-xl font-black mt-1">
                        {a.users?.nome || 'Cliente'}
                      </div>
                      <div className="text-sm text-gray-500 font-normal">
                        {a.profissionais?.nome || 'Profissional'} • {a.servicos?.nome || 'Serviço'}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 font-normal">Nenhum cancelado encontrado.</p>
            )}
          </section>
        )}

        {/* HISTÓRICO */}
        {activeTab === 'historico' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black">HISTÓRICO</h2>

            <div className="flex flex-wrap items-center gap-3">
              <DateFilterButton
                value={historicoData}
                onChange={(e) => setHistoricoData(e.target.value)}
                title="Selecionar data do histórico"
              />
              <div className="text-sm text-gray-400">
                DATA: <span className="text-gray-200">{formatDateBRFromISO(historicoData)}</span>
              </div>
            </div>

            {agendamentosDiaSelecionado.length ? (
              <div className="space-y-3">
                {agendamentosDiaSelecionado.map(a => (
                  <div key={a.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-normal">
                          {a.hora_inicio} - {a.hora_fim} • {String(a.status || '').toUpperCase()}
                        </div>
                        <div className="text-xl font-black mt-1">
                          {a.users?.nome || 'Cliente'}
                        </div>
                        <div className="text-sm text-gray-500 font-normal">
                          {a.profissionais?.nome || 'Profissional'} • {a.servicos?.nome || 'Serviço'}
                        </div>
                      </div>
                      <div className="text-primary font-black text-xl">
                        R$ {Number(a.servicos?.preco || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 font-normal">Nenhum registro para essa data.</p>
            )}
          </section>
        )}

        {/* SERVIÇOS */}
        {activeTab === 'servicos' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">SERVIÇOS</h2>
              <button
                onClick={() => {
                  setShowNovoServico(true);
                  setEditingServicoId(null);
                  setFormServico({ nome: '', duracao_minutos: '', preco: '', profissional_id: '' });
                }}
                className="px-4 py-2 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> NOVO
                </span>
              </button>
            </div>

            {servicos.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {servicos.map(s => (
                  <div key={s.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                    <div className="text-xl font-black">{s.nome}</div>
                    <div className="text-sm text-gray-500 font-normal mt-1">
                      {s.profissionais?.nome || 'Profissional'}
                    </div>
                    <div className="text-sm text-gray-500 font-normal mt-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {s.duracao_minutos} min
                    </div>
                    <div className="text-primary font-black text-2xl mt-2">
                      R$ {Number(s.preco || 0).toFixed(2)}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setEditingServicoId(s.id);
                          setShowNovoServico(true);
                          setFormServico({
                            nome: s.nome || '',
                            duracao_minutos: String(s.duracao_minutos ?? ''),
                            preco: String(s.preco ?? ''),
                            profissional_id: s.profissional_id || ''
                          });
                        }}
                        className="flex-1 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button uppercase font-normal"
                      >
                        EDITAR
                      </button>
                      <button
                        onClick={() => deleteServico(s.id)}
                        className="px-4 py-2 bg-red-600/20 border border-red-600/40 text-red-300 hover:border-red-500 rounded-button uppercase font-normal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 font-normal">Nenhum serviço cadastrado.</p>
            )}
          </section>
        )}

        {/* PROFISSIONAIS */}
        {activeTab === 'profissionais' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">PROFISSIONAIS</h2>
              <button
                onClick={() => {
                  setShowNovoProfissional(true);
                  setEditingProfissional(null);
                  setFormProfissional({
                    nome: '',
                    especialidade: '',
                    anos_experiencia: '',
                    horario_inicio: '08:00',
                    horario_fim: '18:00',
                    almoco_inicio: '',
                    almoco_fim: '',
                    dias_trabalho: [1, 2, 3, 4, 5, 6]
                  });
                }}
                className="px-4 py-2 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> NOVO
                </span>
              </button>
            </div>

            {profissionais.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profissionais.map(p => {
                  const status = getProfStatus(p);
                  return (
                    <div key={p.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5 relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-black">{p.nome}</div>
                          {p.especialidade && (
                            <div className="mt-2">
                              <span className="inline-block px-2 py-1 rounded-full bg-yellow-400 text-black text-[10px] uppercase font-normal">
                                {p.especialidade}
                              </span>
                            </div>
                          )}
                          <div className="text-sm text-gray-500 font-normal mt-2">
                            {p.anos_experiencia != null ? `${p.anos_experiencia} anos de experiência` : 'Sem experiência informada'}
                          </div>
                          <div className="text-sm text-gray-500 font-normal mt-2">
                            Horário: <span className="text-gray-200">{p.horario_inicio || '08:00'} - {p.horario_fim || '18:00'}</span>
                          </div>
                          {(p.almoco_inicio && p.almoco_fim) && (
                            <div className="text-sm text-gray-500 font-normal mt-1">
                              Almoço: <span className="text-gray-200">{p.almoco_inicio} - {p.almoco_fim}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                          <span className="text-xs text-gray-300 uppercase font-normal">{status.label}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={() => {
                            setEditingProfissional(p);
                            setShowNovoProfissional(true);
                            setFormProfissional({
                              nome: p.nome || '',
                              especialidade: p.especialidade || '',
                              anos_experiencia: String(p.anos_experiencia ?? ''),
                              horario_inicio: p.horario_inicio || '08:00',
                              horario_fim: p.horario_fim || '18:00',
                              almoco_inicio: p.almoco_inicio || '',
                              almoco_fim: p.almoco_fim || '',
                              dias_trabalho: Array.isArray(p.dias_trabalho) ? p.dias_trabalho : [1, 2, 3, 4, 5, 6]
                            });
                          }}
                          className="px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button uppercase font-normal"
                        >
                          EDITAR
                        </button>

                        <button
                          onClick={() => toggleAtivoProfissional(p)}
                          className={`px-4 py-2 rounded-button uppercase font-normal border ${
                            (p.ativo === undefined ? true : !!p.ativo)
                              ? 'bg-red-600/20 border-red-600/40 text-red-300 hover:border-red-500'
                              : 'bg-green-500/20 border-green-500/40 text-green-300 hover:border-green-500'
                          }`}
                        >
                          {(p.ativo === undefined ? true : !!p.ativo) ? 'INATIVAR' : 'ATIVAR'}
                        </button>
                      </div>

                      <button
                        onClick={() => excluirProfissional(p)}
                        className="mt-2 w-full px-4 py-2 bg-red-600/10 border border-red-600/30 text-red-300 rounded-button uppercase font-normal"
                      >
                        EXCLUIR
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 font-normal">Nenhum profissional cadastrado.</p>
            )}
          </section>
        )}

        {/* INFO DO NEGÓCIO */}
        {activeTab === 'info-negocio' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black">INFO DO NEGÓCIO</h2>

            <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">NOME</div>
                  <input
                    value={formInfo.nome}
                    onChange={(e) => setFormInfo(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="Nome do negócio"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">TELEFONE</div>
                  <input
                    value={formInfo.telefone}
                    onChange={(e) => setFormInfo(prev => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="Telefone"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 uppercase font-normal mb-2">DESCRIÇÃO</div>
                <textarea
                  value={formInfo.descricao}
                  onChange={(e) => setFormInfo(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  placeholder="Descrição"
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 uppercase font-normal mb-2">ENDEREÇO</div>
                <input
                  value={formInfo.endereco}
                  onChange={(e) => setFormInfo(prev => ({ ...prev, endereco: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  placeholder="Endereço"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">INSTAGRAM</div>
                  <input
                    value={formInfo.instagram}
                    onChange={(e) => setFormInfo(prev => ({ ...prev, instagram: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="@seuinstagram"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">FACEBOOK</div>
                  <input
                    value={formInfo.facebook}
                    onChange={(e) => setFormInfo(prev => ({ ...prev, facebook: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="facebook.com/..."
                  />
                </div>
              </div>

              <button
                onClick={salvarInfoNegocio}
                disabled={infoSaving}
                className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {infoSaving ? 'SALVANDO...' : 'SALVAR'}
                </span>
              </button>
            </div>

            <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-black">GALERIA</h3>

                <label className="inline-flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button cursor-pointer uppercase font-normal">
                  <Plus className="w-4 h-4" />
                  {galleryUploading ? 'ENVIANDO...' : 'ADICIONAR'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    disabled={galleryUploading}
                    onChange={(e) => uploadGaleria(e.target.files)}
                  />
                </label>
              </div>

              {Array.isArray(formInfo.galeria) && formInfo.galeria.length ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formInfo.galeria.map((url) => (
                    <div key={url} className="bg-dark-200 border border-gray-800 rounded-custom overflow-hidden">
                      <img src={url} alt="Galeria" className="w-full h-48 object-cover" />
                      <div className="p-3 flex gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 px-4 py-2 bg-dark-100 border border-gray-800 hover:border-primary rounded-button text-sm uppercase font-normal inline-flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          VER
                        </a>
                        <button
                          onClick={() => removerImagemGaleria(url)}
                          className="px-4 py-2 bg-red-600/20 border border-red-600/40 text-red-300 hover:border-red-500 rounded-button uppercase font-normal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 font-normal">Nenhuma imagem na galeria.</p>
              )}
            </div>
          </section>
        )}
      </main>

      {/* MODAL SERVIÇO */}
      {showNovoServico && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black">{editingServicoId ? 'EDITAR SERVIÇO' : 'NOVO SERVIÇO'}</h3>
              <button
                onClick={() => setShowNovoServico(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingServicoId ? updateServico : createServico} className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 uppercase font-normal mb-2">NOME</div>
                <input
                  value={formServico.nome}
                  onChange={(e) => setFormServico(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  placeholder="Nome do serviço"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">DURAÇÃO</div>
                  <input
                    value={formServico.duracao_minutos}
                    onChange={(e) => setFormServico(prev => ({ ...prev, duracao_minutos: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="min"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">PREÇO</div>
                  <input
                    value={formServico.preco}
                    onChange={(e) => setFormServico(prev => ({ ...prev, preco: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="R$"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 uppercase font-normal mb-2">PROFISSIONAL</div>
                <select
                  value={formServico.profissional_id}
                  onChange={(e) => setFormServico(prev => ({ ...prev, profissional_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                >
                  <option value="">SELECIONAR</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal"
              >
                {editingServicoId ? 'SALVAR' : 'CRIAR'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROFISSIONAL */}
      {showNovoProfissional && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black">{editingProfissional ? 'EDITAR PROFISSIONAL' : 'NOVO PROFISSIONAL'}</h3>
              <button
                onClick={() => setShowNovoProfissional(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingProfissional ? updateProfissional : createProfissional} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">NOME</div>
                  <input
                    value={formProfissional.nome}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="Nome"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">ESPECIALIDADE</div>
                  <input
                    value={formProfissional.especialidade}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, especialidade: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="Ex: BARBA, DEGRADÊ..."
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">EXPERIÊNCIA</div>
                  <input
                    value={formProfissional.anos_experiencia}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, anos_experiencia: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    placeholder="anos"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">INÍCIO</div>
                  <input
                    type="time"
                    value={formProfissional.horario_inicio}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, horario_inicio: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">FIM</div>
                  <input
                    type="time"
                    value={formProfissional.horario_fim}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, horario_fim: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">ALMOÇO INÍCIO</div>
                  <input
                    type="time"
                    value={formProfissional.almoco_inicio}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, almoco_inicio: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase font-normal mb-2">ALMOÇO FIM</div>
                  <input
                    type="time"
                    value={formProfissional.almoco_fim}
                    onChange={(e) => setFormProfissional(prev => ({ ...prev, almoco_fim: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 uppercase font-normal mb-3">DIAS DE TRABALHO</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(w => {
                    const selected = (formProfissional.dias_trabalho || []).includes(w.i);
                    return (
                      <button
                        key={w.i}
                        type="button"
                        onClick={() => {
                          const cur = Array.isArray(formProfissional.dias_trabalho) ? [...formProfissional.dias_trabalho] : [];
                          const next = selected ? cur.filter(x => x !== w.i) : [...cur, w.i];
                          setFormProfissional(prev => ({ ...prev, dias_trabalho: normalizeDiasTrabalho(next) }));
                        }}
                        className={`px-4 py-2 rounded-button border uppercase font-normal text-sm ${
                          selected
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-dark-200 border-gray-800 text-gray-300 hover:border-primary/30'
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 font-normal mt-3">
                  O almoço bloqueia agendamentos automaticamente. Se houver conflito com agendamentos futuros, o sistema impedirá a alteração.
                </p>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button uppercase font-normal"
              >
                {editingProfissional ? 'SALVAR' : 'CRIAR'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
