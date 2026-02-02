import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Heart, History, LogOut, X } from 'lucide-react';
import { supabase } from '../supabase';

// ✅ Data segura: YYYY-MM-DD -> DD/MM/YYYY (sem Date/UTC)
function formatDateBRFromISO(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
}

export default function ClientArea({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('agendamentos');
  const [agendamentos, setAgendamentos] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Perfil
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Dados (email/senha)
  const [novoEmail, setNovoEmail] = useState(user?.email || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingDados, setSavingDados] = useState(false);
  const [dadosMsg, setDadosMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setNovoEmail(user?.email || '');
  }, [user?.email]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1) Perfil (avatar_url)
      const { data: profileData, error: profileErr } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileErr) setAvatarUrl(profileData?.avatar_url || null);

      // 2) Agendamentos
      const { data: agendamentosData } = await supabase
        .from('agendamentos')
        .select(`
          *,
          servicos (*),
          profissionais (
            nome,
            barbearias (nome, slug)
          )
        `)
        .eq('cliente_id', user.id)
        .order('data', { ascending: false });

      setAgendamentos(agendamentosData || []);

      // 3) Favoritos
      const { data: favoritosData } = await supabase
        .from('favoritos')
        .select(`
          *,
          barbearias (nome, slug, logo_url),
          profissionais (nome, barbearias (slug))
        `)
        .eq('cliente_id', user.id);

      setFavoritos(favoritosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelarAgendamento = async (agendamentoId) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado_cliente' })
        .eq('id', agendamentoId);

      if (error) throw error;

      alert('✅ Agendamento cancelado!');
      loadData();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert('❌ Erro ao cancelar agendamento');
    }
  };

  const removerFavorito = async (favoritoId) => {
    try {
      const { error } = await supabase
        .from('favoritos')
        .delete()
        .eq('id', favoritoId);

      if (error) throw error;

      setFavoritos(favoritos.filter(f => f.id !== favoritoId));
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'agendado':
      case 'confirmado':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'concluido':
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'cancelado_cliente':
      case 'cancelado_profissional':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      agendado: 'AGENDADO',
      confirmado: 'CONFIRMADO',
      concluido: 'CONCLUÍDO',
      cancelado_cliente: 'CANCELADO :(',
      cancelado_profissional: 'CANCELADO',
      nao_compareceu: 'SE ESQUECEU :('
    };
    return statusMap[status] || status;
  };

  // ====== FOTO DE PERFIL ======
  const openFilePicker = () => fileInputRef.current?.click();

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpa input pra permitir escolher o mesmo arquivo de novo
    e.target.value = '';

    // Validações simples (seguras)
    const maxMb = 3;
    const okTypes = ['image/png', 'image/jpeg', 'image/webp'];

    if (!okTypes.includes(file.type)) {
      alert('❌ Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      alert(`❌ Imagem muito grande. Máx: ${maxMb}MB.`);
      return;
    }

    try {
      setUploadingAvatar(true);

      // Nome do arquivo (único)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/${Date.now()}.${ext}`;

      // Upload no bucket avatars
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      // URL pública (bucket public)
      const { data: pub } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(path);

      const url = pub?.publicUrl;
      if (!url) throw new Error('Não foi possível obter a URL pública.');

      // Salvar no profile (tabela users)
      const { error: updErr } = await supabase
        .from('users')
        .update({ avatar_url: url })
        .eq('id', user.id);

      if (updErr) throw updErr;

      setAvatarUrl(url);
      alert('✅ Foto atualizada!');
    } catch (err) {
      console.error('Erro ao atualizar avatar:', err);
      alert('❌ Erro ao atualizar foto. Veja o console.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const nome = user?.user_metadata?.nome || 'Cliente';
  const avatarFallback = nome?.[0]?.toUpperCase() || 'C';

  // ✅ Regra: ordenar por DATA (mais próxima) e depois HORÁRIO (mais cedo)
  const sortByDateThenTime = (list) => {
    return [...(list || [])].sort((a, b) => {
      const da = String(a?.data || '');
      const db = String(b?.data || '');
      if (da !== db) return da.localeCompare(db);

      const ha = String(a?.hora_inicio || '99:99');
      const hb = String(b?.hora_inicio || '99:99');
      return ha.localeCompare(hb);
    });
  };

  // ✅ Separar por status (Em aberto / Cancelados / Concluídos), mantendo a ordenação data+hora em cada lista
  const agendamentosPorStatus = useMemo(() => {
    const abertos = [];
    const cancelados = [];
    const concluidos = [];

    for (const a of (agendamentos || [])) {
      const st = String(a?.status || '');

      if (st === 'concluido') {
        concluidos.push(a);
      } else if (st.includes('cancelado')) {
        cancelados.push(a);
      } else {
        abertos.push(a);
      }
    }

    return {
      abertos: sortByDateThenTime(abertos),
      cancelados: sortByDateThenTime(cancelados),
      concluidos: sortByDateThenTime(concluidos),
    };
  }, [agendamentos]);

  const renderSecaoAgendamentos = (titulo, lista) => {
    if (!lista.length) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">
            {titulo}
          </div>
          <div className="text-xs text-gray-500">
            {lista.length}
          </div>
        </div>

        <div className="space-y-4">
          {lista.map(agendamento => (
            <div
              key={agendamento.id}
              className="bg-dark-200 border border-gray-800 rounded-custom p-4 sm:p-5"
            >
              {/* ✅ FIX: status no topo à direita também no mobile (sem “virar faixa”) */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-white mb-1">
                    {agendamento.profissionais?.barbearias?.nome}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    PROFISSIONAL: {agendamento.profissionais?.nome}
                  </p>
                  <p className="text-sm text-primary">
                    {agendamento.servicos?.nome}
                  </p>
                </div>

                <div
                  className={`shrink-0 inline-flex px-3 py-1 rounded-button text-xs border ${getStatusColor(agendamento.status)}`}
                >
                  {getStatusText(agendamento.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">DATA</div>
                  <div className="text-sm text-white">
                    {formatDateBRFromISO(agendamento.data)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">HORÁRIO</div>
                  <div className="text-sm text-white">
                    {agendamento.hora_inicio}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">VALOR</div>
                  <div className="text-sm text-white">
                    R$ {agendamento.servicos?.preco}
                  </div>
                </div>
              </div>

              {(agendamento.status === 'agendado' || agendamento.status === 'confirmado') && (
                <button
                  onClick={() => cancelarAgendamento(agendamento.id)}
                  className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-button text-sm transition-all"
                >
                  CANCELAR AGENDAMENTO
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ====== DADOS (email/senha) ======
  const salvarEmail = async () => {
    setDadosMsg('');
    const email = String(novoEmail || '').trim();
    if (!email || !email.includes('@')) {
      setDadosMsg('❌ Email inválido.');
      return;
    }

    try {
      setSavingDados(true);

      // Atualiza email (Supabase pode exigir confirmação por email)
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;

      setDadosMsg('✅ Solicitação enviada. Verifique seu email para confirmar a alteração.');
    } catch (e) {
      console.error('Erro ao alterar email:', e);
      setDadosMsg('❌ Erro ao alterar email: ' + (e?.message || ''));
    } finally {
      setSavingDados(false);
    }
  };

  const salvarSenha = async () => {
    setDadosMsg('');
    const pass = String(novaSenha || '');
    const conf = String(confirmarSenha || '');

    if (pass.length < 6) {
      setDadosMsg('❌ A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (pass !== conf) {
      setDadosMsg('❌ As senhas não coincidem.');
      return;
    }

    try {
      setSavingDados(true);

      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;

      setNovaSenha('');
      setConfirmarSenha('');
      setDadosMsg('✅ Senha atualizada!');
    } catch (e) {
      console.error('Erro ao alterar senha:', e);
      setDadosMsg('❌ Erro ao alterar senha: ' + (e?.message || ''));
    } finally {
      setSavingDados(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-2xl animate-pulse">CARREGANDO...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-3">
              {/* ✅ Avatar redondo (como estava aprovado) */}
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-gray-800 bg-dark-200 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black">{avatarFallback}</span>
                )}
              </div>

              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-normal">MINHA ÁREA</h1>
                <p className="text-xs text-blue-400 -mt-1">CLIENTE</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickAvatar}
                className="hidden"
              />

              {/* ✅ Botão FOTO no header e sem ícone (como estava aprovado) */}
              <button
                onClick={openFilePicker}
                disabled={uploadingAvatar}
                className="px-4 py-2 bg-dark-200 border border-gray-800 hover:border-primary/50 rounded-button text-sm transition-all"
              >
                {uploadingAvatar ? 'ENVIANDO...' : 'FOTO'}
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-button text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">SAIR</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl sm:text-4xl font-normal mb-2">Olá, {nome} :)</h2>
            <p className="text-gray-400 text-sm sm:text-base">Gerencie seus agendamentos e favoritos</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Link
            to="/"
            className="bg-gradient-to-r from-primary to-yellow-600 rounded-custom p-6 hover:shadow-lg hover:shadow-primary/50 transition-all group"
          >
            <Calendar className="w-8 h-8 text-black mb-3" />
            <h3 className="text-lg font-normal text-black mb-1">NOVO AGENDAMENTO</h3>
            <p className="text-black/80 text-sm">Buscar profissionais</p>
          </Link>

          <button
            onClick={() => setActiveTab('favoritos')}
            className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all text-left"
          >
            <Heart className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-lg font-normal mb-1">{favoritos.length} FAVORITOS</h3>
            <p className="text-gray-400 text-sm">Suas barbearias preferidas</p>
          </button>

          <button
            onClick={() => setActiveTab('agendamentos')}
            className="bg-dark-100 border border-gray-800 rounded-custom p-6 hover:border-primary/50 transition-all text-left"
          >
            <History className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-lg font-normal mb-1">{agendamentos.length} AGENDAMENTOS</h3>
            <p className="text-gray-400 text-sm">Ver histórico completo</p>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-dark-100 border border-gray-800 rounded-custom overflow-hidden">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('agendamentos')}
              className={`flex-1 py-4 px-6 font-normal transition-all text-sm sm:text-base ${
                activeTab === 'agendamentos'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              AGENDAMENTOS
            </button>

            <button
              onClick={() => setActiveTab('favoritos')}
              className={`flex-1 py-4 px-6 font-normal transition-all text-sm sm:text-base ${
                activeTab === 'favoritos'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              FAVORITOS
            </button>

            {/* ✅ NOVA COLUNA: DADOS */}
            <button
              onClick={() => setActiveTab('dados')}
              className={`flex-1 py-4 px-6 font-normal transition-all text-sm sm:text-base ${
                activeTab === 'dados'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              DADOS
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {/* Tab Agendamentos */}
            {activeTab === 'agendamentos' && (
              <div>
                {(agendamentosPorStatus.abertos.length ||
                  agendamentosPorStatus.cancelados.length ||
                  agendamentosPorStatus.concluidos.length) ? (
                  <div>
                    {renderSecaoAgendamentos('EM ABERTO', agendamentosPorStatus.abertos)}
                    {renderSecaoAgendamentos('CANCELADOS :(', agendamentosPorStatus.cancelados)}
                    {renderSecaoAgendamentos('CONCLUÍDOS', agendamentosPorStatus.concluidos)}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 mb-4">Nenhum agendamento ainda</p>
                    <Link
                      to="/"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button hover:shadow-lg transition-all"
                    >
                      Fazer Primeiro Agendamento
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tab Favoritos */}
            {activeTab === 'favoritos' && (
              <div>
                {favoritos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoritos.map(favorito => {
                      const nomeFav = favorito.tipo === 'barbearia'
                        ? favorito.barbearias?.nome
                        : favorito.profissionais?.nome;
                      const slug = favorito.tipo === 'barbearia'
                        ? favorito.barbearias?.slug
                        : favorito.profissionais?.barbearias?.slug;

                      return (
                        <div
                          key={favorito.id}
                          className="bg-dark-200 border border-gray-800 rounded-custom p-4 relative group hover:border-primary/50 transition-all"
                        >
                          <button
                            onClick={() => removerFavorito(favorito.id)}
                            className="absolute top-2 right-2 w-8 h-8 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>

                          <div className="mb-3">
                            {/* ✅ removeu o “quadrado/contorno” do coração */}
                            <Heart className="w-6 h-6 text-primary fill-current mb-3" />

                            <h3 className="text-lg font-black text-white mb-1">{nomeFav}</h3>
                            <p className="text-xs text-gray-500 uppercase">{favorito.tipo}</p>
                          </div>

                          {slug && (
                            <Link
                              to={`/v/${slug}`}
                              className="block w-full py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-button text-sm text-center transition-all"
                            >
                              VER VITRINE
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 mb-4">Nenhum favorito ainda</p>
                    <Link
                      to="/"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-yellow-600 text-black rounded-button hover:shadow-lg transition-all"
                    >
                      EXPLORAR BARBEARIAS
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tab Dados */}
            {activeTab === 'dados' && (
              <div className="space-y-6">
                <div className="bg-dark-200 border border-gray-800 rounded-custom p-5">
                  <div className="text-xs text-gray-500 mb-2">SEUS DADOS</div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2">EMAIL</label>
                      <input
                        type="email"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                        placeholder="seu@email.com"
                      />
                      <button
                        type="button"
                        disabled={savingDados}
                        onClick={salvarEmail}
                        className="mt-3 w-full py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-button text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        SALVAR EMAIL
                      </button>                    
                    </div>

                    <div>
                      <label className="block text-sm mb-2">NOVA SENHA</label>
                      <input
                        type="password"
                        value={novaSenha}
                        onChange={(e) => setNovaSenha(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                        placeholder="••••••••"
                      />

                      <label className="block text-sm mb-2 mt-3">CONFIRMAR SENHA</label>
                      <input
                        type="password"
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-100 border border-gray-800 rounded-custom text-white"
                        placeholder="••••••••"
                      />

                      <button
                        type="button"
                        disabled={savingDados}
                        onClick={salvarSenha}
                        className="mt-3 w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 rounded-button text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        SALVAR SENHA
                      </button>
                    </div>
                  </div>

                  {!!dadosMsg && (
                    <div className="mt-4 bg-dark-100 border border-gray-800 rounded-custom p-3 text-sm text-gray-300">
                      {dadosMsg}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
