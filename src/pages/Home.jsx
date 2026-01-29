import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, Star, Zap, TrendingUp, Shield, Users, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

export default function Home({ user, userType, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const isLogged = !!user && !!userType;

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

  const SearchBox = ({ mobile }) => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar profissional ou barbearia..."
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
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );

  const doLogout = async () => {
    try {
      setMobileMenuOpen(false);
      if (typeof onLogout === 'function') {
        await onLogout();
      }
    } catch (e) {
      console.error('Erro ao deslogar:', e);
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
                <p className="text-xs text-primary font-bold -mt-1">BARBEARIA ELITE</p>
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
                    className="px-5 py-2 text-sm font-bold text-white hover:text-primary transition-colors"
                  >
                    {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                  </Link>
                  <button
                    type="button"
                    onClick={doLogout}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-button"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2 text-sm font-bold text-white hover:text-primary transition-colors">
                    Entrar
                  </Link>
                  <Link
                    to="/cadastro"
                    className="px-6 py-2.5 bg-gradient-to-r from-primary to-yellow-600 text-black text-sm font-black rounded-button hover:shadow-lg hover:shadow-primary/50 transition-all hover:scale-105"
                  >
                    Cadastrar Grátis
                  </Link>
                </>
              )}
            </nav>

            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-white">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-gray-800">
              <div className="mb-4"><SearchBox mobile={true} /></div>
              <nav className="flex flex-col gap-2">
                {isLogged ? (
                  <>
                    <Link
                      to={userType === 'professional' ? '/dashboard' : '/minha-area'}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom font-bold"
                    >
                      {userType === 'professional' ? 'Dashboard' : 'Minha Área'}
                    </Link>
                    <button
                      type="button"
                      onClick={doLogout}
                      className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-custom font-bold text-left"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-white hover:bg-dark-200 rounded-custom font-bold">
                      Entrar
                    </Link>
                    <Link to="/cadastro" onClick={() => setMobileMenuOpen(false)} className="mx-4 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button font-black text-center">
                      Cadastrar Grátis
                    </Link>
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* seu resto do layout (HERO / SECTIONS / FOOTER) fica igual */}
      {/* ... */}
    </div>
  );
}
