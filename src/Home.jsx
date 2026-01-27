import React from 'react';
import { Scissors, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="bg-black text-white min-h-screen">
      <section className="pt-20 pb-12 px-6 text-center">
        <h1 className="text-5xl font-black tracking-tighter mb-4 text-yellow-500">HAKON</h1>
        <p className="text-xl font-bold mb-6 uppercase italic">Elite em Barbearia</p>
        <p className="text-gray-400 mb-10 max-w-md mx-auto text-sm">Agendamento inteligente para barbeiros que não perdem tempo.</p>
        <div className="flex flex-col gap-4">
          <Link to="/dashboard" className="bg-yellow-500 text-black font-extrabold py-4 rounded-md uppercase">Acessar Painel</Link>
        </div>
      </section>
    </div>
  );
}
