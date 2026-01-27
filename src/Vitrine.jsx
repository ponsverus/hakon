import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Star, MapPin, Clock, Phone, Instagram, Award, ChevronLeft, Sparkles } from 'lucide-react';
import { supabase } from './supabase';

export default function Vitrine() {
  const { slug } = useParams();
  const [barbearia, setBarbearia] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servicos');

  useEffect(() => {
    loadBarbearia();
  }, [slug]);

  const loadBarbearia = async () => {
    try {
      // Buscar barbearia
      const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('*')
        .eq('slug', slug)
        .single();

      if (barbeariaError) throw barbeariaError;
      setBarbearia(barbeariaData);

      // Buscar serviços
      const { data: servicosData, error: servicosError } = await supabase
        .from('servicos')
        .select('*')
        .eq('barbearia_id', barbeariaData.id);

      if (servicosError) throw servicosError;
      setServicos(servicosData || []);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-yellow-400 text-2xl font-bold animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Barbearia não encontrada</h1>
          <p className="text-slate-400">Verifique se o link está correto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header/Hero */}
      <div className="relative h-64 sm:h-80 bg-gradient-to-br from-yellow-500/20 via-zinc-900 to-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8">
          <div className="max-w-4xl mx-auto w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-semibold text-sm">Barbearia Verificada</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-3 capitalize">
              {barbearia.nome}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">São Paulo, SP</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">4.9</span>
                <span className="text-sm">(127 avaliações)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <button className="group bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-4 rounded-2xl font-black text-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-105 flex items-center justify-center gap-3">
            <Calendar className="w-5 h-5" />
            AGENDAR HORÁRIO
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>
          
          <button className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-6 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-3">
            <Phone className="w-5 h-5" />
            LIGAR AGORA
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('servicos')}
              className={`flex-1 py-4 px-6 font-bold transition-all ${
                activeTab === 'servicos'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Serviços
            </button>
            <button
              onClick={() => setActiveTab('sobre')}
              className={`flex-1 py-4 px-6 font-bold transition-all ${
                activeTab === 'sobre'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sobre
            </button>
            <button
              onClick={() => setActiveTab('avaliacoes')}
              className={`flex-1 py-4 px-6 font-bold transition-all ${
                activeTab === 'avaliacoes'
                  ? 'bg-yellow-500/20 text-yellow-400 border-b-2 border-yellow-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Avaliações
            </button>
          </div>

          <div className="p-6">
            {/* Serviços Tab */}
            {activeTab === 'servicos' && (
              <div>
                {servicos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {servicos.map(servico => (
                      <div
                        key={servico.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-yellow-500/50 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">
                            {servico.nome}
                          </h3>
                          <div className="text-2xl font-black text-yellow-400">
                            R$ {Number(servico.preco).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                          <Clock className="w-4 h-4" />
                          <span>45 minutos</span>
                        </div>
                        <button className="w-full py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 rounded-lg font-semibold text-sm transition-all">
                          Selecionar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✂️</div>
                    <p className="text-slate-400">Nenhum serviço cadastrado ainda</p>
                  </div>
                )}
              </div>
            )}

            {/* Sobre Tab */}
            {activeTab === 'sobre' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Sobre a Barbearia</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Especializada em cortes masculinos clássicos e modernos, 
                    trabalhando com as melhores técnicas e produtos do mercado. 
                    Ambiente acolhedor e profissionais experientes.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Horário de Funcionamento</h3>
                  <div className="space-y-2">
                    {[
                      { dia: 'Segunda a Sexta', horario: '09:00 - 20:00' },
                      { dia: 'Sábado', horario: '09:00 - 18:00' },
                      { dia: 'Domingo', horario: 'Fechado' }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-slate-300">{item.dia}</span>
                        <span className="text-yellow-400 font-semibold">{item.horario}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Localização</h3>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-white font-semibold mb-1">Rua Exemplo, 123</p>
                        <p className="text-slate-400 text-sm">Centro - São Paulo, SP</p>
                        <p className="text-slate-400 text-sm">CEP 01234-567</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Redes Sociais</h3>
                  <div className="flex gap-3">
                    <button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                      <Instagram className="w-5 h-5" />
                      Instagram
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Avaliações Tab */}
            {activeTab === 'avaliacoes' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <div className="text-5xl font-black text-yellow-400 mb-2">4.9</div>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm">Baseado em 127 avaliações</p>
                </div>

                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        {String.fromCharCode(64 + i)}
                      </div>
                      <div>
                        <div className="text-white font-semibold">Cliente {i}</div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-400">
                      Excelente atendimento! Profissionais muito caprichosos e ambiente top. 
                      Super recomendo!
                    </p>
                  </div>
                ))}

                <button className="w-full py-4 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 rounded-xl font-bold transition-all">
                  ⭐ Deixar Minha Avaliação
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CTA Fixo Mobile */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/95 backdrop-blur-lg border-t border-white/10">
          <button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-4 rounded-2xl font-black text-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all flex items-center justify-center gap-3">
            <Calendar className="w-5 h-5" />
            AGENDAR AGORA
          </button>
        </div>
      </div>

      {/* Spacer para mobile */}
      <div className="sm:hidden h-24"></div>
    </div>
  );
}
