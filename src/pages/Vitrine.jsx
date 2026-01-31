import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, Star, MapPin, Clock, Phone, Heart, ArrowLeft,
  Zap, X, AlertCircle
} from 'lucide-react';
import { supabase } from '../supabase';

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

function roundUpToNextStep(min, step = 30) {
  return Math.ceil(min / step) * step;
}

const withTimeout = (promise, ms, label = 'timeout') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${label}) em ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

// ✅ Sempre 5 estrelas (cheias + apagadas)
function Stars5({ value = 0, size = 14 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={i <= v ? 'text-primary fill-current' : 'text-gray-700'}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

// ✅ Resolve logo_url: se for URL, usa direto; se for path do bucket, monta publicUrl
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

export default function Vitrine({ user, userType }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [barbearia, setBarbearia] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFavorito, setIsFavorito] = useState(false);

  // Agendamento (NOVO FLUXO)
  const [showAgendamento, setShowAgendamento] = useState(false);
  const [flow, setFlow] = useState({
    step: 1,
    profissional: null,
    data: '',
    horario: null, // { hora, tipo, slot?, maxMinutos }
    servico: null,
  });

  // Avaliar
  const [showAvaliar, setShowAvaliar] = useState(false);
  const [avaliarNota, setAvaliarNota] = useState(5);
  const [avaliarTexto, setAvaliarTexto] = useState('');
  const [avaliarLoading, setAvaliarLoading] = useState(false);

  const isProfessional = user && userType === 'professional';
  const isClient = user && userType === 'client';

  useEffect(() => {
    loadVitrine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (user && barbearia?.id) checkFavorito();
    else setIsFavorito(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userType, barbearia?.id]);

  const loadVitrine = async () => {
    setLoading(true);
    setError(null);

    const watchdog = setTimeout(() => {
      setLoading(false);
      setError('Demorou demais para carregar. Tente novamente.');
    }, 12000);

    try {
      const { data: barbeariaData, error: barbeariaError } = await withTimeout(
        supabase.from('barbearias').select('*').eq('slug', slug).maybeSingle(),
        7000,
        'barbearia'
      );

      if (barbeariaError) throw barbeariaError;

      if (!barbeariaData) {
        setBarbearia(null);
        setProfissionais([]);
        setServicos([]);
        setAvaliacoes([]);
        return;
      }

      setBarbearia(barbeariaData);

      const { data: profissionaisData, error: profErr } = await withTimeout(
        supabase.from('profissionais').select('*').eq('barbearia_id', barbeariaData.id),
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
          .select(`*, users (nome)`)
          .eq('barbearia_id', barbeariaData.id)
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
      setBarbearia(null);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  };

  const checkFavorito = async () => {
    if (!user || userType !== 'client' || !barbearia?.id) {
      setIsFavorito(false);
      return;
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('favoritos')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('barbearia_id', barbearia.id)
          .eq('tipo', 'barbearia')
          .maybeSingle(),
        6000,
        'favorito'
      );

      if (error) throw error;
      setIsFavorito(!!data);
    } catch {
      setIsFavorito(false);
    }
  };

  const toggleFavorito = async () => {
    if (!user) {
      alert('Faça login para favoritar');
      return;
    }
    if (userType !== 'client') {
      alert('Apenas CLIENTE pode favoritar barbearias.');
      return;
    }

    try {
      if (isFavorito) {
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('cliente_id', user.id)
          .eq('barbearia_id', barbearia.id)
          .eq('tipo', 'barbearia');

        if (error) throw error;
        setIsFavorito(false);
      } else {
        const { error } = await supabase
          .from('favoritos')
          .insert({
            cliente_id: user.id,
            tipo: 'barbearia',
            barbearia_id: barbearia.id
          });

        if (error) throw error;
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
      servico: null
    });
    setShowAgendamento(true);
  };

  // Serviços do prof selecionado (modal)
  const servicosDoProf = useMemo(() => {
    if (!flow.profissional) return [];
    return servicos.filter(s => s.profissional_id === flow.profissional.id);
  }, [servicos, flow.profissional]);

  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);

  const calcularHorariosDisponiveis = async () => {
    if (!flow.profissional || !flow.data) return;

    try {
      const inicio = flow.profissional.horario_inicio || '08:00';
      const fim = flow.profissional.horario_fim || '18:00';

      const startDay = timeToMinutes(inicio);
      const endDay = timeToMinutes(fim);

      const nowSP = getNowSP();
      const isHoje = flow.data === nowSP.date;
      const minNow = isHoje ? roundUpToNextStep(nowSP.minutes, 30) : -Infinity;

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

      if (slotErr) {
        console.warn('slots_temporarios indisponível:', slotErr.message);
      }

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

      const horarios = [];
      let cur = startDay;

      while (cur < endDay) {
        if (cur < minNow) {
          cur += 30;
          continue;
        }

        const hora = minutesToTime(cur);

        const conflitaAgora = agendamentosValidos.some(a => cur >= a.ini && cur < a.fim);
        if (conflitaAgora) {
          cur += 30;
          continue;
        }

        const nextBusyStart = agendamentosValidos
          .filter(a => a.ini > cur)
          .map(a => a.ini)
          .sort((a, b) => a - b)[0];

        let freeEnd = Number.isFinite(nextBusyStart) ? Math.min(nextBusyStart, endDay) : endDay;

        const slotExato = slotsList.find(s => s.ini === cur);
        if (slotExato) {
          freeEnd = Math.min(freeEnd, slotExato.fim);
        }

        const maxMinutos = freeEnd - cur;

        if (maxMinutos > 0) {
          horarios.push({
            hora,
            tipo: slotExato ? 'slot' : 'normal',
            slot: slotExato ? slotExato.raw : null,
            maxMinutos
          });
        }

        cur += 30;
      }

      setHorariosDisponiveis(horarios);
    } catch (e) {
      console.error('Erro ao calcular horários:', e);
      setHorariosDisponiveis([]);
    }
  };

  useEffect(() => {
    if (showAgendamento && flow.step === 2) calcularHorariosDisponiveis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAgendamento, flow.profissional?.id, flow.data, flow.step]);

  const servicosFiltrados = useMemo(() => {
    if (!flow.horario) return [];
    const max = Number(flow.horario.maxMinutos || 0);
    return servicosDoProf.filter(s => Number(s.duracao_minutos || 0) > 0 && Number(s.duracao_minutos) <= max);
  }, [servicosDoProf, flow.horario]);

  const confirmarAgendamento = async () => {
    if (!user || userType !== 'client') {
      alert('Você precisa estar logado como CLIENTE para agendar.');
      return;
    }

    try {
      if (!flow.profissional || !flow.data || !flow.horario || !flow.servico) {
        alert('Dados incompletos. Refaça o agendamento.');
        return;
      }

      const horaInicio = flow.horario.hora;
      const duracao = Number(flow.servico.duracao_minutos || 0);
      const horaFim = addMinutes(horaInicio, duracao);

      const { error } = await withTimeout(
        supabase.from('agendamentos').insert({
          profissional_id: flow.profissional.id,
          cliente_id: user.id,
          servico_id: flow.servico.id,
          data: flow.data,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          status: 'agendado'
        }),
        7000,
        'criar-agendamento'
      );

      if (error) throw error;

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
    setShowAvaliar(true);
  };

  const enviarAvaliacao = async () => {
    if (!user || userType !== 'client') return;

    try {
      setAvaliarLoading(true);

      const payload = {
        cliente_id: user.id,
        barbearia_id: barbearia.id,
        nota: avaliarNota,
        comentario: avaliarTexto || null
      };

      const { error } = await withTimeout(
        supabase.from('avaliacoes').insert(payload),
        7000,
        'enviar-avaliacao'
      );

      if (error) throw error;

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

  // ✅ logo no hero
  const logoUrl = useMemo(() => resolveLogoUrl(barbearia?.logo_url), [barbearia?.logo_url]);

  // ✅ serviços agrupados por profissional (para seção Serviços)
  const servicosPorProf = useMemo(() => {
    const map = new Map();
    for (const p of profissionais) map.set(p.id, []);
    for (const s of servicos) {
      if (!map.has(s.profissional_id)) map.set(s.profissional_id, []);
      map.get(s.profissional_id).push(s);
    }
    return map;
  }, [profissionais, servicos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-2xl font-bold animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-100 border border-red-500/40 rounded-custom p-8 text-center">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white mb-2">Não foi possível carregar</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={loadVitrine}
            className="w-full px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-button font-bold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-4">Barbearia não encontrada</h1>
          <Link to="/" className="text-primary hover:text-yellow-500 font-bold">← Voltar para Home</Link>
        </div>
      </div>
    );
  }

  const mediaAvaliacoes = avaliacoes.length > 0
    ? (avaliacoes.reduce((sum, a) => sum + a.nota, 0) / avaliacoes.length).toFixed(1)
    : '5.0';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-bold"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={abrirAvaliar}
                disabled={!!isProfessional}
                className={`flex items-center gap-2 px-4 py-2 rounded-button font-bold transition-all bg-dark-200 border ${
                  isProfessional ? 'border-gray-900 text-gray-600 cursor-not-allowed' : 'border-gray-800 text-gray-300 hover:border-primary'
                }`}
              >
                <Star className="w-5 h-5 text-primary" />
                <span className="hidden sm:inline">Avaliar</span>
              </button>

              <button
                onClick={toggleFavorito}
                disabled={!!isProfessional}
                className={`flex items-center gap-2 px-4 py-2 rounded-button font-bold transition-all ${
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

          {isProfessional && (
            <div className="mt-3 bg-yellow-600/10 border border-yellow-600/30 rounded-custom p-3 text-yellow-300 text-sm font-bold">
              Você está logado como <b>PROFISSIONAL</b>. Você pode ver a vitrine, mas não pode agendar, favoritar ou avaliar.
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/20 via-black to-yellow-600/20 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* ✅ LOGO */}
            {logoUrl ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-primary/30 bg-dark-100">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-4xl sm:text-5xl font-black text-black">
                {barbearia.nome?.[0] || 'B'}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">{barbearia.nome}</h1>
              <p className="text-base sm:text-lg text-gray-400 mb-4">{barbearia.descricao}</p>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Stars5 value={Math.round(Number(mediaAvaliacoes || 0))} size={18} />
                  <span className="text-xl font-black text-primary">{mediaAvaliacoes}</span>
                  <span className="text-sm text-gray-500">({avaliacoes.length} avaliações)</span>
                </div>

                {barbearia.endereco && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{barbearia.endereco}</span>
                  </div>
                )}

                {barbearia.telefone && (
                  <a
                    href={`tel:${barbearia.telefone}`}
                    className="flex items-center gap-2 text-primary hover:text-yellow-500 text-sm font-bold transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {barbearia.telefone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profissionais (sem serviços dentro) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black mb-6">Profissionais</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profissionais.map(prof => {
              const totalServ = (servicosPorProf.get(prof.id) || []).length;

              return (
                <div key={prof.id} className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-xl font-black text-black">
                      {prof.nome?.[0] || 'P'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black mb-1">{prof.nome}</h3>
                      {prof.anos_experiencia != null && (
                        <p className="text-sm text-gray-500 font-bold">{prof.anos_experiencia} anos de experiência</p>
                      )}
                      <p className="text-xs text-gray-500 font-bold mt-2">
                        Horário: <span className="text-gray-300">{prof.horario_inicio || '08:00'} - {prof.horario_fim || '18:00'}</span>
                      </p>
                      <p className="text-xs text-gray-600 font-bold mt-2">
                        {totalServ} serviço(s) disponíveis
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => iniciarAgendamento(prof)}
                    className={`w-full py-3 rounded-button font-black hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isProfessional
                        ? 'bg-dark-200 border border-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-yellow-600 text-black'
                    }`}
                    disabled={!!isProfessional}
                  >
                    <Calendar className="w-5 h-5" />
                    AGENDAR
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ✅ Serviços (seção separada) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black mb-6">Serviços</h2>

          {profissionais.length === 0 ? (
            <p className="text-gray-500 font-bold">Nenhum profissional cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {profissionais.map(p => {
                const lista = (servicosPorProf.get(p.id) || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

                return (
                  <div key={p.id} className="bg-dark-100 border border-gray-800 rounded-custom p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-black text-lg">{p.nome}</div>
                      <div className="text-xs text-gray-500 font-bold">{lista.length} serviço(s)</div>
                    </div>

                    {lista.length ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lista.map(s => (
                          <div key={s.id} className="bg-dark-200 border border-gray-800 rounded-custom p-4">
                            <div className="font-black">{s.nome}</div>
                            <div className="text-xs text-gray-500 font-bold mt-1">
                              <Clock className="w-4 h-4 inline mr-1" />
                              {s.duracao_minutos} min
                            </div>
                            <div className="text-primary font-black text-lg mt-2">R$ {s.preco}</div>
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
      </section>

      {/* ✅ Avaliações SEMPRE como seção final (footer de conversão) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl sm:text-3xl font-black">Avaliações</h2>
            <button
              onClick={abrirAvaliar}
              disabled={!!isProfessional}
              className={`px-5 py-2 border rounded-button font-black text-sm transition-all ${
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
                <div key={av.id} className="bg-dark-100 border border-gray-800 rounded-custom p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {av.users?.nome?.[0] || 'A'}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{av.users?.nome || 'Cliente'}</p>
                      <Stars5 value={av.nota} size={14} />
                    </div>
                  </div>
                  {av.comentario && <p className="text-sm text-gray-400">{av.comentario}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma avaliação ainda</p>
          )}
        </div>
      </section>

      {/* Modal Agendamento */}
      {showAgendamento && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-100 border-b border-gray-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-black">Agendar com {flow.profissional?.nome}</h2>
              <button onClick={() => setShowAgendamento(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* STEP 1: DATA */}
              {flow.step === 1 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Escolha a Data</h3>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={flow.data}
                    onChange={(e) => setFlow(prev => ({ ...prev, data: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                  <button
                    onClick={() => {
                      if (!flow.data) return alert('Selecione uma data.');
                      setFlow(prev => ({ ...prev, step: 2, horario: null, servico: null }));
                    }}
                    className="mt-4 w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
                  >
                    CONTINUAR
                  </button>
                </div>
              )}

              {/* STEP 2: HORÁRIO */}
              {flow.step === 2 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 1 }))}
                    className="text-primary mb-4 font-bold"
                  >
                    ← Voltar
                  </button>

                  <h3 className="text-xl font-black mb-4">Escolha o Horário</h3>

                  {horariosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {horariosDisponiveis.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => setFlow(prev => ({ ...prev, horario: h, step: 3, servico: null }))}
                          className="relative p-3 rounded-custom font-bold transition-all bg-dark-200 border border-gray-800 hover:border-primary"
                        >
                          {h.tipo === 'slot' && (
                            <Zap className="w-4 h-4 text-primary absolute top-1 right-1" />
                          )}
                          <div className="text-lg">{h.hora}</div>
                          <div className="text-[10px] text-gray-500">
                            até {h.maxMinutos}min
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Nenhum horário disponível nessa data.</p>
                  )}

                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
                    <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
                    <span className="text-sm text-blue-300">
                      Horários com <Zap className="w-4 h-4 inline text-primary" /> são slots reaproveitados (cancelamentos).
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: SERVIÇO FILTRADO */}
              {flow.step === 3 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 2, servico: null }))}
                    className="text-primary mb-4 font-bold"
                  >
                    ← Voltar
                  </button>

                  <h3 className="text-xl font-black mb-4">
                    Escolha o Serviço <span className="text-sm text-gray-500">(cabe até {flow.horario?.maxMinutos} min)</span>
                  </h3>

                  {servicosFiltrados.length > 0 ? (
                    <div className="space-y-3">
                      {servicosFiltrados.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setFlow(prev => ({ ...prev, servico: s, step: 4 }))}
                          className="w-full bg-dark-200 border border-gray-800 hover:border-primary rounded-custom p-4 transition-all text-left"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-black">{s.nome}</p>
                              <p className="text-sm text-gray-500">
                                <Clock className="w-4 h-4 inline mr-1" />
                                {s.duracao_minutos} min
                              </p>
                            </div>
                            <div className="text-2xl font-black text-primary">R$ {s.preco}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      Nenhum serviço cabe nesse horário.
                      <div className="mt-3">
                        <button
                          onClick={() => setFlow(prev => ({ ...prev, step: 2, servico: null }))}
                          className="px-4 py-2 bg-dark-200 border border-gray-800 rounded-button font-bold"
                        >
                          Escolher outro horário
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: CONFIRMAR */}
              {flow.step === 4 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Confirmar Agendamento</h3>

                  <div className="bg-dark-200 rounded-custom p-4 space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profissional:</span>
                      <span className="font-bold">{flow.profissional?.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Data:</span>
                      <span className="font-bold">{new Date(flow.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Horário:</span>
                      <span className="font-bold">{flow.horario?.hora}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Serviço:</span>
                      <span className="font-bold">{flow.servico?.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duração:</span>
                      <span className="font-bold">{flow.servico?.duracao_minutos} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Valor:</span>
                      <span className="font-bold text-primary text-xl">R$ {flow.servico?.preco}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setFlow(prev => ({ ...prev, step: 3 }))}
                      className="flex-1 py-3 bg-dark-200 border border-gray-800 rounded-button font-bold"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={confirmarAgendamento}
                      className="flex-1 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
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

      {/* Modal Avaliar */}
      {showAvaliar && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black">Avaliar</h3>
              <button onClick={() => setShowAvaliar(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-300 font-bold mb-2">Nota</div>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setAvaliarNota(n)}
                    className={`w-10 h-10 rounded-custom border font-black transition-all ${
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
              <div className="text-sm text-gray-300 font-bold mb-2">Comentário (opcional)</div>
              <textarea
                value={avaliarTexto}
                onChange={(e) => setAvaliarTexto(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                placeholder="Conte como foi sua experiência..."
              />
            </div>

            <button
              onClick={enviarAvaliacao}
              disabled={avaliarLoading}
              className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black disabled:opacity-60"
            >
              {avaliarLoading ? 'ENVIANDO...' : 'ENVIAR AVALIAÇÃO'}
            </button>

            <p className="text-xs text-gray-500 mt-3 font-bold">
              Somente clientes logados podem avaliar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
