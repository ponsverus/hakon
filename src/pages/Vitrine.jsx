import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, Star, MapPin, Clock, Phone, Heart, ArrowLeft, 
  Zap, User, X, ChevronRight, AlertCircle 
} from 'lucide-react';
import { supabase } from '../supabase';

export default function Vitrine({ user }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [barbearia, setBarbearia] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorito, setIsFavorito] = useState(false);
  
  // Modal de agendamento
  const [showAgendamento, setShowAgendamento] = useState(false);
  const [selectedProfissional, setSelectedProfissional] = useState(null);
  const [selectedServico, setSelectedServico] = useState(null);
  const [selectedData, setSelectedData] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
  const [selectedHorario, setSelectedHorario] = useState(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadVitrine();
  }, [slug]);

  useEffect(() => {
    if (user && barbearia) {
      checkFavorito();
    }
  }, [user, barbearia]);

  const loadVitrine = async () => {
    try {
      // Buscar barbearia
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('slug', slug)
        .single();

      if (barbeariaError) throw barbeariaError;
      setBarbearia(barbeariaData);

      // Buscar profissionais
      const { data: profissionaisData } = await supabase
        .from('profissionais')
        .select('*')
        .eq('barbearia_id', barbeariaData.id);

      setProfissionais(profissionaisData || []);

      // Buscar serviços de todos os profissionais
      const profissionalIds = profissionaisData?.map(p => p.id) || [];
      const { data: servicosData } = await supabase
        .from('servicos')
        .select('*')
        .in('profissional_id', profissionalIds)
        .eq('ativo', true);

      setServicos(servicosData || []);

      // Buscar avaliações
      const { data: avaliacoesData } = await supabase
        .from('avaliacoes')
        .select(`
          *,
          users (nome)
        `)
        .eq('barbearia_id', barbeariaData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setAvaliacoes(avaliacoesData || []);

    } catch (error) {
      console.error('Erro ao carregar vitrine:', error);
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
    } catch (error) {
      // Não é favorito
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
          .eq('barbearia_id', barbearia.id);
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
    }
  };

  const iniciarAgendamento = (profissional) => {
    if (!user) {
      if (confirm('Você precisa fazer login para agendar. Deseja fazer login agora?')) {
        navigate('/login');
      }
      return;
    }

    setSelectedProfissional(profissional);
    setShowAgendamento(true);
    setStep(1);
  };

  const calcularHorariosDisponiveis = async () => {
    if (!selectedProfissional || !selectedData) return;

    try {
      // Buscar agendamentos do dia
      const { data: agendamentos } = await supabase
        .from('agendamentos')
        .select('hora_inicio, hora_fim, status')
        .eq('profissional_id', selectedProfissional.id)
        .eq('data', selectedData);

      // Buscar slots temporários (cancelamentos)
      const { data: slots } = await supabase
        .from('slots_temporarios')
        .select('*')
        .eq('profissional_id', selectedProfissional.id)
        .eq('data', selectedData)
        .eq('ativo', true);

      // Gerar horários
      const horarios = [];
      const inicio = selectedProfissional.horario_inicio || '08:00';
      const fim = selectedProfissional.horario_fim || '18:00';
      
      let hora = inicio;
      while (hora < fim) {
        // Verificar se horário está ocupado
        const ocupado = agendamentos?.some(a => 
          a.hora_inicio <= hora && a.hora_fim > hora && 
          !a.status.includes('cancelado')
        );

        if (!ocupado) {
          // Verificar se é um slot temporário
          const slot = slots?.find(s => s.hora_inicio === hora);
          
          if (slot) {
            // AGENDAMENTO INTELIGENTE: Calcular tempo disponível
            const agora = new Date();
            const dataHoraFim = new Date(`${selectedData}T${slot.hora_fim}`);
            const minutosDisponiveis = Math.floor((dataHoraFim - agora) / 60000);

            if (minutosDisponiveis > 0) {
              horarios.push({
                hora,
                tipo: 'slot',
                tempoDisponivel: minutosDisponiveis,
                slot: slot
              });
            }
          } else {
            // Horário normal
            horarios.push({
              hora,
              tipo: 'normal'
            });
          }
        }

        // Próximo horário (intervalo de 30min)
        const [h, m] = hora.split(':').map(Number);
        const proximaHora = new Date(2000, 0, 1, h, m + 30);
        hora = `${String(proximaHora.getHours()).padStart(2, '0')}:${String(proximaHora.getMinutes()).padStart(2, '0')}`;
      }

      setHorariosDisponiveis(horarios);
    } catch (error) {
      console.error('Erro ao calcular horários:', error);
    }
  };

  useEffect(() => {
    if (selectedProfissional && selectedData) {
      calcularHorariosDisponiveis();
    }
  }, [selectedProfissional, selectedData]);

  const servicosDoProf = servicos.filter(s => s.profissional_id === selectedProfissional?.id);

  const confirmarAgendamento = async () => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .insert({
          profissional_id: selectedProfissional.id,
          cliente_id: user.id,
          servico_id: selectedServico.id,
          data: selectedData,
          hora_inicio: selectedHorario.hora,
          hora_fim: calcularHoraFim(selectedHorario.hora, selectedServico.duracao_minutos),
          status: 'agendado'
        });

      if (error) throw error;

      alert('✅ Agendamento confirmado! Você receberá uma confirmação.');
      setShowAgendamento(false);
      navigate('/minha-area');
    } catch (error) {
      console.error('Erro ao agendar:', error);
      alert('❌ Erro ao criar agendamento');
    }
  };

  const calcularHoraFim = (horaInicio, duracaoMinutos) => {
    const [h, m] = horaInicio.split(':').map(Number);
    const fim = new Date(2000, 0, 1, h, m + duracaoMinutos);
    return `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`;
  };

  const servicoCabeNoSlot = (servico, horario) => {
    if (horario.tipo !== 'slot') return true;
    // REGRA: Serviço deve ser MENOR que tempo disponível
    return servico.duracao_minutos < horario.tempoDisponivel;
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
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-bold">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

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
                      {prof.nome[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black mb-1">{prof.nome}</h3>
                      {prof.anos_experiencia && (
                        <p className="text-sm text-gray-500 font-bold">{prof.anos_experiencia} anos de experiência</p>
                      )}
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
                    className="w-full py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black hover:shadow-lg transition-all flex items-center justify-center gap-2"
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
          <h2 className="text-2xl sm:text-3xl font-black mb-6">Avaliações</h2>

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

      {/* Modal de Agendamento */}
      {showAgendamento && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-100 border border-gray-800 rounded-custom max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-100 border-b border-gray-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-black">Agendar com {selectedProfissional?.nome}</h2>
              <button onClick={() => setShowAgendamento(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Step 1: Escolher Serviço */}
              {step === 1 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Escolha o Serviço</h3>
                  <div className="space-y-3">
                    {servicosDoProf.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedServico(s);
                          setStep(2);
                        }}
                        className="w-full bg-dark-200 border border-gray-800 hover:border-primary rounded-custom p-4 transition-all text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-black">{s.nome}</p>
                            <p className="text-sm text-gray-500"><Clock className="w-4 h-4 inline mr-1" />{s.duracao_minutos} min</p>
                          </div>
                          <div className="text-2xl font-black text-primary">R$ {s.preco}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Escolher Data */}
              {step === 2 && (
                <div>
                  <button onClick={() => setStep(1)} className="text-primary mb-4">← Voltar</button>
                  <h3 className="text-xl font-black mb-4">Escolha a Data</h3>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedData}
                    onChange={(e) => {
                      setSelectedData(e.target.value);
                      setStep(3);
                    }}
                    className="w-full px-4 py-3 bg-dark-200 border border-gray-800 rounded-custom text-white"
                  />
                </div>
              )}

              {/* Step 3: Escolher Horário */}
              {step === 3 && (
                <div>
                  <button onClick={() => setStep(2)} className="text-primary mb-4">← Voltar</button>
                  <h3 className="text-xl font-black mb-4">Escolha o Horário</h3>

                  {horariosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {horariosDisponiveis.map((h, i) => {
                        const cabe = servicoCabeNoSlot(selectedServico, h);
                        
                        return (
                          <button
                            key={i}
                            onClick={() => cabe && (setSelectedHorario(h), setStep(4))}
                            disabled={!cabe}
                            className={`relative p-3 rounded-custom font-bold transition-all ${
                              cabe
                                ? 'bg-dark-200 border border-gray-800 hover:border-primary'
                                : 'bg-dark-200 border border-red-500/30 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            {h.tipo === 'slot' && cabe && (
                              <Zap className="w-4 h-4 text-primary absolute top-1 right-1" />
                            )}
                            <div className="text-lg">{h.hora}</div>
                            {h.tipo === 'slot' && (
                              <div className="text-[10px] text-gray-500">
                                {cabe ? `${h.tempoDisponivel}min` : 'Não cabe'}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500">Nenhum horário disponível</p>
                  )}

                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-custom p-4">
                    <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
                    <span className="text-sm text-blue-300">Horários com <Zap className="w-4 h-4 inline text-primary" /> são cancelamentos reaproveitados!</span>
                  </div>
                </div>
              )}

              {/* Step 4: Confirmar */}
              {step === 4 && (
                <div>
                  <h3 className="text-xl font-black mb-4">Confirmar Agendamento</h3>
                  <div className="bg-dark-200 rounded-custom p-4 space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profissional:</span>
                      <span className="font-bold">{selectedProfissional.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Serviço:</span>
                      <span className="font-bold">{selectedServico.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Data:</span>
                      <span className="font-bold">{new Date(selectedData).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Horário:</span>
                      <span className="font-bold">{selectedHorario.hora}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Valor:</span>
                      <span className="font-bold text-primary text-xl">R$ {selectedServico.preco}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="flex-1 py-3 bg-dark-200 border border-gray-800 rounded-button font-bold">Voltar</button>
                    <button onClick={confirmarAgendamento} className="flex-1 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black">CONFIRMAR</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
