import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, Star, Zap, TrendingUp, Shield, Users, Clock, CheckCircle, Award, Calendar } from 'lucide-react';

export default function Home({ user, userType, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center shadow-lg shadow-primary/50 group-hover:scale-110 transition-transform">
                <span className="text-black font-black text-xl sm:text-2xl">H</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">HAKON</h1>
                <p className="text-xs text-primary font-bold -mt-1">BARBEARIA ELITE</p>
              </div>
            </Link>

            {/* Search Desktop */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar profissional ou barbearia..."
                  className="w-full pl-11 pr-4 py-2.5 bg-dark-200 border border-gray-800 rounded-button text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-4">
              {user ? (
                <>
                  <Link
                    to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                    className="px-5 py-2 text-sm font-bold text-white hover:text-primary transition-colors"
                  >
                    {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                  </Link>
                  <button
                    onClick={onLogout}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-button transition-all"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-5 py-2 text-sm font-bold text-white hover:text-primary transition-colors"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/cadastro"
                    className="px-6 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black text-sm font-black rounded-button hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105"
                  >
                    Cadastrar Grátis
                  </Link>
                  <a
                    href="mailto:suporte@hakon.app"
                    className="px-5 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    Suporte
                  </a>
                </>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white hover:bg-dark-200 rounded-custom transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-gray-800 animate-slide-up">
              {/* Mobile Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-11 pr-4 py-2.5 bg-dark-200 border border-gray-800 rounded-button text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <nav className="flex flex-col gap-2">
                {user ? (
                  <>
                    <Link
                      to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                      className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom transition-all font-bold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                    </Link>
                    <button
                      onClick={() => {
                        onLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-custom transition-all font-bold text-left"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom transition-all font-bold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Entrar
                    </Link>
                    <Link
                      to="/cadastro"
                      className="mx-4 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Cadastrar Grátis
                    </Link>
                    <a
                      href="mailto:suporte@hakon.app"
                      className="px-4 py-3 text-gray-400 hover:text-white hover:bg-dark-200 rounded-custom transition-all font-bold"
                    >
                      Suporte
                    </a>
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-yellow-600/10"></div>
        <div className="absolute top-20 right-10 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-80 h-80 sm:w-96 sm:h-96 bg-yellow-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/30 rounded-button mb-6 sm:mb-8 backdrop-blur-sm animate-fade-in">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-primary font-bold text-xs sm:text-sm">AGENDAMENTO INTELIGENTE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-4 sm:mb-6 leading-tight animate-slide-up">
            TRANSFORME SUA
            <br />
            <span className="bg-gradient-to-r from-primary via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              BARBEARIA EM OURO
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed animate-slide-up px-4" style={{ animationDelay: '0.1s' }}>
            O único sistema que{' '}
            <span className="text-primary font-bold">reaproveita cancelamentos automaticamente</span>,
            aumentando seu faturamento sem esforço.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 sm:mb-16 animate-slide-up px-4" style={{ animationDelay: '0.2s' }}>
            <Link
              to="/cadastro"
              className="group px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-base sm:text-lg hover:shadow-2xl hover:shadow-primary/50 transition-all hover:scale-105 flex items-center justify-center gap-3"
            >
              CRIAR VITRINE GRÁTIS
              <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </Link>
            <button 
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 sm:px-10 py-4 sm:py-5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-button font-bold text-base sm:text-lg hover:bg-white/20 transition-all">
              Ver Como Funciona
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-3xl mx-auto animate-slide-up px-4" style={{ animationDelay: '0.3s' }}>
            <div className="bg-dark-100 border border-gray-800 rounded-custom p-3 sm:p-6 hover:border-primary/50 transition-all">
              <div className="text-2xl sm:text-4xl font-black text-primary mb-1 sm:mb-2">+58%</div>
              <div className="text-[10px] sm:text-sm text-gray-500 uppercase font-bold">Faturamento</div>
            </div>
            <div className="bg-dark-100 border border-gray-800 rounded-custom p-3 sm:p-6 hover:border-primary/50 transition-all">
              <div className="text-2xl sm:text-4xl font-black text-primary mb-1 sm:mb-2">24/7</div>
              <div className="text-[10px] sm:text-sm text-gray-500 uppercase font-bold">Disponível</div>
            </div>
            <div className="bg-dark-100 border border-gray-800 rounded-custom p-3 sm:p-6 hover:border-primary/50 transition-all">
              <div className="text-2xl sm:text-4xl font-black text-primary mb-1 sm:mb-2">0%</div>
              <div className="text-[10px] sm:text-sm text-gray-500 uppercase font-bold">Comissão</div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA SECTION */}
      <section id="como-funciona" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-dark-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 sm:mb-4">
              COMO <span className="text-primary">FUNCIONA?</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Em 3 passos simples, você está pronto para faturar mais
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 sm:gap-12 max-w-5xl mx-auto">
            {/* Passo 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-primary/50">
                1
              </div>
              <div className="bg-dark-200 border border-gray-800 rounded-custom p-6 sm:p-8 pt-10">
                <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Cadastre sua Barbearia</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Crie sua conta profissional, adicione serviços, defina horários e profissionais. 
                  Tudo em <span className="text-primary font-bold">menos de 3 minutos</span>.
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-primary/50">
                2
              </div>
              <div className="bg-dark-200 border border-gray-800 rounded-custom p-6 sm:p-8 pt-10">
                <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Compartilhe sua Vitrine</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Receba um <span className="text-primary font-bold">link único</span> (ex: hakon.app/v/sua-barbearia).
                  Compartilhe no Instagram, WhatsApp e redes sociais.
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-primary/50">
                3
              </div>
              <div className="bg-dark-200 border border-gray-800 rounded-custom p-6 sm:p-8 pt-10">
                <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Receba Agendamentos</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Clientes agendam <span className="text-primary font-bold">24/7</span>. 
                  Cancelou? Sistema reaproveita automaticamente. Você só confirma e atende.
                </p>
              </div>
            </div>
          </div>

          {/* Destaque do Agendamento Inteligente */}
          <div className="mt-12 sm:mt-16 bg-gradient-to-br from-primary/20 to-yellow-600/20 border border-primary/30 rounded-custom p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/30 rounded-custom flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black mb-2 text-white">🔥 Agendamento Inteligente</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-3">
                  Cliente cancelou um corte de 50 minutos às 14h? Nosso sistema{' '}
                  <span className="text-primary font-bold">calcula em tempo real</span> quais serviços ainda cabem 
                  (ex: barba de 30min) e mostra automaticamente na vitrine.
                </p>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  <span className="text-primary font-bold">Zero esforço seu.</span> Máximo aproveitamento da agenda.
                  É como ter um assistente trabalhando 24h por você.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 sm:mb-4">
              POR QUE <span className="text-primary">HAKON?</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              O único sistema que transforma tempo perdido em dinheiro
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Benefit 1 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Agendamento Inteligente</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Cancelou? <span className="text-primary font-bold">Reaproveitamos automaticamente</span> com
                serviços menores. Sem desperdício, sem buracos na agenda.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Sua Vitrine, Suas Regras</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                URL personalizada, múltiplos profissionais, controle total.{' '}
                <span className="text-primary font-bold">Zero marketplace</span>, zero comissão.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Multiprofissional</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Adicione quantos profissionais quiser. Cada um com{' '}
                <span className="text-primary font-bold">agenda independente</span> e serviços próprios.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Tempo Real</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Sistema calcula disponibilidade{' '}
                <span className="text-primary font-bold">a cada segundo</span>. Cliente vê só o que realmente cabe.
              </p>
            </div>

            {/* Benefit 5 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <Star className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Avaliações Reais</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Clientes avaliam barbearia E profissionais.{' '}
                <span className="text-primary font-bold">Credibilidade que converte</span>.
              </p>
            </div>

            {/* Benefit 6 */}
            <div className="group bg-gradient-to-br from-primary/10 to-yellow-600/10 border border-primary/20 rounded-custom p-6 sm:p-8 hover:border-primary/50 transition-all hover:scale-105">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/20 rounded-custom flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/30 transition-all">
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black mb-3 text-white">Controle Total</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Histórico completo, faturamento separado de agenda,{' '}
                <span className="text-primary font-bold">seus dados são seus</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary via-yellow-500 to-yellow-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-black mb-4 sm:mb-6">
            PRONTO PARA FATURAR MAIS?
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-black/80 mb-6 sm:mb-8 font-bold">
            Crie sua vitrine em menos de 3 minutos
          </p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-3 px-10 sm:px-12 py-4 sm:py-6 bg-black text-primary rounded-button font-black text-lg sm:text-xl hover:bg-dark-100 hover:shadow-2xl transition-all hover:scale-105"
          >
            COMEÇAR AGORA GRÁTIS
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>
          <p className="text-black/60 text-xs sm:text-sm mt-4 sm:mt-6 font-bold">
            Sem cartão • Sem compromisso • 100% seguro
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-gray-800 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8">
            <div>
              <h4 className="text-white font-black mb-3 sm:mb-4 text-sm sm:text-base">Produto</h4>
              <ul className="space-y-2">
                <li><Link to="/login" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Como Funciona</Link></li>
                <li><Link to="/login" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Preços</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black mb-3 sm:mb-4 text-sm sm:text-base">Para Você</h4>
              <ul className="space-y-2">
                <li><Link to="/login" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Criar Vitrine</Link></li>
                <li><a href="mailto:suporte@hakon.app" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Suporte</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black mb-3 sm:mb-4 text-sm sm:text-base">Empresa</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Sobre</a></li>
                <li><a href="#" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Blog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Privacidade</a></li>
                <li><a href="#" className="text-gray-500 hover:text-primary transition-colors text-xs sm:text-sm font-bold">Termos</a></li>
                <li><a href="mailto:sugestoes@hakon.app" className="text-primary hover:text-yellow-500 transition-colors text-xs sm:text-sm font-black">💡 Enviar Sugestão</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
                <span className="text-black font-black text-xl">H</span>
              </div>
              <div>
                <div className="text-white font-black text-sm">HAKON</div>
                <div className="text-gray-600 text-[10px] font-bold">Barbearia Elite</div>
              </div>
            </div>

            <div className="text-gray-600 text-xs sm:text-sm font-bold">
              © 2026 HAKON. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
