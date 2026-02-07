import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Clock, Phone, Heart, ArrowLeft,
  Zap, X, AlertCircle, Instagram
} from 'lucide-react';
import { supabase } from '../supabase';

const FOLGA_MINUTOS = 5;

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

function addMinutes(time, delta) {
  return minutesToTime(timeToMinutes(time) + delta);
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

  return {
    date: `${y}-${mo}-${d}`,
    minutes: (Number(hh) * 60) + Number(mm)
  };
}

function formatDateBR(ymd) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return String(ymd);
  return `${d}/${m}/${y}`;
}

function getDowFromDateSP(dateStr) {
  if (!dateStr) return null;
  const dt = new Date(`${dateStr}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short'
  }).format(dt);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? null;
}

function roundUpToNextStep(min, step = 30) {
  return Math.ceil(min / step) * step;
}

// Alinha o "min" para o próximo horário que respeite (t - base) % step === 0
function alignToStepFromBase(min, base, step) {
  if (!Number.isFinite(min) || !Number.isFinite(base) || !Number.isFinite(step) || step <= 0) return min;
  if (min <= base) return base;
  const offset = (min - base) % step;
  if (offset === 0) return min;
  return min + (step - offset);
}

const withTimeout = (promise, ms, label = 'timeout') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${label}) em ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

function StarChar({ size = 18, className = 'text-primary' }) {
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      ★
    </span>
  );
}

function Stars5Char({ value = 0, size = 14 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div className="flex items-center gap-1" aria-label={`Nota ${v} de 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          style={{ fontSize: size, lineHeight: 1 }}
          className={i <= v ? 'text-primary' : 'text-gray-700'}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}

function resolveLogoUrl(logo_url) {
  const raw = String(logo_url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  try {
    const { data } = supabase.storage.from('logos').getPublicUrl(raw);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

function normalizeDiasTrabalho(arr) {
  const base = Array.isArray(arr) ? arr : [];
  const cleaned = base
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .map(n => (n === 7 ? 0 : n))
    .filter(n => n >= 0 && n <= 6);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

function resolveInstagram(instaRaw) {
  const raw = String(instaRaw || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const handle = raw.replace(/^@/, '').replace(/\s+/g, '');
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

function DatePickerButton({
  value,
  onChange,
  min,
  placeholder = 'SELECIONAR DATA',
  className = ''
}) {
  const inputRef = useRef(null);

  const label = value ? formatDateBR(value) : placeholder;

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;

    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.click();
      el.focus();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={openPicker}
        className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white flex items-center justify-between uppercase"
      >
        <span className={`text-base ${value ? 'text-white' : 'text-gray-400'}`}>
          {label}
        </span>
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0 pointer-events-none" />
      </button>

      <input
        ref={inputRef}
        type="date"
        min={min}
        value={value}
        onChange={onChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Selecionar data"
      />
    </div>
  );
}

export default function Vitrine({ user, userType }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [negocio, setNegocio] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFavorito, setIsFavorito] = useState(false);

  const [showAgendamento, setShowAgendamento] = useState(false);
  const [flow, setFlow] = useState({
    step: 1,
    profissional: null,
    data: '',
    horario: null,
    servicosSelecionados: [],
  });

  const minDateSP = useMemo(() => getNowSP().date, []);

  const [showAvaliar, setShowAvaliar] = useState(false);
  const [avaliarNota, setAvaliarNota] = useState(5);
  const [avaliarTexto, setAvaliarTexto] = useState('');
  const [avaliarLoading, setAvaliarLoading] = useState(false);
  const [avaliarTipo, setAvaliarTipo] = useState('negocio');
  const [avaliarProfissionalId, setAvaliarProfissionalId] = useState(null);

  const isProfessional = user && userType === 'professional';

  useEffect(() => {
    loadVitrine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (user && negocio?.id) checkFavorito();
    else setIsFavorito(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userType, negocio?.id]);

  const loadVitrine = async () => {
    setLoading(true);
    setError(null);

    const watchdog = setTimeout(() => {
      setLoading(false);
      setError('Demorou demais para carregar. Tente novamente.');
    }, 12000);

    try {
      const { data: negocioData, error: negocioError } = await withTimeout(
        supabase.from('negocios').select('*').eq('slug', slug).maybeSingle(),
        7000,
        'negocio'
      );

      if (negocioError) throw negocioError;

      if (!negocioData) {
        setNegocio(null);
        setProfissionais([]);
        setServicos([]);
        setAvaliacoes([]);
        return;
      }

      setNegocio(negocioData);

      const { data: profissionaisData, error: profErr } = await withTimeout(
        supabase.from('profissionais').select('*').eq('negocio_id', negocioData.id),
        7000,
        'profissionais'
      );

      if (profErr) throw profErr;
      const profs = profissionaisData || [];
      setProfissionais(profs);

      const profissionalIds = profs.map(p => p.id);

      if (profissionalIds.length > 0) {
        const { data: servicosData, error: servErr } = await withTimeout(
          supabase.from('servicos').select('*').in('profissional_id', profissionalIds).eq('ativo', true),
          7000,
          'servicos'
        );

        if (servErr) throw servErr;
        setServicos(servicosData || []);
      } else {
        setServicos([]);
      }

      const { data: avaliacoesData, error: avalErr } = await withTimeout(
        supabase
          .from('avaliacoes')
          .select(`*, users (nome), profissionais (nome), negocios (nome)`)
          .eq('negocio_id', negocioData.id)
          .order('created_at', { ascending: false })
          .limit(10),
        7000,
        'avaliacoes'
      );

      if (avalErr) throw avalErr;
      setAvaliacoes(avaliacoesData || []);
    } catch (e) {
      console.error('Erro ao carregar vitrine:', e);
      setError(e?.message || 'Erro ao carregar a vitrine.');
      setNegocio(null);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  };

  const checkFavorito = async () => {
    if (!user || userType !== 'client' || !negocio?.id) {
      setIsFavorito(false);
      return;
    }

    try {
      const { data, error: favErr } = await withTimeout(
        supabase
          .from('favoritos')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('negocio_id', negocio.id)
          .maybeSingle(),
        6000,
        'favorito'
      );

      if (favErr) throw favErr;
      setIsFavorito(!!data);
    } catch (e) {
      console.warn('checkFavorito falhou:', e?.message || e);
      setIsFavorito(false);
    }
  };

  const toggleFavorito = async () => {
    if (!user) {
      alert('Faça login para favoritar');
      return;
    }
    if (userType !== 'client') {
      alert('Apenas CLIENTE pode favoritar negócios.');
      return;
    }
    if (!negocio?.id) {
      alert('Negócio inválido.');
      return;
    }

    try {
      if (isFavorito) {
        const { error: delErr } = await supabase
          .from('favoritos')
          .delete()
          .eq('cliente_id', user.id)
          .eq('negocio_id', negocio.id);

        if (delErr) throw delErr;
        setIsFavorito(false);
      } else {
        const { error: insErr } = await supabase
          .from('favoritos')
          .insert({
            cliente_id: user.id,
            negocio_id: negocio.id
          });

        if (insErr) throw insErr;
        setIsFavorito(true);
      }
    } catch (e) {
      console.error('Erro ao favoritar:', e);
      alert('Erro ao favoritar. Tente novamente.');
    }
  };

  const iniciarAgendamento = (profissional) => {
    if (!user) {
      if (confirm('Você precisa fazer login para agendar. Deseja fazer login agora?')) navigate('/login');
      return;
    }

    if (userType !== 'client') {
      alert('Você está logado como PROFISSIONAL. Para agendar, entre como CLIENTE.');
      return;
    }

    setFlow({
      step: 1,
      profissional,
      data: '',
      horario: null,
      servicosSelecionados: []
    });
    setShowAgendamento(true);
  };

  const servicosDoProf = useMemo(() => {
    if (!flow.profissional) return [];
    return servicos.filter(s => s.profissional_id === flow.profissional.id);
  }, [servicos, flow.profissional]);

  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);

  const diaSelecionadoEhTrabalho = useMemo(() => {
    if (!flow.profissional || !flow.data) return true;
    const dias = normalizeDiasTrabalho(flow.profissional.dias_trabalho);
    const diasEfetivos = dias.length ? dias : [0, 1, 2, 3, 4, 5, 6];
    const dow = getDowFromDateSP(flow.data);
    if (dow == null) return true;
    return diasEfetivos.includes(dow);
  }, [flow.profissional, flow.data]);

  const totalSelecionado = useMemo(() => {
    const lista = Array.isArray(flow.servicosSelecionados) ? flow.servicosSelecionados : [];
    const dur = lista.reduce((sum, s) => sum + Number(s?.duracao_minutos || 0), 0);
    const val = lista.reduce((sum, s) => sum + Number(s?.preco || 0), 0);
    return { duracao: dur, valor: val, qtd: lista.length };
  }, [flow.servicosSelecionados]);

  const duracaoTotalComFolga = useMemo(() => {
    const dur = Number(totalSelecionado.duracao || 0);
    if (!dur || dur <= 0) return 0;
    return dur + FOLGA_MINUTOS;
  }, [totalSelecionado.duracao]);

  // Lista de serviços (agora no step 2, sem depender de horário)
  const servicosPossiveis = useMemo(() => {
    return (servicosDoProf || [])
      .filter(s => Number(s.duracao_minutos || 0) > 0)
      .sort((a, b) => {
        const pa = Number(a.preco ?? 0);
        const pb = Number(b.preco ?? 0);
        if (pb !== pa) return pb - pa;
        return String(a.nome || '').localeCompare(String(b.nome || ''));
      });
  }, [servicosDoProf]);

  const getAlmocoRange = (p) => {
    const ini = p?.almoco_inicio || p?.horario_almoco_inicio || null;
    const fim = p?.almoco_fim || p?.horario_almoco_fim || null;
    return { ini, fim };
  };

  const isInLunchNow = (p) => {
    const { ini, fim } = getAlmocoRange(p);
    if (!ini || !fim) return false;
    const now = getNowSP();
    const a = timeToMinutes(ini);
    const b = timeToMinutes(fim);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (b < a) return (now.minutes >= a || now.minutes < b);
    return (now.minutes >= a && now.minutes < b);
  };

  const getProfStatus = (p) => {
    const ativo = (p?.ativo === undefined) ? true : !!p.ativo;
    if (!ativo) return { label: 'FECHADO', color: 'bg-red-500' };

    const now = getNowSP();
    const ini = timeToMinutes(p?.horario_inicio || '08:00');
    const fim = timeToMinutes(p?.horario_fim || '18:00');

    const dias = normalizeDiasTrabalho(p?.dias_trabalho);
    const diasEfetivos = dias.length ? dias : [0, 1, 2, 3, 4, 5, 6];

    const hojeDow = getDowFromDateSP(now.date);
    const trabalhaHoje = hojeDow == null ? true : diasEfetivos.includes(hojeDow);
    const dentroHorario = now.minutes >= ini && now.minutes < fim;

    if (!(trabalhaHoje && dentroHorario)) return { label: 'FECHADO', color: 'bg-red-500' };
    if (isInLunchNow(p)) return { label: 'ALMOÇO', color: 'bg-yellow-400' };

    return { label: 'ABERTO', color: 'bg-green-500' };
  };

  // ✅ NOVA REGRA: horários gerados com "slot fixo temporário" baseado em (tempo_total + folga),
  // e validação no clique pelo maxMinutos (até o próximo agendamento).
  const calcularHorariosDisponiveis = async () => {
    if (!flow.profissional || !flow.data) return;

    if (!diaSelecionadoEhTrabalho) {
      setHorariosDisponiveis([]);
      return;
    }

    // precisa do serviço antes do horário (novo fluxo)
    if (!duracaoTotalComFolga || duracaoTotalComFolga <= 0) {
      setHorariosDisponiveis([]);
      return;
    }

    try {
      const inicio = flow.profissional.horario_inicio || '08:00';
      const fim = flow.profissional.horario_fim || '18:00';

      const startDay = timeToMinutes(inicio);
      const endDay = timeToMinutes(fim);

      const nowSP = getNowSP();
      const isHoje = flow.data === nowSP.date;

      // Base SP sempre. Alinha o primeiro horário a partir da abertura respeitando o step.
      const minNowBase = isHoje ? nowSP.minutes : -Infinity;
      const minNow = isHoje
        ? alignToStepFromBase(
            // arredonda o "agora" pra cima em 5 min só pra não gerar horários "no passado imediato"
            roundUpToNextStep(minNowBase, 5),
            startDay,
            duracaoTotalComFolga
          )
        : startDay;

      const { data: ags, error: agErr } = await withTimeout(
        supabase.rpc('get_agendamentos_dia', {
          p_profissional_id: flow.profissional.id,
          p_data: flow.data
        }),
        7000,
        'rpc-busy-slots'
      );
      if (agErr) throw agErr;

      const { data: slots, error: slotErr } = await withTimeout(
        supabase
          .from('slots_temporarios')
          .select('*')
          .eq('profissional_id', flow.profissional.id)
          .eq('data', flow.data)
          .eq('ativo', true),
        7000,
        'slots'
      );

      if (slotErr) console.warn('slots_temporarios indisponível:', slotErr.message);

      const agendamentosValidos = (ags || [])
        .filter(a => !String(a.status || '').includes('cancelado'))
        .map(a => ({
          ini: timeToMinutes(a.hora_inicio),
          fim: timeToMinutes(a.hora_fim)
        }))
        .sort((a, b) => a.ini - b.ini);

      const slotsList = (slots || []).map(s => ({
        ini: timeToMinutes(s.hora_inicio),
        fim: timeToMinutes(s.hora_fim),
        raw: s
      }));

      // gera a série fixa (temporária) do dia inteiro baseada no step,
      // mas ignora horários que caem DENTRO de um agendamento.
      const horarios = [];
      let cur = Math.max(startDay, minNow);

      // garante alinhamento com a abertura
      cur = alignToStepFromBase(cur, startDay, duracaoTotalComFolga);

      while (cur < endDay) {
        if (cur < minNow) {
          cur += duracaoTotalComFolga;
          continue;
        }

        // se cair dentro de um agendamento existente, pula para o fim do agendamento e realinha no step
        const busyNow = agendamentosValidos.find(a => cur >= a.ini && cur < a.fim);
        if (busyNow) {
          const next = Math.max(busyNow.fim, cur + 1);
          cur = alignToStepFromBase(next, startDay, duracaoTotalComFolga);
          continue;
        }

        const hora = minutesToTime(cur);

        const nextBusyStart = agendamentosValidos
          .filter(a => a.ini > cur)
          .map(a => a.ini)
          .sort((a, b) => a - b)[0];

        let freeEnd = Number.isFinite(nextBusyStart) ? Math.min(nextBusyStart, endDay) : endDay;

        // Se existir um slot temporário exatamente aqui, limita o freeEnd ao fim dele
        const slotExato = slotsList.find(s => s.ini === cur);
        if (slotExato) freeEnd = Math.min(freeEnd, slotExato.fim);

        const maxMinutos = Math.max(0, freeEnd - cur);

        // regra de exibição: mostra o horário mesmo se não couber,
        // para dar a mensagem inteligente no clique (sem “sumir” horário).
        if (maxMinutos > 0) {
          horarios.push({
            hora,
            tipo: slotExato ? 'slot' : 'normal',
            slot: slotExato ? slotExato.raw : null,
            maxMinutos,
            // capacidade real vs necessidade (serviços + folga)
            precisaMinutos: duracaoTotalComFolga,
            cabe: duracaoTotalComFolga <= maxMinutos,
          });
        }

        cur += duracaoTotalComFolga;
      }

      setHorariosDisponiveis(horarios);
    } catch (e) {
      console.error('Erro ao calcular horários:', e);
      setHorariosDisponiveis([]);
    }
  };

  // ✅ Agora calcula horários quando estiver no step 3 (horários) e já tiver serviços selecionados
  useEffect(() => {
    if (showAgendamento && flow.step === 3) calcularHorariosDisponiveis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAgendamento,
    flow.profissional?.id,
    flow.data,
    flow.step,
    diaSelecionadoEhTrabalho,
    duracaoTotalComFolga
  ]);

  const confirmarAgendamento = async () => {
    if (!user || userType !== 'client') {
      alert('Você precisa estar logado como CLIENTE para agendar.');
      return;
    }
    if (!negocio?.id) {
      alert('Negócio inválido. Recarregue a vitrine.');
      return;
    }

    try {
      // novo fluxo: data -> serviços -> horário -> confirmar
      if (!flow.profissional || !flow.data || !flow.horario || !flow.servicosSelecionados?.length) {
        alert('Dados incompletos. Refaça o agendamento.');
        return;
      }

      if (!diaSelecionadoEhTrabalho) {
        alert('Esse profissional está FECHADO nesse dia. Escolha outra data.');
        setFlow(prev => ({ ...prev, step: 1, horario: null, servicosSelecionados: [] }));
        return;
      }

      const horaInicioBase = flow.horario.hora;
      const max = Number(flow.horario.maxMinutos || 0);
      const durServicos = Number(totalSelecionado.duracao || 0);
      const precisa = durServicos + FOLGA_MINUTOS;

      if (!durServicos) {
        alert('Selecione pelo menos 1 serviço.');
        return;
      }

      if (precisa > max) {
        const maxServico = Math.max(0, max - FOLGA_MINUTOS);
        alert(
          `⛔ Esse horário não comporta seu agendamento.\n\n` +
          `• Tempo disponível até o próximo compromisso: ${max} min\n` +
          `• Seu agendamento (serviços + folga de ${FOLGA_MINUTOS} min): ${precisa} min\n\n` +
          `✅ Para esse horário, cabe no máximo: ${maxServico} min de serviços.\n` +
          `Escolha outro horário ou ajuste os serviços.`
        );
        return;
      }

      let curInicio = horaInicioBase;
      const insertedIds = [];

      try {
        const lista = Array.isArray(flow.servicosSelecionados) ? flow.servicosSelecionados : [];
        const ordered = [...lista]; // mantém a ordem de seleção atual

        for (let idx = 0; idx < ordered.length; idx++) {
          const s = ordered[idx];
          const dur = Number(s.duracao_minutos || 0);
          if (!dur) continue;

          let curFim = addMinutes(curInicio, dur);

          // ✅ folga fixa SOMENTE ao final do último serviço (reserva a limpeza)
          const isLast = idx === ordered.length - 1;
          if (isLast) curFim = addMinutes(curFim, FOLGA_MINUTOS);

          const { data: inserted, error: insErr } = await withTimeout(
            supabase
              .from('agendamentos')
              .insert({
                negocio_id: negocio.id,
                profissional_id: flow.profissional.id,
                cliente_id: user.id,
                servico_id: s.id,
                data: flow.data,
                hora_inicio: curInicio,
                hora_fim: curFim,
                status: 'agendado'
              })
              .select('id')
              .maybeSingle(),
            7000,
            'criar-agendamento'
          );

          if (insErr) throw insErr;
          if (inserted?.id) insertedIds.push(inserted.id);

          // próximo serviço começa no fim do anterior (sem folga entre serviços)
          curInicio = curFim;
        }
      } catch (errInsert) {
        if (insertedIds.length) {
          await supabase.from('agendamentos').delete().in('id', insertedIds);
        }
        throw errInsert;
      }

      alert('✅ Agendamento confirmado!');
      setShowAgendamento(false);
      navigate('/minha-area');
    } catch (e) {
      console.error('Erro ao agendar:', e);
      alert('❌ Erro ao criar agendamento: ' + (e.message || ''));
    }
  };

  const abrirAvaliar = () => {
    if (!user) {
      if (confirm('Você precisa fazer login para avaliar. Deseja fazer login agora?')) navigate('/login');
      return;
    }
    if (userType !== 'client') {
      alert('Apenas CLIENTE pode avaliar.');
      return;
    }
    setAvaliarNota(5);
    setAvaliarTexto('');
    setAvaliarTipo('negocio');
    setAvaliarProfissionalId(null);
    setShowAvaliar(true);
  };

  const enviarAvaliacao = async () => {
    if (!user || userType !== 'client') return;
    if (!negocio?.id) return alert('Negócio inválido.');

    try {
      setAvaliarLoading(true);

      const payload = {
        cliente_id: user.id,
        negocio_id: negocio.id,
        nota: avaliarNota,
        comentario: avaliarTexto || null,
        profissional_id: avaliarTipo === 'profissional' ? avaliararProfissionalId : null
      };

      const { error: avErr } = await withTimeout(
        supabase.from('avaliacoes').insert(payload),
        7000,
        'enviar-avaliacao'
      );

      if (avErr) throw avErr;

      setShowAvaliar(false);
      await loadVitrine();
      alert('✅ Avaliação enviada!');
    } catch (e) {
      console.error('Erro ao avaliar:', e);
      alert('❌ Erro ao enviar avaliação: ' + (e.message || ''));
    } finally {
      setAvaliarLoading(false);
    }
  };

  // ✅ BUGFIX: variável correta (no payload acima tinha um typo)
  const avaliararProfissionalId = avaliarProfissionalId;

  const logoUrl = useMemo(() => resolveLogoUrl(negocio?.logo_url), [negocio?.logo_url]);
  const instagramUrl = useMemo(() => resolveInstagram(negocio?.instagram), [negocio?.instagram]);

  const galeria = useMemo(() => {
    const arr =
      negocio?.galeria ??
      negocio?.galeria ??
      negocio?.fotos ??
      [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }, [negocio?.galeria, negocio?.galeria, negocio?.fotos]);

  const servicosPorProf = useMemo(() => {
    const map = new Map();
    for (const p of profissionais) map.set(p.id, []);
    for (const s of servicos) {
      if (!map.has(s.profissional_id)) map.set(s.profissional_id, []);
      map.get(s.profissional_id).push(s);
    }
    return map;
  }, [profissionais, servicos]);

  const avaliacoesPorProf = useMemo(() => {
    const map = new Map();

    for (const av of avaliacoes) {
      if (av.profissional_id) {
        if (!map.has(av.profissional_id)) map.set(av.profissional_id, []);
        map.get(av.profissional_id).push(av);
      }
    }

    const medias = new Map();
    for (const [profId, avs] of map.entries()) {
      const media = avs.length > 0
        ? (avs.reduce((sum, a) => sum + a.nota, 0) / avs.length).toFixed(1)
        : null;
      medias.set(profId, { media, count: avs.length });
    }

    return medias;
  }, [avaliacoes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-2xl font-normal animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-100 border border-red-500/40 rounded-custom p-8 text-center">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-normal text-white mb-2">Não foi possível carregar</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={loadVitrine}
            className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-normal uppercase"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-normal text-white mb-4">Negócio não encontrado</h1>
          <Link to="/" className="text-primary hover:text-yellow-500 font-normal">Voltar para Home</Link>
        </div>
      </div>
    );
  }

  const mediaAvaliacoes = avaliacoes.length > 0
    ? (avaliacoes.reduce((sum, a) => sum + a.nota, 0) / avaliacoes.length).toFixed(1)
    : '0.0';

  const nomeNegocioLabel = String(negocio?.nome || '').trim() || 'NEGÓCIO';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Announcement Bar - Estilo Impact */}
      <div className="bg-primary overflow-hidden relative h-10 flex items-center">
        <div className="announcement-bar-marquee flex whitespace-nowrap">
          <div className="flex animate-marquee-infinite">
            {[...Array(20)].map((_, index) => (
              <div key={index} className="flex items-center px-4 shrink-0">
                <span className="text-black font-normal text-sm uppercase">FRETE GRÁTIS</span>
                <span className="mx-4 text-black font-normal text-sm">●</span>
              </div>
            ))}
          </div>

          <div className="flex animate-marquee-infinite" aria-hidden="true">
            {[...Array(20)].map((_, index) => (
              <div key={index} className="flex items-center px-4 shrink-0">
                <span className="text-black font-normal text-sm uppercase">FRETE GRÁTIS</span>
                <span className="mx-4 text-black font-normal text-sm">●</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes marquee-infinite {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee-infinite {
            animation: marquee-infinite 30s linear infinite;
            display: flex;
          }
          .announcement-bar-marquee:hover .animate-marquee-infinite {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-marquee-infinite { animation: none; }
          }
        `}</style>
      </div>

      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors uppercase"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={abrirAvaliar}
                disabled={!!isProfessional}
                className={`flex items-center gap-2 px-4 py-2 rounded-button transition-all bg-dark-200 border uppercase ${
                  isProfessional ? 'border-gray-900 text-gray-600 cursor-not-allowed' : 'border-gray-800 text-gray-300 hover:border-primary'
                }`}
              >
                <StarChar size={18} className="text-primary" />
                <span className="hidden sm:inline">Avaliar</span>
              </button>

              <button
                onClick={toggleFavorito}
                disabled={!!isProfessional}
                className={`flex items-center gap-2 px-4 py-2 rounded-button transition-all uppercase ${
                  isProfessional
                    ? 'bg-dark-200 border border-gray-900 text-gray-600 cursor-not-allowed'
                    : isFavorito
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : 'bg-dark-200 border border-gray-800 text-gray-400 hover:text-red-400'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorito ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">
                  {isProfessional ? 'Somente Cliente' : (isFavorito ? 'Favoritado' : 'Favoritar')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/20 via-black to-yellow-600/20 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {logoUrl ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-primary/30 bg-dark-100">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-4xl sm:text-5xl font-normal text-black">
                {negocio.nome?.[0] || 'N'}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal mb-3">{negocio.nome}</h1>
              <p className="text-base sm:text-lg text-gray-400 mb-4 font-normal">{negocio.descricao}</p>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <StarChar size={18} className="text-primary" />
                  <span className="text-xl font-normal text-primary">{mediaAvaliacoes}</span>
                  <span className="text-sm text-gray-500">({avaliacoes.length} avaliações)</span>
                </div>

                {negocio.endereco && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <MapPin className="w-4 h-4" strokeWidth={1.5} />
                    <span className="font-normal">{negocio.endereco}</span>
                  </div>
                )}

                {negocio.telefone && (
                  <a
                    href={`tel:${negocio.telefone}`}
                    className="flex items-center gap-2 text-primary hover:text-yellow-500 text-sm font-normal transition-colors"
                  >
                    <Phone className="w-4 h-4" strokeWidth={1.5} />
                    {negocio.telefone}
                  </a>
                )}

                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary hover:text-yellow-500 text-sm font-normal transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-4 h-4" strokeWidth={1.5} />
                    Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profissionais */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-normal mb-6">Profissionais</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profissionais.map(prof => {
              const totalServ = (servicosPorProf.get(prof.id) || []).length;
              const status = getProfStatus(prof);
              const avalInfo = avaliacoesPorProf.get(prof.id);

              const profissao = String(
                prof?.profissao ?? prof?.profissao_nome ?? prof?.especialidade ?? ''
              ).trim();

              const { ini: almIni, fim: almFim } = getAlmocoRange(prof);

              return (
                <div key={prof.id} className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-xl font-normal text-black">
                      {prof.nome?.[0] || 'P'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-lg font-normal">{prof.nome}</h3>
                        {profissao && (
                          <span className="inline-block px-2 py-1 bg-primary/20 border border-primary/30 rounded-button text-[10px] text-primary font-normal uppercase whitespace-nowrap">
                            {profissao}
                          </span>
                        )}
                      </div>

                      {avalInfo && avalInfo.media && (
                        <div className="flex items-center gap-2 mb-1">
                          <StarChar size={16} className="text-primary" />
                          <span className="text-lg font-normal text-primary">{avalInfo.media}</span>
                          <span className="text-xs text-gray-500">({avalInfo.count})</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                        <span className="text-xs text-gray-400 font-normal uppercase">{status.label}</span>
                      </div>

                      {prof.anos_experiencia != null && (
                        <p className="text-sm text-gray-500 font-normal mt-1">{prof.anos_experiencia} anos de experiência</p>
                      )}

                      <p className="text-xs text-gray-500 font-normal mt-2">
                        Horário: <span className="text-gray-300">{prof.horario_inicio || '08:00'} - {prof.horario_fim || '18:00'}</span>
                      </p>

                      {(almIni && almFim) && (
                        <p className="text-xs text-gray-500 font-normal mt-1">
                          Almoço: <span className="text-gray-300">{almIni} - {almFim}</span>
                        </p>
                      )}

                      <p className="text-xs text-gray-600 font-normal mt-2">
                        {totalServ} serviço(s) disponíveis
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => iniciarAgendamento(prof)}
                    className={`w-full py-3 rounded-button hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase font-normal ${
                      isProfessional
                        ? 'bg-dark-200 border border-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-yellow-600 text-black'
                    }`}
                    disabled={!!isProfessional}
                  >
                    <Calendar className="w-5 h-5" />
                    Agendar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-normal mb-6">Serviços</h2>

          {profissionais.length === 0 ? (
            <p className="text-gray-500 font-normal">Nenhum profissional cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {profissionais.map(p => {
                const lista = (servicosPorProf.get(p.id) || [])
                  .slice()
                  .sort((a, b) => {
                    const pa = Number(a.preco ?? 0);
                    const pb = Number(b.preco ?? 0);
                    if (pb !== pa) return pb - pa;
                    return String(a.nome || '').localeCompare(String(b.nome || ''));
                  });

                return (
                  <div key={p.id} className="bg-dark-100 border border-gray-800 rounded-custom p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-normal text-lg">{p.nome}</div>
                      <div className="text-xs text-gray-500 font-normal">{lista.length} serviço(s)</div>
                    </div>

                    {lista.length ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lista.map(s => {
                          const preco = Number(s.preco ?? 0);
                          const promo = Number(s.preco_promocional ?? 0);
                          const temPromo = Number.isFinite(promo) && promo > 0 && promo < preco;

                          return (
                            <div key={s.id} className="relative bg-dark-200 border border-gray-800 rounded-custom p-4">
                              {temPromo && (
                                <div className="absolute top-3 right-3">
                                  <span className="inline-block px-2 py-1 bg-green-500/20 border border-green-500/40 rounded-button text-[10px] text-green-400 font-normal uppercase">
                                    OFERTA
                                  </span>
                                </div>
                              )}

                              <div className="font-normal">{s.nome}</div>
                              <div className="text-xs text-gray-500 font-normal mt-1">
                                <Clock className="w-4 h-4 inline mr-1" />
                                {s.duracao_minutos} min
                              </div>

                              {!temPromo ? (
                                <div className="text-primary font-normal text-lg mt-2">
                                  R$ {preco.toFixed(2)}
                                </div>
                              ) : (
                                <div className="mt-2">
                                  <div className="text-green-400 font-normal text-lg">
                                    R$ {promo.toFixed(2)}
                                  </div>
                                  <div className="text-red-400 text-sm font-normal line-through">
                                    R$ {preco.toFixed(2)}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 font-normal">Sem serviços ativos para este profissional.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* GALERIA */}
      {galeria.length > 0 && (
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {galeria.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="mb-3 w-full break-inside-avoid overflow-hidden rounded-custom border border-gray-800 bg-dark-100"
                >
                  <img
                    src={url}
                    alt="Galeria"
                    className="w-full h-auto object-contain bg-black"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Avaliações */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl sm:text-3xl font-normal">Avaliações</h2>
            <button
              onClick={abrirAvaliar}
              disabled={!!isProfessional}
              className={`px-5 py-2 border rounded-button text-sm transition-all uppercase font-normal ${
                isProfessional
                  ? 'bg-dark-100 border-gray-900 text-gray-600 cursor-not-allowed'
                  : 'bg-primary/20 hover:bg-primary/30 border-primary/50 text-primary'
              }`}
            >
              + Avaliar
            </button>
          </div>

          {avaliacoes.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {avaliacoes.map(av => (
                <div key={av.id} className="bg-dark-100 border border-gray-800 rounded-custom p-4 relative">
                  <div className="absolute top-3 right-3">
                    {av.profissional_id && av.profissionais?.nome ? (
                      <span className="inline-block px-1.5 py-0.5 bg-primary/20 border border-primary/30 rounded-button text-[10px] text-primary font-normal uppercase">
                        Profissional: {av.profissionais.nome}
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-button text-[10px] text-blue-400 font-normal uppercase">
                        {nomeNegocioLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-normal">
                      {av.users?.nome?.[0] || 'A'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-normal">{av.users?.nome || 'Cliente'}</p>
                      <Stars5Char value={av.nota} size={14} />
                    </div>
                  </div>

                  {av.comentario && <p className="text-sm text-gray-400 font-normal">{av.comentario}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 font-normal">Nenhuma avaliação ainda</p>
          )}
        </div>
      </section>

      {/* Modal Agendamento */}
      {showAgendamento && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-100 border-b border-gray-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-normal">Agendar com {flow.profissional?.nome}</h2>
              <button onClick={() => setShowAgendamento(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* STEP 1: DATA */}
              {flow.step === 1 && (
                <div>
                  <h3 className="text-xl font-normal mb-4">Escolha a Data</h3>

                  <DatePickerButton
                    value={flow.data}
                    min={minDateSP}
                    placeholder="Selecionar data"
                    onChange={(e) => setFlow(prev => ({ ...prev, data: e.target.value }))}
                  />

                  {flow.data && !diaSelecionadoEhTrabalho && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-custom p-3 text-red-300 text-sm font-normal">
                      Este profissional está <b>FECHADO</b> nessa data. Escolha outro dia.
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!flow.data) return alert('Selecione uma data.');
                      if (!diaSelecionadoEhTrabalho) return alert('Esse profissional está FECHADO nesse dia. Escolha outra data.');
                      // ✅ novo fluxo: vai para SERVIÇOS
                      setFlow(prev => ({ ...prev, step: 2, horario: null, servicosSelecionados: [] }));
                    }}
                    className={`mt-4 w-full py-3 rounded-button uppercase font-normal ${
                      (!flow.data || !diaSelecionadoEhTrabalho)
                        ? 'bg-dark-200 border border-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-yellow-600 text-black'
                    }`}
                    disabled={!flow.data || !diaSelecionadoEhTrabalho}
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* STEP 2: SERVIÇOS (ANTES DO HORÁRIO) */}
              {flow.step === 2 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 1, servicosSelecionados: [], horario: null }))}
                    className="text-primary mb-4 uppercase font-normal"
                  >
                    VOLTAR
                  </button>

                  <h3 className="text-xl font-normal mb-2">
                    Escolha o(s) Serviço(s)
                  </h3>

                  <div className="mb-4 bg-dark-200 border border-gray-800 rounded-custom p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-normal">Selecionados:</span>
                      <span className="font-normal">{totalSelecionado.qtd}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500 font-normal">Tempo estimado:</span>
                      <span className="font-normal text-gray-200">
                        {totalSelecionado.duracao} min
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500 font-normal">Folga do sistema:</span>
                      <span className="font-normal text-gray-200">
                        {totalSelecionado.duracao ? FOLGA_MINUTOS : 0} min
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500 font-normal">Total para encaixe:</span>
                      <span className="font-normal text-primary">
                        {duracaoTotalComFolga || 0} min
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500 font-normal">Valor total:</span>
                      <span className="font-normal text-primary">R$ {totalSelecionado.valor.toFixed(2)}</span>
                    </div>
                  </div>

                  {servicosPossiveis.length > 0 ? (
                    <div className="space-y-3">
                      {servicosPossiveis.map(s => {
                        const selected = (flow.servicosSelecionados || []).some(x => x.id === s.id);

                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              const cur = Array.isArray(flow.servicosSelecionados) ? [...flow.servicosSelecionados] : [];
                              let next;
                              if (selected) next = cur.filter(x => x.id !== s.id);
                              else next = [...cur, s];
                              setFlow(prev => ({ ...prev, servicosSelecionados: next }));
                            }}
                            className={`w-full rounded-custom p-4 transition-all text-left border-2 ${
                              selected
                                ? 'bg-primary/10 border-primary'
                                : 'bg-dark-200 border-gray-800 hover:border-primary/50'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-normal">{s.nome}</p>
                                <p className="text-sm text-gray-500 font-normal">
                                  <Clock className="w-4 h-4 inline mr-1" />
                                  {s.duracao_minutos} min
                                </p>
                              </div>
                              <div className="text-2xl font-normal text-primary">R$ {Number(s.preco || 0).toFixed(2)}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 font-normal">
                      Nenhum serviço disponível.
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!flow.servicosSelecionados?.length) return alert('Selecione pelo menos 1 serviço.');
                      // ✅ novo fluxo: agora vai para HORÁRIOS já com step baseado no total
                      setFlow(prev => ({ ...prev, step: 3, horario: null }));
                    }}
                    className={`mt-4 w-full py-3 rounded-button uppercase font-normal ${
                      flow.servicosSelecionados?.length
                        ? 'bg-gradient-to-r from-primary to-yellow-600 text-black'
                        : 'bg-dark-200 border border-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!flow.servicosSelecionados?.length}
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* STEP 3: HORÁRIOS (DEPOIS DO SERVIÇO) */}
              {flow.step === 3 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 2, horario: null }))}
                    className="text-primary mb-4 font-normal uppercase"
                  >
                    Voltar
                  </button>

                  <h3 className="text-xl font-normal mb-4">Escolha o Horário</h3>

                  {!diaSelecionadoEhTrabalho ? (
                    <p className="text-gray-500 font-normal">Esse profissional está fechado nessa data.</p>
                  ) : horariosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {horariosDisponiveis.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            // mensagem inteligente no clique (sem mudar design)
                            if (!h.cabe) {
                              const maxServico = Math.max(0, Number(h.maxMinutos || 0) - FOLGA_MINUTOS);
                              alert(
                                `⛔ Esse horário não comporta seu agendamento.\n\n` +
                                `• Tempo disponível até o próximo compromisso: ${h.maxMinutos} min\n` +
                                `• Seu agendamento (serviços + folga de ${FOLGA_MINUTOS} min): ${h.precisaMinutos} min\n\n` +
                                `✅ Para esse horário, cabe no máximo: ${maxServico} min de serviços.\n` +
                                `Tente outro horário ou ajuste os serviços.`
                              );
                              return;
                            }

                            setFlow(prev => ({ ...prev, horario: h, step: 4 }));
                          }}
                          className={`relative p-3 rounded-custom transition-all bg-dark-200 border uppercase font-normal ${
                            h.cabe ? 'border-gray-800 hover:border-primary' : 'border-yellow-500/40 hover:border-yellow-500'
                          }`}
                        >
                          {h.tipo === 'slot' && (
                            <Zap className="w-4 h-4 text-primary absolute top-1 right-1" />
                          )}
                          <div className="text-lg normal-case">{h.hora}</div>
                          <div className="text-[10px] text-gray-500 normal-case">
                            até {h.maxMinutos}min
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 font-normal">Nenhum horário disponível nessa data.</p>
                  )}

                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
                    <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
                    <span className="text-sm text-blue-300 font-normal">
                      Horários com <Zap className="w-4 h-4 inline text-primary" /> são slots reaproveitados (cancelamentos).
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 4: CONFIRMAR */}
              {flow.step === 4 && (
                <div>
                  <h3 className="text-xl font-normal mb-4">Confirmar Agendamento</h3>

                  <div className="bg-dark-200 rounded-custom p-4 space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Profissional:</span>
                      <span className="font-normal">{flow.profissional?.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Data:</span>
                      <span className="font-normal">{formatDateBR(flow.data)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Horário:</span>
                      <span className="font-normal">{flow.horario?.hora}</span>
                    </div>

                    <div className="pt-2 border-t border-gray-800">
                      <div className="text-gray-500 font-normal text-sm mb-2">Serviços:</div>
                      <div className="space-y-1">
                        {(flow.servicosSelecionados || []).map(s => (
                          <div key={s.id} className="flex justify-between text-sm">
                            <span className="font-normal text-gray-200">{s.nome}</span>
                            <span className="text-gray-400 font-normal">
                              {s.duracao_minutos} min • R$ {Number(s.preco || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Tempo estimado:</span>
                      <span className="font-normal">{totalSelecionado.duracao} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Folga:</span>
                      <span className="font-normal">{FOLGA_MINUTOS} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Total para encaixe:</span>
                      <span className="font-normal text-primary">{duracaoTotalComFolga} min</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500 font-normal">Valor total:</span>
                      <span className="font-normal text-primary text-xl">R$ {totalSelecionado.valor.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setFlow(prev => ({ ...prev, step: 3 }))}
                      className="flex-1 py-3 bg-dark-200 border border-gray-800 rounded-button uppercase font-normal"
                    >
                      VOLTAR
                    </button>
                    <button
                      onClick={confirmarAgendamento}
                      className="flex-1 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button uppercase font-normal"
                    >
                      CONFIRMAR
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {showAvaliar && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-normal">AVALIAR</h3>
              <button onClick={() => setShowAvaliar(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-300 font-normal mb-2">Você está avaliando</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setAvaliarTipo('negocio');
                    setAvaliarProfissionalId(null);
                  }}
                  className={`px-4 py-3 rounded-custom border transition-all font-normal ${
                    avaliarTipo === 'negocio'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-dark-200 border-gray-800 text-gray-400'
                  }`}
                >
                  {nomeNegocioLabel}
                </button>
                <button
                  onClick={() => setAvaliarTipo('profissional')}
                  className={`px-4 py-3 rounded-custom border transition-all font-normal ${
                    avaliarTipo === 'profissional'
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'bg-dark-200 border-gray-800 text-gray-400'
                  }`}
                >
                  PROFISSIONAL
                </button>
              </div>
            </div>

            {avaliarTipo === 'profissional' && (
              <div className="mb-4">
                <div className="text-sm text-gray-300 font-normal mb-2">Qual profissional?</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {profissionais.map(prof => (
                    <button
                      key={prof.id}
                      onClick={() => setAvaliarProfissionalId(prof.id)}
                      className={`w-full text-left px-4 py-3 rounded-custom border transition-all font-normal ${
                        avaliarProfissionalId === prof.id
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-dark-200 border-gray-800 text-gray-400 hover:border-primary/30'
                      }`}
                    >
                      {prof.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="text-sm text-gray-300 font-normal mb-2">Nota</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setAvaliarNota(n)}
                    className={`w-12 h-8 rounded-button border transition-all font-normal ${
                      avaliarNota >= n
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-dark-200 border-gray-800 text-gray-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-sm text-gray-300 font-normal mb-2">Comentário (opcional)</div>
              <textarea
                value={avaliarTexto}
                onChange={(e) => setAvaliarTexto(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none resize-none"
                placeholder="Conte como foi sua experiência..."
              />
            </div>

            <button
              onClick={enviarAvaliacao}
              disabled={avaliarLoading || (avaliarTipo === 'profissional' && !avaliarProfissionalId)}
              className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button disabled:opacity-60 uppercase font-normal"
            >
              {avaliarLoading ? 'Enviando...' : 'AVALIAR AGORA'}
            </button>

            <p className="text-xs text-gray-500 mt-3 font-normal">
              {avaliarTipo === 'profissional' && !avaliarProfissionalId
                ? 'Selecione um profissional para continuar'
                : 'Somente clientes logados podem avaliar.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
