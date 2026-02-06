import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, X, ExternalLink, Eye, Copy, Check, Calendar,
  Users, TrendingUp, Award, LogOut, AlertCircle, Clock,
  Save
} from 'lucide-react';
import { supabase } from '../supabase';

const SUPORTE_PHONE_E164 = '5533999037979'; // 55 + DDD + número (sem espaços)
const SUPORTE_MSG = 'Olá, sou cadastrado como Profissional e gostaria de uma ajuda especializada para o meu perfil. Pode me orientar?';

const SUPORTE_HREF =
  `https://wa.me/${SUPORTE_PHONE_E164}?text=${encodeURIComponent(SUPORTE_MSG)}`;

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

function normalizeDiasTrabalho(arr) {
  const base = Array.isArray(arr) ? arr : [];
  const cleaned = base
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .map(n => (n === 7 ? 0 : n))
    .filter(n => n >= 0 && n <= 6);

  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

function formatDateBRFromISO(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
}

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

// ✅ Wrapper para SELECT/TIME com “setinha”
function InputWithChevron({ children }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-dark-100 border border-gray-800 text-gray-400 text-xs">
        ▾
      </span>
    </div>
  );
}

const toUpperClean = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const isEnderecoPadrao = (s) => {
  const v = String(s || '').trim();
  const re = /^.+,\s*\d+.*\s-\s.+,\s.+$/;
  return re.test(v);
};

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('visao-geral');

  const [negocio, setNegocio] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [copied, setCopied] = useState(false);

  // ✅ HOJE DINÂMICO (corrige etiqueta FUTURO ao virar o dia)
  const [hoje, setHoje] = useState(() => getNowSP().date);
  useEffect(() => {
    const tick = () => setHoje(getNowSP().date);
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const [historicoData, setHistoricoData] = useState(hoje);
  const [faturamentoData, setFaturamentoData] = useState(hoje);

  const [showNovoServico, setShowNovoServico] = useState(false);
  const [showNovoProfissional, setShowNovoProfissional] = useState(false);

  const [editingServicoId, setEditingServicoId] = useState(null);
  const [editingProfissional, setEditingProfissional] = useState(null);

  const [logoUploading, setLogoUploading] = useState(false);

  const [formServico, setFormServico] = useState({
    nome: '',
    duracao_minutos: '',
    preco: '',
    preco_promocional: '',
    profissional_id: ''
  });

  const [formProfissional, setFormProfissional] = useState({
    nome: '',
    profissao: '',
    anos_experiencia: '',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    almoco_inicio: '',
    almoco_fim: '',
    dias_trabalho: [1, 2, 3, 4, 5, 6]
  });

  const [infoSaving, setInfoSaving] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [formInfo, setFormInfo] = useState({
    nome: '',
    descricao: '',
    telefone: '',
    endereco: '',
    instagram: '',
    facebook: '',
    galeria: []
  });

  useEffect(() => {
    if (user?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ✅ se HOJE mudar, mantém filtros coerentes (sem quebrar UX)
  useEffect(() => {
    setHistoricoData(prev => (prev ? prev : hoje));
    setFaturamentoData(prev => (prev ? prev : hoje));
  }, [hoje]);

  const loadData = async () => {
    if (!user?.id) {
      setError('Sessão inválida. Faça login novamente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      setFormInfo({
        nome: negocioData.nome || '',
        descricao: negocioData.descricao || '',
        telefone: negocioData.telefone || '',
        endereco: negocioData.endereco || '',
        instagram: negocioData.instagram || '',
        facebook: negocioData.facebook || '',
        galeria: Array.isArray(negocioData.galeria) ? negocioData.galeria : []
      });

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

      const { data: servicosData, error: servErr } = await supabase
        .from('servicos')
        .select('*, profissionais (nome)')
        .in('profissional_id', ids)
        .order('created_at', { ascending: false });

      if (servErr) throw servErr;
      setServicos(servicosData || []);

      const { data: ags, error: agErr } = await supabase
        .from('agendamentos')
        .select(`*, servicos (nome, preco, preco_promocional), profissionais (nome), users (nome)`)
        .in('profissional_id', ids)
        .order('data', { ascending: false })
        .limit(300);

      if (agErr) throw agErr;

      // ✅ Auto-concluir passados usando horário SP (sem Date/UTC)
      if (ags?.length) {
        const now = getNowSP();
        const toUpdate = [];

        for (const a of ags) {
          const st = String(a?.status || '');
          if (st === 'agendado' || st === 'confirmado') {
            const dataA = String(a.data || '');
            const fimMin = timeToMinutes(a.hora_fim || '00:00');

            const passou =
              (dataA < now.date) ||
              (dataA === now.date && fimMin <= now.minutes);

            if (passou && !String(a.status || '').includes('cancelado')) toUpdate.push(a.id);
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
              .select(`*, servicos (nome, preco, preco_promocional), profissionais (nome), users (nome)`)
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

  const salvarInfoNegocio = async () => {
    if (!negocio?.id) return alert('Negócio não carregado.');
    try {
      setInfoSaving(true);

      const endereco = String(formInfo.endereco || '').trim();

      // ✅ Regra do endereço (bloqueia salvar se fugir do padrão)
      if (endereco && !isEnderecoPadrao(endereco)) {
        throw new Error('Endereço fora do padrão. Use: "RUA, NÚMERO - CIDADE, ESTADO". Ex.: Rua Serra do Sincorá, 1038 - Belo Horizonte, Minas Gerais');
      }

      const payload = {
        nome: String(formInfo.nome || '').trim(),
        descricao: String(formInfo.descricao || '').trim(),
        telefone: String(formInfo.telefone || '').trim(),
        endereco,
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
        const next = Array.isArray(formInfo.galeria) ? [...formInfo.galeria, ...urlsNovas] : [...urlsNovas];
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

  const createServico = async (e) => {
    e.preventDefault();
    try {
      if (!negocio?.id) throw new Error('Negócio não carregado.');

      const preco = toNumberOrNull(formServico.preco);
      const promo = toNumberOrNull(formServico.preco_promocional);

      if (preco == null) throw new Error('Preço inválido.');
      if (promo != null && promo >= preco) throw new Error('Preço de oferta deve ser MENOR que o preço normal.');

      const payload = {
        nome: toUpperClean(formServico.nome),
        profissional_id: formServico.profissional_id,
        duracao_minutos: toNumberOrNull(formServico.duracao_minutos),
        preco,
        preco_promocional: promo,
        ativo: true,
        negocio_id: negocio.id,
      };

      if (!payload.nome) throw new Error('Nome do serviço é obrigatório.');
      if (!payload.profissional_id) throw new Error('Selecione um profissional.');
      if (!payload.duracao_minutos) throw new Error('Duração inválida.');

      const { error } = await supabase.from('servicos').insert([payload]);
      if (error) throw error;

      alert('✅ Serviço criado!');
      setShowNovoServico(false);
      setEditingServicoId(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', preco_promocional: '', profissional_id: '' });
      await loadData();
    } catch (e2) {
      console.error('createServico error:', e2);
      alert('❌ Erro ao criar serviço: ' + (e2?.message || ''));
    }
  };

  const updateServico = async (e) => {
    e.preventDefault();
    try {
      const preco = toNumberOrNull(formServico.preco);
      const promo = toNumberOrNull(formServico.preco_promocional);

      if (!toUpperClean(formServico.nome)) throw new Error('Nome do serviço é obrigatório.');
      if (!formServico.profissional_id) throw new Error('Selecione um profissional.');
      if (!toNumberOrNull(formServico.duracao_minutos)) throw new Error('Duração inválida.');
      if (preco == null) throw new Error('Preço inválido.');
      if (promo != null && promo >= preco) throw new Error('Preço de oferta deve ser MENOR que o preço normal.');

      const payload = {
        nome: toUpperClean(formServico.nome),
        duracao_minutos: toNumberOrNull(formServico.duracao_minutos),
        preco,
        preco_promocional: promo,
        profissional_id: formServico.profissional_id
      };

      const { error } = await supabase
        .from('servicos')
        .update(payload)
        .eq('id', editingServicoId);

      if (error) throw error;

      alert('✅ Serviço atualizado!');
      setShowNovoServico(false);
      setEditingServicoId(null);
      setFormServico({ nome: '', duracao_minutos: '', preco: '', preco_promocional: '', profissional_id: '' });
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

  const createProfissional = async (e) => {
    e.preventDefault();
    try {
      if (!negocio?.id) throw new Error('Negócio não carregado.');

      const dias = normalizeDiasTrabalho(formProfissional.dias_trabalho);

      const payload = {
        negocio_id: negocio.id,
        nome: toUpperClean(formProfissional.nome),
        profissao: String(formProfissional.profissao || '').trim() || null,
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
        profissao: '',
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
        nome: toUpperClean(formProfissional.nome),
        profissao: String(formProfissional.profissao || '').trim() || null,
        anos_experiencia: toNumberOrNull(formProfissional.anos_experiencia),
        horario_inicio: formProfissional.horario_inicio,
        horario_fim: formProfissional.horario_fim,
        almoco_inicio: String(formProfissional.almoco_inicio || '').trim() || null,
        almoco_fim: String(formProfissional.almoco_fim || '').trim() || null,
        dias_trabalho: dias,
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
        if (r === null) return;
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

  const agendamentosHoje = useMemo(
    () => agendamentos.filter(a => sameDay(a.data, hoje)),
    [agendamentos, hoje]
  );

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
      const nome = a.profissionais?.nome || 'PROFISSIONAL';
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
    const nowTimeMin = now.minutes;

    const futuros = hojeValidos
      .filter(a => timeToMinutes(String(a.hora_inicio || '00:00')) >= nowTimeMin)
      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));

    return futuros[0] || null;
  }, [hojeValidos]);

  const agendamentosDiaSelecionado = useMemo(() => {
    return agendamentos
      .filter(a => sameDay(a.data, historicoData))
      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }, [agendamentos, historicoData]);

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

  const getProfStatus = (p) => {
    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
    if (!ativo) return { label: 'FECHADO', color: 'bg-red-500' };

    const now = getNowSP();
    const ini = timeToMinutes(p.horario_inicio || '08:00');
    const fim = timeToMinutes(p.horario_fim || '18:00');

    const dias = (Array.isArray(p.dias_trabalho) && p.dias_trabalho.length)
      ? p.dias_trabalho
      : [0, 1, 2, 3, 4, 5, 6];

    const trabalhaHoje = dias.includes(now.dow);
    const dentroHorario = now.minutes >= ini && now.minutes < fim;

    if (!(trabalhaHoje && dentroHorario)) return { label: 'FECHADO', color: 'bg-red-500' };

    const li = p.almoco_inicio ? timeToMinutes(p.almoco_inicio) : null;
    const lf = p.almoco_fim ? timeToMinutes(p.almoco_fim) : null;

    if (li != null && lf != null && now.minutes >= li && now.minutes < lf) {
      return { label: 'ALMOÇO', color: 'bg-yellow-400' };
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
        <h1 className="text-2xl font-normal text-white mb-2">Erro ao carregar :(</h1>
        <p className="text-gray-400 mb-6">{error || 'Negócio não encontrado'}</p>
        <button onClick={loadData} className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button mb-3 font-normal uppercase">
          TENTAR NOVAMENTE
        </button>
        <button onClick={onLogout} className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-button font-normal uppercase">
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

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .date-no-arrow {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .date-no-arrow::-webkit-inner-spin-button,
        .date-no-arrow::-webkit-clear-button {
          display: none;
          -webkit-appearance: none;
        }
        .date-no-arrow::-webkit-calendar-picker-indicator {
          opacity: 0;
          cursor: pointer;
        }

        .no-native-indicator {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .no-native-indicator::-webkit-calendar-picker-indicator {
          opacity: 0;
          cursor: pointer;
        }
      `}</style>

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
                <h1 className="text-xl font-normal">{negocio.nome}</h1>
                <p className="text-xs text-gray-500 -mt-1">DASHBOARD</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to={`/v/${negocio.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary rounded-button text-sm font-normal uppercase"
              >
                <Eye className="w-4 h-4" />VER VITRINE
              </Link>

              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadLogoNegocio(e.target.files?.[0])}
                  disabled={logoUploading}
                />
                <span
                  className={`inline-flex items-center justify-center text-center rounded-button font-normal border transition-all uppercase ${
                    logoUploading
                      ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary cursor-pointer'
                  }
                  px-3 py-2 text-[11px]
                  sm:px-4 sm:py-2 sm:text-sm
                  `}
                >
                  <span className="sm:hidden">{logoUploading ? '...' : 'LOGO'}</span>
                  <span className="hidden sm:inline">{logoUploading ? 'ENVIANDO...' : 'ALTERAR LOGO'}</span>
                </span>
              </label>

              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-button text-sm font-normal uppercase"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">SAIR</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-custom p-6">
            <div className="mb-2 flex items-center gap-2">
              <span style={{ fontFamily: 'Roboto Condensed, sans-serif' }} className="text-green-400 font-normal text-3xl leading-none">
                $
              </span>
              <span className="text-sm text-gray-500">FATURAMENTO HOJE</span>
            </div>

            <div className="text-3xl font-normal text-white mb-1">
              R$ {agendamentosHoje
                .filter(a => a.status === 'concluido')
                .reduce((s, a) => s + Number(a.servicos?.preco || 0), 0)
                .toFixed(2)}
            </div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Calendar className="w-8 h-8 text-blue-400 mb-2" />
            <div className="text-3xl font-normal text-white mb-1">{hojeValidos.length}</div>
            <div className="text-sm text-gray-400">AGENDAMENTOS HOJE</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <Users className="w-8 h-8 text-purple-400 mb-2" />
            <div className="text-3xl font-normal text-white mb-1">{profissionais.length}</div>
            <div className="text-sm text-gray-400">PROFISSIONAIS</div>
          </div>

          <div className="bg-dark-100 border border-gray-800 rounded-custom p-6">
            <TrendingUp className="w-8 h-8 text-primary mb-2" />
            <div className="text-3xl font-normal text-white mb-1">{servicos.length}</div>
            <div className="text-sm text-gray-400">SERVIÇOS</div>
          </div>
        </div>

        {/* ✅ SUBSTITUI “SUA VITRINE” NO MOBILE (DESKTOP: NÃO MOSTRA NADA) */}
        
          <div className="grid grid-cols-2 gap-3">
            <Link
              to={`/v/${negocio.slug}`}
              target="_blank"
              className="w-full py-3 bg-dark-200 border border-gray-800 hover:border-primary rounded-button text-sm font-normal uppercase flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              VER VITRINE
            </Link>

            <a
              href={SUPORTE_HREF}
              className="w-full py-3 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-button text-sm font-normal uppercase flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              SUPORTE
            </a>
          </div>
        </div>

        <div className="bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-800">
            {['visao-geral', 'agendamentos', 'cancelados', 'historico', 'servicos', 'profissionais', 'info-negocio'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-6 py-4 text-sm transition-all uppercase font-normal ${
                  activeTab === tab ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'
                }`}
              >
                {TAB_LABELS[tab] || tab.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'visao-geral' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 mb-2">CANCELAMENTOS HOJE</div>
                    <div className="text-3xl font-normal text-white">{hojeCancelados.length}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      TAXA: <span className="text-primary">{cancelRateHoje.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 mb-2">CONCLUÍDOS HOJE</div>
                    <div className="text-3xl font-normal text-white">{hojeConcluidos.length}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      TICKET MÉDIO: <span className="text-primary">R$ {ticketMedioHoje.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <div className="text-xs text-gray-500 mb-2">PRÓXIMO AGENDAMENTO</div>
                    {proximoAgendamento ? (
                      <>
                        <div className="text-3xl font-normal text-primary">{proximoAgendamento.hora_inicio}</div>
                        <div className="text-sm text-gray-300 mt-1">
                          {proximoAgendamento.users?.nome || 'Cliente'} • {proximoAgendamento.profissionais?.nome}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {proximoAgendamento.servicos?.nome}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">:(</div>
                    )}
                  </div>
                </div>

                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-lg font-normal flex items-center gap-2 uppercase">
                      <span style={{ fontFamily: 'Roboto Condensed, sans-serif' }} className="font-normal text-2xl">
                        $
                      </span>
                      FATURAMENTO
                    </h3>

                    <div className="flex items-center gap-2">
                      <DateFilterButton
                        value={faturamentoData}
                        onChange={(e) => setFaturamentoData(e.target.value)}
                        title="Filtrar faturamento por data"
                      />
                    </div>
                  </div>

                  <div className="text-3xl font-normal text-white mb-2">
                    R$ {faturamentoDoDiaSelecionado.toFixed(2)}
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 mb-1">CONCLUÍDOS</div>
                      {/* ✅ VERDE */}
                      <div className="text-xl font-normal text-green-400">{concluidosDoDiaFaturamento.length}</div>
                    </div>

                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 mb-1">CANCELADOS</div>
                      {/* ✅ VERMELHO */}
                      <div className="text-xl font-normal text-red-400">{canceladosDoDiaFaturamento.length}</div>
                      <div className="text-xs text-gray-500 mt-1">{taxaCancelamentoDoDiaFaturamento.toFixed(1)}%</div>
                    </div>

                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 mb-1">FECHAMENTO</div>
                      <div className="text-xl font-normal text-white">{taxaConversaoDoDiaFaturamento.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500 mt-1">sobre {totalDoDiaFaturamento} agendamento(s).</div>
                    </div>

                    <div className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                      <div className="text-xs text-gray-500 mb-1">TICKET MÉDIO</div>
                      <div className="text-xl font-normal text-primary">R$ {ticketMedioDoDiaFaturamento.toFixed(2)}</div>
                    </div>
                  </div>

                  {profissionais.length >= 2 && faturamentoPorProfissional.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {faturamentoPorProfissional.map(([nome, valor]) => (
                        <div key={nome} className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                          <div className="text-xs text-gray-500 mb-1">PROFISSIONAL</div>
                          <div className="font-normal text-white">{nome}</div>
                          <div className="text-primary font-normal mt-1">R$ {Number(valor).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {profissionais.length < 2
                        ? 'Você tem 1 profissional — o detalhamento por profissional não aparece.'
                        : 'Sem faturamento concluído nessa data.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'agendamentos' && (
              <div>
                <h2 className="text-2xl font-normal mb-6">Agendamentos</h2>
                {agendamentosHojeEFuturos.length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosHojeEFuturos.map(a => {
                      const dataA = String(a.data || '');
                      const isFuturo = dataA > String(hoje || ''); // ✅ FUTURO SÓ SE FOR > HOJE
                      const isHoje = dataA === String(hoje || '');
                      const isDone = a.status === 'concluido';

                      return (
                        <div key={a.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-normal text-lg">{a.users?.nome || 'Cliente'}</p>
                              <p className="text-sm text-gray-400">
                                {a.servicos?.nome} • {a.profissionais?.nome}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {isDone ? (
                                <div className="px-3 py-1 rounded-button text-xs bg-green-500/20 text-green-400">
                                  CONCLUÍDO
                                </div>
                              ) : (
                                <>
                                  {isFuturo && (
                                    <div className="px-3 py-1 rounded-button text-xs bg-yellow-500/20 text-yellow-300">
                                      FUTURO
                                    </div>
                                  )}
                                  <div className="px-3 py-1 rounded-button text-xs bg-blue-500/20 text-blue-400">
                                    AGENDADO
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <div className="text-xs text-gray-500">DATA</div>
                              <div className="text-sm">{formatDateBRFromISO(a.data)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">HORÁRIO</div>
                              <div className="text-sm">{a.hora_inicio}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">VALOR</div>
                              <div className="text-sm">R$ {a.servicos?.preco}</div>
                            </div>
                          </div>

                          {!isDone && isHoje && (
                            <button
                              onClick={() => confirmarAtendimento(a.id)}
                              className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-custom text-sm font-normal uppercase"
                            >
                              CONFIRMAR ATENDIMENTO
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Uhuul, nenhum agendamento (hoje ou futuro) :(</p>
                )}
              </div>
            )}

            {activeTab === 'cancelados' && (
              <div>
                <h2 className="text-2xl font-normal mb-6">Agendamentos Cancelados (Hoje)</h2>
                {agendamentosHoje.filter(a => String(a.status || '').includes('cancelado')).length > 0 ? (
                  <div className="space-y-4">
                    {agendamentosHoje
                      .filter(a => String(a.status || '').includes('cancelado'))
                      .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
                      .map(a => (
                        <div key={a.id} className="bg-dark-200 border border-red-500/30 rounded-custom p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-normal text-lg text-white">{a.users?.nome || 'Cliente'}</p>
                              <p className="text-sm text-gray-400">{a.servicos?.nome} • {a.profissionais?.nome}</p>
                            </div>
                            <div className="px-3 py-1 rounded-button text-xs bg-red-500/20 border border-red-500/50 text-red-400">
                              CANCELADO :(
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-gray-500">Data</div>
                              <div className="text-white">{formatDateBRFromISO(a.data)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Horário</div>
                              <div className="text-white">{a.hora_inicio}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Valor</div>
                              <div className="text-white">R$ {a.servicos?.preco}</div>
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

            {activeTab === 'historico' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <h2 className="text-2xl font-normal">Histórico de Agendamentos</h2>

                  <div className="flex items-center gap-2">
                    <DateFilterButton
                      value={historicoData}
                      onChange={(e) => setHistoricoData(e.target.value)}
                      title="Filtrar histórico por data"
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
                              <div className="font-normal text-lg">{a.users?.nome || 'Cliente'}</div>
                              <div className="text-sm text-gray-400">
                                {a.hora_inicio} • {a.servicos?.nome} • {a.profissionais?.nome}
                              </div>
                            </div>

                            <div className={`px-3 py-1 rounded-button text-xs ${
                              isCancel ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                              : isDone ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                              : 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                            }`}>
                              {isCancel ? 'CANCELADO' : isDone ? 'CONCLUÍDO' : 'AGENDADO'}
                            </div>
                          </div>

                          <div className="text-sm text-gray-300">
                            VALOR: <span className="text-primary">R$ {a.servicos?.preco ?? '0.00'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-12">:(</div>
                )}
              </div>
            )}

            {activeTab === 'servicos' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-normal">Serviços</h2>
                  <button
                    onClick={() => {
                      setShowNovoServico(true);
                      setEditingServicoId(null);
                      setFormServico({ nome: '', duracao_minutos: '', preco: '', preco_promocional: '', profissional_id: '' });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal uppercase"
                  >
                    <Plus className="w-5 h-5" />SERVIÇO
                  </button>
                </div>

                {profissionais.length === 0 ? (
                  <div className="text-gray-500">Nenhum profissional cadastrado.</div>
                ) : (
                  <div className="space-y-4">
                    {profissionais.map(p => {
                      const lista = (servicosPorProf.get(p.id) || [])
                        .slice()
                        .sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));

                      return (
                        <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="font-normal text-lg">{p.nome}</div>
                            <div className="text-xs text-gray-500">{lista.length} serviço(s)</div>
                          </div>

                          {lista.length ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {lista.map(s => {
                                const preco = Number(s.preco ?? 0);
                                const promo = (s.preco_promocional == null) ? null : Number(s.preco_promocional);

                                return (
                                  <div key={s.id} className="bg-dark-100 border border-gray-800 rounded-custom p-5">
                                    <div className="flex justify-between items-start mb-3">
                                      <div>
                                        <h3 className="text-lg font-normal">{s.nome}</h3>
                                        <p className="text-xs text-gray-500">{p.nome}</p>
                                      </div>

                                      <div className="text-right">
                                        {promo != null && promo > 0 && promo < preco ? (
                                          <div className="leading-tight">
                                            <div className="text-sm font-normal text-red-400 line-through">
                                              R$ {preco.toFixed(2)}
                                            </div>
                                            <div className="text-2xl font-normal text-green-400">
                                              R$ {promo.toFixed(2)}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-2xl font-normal text-primary">R$ {preco.toFixed(2)}</div>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-sm text-gray-400 mb-4">{s.duracao_minutos} MIN</p>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingServicoId(s.id);
                                          setFormServico({
                                            nome: s.nome || '',
                                            duracao_minutos: String(s.duracao_minutos ?? ''),
                                            preco: String(s.preco ?? ''),
                                            preco_promocional: String(s.preco_promocional ?? ''),
                                            profissional_id: s.profissional_id || ''
                                          });
                                          setShowNovoServico(true);
                                        }}
                                        className="flex-1 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-button text-sm font-normal uppercase"
                                      >
                                        EDITAR
                                      </button>

                                      <button
                                        onClick={() => deleteServico(s.id)}
                                        className="flex-1 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-button text-sm font-normal uppercase"
                                      >
                                        EXCLUIR
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-gray-500">Sem serviços ativos para este profissional.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profissionais' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-normal">Profissionais</h2>
                  <button
                    onClick={() => {
                      setShowNovoProfissional(true);
                      setEditingProfissional(null);
                      setFormProfissional({
                        nome: '',
                        profissao: '',
                        anos_experiencia: '',
                        horario_inicio: '08:00',
                        horario_fim: '18:00',
                        almoco_inicio: '',
                        almoco_fim: '',
                        dias_trabalho: [1, 2, 3, 4, 5, 6]
                      });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal uppercase"
                  >
                    <Plus className="w-5 h-5" />ADICIONAR
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profissionais.map(p => {
                    const ativo = (p.ativo === undefined) ? true : !!p.ativo;
                    const status = getProfStatus(p);

                    return (
                      <div key={p.id} className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-normal font-normal text-xl">
                            {p.nome?.[0] || 'P'}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-normal flex items-center gap-2">
                              {p.nome}
                              {!ativo && (
                                <span className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 font-normal">
                                  INATIVO
                                </span>
                              )}
                            </h3>

                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                              <span className="text-xs text-gray-400">{status.label}</span>
                            </div>

                            {p.profissao ? (
                              <p className="text-xs text-gray-500 mt-1">{p.profissao}</p>
                            ) : null}

                            {p.anos_experiencia != null && (
                              <p className="text-xs text-gray-500 mt-1">{p.anos_experiencia} anos</p>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-400 mb-3">
                          {servicos.filter(s => s.profissional_id === p.id).length} serviços
                        </div>

                        <div className="text-xs text-gray-500 mb-3">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {p.horario_inicio} - {p.horario_fim}
                          {p.almoco_inicio && p.almoco_fim ? (
                            <span className="ml-2 text-yellow-300">• ALMOÇO {p.almoco_inicio} - {p.almoco_fim}</span>
                          ) : null}
                        </div>

                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => toggleAtivoProfissional(p)}
                            className={`flex-1 py-2 rounded-button text-sm border font-normal uppercase ${
                              ativo
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                : 'bg-green-500/10 border-green-500/30 text-green-300'
                            }`}
                          >
                            {ativo ? 'INATIVAR' : 'ATIVAR'}
                          </button>

                          <button
                            onClick={() => excluirProfissional(p)}
                            className="flex-1 py-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-button text-sm font-normal uppercase"
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
                              profissao: p.profissao || '',
                              anos_experiencia: String(p.anos_experiencia ?? ''),
                              horario_inicio: p.horario_inicio || '08:00',
                              horario_fim: p.horario_fim || '18:00',
                              almoco_inicio: p.almoco_inicio || '',
                              almoco_fim: p.almoco_fim || '',
                              dias_trabalho: Array.isArray(p.dias_trabalho) && p.dias_trabalho.length ? p.dias_trabalho : [1, 2, 3, 4, 5, 6],
                            });
                            setShowNovoProfissional(true);
                          }}
                          className="w-full py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-button text-sm font-normal uppercase"
                        >
                          EDITAR
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'info-negocio' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-normal">Info do Negócio</h2>

                  <button
                    onClick={salvarInfoNegocio}
                    disabled={infoSaving}
                    className={`px-5 py-2.5 rounded-button font-normal border flex items-center gap-2 uppercase ${
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
                    <label className="block text-sm mb-2">Nome do Negócio</label>
                    <input
                      value={formInfo.nome}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="Nome"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm mb-2">Telefone</label>
                    <input
                      value={formInfo.telefone}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, telefone: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="(xx) xxxxx-xxxx"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5 md:col-span-2">
                    <label className="block text-sm mb-2">Endereço</label>
                    <input
                      value={formInfo.endereco}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, endereco: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder='Ex.: Rua Serra do Sincorá, 1038 - Belo Horizonte, Minas Gerais'
                    />
                    <p className="text-[12px] text-yellow-300 mt-2">
                      IMPORTANTE: se você mudar o endereço, use sempre o formato:
                      <span className="text-gray-300">{" "}"RUA, NÚMERO - CIDADE, ESTADO"</span>.
                      <span className="text-gray-500"> Ex.: Rua Serra do Sincorá, 1038 - Belo Horizonte, Minas Gerais</span>
                    </p>
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5 md:col-span-2">
                    <label className="block text-sm mb-2">Sobre</label>
                    <textarea
                      value={formInfo.descricao}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, descricao: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white resize-none"
                      placeholder="Sobre o negócio..."
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm mb-2">Instagram (ID ou @)</label>
                    <input
                      value={formInfo.instagram}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, instagram: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="@seuinstagram"
                    />
                  </div>

                  <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                    <label className="block text-sm mb-2">Facebook (ID ou nome)</label>
                    <input
                      value={formInfo.facebook}
                      onChange={(e) => setFormInfo(prev => ({ ...prev, facebook: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                      placeholder="facebook.com/..."
                    />
                  </div>
                </div>

                <div className="bg-dark-200 border border-gray-800 rounded-custom p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-normal">GALERIA</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Adicione fotos do seu negócio :)
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
                        className={`inline-flex items-center gap-2 rounded-button font-normal border cursor-pointer transition-all uppercase ${
                          galleryUploading
                            ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                            : 'bg-primary/20 hover:bg-primary/30 border-primary/50 text-primary'
                        }
                        px-3 py-1.5 text-xs
                        sm:px-4 sm:py-2 sm:text-sm
                        `}
                      >
                        <Plus className="w-4 h-4" />
                        {galleryUploading ? 'ENVIANDO...' : 'ADICIONAR'}
                      </span>
                    </label>
                  </div>

                  {Array.isArray(formInfo.galeria) && formInfo.galeria.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {formInfo.galeria.map((url) => (
                        <div key={url} className="relative bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
                          <img src={url} alt="Galeria" className="w-full h-28 object-cover" />

                          {/* ✅ REMOVER CENTRALIZADO SÓ NO MOBILE */}
                          <button
                            onClick={() => removerImagemGaleria(url)}
                            className="
                              absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                              sm:left-auto sm:top-10 sm:right-2 sm:transform-none
                              px-3 py-1 rounded-full bg-black/60 border border-gray-700
                              hover:border-red-400 text-[12px] text-red-200 font-normal uppercase
                            "
                            title="Remover"
                          >
                            REMOVER
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">Nenhuma imagem ainda :(</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Modal Serviço */}
      {showNovoServico && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-normal">{editingServicoId ? 'EDITAR SERVIÇO' : 'NOVO SERVIÇO'}</h3>
              <button
                onClick={() => {
                  setShowNovoServico(false);
                  setEditingServicoId(null);
                  setFormServico({ nome: '', duracao_minutos: '', preco: '', preco_promocional: '', profissional_id: '' });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingServicoId ? updateServico : createServico} className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Profissional</label>
                <InputWithChevron>
                  <select
                    value={formServico.profissional_id}
                    onChange={(e) => setFormServico({ ...formServico, profissional_id: e.target.value })}
                    className="no-native-indicator w-full px-4 py-3 pr-12 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    required
                  >
                    <option value="">Selecione</option>
                    {profissionais
                      .filter(p => (p.ativo === undefined ? true : !!p.ativo))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                  </select>
                </InputWithChevron>
              </div>

              <div>
                <label className="block text-sm mb-2">Nome</label>
                <input
                  type="text"
                  value={formServico.nome}
                  onChange={(e) => setFormServico({ ...formServico, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />                
              </div>

              <div>
                <label className="block text-sm mb-2">Tempo estimado (min)</label>
                <input
                  type="number"
                  value={formServico.duracao_minutos}
                  onChange={(e) => setFormServico({ ...formServico, duracao_minutos: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-2">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formServico.preco}
                  onChange={(e) => setFormServico({ ...formServico, preco: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-2">Preço de OFERTA (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formServico.preco_promocional}
                  onChange={(e) => setFormServico({ ...formServico, preco_promocional: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  placeholder="Preencha apenas se houver oferta"
                />
                <p className="text-[12px] text-gray-500 mt-2">
                  Para oferta aparecer, o preço de oferta deve ser menor que o preço normal.
                </p>
              </div>

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal uppercase">
                {editingServicoId ? 'SALVAR' : 'CRIAR SERVIÇO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Modal Profissional */}
      {showNovoProfissional && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-normal">{editingProfissional ? 'EDITAR PROFISSIONAL' : 'NOVO PROFISSIONAL'}</h3>
              <button
                onClick={() => {
                  setShowNovoProfissional(false);
                  setEditingProfissional(null);
                  setFormProfissional({
                    nome: '',
                    profissao: '',
                    anos_experiencia: '',
                    horario_inicio: '08:00',
                    horario_fim: '18:00',
                    almoco_inicio: '',
                    almoco_fim: '',
                    dias_trabalho: [1, 2, 3, 4, 5, 6]
                  });
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingProfissional ? updateProfissional : createProfissional} className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Nome</label>
                <input
                  type="text"
                  value={formProfissional.nome}
                  onChange={(e) => setFormProfissional({ ...formProfissional, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  required
                />                
              </div>

              <div>
                <label className="block text-sm mb-2">Como te chamamos?</label>
                <input
                  type="text"
                  value={formProfissional.profissao}
                  onChange={(e) => setFormProfissional({ ...formProfissional, profissao: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  placeholder="Ex: Barbeiro, Manicure..."
                />
              </div>

              <div>
                <label className="block text-sm mb-2">Ano(s) de experiência</label>
                <input
                  type="number"
                  value={formProfissional.anos_experiencia}
                  onChange={(e) => setFormProfissional({ ...formProfissional, anos_experiencia: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">Das</label>
                  <InputWithChevron>
                    <input
                      type="time"
                      value={formProfissional.horario_inicio}
                      onChange={(e) => setFormProfissional({ ...formProfissional, horario_inicio: e.target.value })}
                      className="no-native-indicator w-full px-4 py-3 pr-12 bg-dark-200 border border-gray-800 rounded-custom text-white"
                      required
                    />
                  </InputWithChevron>
                </div>
                <div>
                  <label className="block text-sm mb-2">Até</label>
                  <InputWithChevron>
                    <input
                      type="time"
                      value={formProfissional.horario_fim}
                      onChange={(e) => setFormProfissional({ ...formProfissional, horario_fim: e.target.value })}
                      className="no-native-indicator w-full px-4 py-3 pr-12 bg-dark-200 border border-gray-800 rounded-custom text-white"
                      required
                    />
                  </InputWithChevron>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">Almoço (Início)</label>
                  <InputWithChevron>
                    <input
                      type="time"
                      value={formProfissional.almoco_inicio}
                      onChange={(e) => setFormProfissional({ ...formProfissional, almoco_inicio: e.target.value })}
                      className="no-native-indicator w-full px-4 py-3 pr-12 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    />
                  </InputWithChevron>
                </div>
                <div>
                  <label className="block text-sm mb-2">Almoço (Fim)</label>
                  <InputWithChevron>
                    <input
                      type="time"
                      value={formProfissional.almoco_fim}
                      onChange={(e) => setFormProfissional({ ...formProfissional, almoco_fim: e.target.value })}
                      className="no-native-indicator w-full px-4 py-3 pr-12 bg-dark-200 border border-gray-800 rounded-custom text-white"
                    />
                  </InputWithChevron>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Dias de trabalho</label>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
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
                        className={`py-2 rounded-button border font-normal text-xs transition-all ${
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

                <p className="text-[12px] text-gray-500 mt-2">
                  • Amarelo aberto e cinza fechado.
                </p>
              </div>

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal uppercase">
                {editingProfissional ? 'SALVAR' : 'ADICIONAR'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
