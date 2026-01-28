import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Award, ArrowLeft } from 'lucide-react';

export default function SignupChoice() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 sm:w-96 sm:h-96 bg-yellow-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-6 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Home
        </Link>

        <div className="bg-dark-100 border border-gray-800 rounded-custom p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-yellow-600 rounded-custom flex items-center justify-center">
              <span className="text-black font-black text-2xl sm:text-3xl">H</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">HAKON</h1>
              <p className="text-xs text-primary font-bold -mt-1">BARBEARIA ELITE</p>
            </div>
          </div>

          {/* Título */}
          <div className="animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-black text-center mb-3 sm:mb-4">
              Cadastrar-se como?
            </h2>
            <p className="text-sm sm:text-base text-gray-400 text-center mb-6 sm:mb-8">
              Escolha o tipo de conta que deseja criar
            </p>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Cliente */}
              <button
                onClick={() => navigate('/cadastro/cliente')}
                className="group bg-dark-200 border-2 border-gray-800 hover:border-blue-500 rounded-custom p-4 sm:p-6 transition-all hover:scale-105"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 rounded-custom flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-blue-500/30 transition-all">
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white mb-1">CLIENTE</div>
                <div className="text-xs sm:text-sm text-gray-500 font-bold">Agendar serviços</div>
              </button>

              {/* Profissional */}
              <button
                onClick={() => navigate('/cadastro/profissional')}
                className="group bg-dark-200 border-2 border-gray-800 hover:border-primary rounded-custom p-4 sm:p-6 transition-all hover:scale-105"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/20 rounded-custom flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-primary/30 transition-all">
                  <Award className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
                <div className="text-base sm:text-lg font-black text-white mb-1">PROFISSIONAL</div>
                <div className="text-xs sm:text-sm text-gray-500 font-bold">Gerenciar barbearia</div>
              </button>
            </div>

            {/* Link para Login */}
            <div className="text-center pt-6 mt-6 border-t border-gray-800">
              <p className="text-sm sm:text-base text-gray-400 mb-2">
                Já tem uma conta?
              </p>
              <Link
                to="/login"
                className="text-primary hover:text-yellow-500 font-black text-sm sm:text-base transition-colors"
              >
                FAZER LOGIN →
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-xs sm:text-sm text-gray-600 mt-6 font-bold">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="text-primary hover:text-yellow-500 transition-colors">
            Termos de Uso
          </a>{' '}
          e{' '}
          <a href="#" className="text-primary hover:text-yellow-500 transition-colors">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
