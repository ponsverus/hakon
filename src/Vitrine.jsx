import React from 'react';
import { useParams } from 'react-router-dom';
import { Star, MessageCircle, Calendar } from 'lucide-react';

export default function Vitrine() {
  const { slug } = useParams();

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-10">
      <div className="h-48 bg-zinc-900 flex items-center justify-center">
        <h1 className="text-yellow-500 text-4xl font-black italic">HAKON</h1>
      </div>
      
      <div className="p-6 -mt-10">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 capitalize">{slug.replace('-', ' ')}</h2>
          <p className="text-gray-500 text-sm">Barbearia Profissional</p>
          
          <div className="flex gap-2 mt-4">
            <button className="flex-1 bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <Calendar size={18}/> Agendar
            </button>
            <button className="p-3 border border-gray-200 rounded-xl text-yellow-600">
              <Star size={24} fill="currentColor"/>
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-bold text-lg mb-4 text-gray-800 uppercase tracking-widest text-sm">Serviços</h3>
          <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-200">
            <div>
              <p className="font-bold text-gray-900">Corte Social</p>
              <p className="text-xs text-gray-500">30 minutos</p>
            </div>
            <span className="font-black text-gray-900">R$ 45,00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
