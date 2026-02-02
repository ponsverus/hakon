import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, Star, Zap, TrendingUp, Shield, Users, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

// ✅ FIX: mover SearchBox para fora do componente Home evita remount e perda de foco
function SearchBox({
  mobile,
  searchTerm,
  setSearchTerm,
  resultadosBusca,
  setResultadosBusca,
  buscando,
  setMobileMenuOpen,
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="PESQUISAR..."
        className="w-full pl-11 pr-4 py-2.5 bg-dark-200 border border-gray-800 rounded-button text-white placeholder-gray-500 focus:border-primary focus:outline-none"
      />

      {resultadosBusca.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-dark-100 border border-gray-800 rounded-custom shadow-2xl z-50 max-h-96 overflow-y-auto">
          {resultadosBusca.map((r, i) => (
            <Link
              key={i}
              to={`/v/${r.tipo === 'barbearia' ? r.slug : r.barbearias?.slug}`}
              onClick={() => {
                setSearchTerm('');
                setResultadosBusca([]);
                if (mobile) setMobileMenuOpen(false);
              }}
              className="block px-4 py-3 hover:bg-dark-200 border-b border-gray-800 last:border-0"
            >
              <div className="font-bold text-white">{r.nome}</div>
              <div className="text-xs text-gray-500 uppercase">{r.tipo}</div>
            </Link>
          ))}
        </div>
      )}

      {buscando && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

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

  const handleLogoutClick = async () => {
    try {
      await onLogout?.();
    } finally {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center shadow-lg shadow-primary/50 group-hover:scale-110 transition-transform">
                <span className="text-black font-black text-xl sm:text-2xl">H</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-black">HAKON</h1>
                <p className="text-xs text-primary -mt-1">AGENDAMENTO INTELIGENTE</p>
              </div>
            </Link>

            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <SearchBox
                mobile={false}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                resultadosBusca={resultadosBusca}
                setResultadosBusca={setResultadosBusca}
                buscando={buscando}
                setMobileMenuOpen={setMobileMenuOpen}
              />
            </div>

            <nav className="hidden lg:flex items-center gap-4">
              {isLogged ? (
                <>
                  <Link
                    to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                    className="px-5 py-2 text-sm text-white hover:text-primary transition-colors"
                  >
                    {userType === 'professional' ? 'DASHBOARD' : 'MINHA ÁREA'}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-button"
                  >
                    SAIR
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2 text-sm text-white hover:text-primary transition-colors">
                    ENTRAR
                  </Link>
                  <Link
                    to="/cadastro"
                    className="px-6 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black text-sm font-normal rounded-button hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105"
                  >
                    CADASTRAR GRÁTIS
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
            <div className="lg:hidden py-4 border-t border-gray-800">
              <div className="mb-4">
                <SearchBox
                  mobile={true}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  resultadosBusca={resultadosBusca}
                  setResultadosBusca={setResultadosBusca}
                  buscando={buscando}
                  setMobileMenuOpen={setMobileMenuOpen}
                />
              </div>

              <nav className="flex flex-col gap-2">
                {isLogged ? (
                  <>
                    <Link
                      to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom font-bold"
                    >
                      {userType === 'professional' ? 'DASHBOARD' : 'MINHA ÁREA'}
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-custom text-left"
                    >
                      SAIR
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom"
                    >
                      ENTRAR
                    </Link>

                    <Link
                      to="/cadastro"
                      onClick={() => setMobileMenuOpen(false)}
                      className="mx-4 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-normal text-center"
                    >
                      CADASTRAR GRÁTIS
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-yellow-600/10"></div>
        <div className="absolute top-20 right-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/30 rounded-button mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-primary font-bold text-sm">AGENDAMENTO INTELIGENTE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 leading-tight">
            TRANSFORME SEU<br />
            <span className="bg-gradient-to-r from-primary to-yellow-600 bg-clip-text text-transparent">
              NEGÓCIO EM OURO
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            O único sistema que <span className="text-primary font-bold">reaproveita cancelamentos automaticamente</span>, aumentando seu faturamento sem esforço.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/cadastro"
              className="px-10 py-5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-lg hover:shadow-2xl hover:shadow-primary/50 transition-all hover:scale-105 flex items-center justify-center gap-3"
            >
              CRIAR VITRINE GRÁTIS <Zap className="w-5 h-5" />
            </Link>

            <button
              type="button"
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-10 py-5 bg-white/10 border border-white/20 text-white rounded-button font-bold text-lg hover:bg-white/20"
            >
              VER COMO FUNCIONA
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
            {['+8%', '24/7'].map((stat, i) => (
              <div key={i} className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all">
                <div className="text-4xl font-normal text-primary mb-2">{stat}</div>
                <div className="text-sm text-gray-500 uppercase">
                  {['Faturamento em média', 'Disponível'][i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24 px-4 bg-dark-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4">
              COMO <span className="text-primary">FUNCIONA?</span>
            </h2>
            <p className="text-xl text-gray-400">Em 3 passos simples, você está pronto para faturar mais</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-14">
            {[
              { num: 1, title: 'CADASTRE SEU NEGÓCIO', text: 'Crie sua conta profissional, adicione serviços, defina horários e profissionais. Tudo em menos de 3 minutos.' },
              { num: 2, title: 'COMPARTILHE SUA VITRINE', text: 'Receba um link único (ex: hakon.app/v/seu-negocio). Compartilhe no Instagram, WhatsApp e redes sociais.' },
              { num: 3, title: 'RECEBA AGENDAMENTOS', text: 'Clientes agendam 24/7. Cancelou? Sistema reaproveita automaticamente. Você só atende.' }
            ].map(({ num, title, text }) => (
              <div key={num} className="relative">
                {/* ✅ FIX DESKTOP: subir bolinha numerada (apenas md+) */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 md:-top-10 md:-left-4 w-16 h-16 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-primary/50 z-10">
                  {num}
                </div>
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-8 pt-14 md:pt-10">
                  <h3 className="text-2xl font-normal mb-3 text-white">{title}</h3>
                  <p className="text-gray-400 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-gradient-to-br from-primary/20 to-yellow-600/20 border border-primary/30 rounded-custom p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/30 rounded-custom flex items-center justify-center flex-shrink-0">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-normal mb-2 text-white">AGENDAMENTO INTELIGENTE</h3>
                <p className="text-gray-300 leading-relaxed">
                  Cliente cancelou um atendimento de 30 minutos às 14h? Nosso sistema <span className="text-primary font-bold">calcula em tempo real</span> quais serviços ainda cabem (ex: acabamento de 15 min) e mostra automaticamente na vitrine. <span className="text-primary font-bold">Zero esforço seu.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-24 px-4 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4">
              POR QUE <span className="text-primary">HAKON?</span>
            </h2>
            <p className="text-xl text-gray-400">O único sistema que transforma tempo perdido em dinheiro</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: TrendingUp, title: 'agendamento inteligente', text: 'Cancelou? Reaproveitamos automaticamente com serviços menores. Sem desperdício.' },
              { icon: Shield, title: 'sua vitrine, suas regras', text: 'URL personalizada, múltiplos profissionais, controle total. Zero marketplace, zero comissão.' },
              { icon: Users, title: 'multiprofissional', text: 'Adicione quantos profissionais quiser. Cada um com agenda independente.' },
              { icon: Clock, title: 'tempo real', text: 'Sistema calcula disponibilidade a cada segundo. Cliente vê só o que realmente cabe.' },
              { icon: Star, title: 'avaliações reais', text: 'Clientes avaliam seu negócio e profissionais. Credibilidade que converte.' },
              { icon: CheckCircle, title: 'controle total', text: 'Histórico completo, faturamento separado, seus dados são seus.' }
            ].map(({ icon: Icon, title, text }, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-8 hover:border-primary/50 transition-all hover:scale-105"
              >
                <div className="w-16 h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-6">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-normal mb-3 text-white">{title}</h3>
                <p className="text-gray-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gradient-to-r from-primary via-yellow-500 to-yellow-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black text-black mb-6">PRONTO PARA FATURAR MAIS?</h2>
          <p className="text-2xl text-black/80 mb-8">Crie sua vitrine em menos de 3 minutos</p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-3 px-12 py-6 bg-black text-primary rounded-button font-black text-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            COMEÇAR AGORA GRÁTIS <Zap className="w-6 h-6" />
          </Link>
          <p className="text-black/60 text-sm mt-6">Sem compromisso e 100% seguro</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-gray-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {[
              { title: 'PRODUTO', links: ['Como Funciona', 'Preços'] },
              { title: 'PARA VOCÊ', links: ['Criar Vitrine', 'Suporte'] },
              { title: 'EMPRESA', links: ['Sobre', 'Blog'] },
              { title: 'LEGAL', links: ['Privacidade', 'Termos'] }
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-white font-normal mb-4">{title}</h4>
                <ul className="space-y-2">
                  {links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-gray-500 hover:text-primary transition-colors text-sm">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
                <span className="text-black font-normal text-xl">H</span>
              </div>
              <div className="text-white font-black text-sm">HAKON</div>
              <div className="text-gray-600 text-sm">© 2026 HAKON. Todos os direitos reservados.</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
