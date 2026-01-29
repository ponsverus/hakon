import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, Star, MapPin, Clock, Phone, Heart, ArrowLeft,
  Zap, X, AlertCircle
} from 'lucide-react';
import { supabase } from '../supabase';

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function addMinutes(time, delta) {
  return minutesToTime(timeToMinutes(time) + delta);
}

export default function Vitrine({ user, userType }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [barbearia, setBarbearia] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorito, setIsFavorito] = useState(false);

  // Agendamento (flow state único pra não quebrar ao voltar)
  const [showAgendamento, setShowAgendamento] = useState(false);
  const [flow, setFlow] = useState({
    step: 1, // 1 servico, 2 data, 3 horario, 4 confirmar
    profissional: null,
    servico: null,
    data: '',
    horario: null, // {hora, tipo, slot...}
  });

  // Avaliar
  const [showAvaliar, setShowAvaliar] = useState(false);
  const [avaliarNota, setAvaliarNota] = useState(5);
  const [avaliarTexto, setAvaliarTexto] = useState('');
  const [avaliarLoading, setAvaliarLoading] = useState(false);

  useEffect(() => {
    loadVitrine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (user && barbearia) checkFavorito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, barbearia?.id]);

  const loadVitrine = async () => {
    setLoading(true);
    try {
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('slug', slug)
        .single();

      if (barbeariaError) throw barbeariaError;
      setBarbearia(barbeariaData);

      const { data: profissionaisData, error: profErr } = await supabase
        .from('profissionais')
        .select('*')
        .eq('barbearia_id', barbeariaData.id);

      if (profErr) throw profErr;
      setProfissionais(profissionaisData || []);

      const profissionalIds = (profissionaisData || []).map(p => p.id);
      if (profissionalIds.length > 0) {
        const { data: servicosData, error: servErr } = await supabase
          .from('servicos')
          .select('*')
          .in('profissional_id', profissionalIds)
          .eq('ativo', true);

        if (servErr) throw servErr;
        setServicos(servicosData || []);
      } else {
        setServicos([]);
      }

      const { data: avaliacoesData, error: avalErr } = await supabase
        .from('avaliacoes')
        .select(`*, users (nome)`)
        .eq('barbearia_id', barbeariaData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (avalErr) throw avalErr;
      setAvaliacoes(avaliacoesData || []);
    } catch (error) {
      console.error('Erro ao carregar vitrine:', error);
      setBarbearia(null);
    } finally {
      setLoading(false);
    }
  };

  const checkFavorito = async () => {
    try {
      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('cliente_id', user.id)
        .eq('barbearia_id', barbearia.id)
        .eq('tipo', 'barbearia')
        .single();

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
    try {
      if (isFavorito) {
        await supabase
          .from('favoritos')
          .delete()
          .eq('cliente_id', user.id)
          .eq('barbearia_id', barbearia.id)
          .eq('tipo', 'barbearia');
        setIsFavorito(false);
      } else {
        await supabase
          .from('favoritos')
          .insert({
            cliente_id: user.id,
            tipo: 'barbearia',
            barbearia_id: barbearia.id
          });
        setIsFavorito(true);
      }
    } catch (error) {
      console.error('Erro ao favoritar:', error);
      alert('Erro ao favoritar. Tente novamente.');
    }
  };

  const iniciarAgendamento = (profissional) => {
    if (!user) {
      if (confirm('Você precisa fazer login para agendar. Deseja fazer login agora?')) navigate('/login');
      return;
    }

    // ✅ BLOQUEIO: profissional não agenda
    if (userType === 'professional') {
      alert('Você está logado como PROFISSIONAL. Para agendar, entre como CLIENTE.');
      return;
    }

    setFlow({
      step: 1,
      profissional,
      servico: null,
      data: '',
      horario: null
    });
    setShowAgendamento(true);
  };

  const servicosDoProf = useMemo(() => {
    if (!flow.profissional) return [];
    return servicos.filter(s => s.profissional_id === flow.profissional.id);
  }, [servicos, flow.profissional]);

  // ✅ Horários calculados de forma correta:
  // - base no horario_inicio/fim do profissional
  // - slots de 30 min como início (padrão)
  // - mas só mostra se o serviço cabe sem ultrapassar o fim
  // - e se não conflita com agendamentos existentes
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);

  const calcularHorariosDisponiveis = async () => {
    if (!flow.profissional || !flow.data || !flow.servico) return;

    try {
      const inicio = flow.profissional.horario_inicio || '08:00';
      const fim = flow.profissional.horario_fim || '18:00';

      const duracao = Number(flow.servico.duracao_minutos || 0);
      if (!duracao) {
        setHorariosDisponiveis([]);
        return;
      }

      // agendamentos do dia
      const { data: ags, error: agErr } = await supabase
        .from('agendamentos')
        .select('hora_inicio, hora_fim, status')
        .eq('profissional_id', flow.profissional.id)
        .eq('data', flow.data);

      if (agErr) throw agErr;

      // slots temporários (cancelados reaproveitáveis)
      const { data: slots, error: slotErr } = await supabase
        .from('slots_temporarios')
        .select('*')
        .eq('profissional_id', flow.profissional.id)
        .eq('data', flow.data)
        .eq('ativo', true);

      if (slotErr) {
        // não derruba; apenas ignora slots temporários se tabela/policy falhar
        console.warn('slots_temporarios indisponível:', slotErr.message);
      }

      const agendamentosValidos = (ags || []).filter(a => !String(a.status || '').includes('cancelado'));

      const horarios = [];
      let cur = timeToMinutes(inicio);
      const end = timeToMinutes(fim);

      while (cur + duracao <= end) {
        const hora = minutesToTime(cur);
        const horaFim = minutesToTime(cur + duracao);

        const conflita = agendamentosValidos.some(a => {
          const ai = timeToMinutes(a.hora_inicio);
          const af = timeToMinutes(a.hora_fim);
          const ni = timeToMinutes(hora);
          const nf = timeToMinutes(horaFim);
          // overlap
          return ni < af && nf > ai;
        });

        if (!conflita) {
          const slot = (slots || []).find(s => s.hora_inicio === hora);

          if (slot) {
            // regra do slot: só aceita se o serviço cabe dentro do slot.hora_fim
            const slotFimMin = timeToMinutes(slot.hora_fim);
            const cabeNoSlot = (cur + duracao) <= slotFimMin;

            if (cabeNoSlot) {
              horarios.push({ hora, tipo: 'slot', slot });
            }
          } else {
            horarios.push({ hora, tipo: 'normal' });
          }
        }

        cur += 30; // padrão 30min como “grade” de início
      }

      setHorariosDisponiveis(horarios);
    } catch (error) {
      console.error('Erro ao calcular horários:', error);
      setHorariosDisponiveis([]);
    }
  };

  useEffect(() => {
    if (showAgendamento && flow.step === 3) {
      calcularHorariosDisponiveis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAgendamento, flow.profissional?.id, flow.data, flow.servico?.id, flow.step]);

  const confirmarAgendamento = async () => {
    if (!user || userType === 'professional') {
      alert('Você precisa estar logado como CLIENTE para agendar.');
      return;
    }

    try {
      const horaInicio = flow.horario.hora;
      const horaFim = addMinutes(horaInicio, Number(flow.servico.duracao_minutos || 0));

      const { error } = await supabase
        .from('agendamentos')
        .insert({
          profissional_id: flow.profissional.id,
          cliente_id: user.id,
          servico_id: flow.servico.id,
          data: flow.data,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          status: 'agendado'
        });

      if (error) throw error;

      alert('✅ Agendamento confirmado!');
      setShowAgendamento(false);
      navigate('/minha-area');
    } catch (error) {
      console.error('Erro ao agendar:', error);
      alert('❌ Erro ao criar agendamento: ' + (error.message || ''));
    }
  };

  const abrirAvaliar = () => {
    if (!user) {
      if (confirm('Você precisa fazer login para avaliar. Deseja fazer login agora?')) navigate('/login');
      return;
    }
    if (userType === 'professional') {
      alert('Você está logado como PROFISSIONAL. Avaliação é só para CLIENTE.');
      return;
    }
    setAvaliarNota(5);
    setAvaliarTexto('');
    setShowAvaliar(true);
  };

  const enviarAvaliacao = async () => {
    if (!user || userType === 'professional') return;

    try {
      setAvaliarLoading(true);

      const payload = {
        cliente_id: user.id,
        barbearia_id: barbearia.id,
        nota: avaliarNota,
        comentario: avaliarTexto || null
      };

      const { error } = await supabase.from('avaliacoes').insert(payload);
      if (error) throw error;

      setShowAvaliar(false);
      await loadVitrine();
      alert('✅ Avaliação enviada!');
    } catch (error) {
      console.error('Erro ao avaliar:', error);
      alert('❌ Erro ao enviar avaliação: ' + (error.message || ''));
    } finally {
      setAvaliarLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-2xl font-bold animate-pulse">Carregando...</div>
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
              {/* Avaliar */}
              <button
                onClick={abrirAvaliar}
                className="flex items-center gap-2 px-4 py-2 rounded-button font-bold transition-all bg-dark-200 border border-gray-800 text-gray-300 hover:border-primary"
              >
                <Star className="w-5 h-5 text-primary" />
                <span className="hidden sm:inline">Avaliar</span>
              </button>

              {/* Favorito */}
              <button
                onClick={toggleFavorito}
                className={`flex items-center gap-2 px-4 py-2 rounded-button font-bold transition-all ${
                  isFavorito
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                    : 'bg-dark-200 border border-gray-800 text-gray-400 hover:text-red-400'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorito ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isFavorito ? 'Favoritado' : 'Favoritar'}</span>
              </button>
            </div>
          </div>

          {/* aviso se profissional */}
          {user && userType === 'professional' && (
            <div className="mt-3 bg-yellow-600/10 border border-yellow-600/30 rounded-custom p-3 text-yellow-300 text-sm font-bold">
              Você está logado como <b>PROFISSIONAL</b>. Nesta vitrine, o agendamento fica desativado para evitar marcações indevidas.
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/20 via-black to-yellow-600/20 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center text-4xl sm:text-5xl font-black text-black">
              {barbearia.nome[0]}
            </div>

            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">{barbearia.nome}</h1>
              <p className="text-base sm:text-lg text-gray-400 mb-4">{barbearia.descricao}</p>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary fill-current" />
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

      {/* Profissionais */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black mb-6">Profissionais</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profissionais.map(prof => {
              const servicosProf = servicos.filter(s => s.profissional_id === prof.id);

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
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 font-bold mb-2">{servicosProf.length} SERVIÇOS</p>
                    <div className="space-y-1">
                      {servicosProf.slice(0, 3).map(s => (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span className="text-gray-400">{s.nome}</span>
                          <span className="text-primary font-bold">R$ {s.preco}</span>
                        </div>
                      ))}
                      {servicosProf.length > 3 && (
                        <p className="text-xs text-gray-600 font-bold">+{servicosProf.length - 3} mais</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => iniciarAgendamento(prof)}
                    className={`w-full py-3 rounded-button font-black hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                      user && userType === 'professional'
                        ? 'bg-dark-200 border border-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-yellow-600 text-black'
                    }`}
                    disabled={!!(user && userType === 'professional')}
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

      {/* Avaliações */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl sm:text-3xl font-black">Avaliações</h2>
            <button
              onClick={abrirAvaliar}
              className="px-5 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-button font-black text-sm transition-all"
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
                      <div className="flex items-center gap-1">
                        {[...Array(av.nota)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-primary fill-current" />
                        ))}
                      </div>
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
              {/* Step 1: Serviço */}
              {flow.step === 1 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Escolha o Serviço</h3>
                  <div className="space-y-3">
                    {servicosDoProf.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setFlow(prev => ({ ...prev, servico: s, step: 2 }))}
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
                    {servicosDoProf.length === 0 && (
                      <p className="text-gray-500">Este profissional ainda não tem serviços cadastrados.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Data */}
              {flow.step === 2 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 1 }))}
                    className="text-primary mb-4 font-bold"
                  >
                    ← Voltar
                  </button>
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
                      setFlow(prev => ({ ...prev, step: 3, horario: null }));
                    }}
                    className="mt-4 w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black"
                  >
                    CONTINUAR
                  </button>
                </div>
              )}

              {/* Step 3: Horário */}
              {flow.step === 3 && (
                <div>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, step: 2 }))}
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
                          onClick={() => setFlow(prev => ({ ...prev, horario: h, step: 4 }))}
                          className="relative p-3 rounded-custom font-bold transition-all bg-dark-200 border border-gray-800 hover:border-primary"
                        >
                          {h.tipo === 'slot' && (
                            <Zap className="w-4 h-4 text-primary absolute top-1 right-1" />
                          )}
                          <div className="text-lg">{h.hora}</div>
                          {h.tipo === 'slot' && (
                            <div className="text-[10px] text-gray-500">Slot</div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Nenhum horário disponível para este serviço nessa data.</p>
                  )}

                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
                    <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
                    <span className="text-sm text-blue-300">
                      Horários com <Zap className="w-4 h-4 inline text-primary" /> são slots reaproveitados (cancelamentos).
                    </span>
                  </div>
                </div>
              )}

              {/* Step 4: Confirmar */}
              {flow.step === 4 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Confirmar Agendamento</h3>

                  <div className="bg-dark-200 rounded-custom p-4 space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profissional:</span>
                      <span className="font-bold">{flow.profissional?.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Serviço:</span>
                      <span className="font-bold">{flow.servico?.nome}</span>
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
