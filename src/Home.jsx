import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, TrendingUp, Shield, Star, ArrowRight, CheckCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white overflow-hidden">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10"></div>
        <div className="absolute top-20 right-20 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full mb-8 backdrop-blur-sm animate-fade-in">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 font-semibold text-sm">Sistema de Elite para Barbeiros</span>
          </div>

          {/* Main Title */}
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-6 animate-slide-up">
            <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent italic tracking-tight">
              HAKON
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-widest mb-4 text-slate-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Transforme Sua Barbearia em Uma Máquina de Faturamento
          </p>

          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.3s' }}>
            Enquanto outros apps cobram caro por features básicas, nós entregamos 
            <span className="text-yellow-400 font-bold"> agendamento inteligente, vitrine personalizada e gestão completa</span> sem complicação.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <Link 
              to="/dashboard" 
              className="group px-10 py-5 bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-500 text-black rounded-full font-black text-lg hover:shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-105 flex items-center justify-center gap-3"
            >
              CRIAR MINHA VITRINE AGORA
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="px-10 py-5 bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all">
              Ver Como Funciona
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl font-black text-yellow-400 mb-2">+45%</div>
              <div className="text-sm text-slate-400 uppercase font-semibold">Mais Faturamento</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl font-black text-orange-400 mb-2">24/7</div>
              <div className="text-sm text-slate-400 uppercase font-semibold">Agendamentos</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl font-black text-yellow-400 mb-2">0%</div>
              <div className="text-sm text-slate-400 uppercase font-semibold">Comissão</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4">
              Por Que <span className="text-yellow-400">HAKON?</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Enquanto outros apps te limitam, nós te empoderamos
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-8 hover:border-yellow-500/50 transition-all hover:scale-105">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500/30 transition-all">
                <TrendingUp className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-black mb-3 text-white">Agendamento Inteligente</h3>
              <p className="text-slate-400 leading-relaxed">
                Sistema que <span className="text-yellow-400 font-bold">transforma cancelamentos em oportunidades</span>. 
                Reaproveitamento automático de horários com filtro inteligente.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-8 hover:border-yellow-500/50 transition-all hover:scale-105">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500/30 transition-all">
                <Shield className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-black mb-3 text-white">Sua Vitrine, Suas Regras</h3>
              <p className="text-slate-400 leading-relaxed">
                URL personalizada, logo, galeria, preços. 
                <span className="text-yellow-400 font-bold"> Nenhum marketplace roubando seus clientes.</span>
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-8 hover:border-yellow-500/50 transition-all hover:scale-105">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500/30 transition-all">
                <Star className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-black mb-3 text-white">Gestão Completa</h3>
              <p className="text-slate-400 leading-relaxed">
                Dashboard financeiro, controle de serviços, reviews. 
                <span className="text-yellow-400 font-bold"> Agenda separada de faturamento.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON SECTION */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4">
              Outros Apps <span className="text-red-500">vs</span> <span className="text-yellow-400">HAKON</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Outros Apps */}
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-8">
              <h3 className="text-2xl font-black text-red-400 mb-6 flex items-center gap-3">
                <span className="text-4xl">❌</span> Outros Apps
              </h3>
              <ul className="space-y-4">
                {[
                  'Comissão de 10-15% em CADA agendamento',
                  'Sua vitrine perdida em um marketplace',
                  'Clientes roubados pela concorrência',
                  'Features básicas custam caro',
                  'Horários cancelados = prejuízo',
                  'Dados dos clientes não são seus'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <span className="text-red-400 font-bold mt-1">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* HAKON */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-2xl p-8">
              <h3 className="text-2xl font-black text-yellow-400 mb-6 flex items-center gap-3">
                <span className="text-4xl">✅</span> HAKON
              </h3>
              <ul className="space-y-4">
                {[
                  '0% de comissão. Nunca.',
                  'Vitrine 100% sua com URL personalizada',
                  'Seus clientes permanecem SEUS',
                  'Todas as features inclusas',
                  'Cancelamentos viram oportunidades',
                  'Você é dono dos seus dados'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-100 font-medium">
                    <CheckCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-black mb-6">
            Pronto Para Dominar Sua Área?
          </h2>
          <p className="text-xl text-black/80 mb-8 font-semibold">
            Junte-se aos barbeiros elite que já faturam 45% a mais
          </p>
          <Link 
            to="/dashboard"
            className="inline-flex items-center gap-3 px-12 py-6 bg-black text-yellow-400 rounded-full font-black text-xl hover:bg-zinc-900 hover:shadow-2xl transition-all hover:scale-105"
          >
            CRIAR VITRINE GRÁTIS AGORA
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="text-black/60 text-sm mt-6 font-semibold">
            Sem cartão • Sem compromisso • Comece em 2 minutos
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/10 py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-4xl font-black text-yellow-500 italic mb-4">HAKON</div>
          <p className="text-slate-500 text-sm">© 2026 HAKON. Gestão de Elite para Barbeiros.</p>
        </div>
      </footer>
    </div>
  );
}
