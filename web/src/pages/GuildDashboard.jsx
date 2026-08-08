import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardBackground from '../components/DashboardBackground';
import Toast from '../components/Toast';
import PreviaEmbed from '../components/PreviaEmbed';
import { cerrarSesion } from '../utils/auth';

function Seccion({ titulo, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-sm uppercase tracking-widest text-pibot-gold font-semibold mb-4 drop-shadow-md">{titulo}</h2>
      <div className="bg-pibot-panel/60 backdrop-blur-md border border-pibot-panel-hover rounded-2xl divide-y divide-pibot-panel-hover overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Toggle({ titulo, descripcion, activo, onCambiar }) {
  return (
    <div className="flex items-center justify-between p-5">
      <div>
        <p className="text-white font-medium">{titulo}</p>
        <p className="text-slate-300 text-sm">{descripcion}</p>
      </div>
      <button
        type="button"
        onClick={onCambiar}
        className={`w-14 h-8 rounded-full transition-colors duration-300 ease-in-out relative shrink-0 active:scale-95 ${activo ? 'bg-pibot-pink' : 'bg-slate-600'}`}
      >
        <span
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ease-in-out ${activo ? 'left-7' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

function Selector({ titulo, descripcion, valor, onCambiar, opciones, prefijo }) {
  return (
    <div className="p-5">
        <p className="text-white font-medium">{titulo}</p>
        <p className="text-slate-300 text-sm mb-3">{descripcion}</p>
      <div className="relative">
        <select
          value={valor || ''}
          onChange={e => onCambiar(e.target.value)}
          className="w-full appearance-none bg-pibot-bg/80 border border-pibot-panel-hover rounded-lg pl-3 pr-10 py-2.5 text-slate-200 focus:outline-none focus:border-pibot-pink focus:ring-1 focus:ring-pibot-pink transition-colors duration-200 cursor-pointer"
        >
          <option value="">Sin configurar</option>
          {opciones.map(o => (
            <option key={o.id} value={o.id}>{prefijo}{o.name}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pibot-pink"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default function GuildDashboard() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [info, setInfo] = useState(null);
  const [cambiosPendientes, setCambiosPendientes] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [mostrarBarra, setMostrarBarra] = useState(false);
  const [barraSaliendo, setBarraSaliendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function copiarId() {
    navigator.clipboard.writeText(guildId);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  useEffect(() => {
    const token = localStorage.getItem('pibot_token');
    if (!token) {
      navigate('/404', { replace: true });
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const base = import.meta.env.VITE_API_BASE_URL;

    Promise.all([
      fetch(`${base}/api/guild-config/${guildId}`, { headers }),
      fetch(`${base}/api/guild-info/${guildId}`, { headers })
    ])
        .then(async ([resConfig, resInfo]) => {
          if (resConfig.status === 401) {
            cerrarSesion();
            navigate('/404', { replace: true });
            return null;
          }
          if (resConfig.status === 403) {
            navigate('/404', { replace: true });
            return null;
          }
          return Promise.all([resConfig.json(), resInfo.json()]);
        })
      .then(data => {
        if (data) {
          setConfig(data[0]);
          setInfo(data[1]);
        }
      })
      .finally(() => setLoading(false));
  }, [guildId]);

  const hayPendientes = Object.keys(cambiosPendientes).length > 0;

  useEffect(() => {
    if (hayPendientes) {
      setMostrarBarra(true);
      setBarraSaliendo(false);
    } else if (mostrarBarra) {
      setBarraSaliendo(true);
      const timer = setTimeout(() => setMostrarBarra(false), 250);
      return () => clearTimeout(timer);
    }
  }, [hayPendientes]);

  function valorActual(clave) {
    return clave in cambiosPendientes ? cambiosPendientes[clave] : config[clave];
  }

  function marcarCambio(clave, valor) {
    setCambiosPendientes(prev => ({ ...prev, [clave]: valor }));
  }

  function descartarCambios() {
    setCambiosPendientes({});
  }

  async function guardarTodo() {
    setGuardando(true);
    const token = localStorage.getItem('pibot_token');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/guild-config/${guildId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cambiosPendientes)
      });

      if (!res.ok) throw new Error();

      setConfig(prev => ({ ...prev, ...cambiosPendientes }));
      setCambiosPendientes({});
      setMensaje('✅ Cambios guardados');
    } catch {
      setMensaje('❌ Error al guardar, intenta de nuevo');
    } finally {
      setGuardando(false);
      setTimeout(() => setMensaje(null), 2500);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative px-6 sm:px-8 py-12 max-w-2xl mx-auto pb-32">
        <DashboardBackground />
        <div className="h-4 w-40 bg-pibot-panel-hover rounded animate-pulse mb-6" />
        <div className="h-9 w-72 bg-pibot-panel-hover rounded animate-pulse mb-2" />
        <div className="h-5 w-96 bg-pibot-panel-hover rounded animate-pulse mb-10" />

        {[1, 2, 3].map(i => (
          <div key={i} className="mb-10">
            <div className="h-4 w-24 bg-pibot-panel-hover rounded animate-pulse mb-4" />
            <div className="bg-pibot-panel/60 backdrop-blur-md border border-pibot-panel-hover rounded-2xl p-5 space-y-3">
              <div className="h-5 w-56 bg-pibot-panel-hover rounded animate-pulse" />
              <div className="h-10 w-full bg-pibot-panel-hover rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen relative px-6 sm:px-8 py-12 max-w-2xl mx-auto pb-32">
      <DashboardBackground />

      <button
        type="button"
        onClick={() => {
            if (hayPendientes && !confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir?')) {
                return;
            }
        navigate('/dashboard');
        }}
        className="text-pibot-gold hover:underline mb-6 text-sm drop-shadow-md"
      >
        ← Volver a mis servidores
      </button>

      <h1 className="text-3xl font-display font-bold text-white mb-1 drop-shadow-lg">Configuración del servidor</h1>
      <p className="text-slate-200 mb-10 drop-shadow-md">Ajusta cómo me comporto en este servidor.</p>
      <button
        type="button"
        onClick={copiarId}
        className="text-slate-300 hover:text-pibot-pink text-sm font-mono mb-10 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap drop-shadow-md"
      >
        <span>ID: {guildId}</span>
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        {copiado && <span className="text-emerald-400 whitespace-nowrap">¡Copiado!</span>}
      </button>


      <Seccion titulo="Economía">
        <Selector
          titulo="Canal de niveles (Economía)"
          descripcion="Dónde se anuncian las subidas de nivel del sistema general del bot"
          valor={valorActual('levelup_channel')}
          onCambiar={v => marcarCambio('levelup_channel', v)}
          opciones={info.canales}
          prefijo="#"
        />
        <div className="px-5 pb-5">
          <PreviaEmbed
            tipo="niveles"
            canalNombre={info.canales.find(c => c.id === valorActual('levelup_channel'))?.name}
          />
        </div>
      </Seccion>

      <Seccion titulo="Niveles">
        <Toggle
          titulo="Sistema de niveles del servidor"
          descripcion="Activa o desactiva el XP local (>slevel, >servtop)"
          activo={valorActual('guild_levels_enabled') === 'true'}
          onCambiar={() => marcarCambio('guild_levels_enabled', valorActual('guild_levels_enabled') === 'true' ? 'false' : 'true')}
        />
        <Selector
          titulo="Canal de niveles (Servidor)"
          descripcion="Dónde se anuncian las subidas de nivel del ranking exclusivo de este servidor"
          valor={valorActual('guild_levelup_channel')}
          onCambiar={v => marcarCambio('guild_levelup_channel', v)}
          opciones={info.canales}
          prefijo="#"
        />
        <div className="px-5 pb-5">
          <PreviaEmbed
            tipo="niveles"
            canalNombre={info.canales.find(c => c.id === valorActual('guild_levelup_channel'))?.name}
          />
        </div>
      </Seccion>

      <Seccion titulo="Eventos">
        <Toggle
          titulo="Eventos automáticos"
          descripcion="Activa o desactiva los eventos globales del servidor"
          activo={valorActual('events_globally_enabled') === 'true'}
          onCambiar={() => marcarCambio('events_globally_enabled', valorActual('events_globally_enabled') === 'true' ? 'false' : 'true')}
        />
        <Selector
          titulo="Rol de eventos"
          descripcion="Rol que se menciona cuando ocurre un evento"
          valor={valorActual('events_role')}
          onCambiar={v => marcarCambio('events_role', v)}
          opciones={info.roles}
          prefijo="@"
        />
        <Selector
          titulo="Canal de eventos"
          descripcion="Dónde se anuncian los eventos automáticos"
          valor={valorActual('events_channel')}
          onCambiar={v => marcarCambio('events_channel', v)}
          opciones={info.canales}
          prefijo="#"
        />
        <div className="px-5 pb-5">
          <PreviaEmbed
            tipo="evento"
            rolNombre={info.roles.find(r => r.id === valorActual('events_role'))?.name}
            canalNombre={info.canales.find(c => c.id === valorActual('events_channel'))?.name}
          />
        </div>
      </Seccion>

      <Seccion titulo="Música">
        <Toggle
          titulo="Anuncios hablados"
          descripcion="El bot anuncia por voz la primera y última canción de la cola"
          activo={valorActual('tts_announce_enabled') === 'true'}
          onCambiar={() => marcarCambio('tts_announce_enabled', valorActual('tts_announce_enabled') === 'true' ? 'false' : 'true')}
        />
      </Seccion>

      <Toast mensaje={mensaje} />

      {mostrarBarra && (
        <div className={`fixed bottom-0 left-0 right-0 bg-pibot-panel/90 backdrop-blur-md border-t border-pibot-panel-hover px-6 sm:px-8 py-4 flex items-center justify-between shadow-2xl z-40 transition-all duration-250 ${barraSaliendo ? 'opacity-0 translate-y-4' : 'animar-entrada'}`}>
          <span className="text-slate-200 text-sm">⚠️ Tienes cambios sin guardar</span>
          <div className="flex gap-3">
            <button type="button" onClick={descartarCambios} disabled={guardando} className="px-4 py-2 text-slate-300 hover:text-white text-sm">
              Restablecer
            </button>
            <button type="button" onClick={guardarTodo} disabled={guardando} className="px-5 py-2 bg-pibot-pink-dark hover:bg-pibot-pink text-white rounded-lg font-semibold text-sm transition-all">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}