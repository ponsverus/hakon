import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, Star, Zap, TrendingUp, Shield, Users, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

export default function Home({ user, userType, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);

  // ✅ CORREÇÃO DE FLUXO: só considera logado se tiver user E userType
  const isLogged = !!user && !!userType;

  // ✅ BUSCA FUNCIONAL
  useEffect(() => {
    const buscar = async () => {
      if (searchTerm.length < 3) {
        setResultadosBusca([]);
        return;
      }

      setBuscando(true);
      try {
        const { data: barbearias } = await supabase
          .from('barbearias')
          .select('nome, slug')
          .ilike('nome', `%${searchTerm}%`)
          .limit(5);

        const { data: profissionais } = await supabase
          .from('profissionais')
          .select('nome, barbearias(slug)')
          .ilike('nome', `%${searchTerm}%`)
          .limit(5);

        setResultadosBusca([
          ...(barbearias || []).map(b => ({ ...b, tipo: 'barbearia' })),
          ...(profissionais || []).map(p => ({ ...p, tipo: 'profissional' }))
        ]);
      } catch (error) {
        console.error('Erro na busca:', error);
      } finally {
        setBuscando(false);
      }
    };

    const timer = setTimeout(buscar, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 🔧 CORREÇÃO DO BUG: SearchBox agora recebe mobile como prop mas não afeta o state
  const SearchBox = ({ mobile }) => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar profissional ou barbearia..."
        className="w-full pl-11 pr-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-white focus:outline-none transition-colors font-['Roboto_Condensed',sans-serif]"
      />

      {resultadosBusca.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          {resultadosBusca.map((r, i) => (
            <Link
              key={i}
              to={`/v/${r.tipo === 'barbearia' ? r.slug : r.barbearias?.slug}`}
              onClick={() => {
                setSearchTerm('');
                setResultadosBusca([]);
                if (mobile) setMobileMenuOpen(false);
              }}
              className="block px-4 py-3 hover:bg-neutral-800 border-b border-neutral-800 last:border-0 transition-colors"
            >
              <div className="font-bold text-white font-['Roboto_Condensed',sans-serif]">{r.nome}</div>
              <div className="text-xs text-gray-500 uppercase font-['Roboto_Condensed',sans-serif]">{r.tipo}</div>
            </Link>
          ))}
        </div>
      )}

      {buscando && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );

  const handleLogoutClick = async () => {
    try {
      await onLogout?.();
    } finally {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'Roboto Condensed', sans-serif" }}>
      {/* HEADER */}
      <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-black font-black text-xl sm:text-2xl font-['Roboto_Condensed',sans-serif]">H</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-black font-['Roboto_Condensed',sans-serif]">HAKON</h1>
                <p className="text-xs text-gray-400 font-bold -mt-1 font-['Roboto_Condensed',sans-serif]">BARBEARIA ELITE</p>
              </div>
            </Link>

            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <SearchBox mobile={false} />
            </div>

            <nav className="hidden lg:flex items-center gap-4">
              {isLogged ? (
                <>
                  <Link
                    to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                    className="px-5 py-2 text-sm font-bold text-white hover:text-gray-300 transition-colors font-['Roboto_Condensed',sans-serif]"
                  >
                    {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold rounded-lg transition-colors font-['Roboto_Condensed',sans-serif]"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2 text-sm font-bold text-white hover:text-gray-300 transition-colors font-['Roboto_Condensed',sans-serif]">
                    Entrar
                  </Link>
                  <Link
                    to="/cadastro"
                    className="px-6 py-2.5 bg-white text-black text-sm font-black rounded-lg hover:bg-gray-200 transition-all hover:scale-105 font-['Roboto_Condensed',sans-serif]"
                  >
                    Cadastrar Grátis
                  </Link>
                </>
              )}
            </nav>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-neutral-800">
              <div className="mb-4">
                <SearchBox mobile={true} />
              </div>

              <nav className="flex flex-col gap-2">
                {isLogged ? (
                  <>
                    <Link
                      to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-white hover:bg-neutral-900 rounded-lg font-bold font-['Roboto_Condensed',sans-serif]"
                    >
                      {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      className="px-4 py-3 text-gray-400 hover:bg-neutral-900 rounded-lg font-bold text-left font-['Roboto_Condensed',sans-serif]"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-white hover:bg-neutral-900 rounded-lg font-bold font-['Roboto_Condensed',sans-serif]"
                    >
                      Entrar
                    </Link>

                    <Link
                      to="/cadastro"
                      onClick={() => setMobileMenuOpen(false)}
                      className="mx-4 py-3 bg-white text-black rounded-lg font-black text-center font-['Roboto_Condensed',sans-serif]"
                    >
                      Cadastrar Grátis
                    </Link>
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="relative py-16 sm:py-24 lg:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900"></div>
        <div className="absolute top-20 right-10 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg mb-8">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm font-['Roboto_Condensed',sans-serif]">AGENDAMENTO INTELIGENTE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 leading-tight font-['Roboto_Condensed',sans-serif]">
            TRANSFORME SUA<br />
            <span className="text-white">
              BARBEARIA EM OURO
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-3xl mx-auto font-['Roboto_Condensed',sans-serif]">
            O único sistema que <span className="text-white font-bold">reaproveita cancelamentos automaticamente</span>, aumentando seu faturamento sem esforço.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/cadastro"
              className="px-10 py-5 bg-white text-black rounded-lg font-black text-lg hover:bg-gray-200 transition-all hover:scale-105 flex items-center justify-center gap-3 font-['Roboto_Condensed',sans-serif]"
            >
              CRIAR VITRINE GRÁTIS <Zap className="w-5 h-5" />
            </Link>

            <button
              type="button"
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-10 py-5 bg-white/10 border border-white/20 text-white rounded-lg font-bold text-lg hover:bg-white/20 transition-colors font-['Roboto_Condensed',sans-serif]"
            >
              Ver Como Funciona
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { stat: '+58%', label: 'Faturamento', accent: 'blue' },
              { stat: '24/7', label: 'Disponível', accent: 'white' },
              { stat: '0%', label: 'Comissão', accent: 'red' }
            ].map(({ stat, label, accent }, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-all">
                <div className={`text-4xl font-black mb-2 font-['Roboto_Condensed',sans-serif] ${
                  accent === 'blue' ? 'text-blue-500' : accent === 'red' ? 'text-red-500' : 'text-white'
                }`}>{stat}</div>
                <div className="text-sm text-gray-500 uppercase font-bold font-['Roboto_Condensed',sans-serif]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24 px-4 bg-neutral-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4 font-['Roboto_Condensed',sans-serif]">
              COMO <span className="text-white">FUNCIONA?</span>
            </h2>
            <p className="text-xl text-gray-400 font-['Roboto_Condensed',sans-serif]">Em 3 passos simples, você está pronto para faturar mais</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: 1, title: 'Cadastre sua Barbearia', text: 'Crie sua conta profissional, adicione serviços, defina horários e profissionais. Tudo em menos de 3 minutos.' },
              { num: 2, title: 'Compartilhe sua Vitrine', text: 'Receba um link único (ex: hakon.app/v/sua-barbearia). Compartilhe no Instagram, WhatsApp e redes sociais.' },
              { num: 3, title: 'Receba Agendamentos', text: 'Clientes agendam 24/7. Cancelou? Sistema reaproveita automaticamente. Você só confirma e atende.' }
            ].map(({ num, title, text }) => (
              <div key={num} className="relative">
                <div className="absolute -top-4 -left-4 w-16 h-16 bg-white rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg font-['Roboto_Condensed',sans-serif]">
                  {num}
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 pt-10">
                  <h3 className="text-2xl font-black mb-3 text-white font-['Roboto_Condensed',sans-serif]">{title}</h3>
                  <p className="text-gray-400 leading-relaxed font-['Roboto_Condensed',sans-serif]">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-gradient-to-br from-blue-950/20 to-red-950/20 border border-white/10 rounded-lg p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black mb-2 text-white font-['Roboto_Condensed',sans-serif]">🔥 Agendamento Inteligente</h3>
                <p className="text-gray-300 leading-relaxed font-['Roboto_Condensed',sans-serif]">
                  Cliente cancelou um corte de 50 minutos às 14h? Nosso sistema <span className="text-white font-bold">calcula em tempo real</span> quais serviços ainda cabem (ex: barba de 30min) e mostra automaticamente na vitrine. <span className="text-white font-bold">Zero esforço seu.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-24 px-4 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4 font-['Roboto_Condensed',sans-serif]">
              POR QUE <span className="text-white">HAKON?</span>
            </h2>
            <p className="text-xl text-gray-400 font-['Roboto_Condensed',sans-serif]">O único sistema que transforma tempo perdido em dinheiro</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: TrendingUp, title: 'Agendamento Inteligente', text: 'Cancelou? Reaproveitamos automaticamente com serviços menores. Sem desperdício.', accent: 'blue' },
              { icon: Shield, title: 'Sua Vitrine, Suas Regras', text: 'URL personalizada, múltiplos profissionais, controle total. Zero marketplace, zero comissão.', accent: 'white' },
              { icon: Users, title: 'Multiprofissional', text: 'Adicione quantos profissionais quiser. Cada um com agenda independente.', accent: 'red' },
              { icon: Clock, title: 'Tempo Real', text: 'Sistema calcula disponibilidade a cada segundo. Cliente vê só o que realmente cabe.', accent: 'blue' },
              { icon: Star, title: 'Avaliações Reais', text: 'Clientes avaliam barbearia E profissionais. Credibilidade que converte.', accent: 'white' },
              { icon: CheckCircle, title: 'Controle Total', text: 'Histórico completo, faturamento separado, seus dados são seus.', accent: 'red' }
            ].map(({ icon: Icon, title, text, accent }, i) => (
              <div
                key={i}
                className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 hover:border-neutral-700 transition-all hover:scale-105"
              >
                <div className={`w-16 h-16 rounded-lg flex items-center justify-center mb-6 ${
                  accent === 'blue' ? 'bg-blue-950/30' : accent === 'red' ? 'bg-red-950/30' : 'bg-white/10'
                }`}>
                  <Icon className={`w-8 h-8 ${
                    accent === 'blue' ? 'text-blue-500' : accent === 'red' ? 'text-red-500' : 'text-white'
                  }`} />
                </div>
                <h3 className="text-2xl font-black mb-3 text-white font-['Roboto_Condensed',sans-serif]">{title}</h3>
                <p className="text-gray-400 leading-relaxed font-['Roboto_Condensed',sans-serif]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black text-black mb-6 font-['Roboto_Condensed',sans-serif]">PRONTO PARA FATURAR MAIS?</h2>
          <p className="text-2xl text-black/80 mb-8 font-bold font-['Roboto_Condensed',sans-serif]">Crie sua vitrine em menos de 3 minutos</p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-3 px-12 py-6 bg-black text-white rounded-lg font-black text-xl hover:bg-neutral-800 transition-all hover:scale-105 font-['Roboto_Condensed',sans-serif]"
          >
            COMEÇAR AGORA GRÁTIS <Zap className="w-6 h-6" />
          </Link>
          <p className="text-black/60 text-sm mt-6 font-bold font-['Roboto_Condensed',sans-serif]">Sem cartão • Sem compromisso • 100% seguro</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-neutral-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {[
              { title: 'Produto', links: ['Como Funciona', 'Preços'] },
              { title: 'Para Você', links: ['Criar Vitrine', 'Suporte'] },
              { title: 'Empresa', links: ['Sobre', 'Blog'] },
              { title: 'Legal', links: ['Privacidade', 'Termos'] }
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-white font-black mb-4 font-['Roboto_Condensed',sans-serif]">{title}</h4>
                <ul className="space-y-2">
                  {links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-gray-500 hover:text-white transition-colors text-sm font-bold font-['Roboto_Condensed',sans-serif]">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-xl font-['Roboto_Condensed',sans-serif]">H</span>
              </div>
              <div>
                <div className="text-white font-black text-sm font-['Roboto_Condensed',sans-serif]">HAKON</div>
                <div className="text-gray-600 text-[10px] font-bold font-['Roboto_Condensed',sans-serif]">Barbearia Elite</div>
              </div>
            </div>
            <div className="text-gray-600 text-sm font-bold font-['Roboto_Condensed',sans-serif]">© 2026 HAKON. Todos os direitos reservados.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
