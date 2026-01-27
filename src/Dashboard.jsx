import React from 'react';

export default function Dashboard() {
  return (
    <div className="p-6 bg-gray-100 min-h-screen text-black">
      <h2 className="text-2xl font-black uppercase mb-4">Painel do Barbeiro</h2>
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <p className="font-bold">Bem-vindo ao Hakon!</p>
        <p className="text-sm text-gray-600">Configure sua URL exclusiva e gerencie seus cortes.</p>
      </div>
    </div>
  );
}
