import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
  const REDIRECT_URI = encodeURIComponent(import.meta.env.VITE_REDIRECT_URI);
  const SCOPES = encodeURIComponent('identify guilds');
  const loginUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPES}`;

  const [user, setUser] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    function cargarUsuario() {
      const stored = localStorage.getItem('pibot_user');
      setUser(stored ? JSON.parse(stored) : null);
    }
    cargarUsuario();
    window.addEventListener('pibot-auth-changed', cargarUsuario);
    return () => window.removeEventListener('pibot-auth-changed', cargarUsuario);
  }, []);

  function handleLogout() {
    localStorage.removeItem('pibot_token');
    localStorage.removeItem('pibot_user');
    window.dispatchEvent(new Event('pibot-auth-changed'));
    setUser(null);
    navigate('/');
  }

  function irASeccion(id) {
    setMenuAbierto(false);
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  }

  return (
    <nav className="bg-pibot-panel/80 backdrop-blur-md border-b border-pibot-panel-hover sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 sm:px-8 py-4">
        <span className="text-xl font-display font-bold text-white tracking-wide">
          Pibot
        </span>

        <div className="hidden md:flex items-center gap-8 text-slate-300 font-medium">
          <button type="button" onClick={() => irASeccion('inicio')} className="hover:text-pibot-pink transition-colors">Inicio</button>
          <button type="button" onClick={() => irASeccion('caracteristicas')} className="hover:text-pibot-pink transition-colors">Características</button>
          <button type="button" onClick={() => irASeccion('leaderboard')} className="hover:text-pibot-pink transition-colors">Ranking</button>
          <button type="button" onClick={() => irASeccion('comandos')} className="hover:text-pibot-pink transition-colors">Comandos</button>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard" onClick={() => setMenuAbierto(false)} className="text-slate-300 hover:text-pibot-pink text-sm transition-colors">
                Dashboard
              </Link>
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                alt={user.displayName}
                className="w-8 h-8 rounded-full border border-pibot-pink"
              />
              <span className="text-slate-200 text-sm">{user.displayName}</span>
              <button type="button" onClick={handleLogout} className="text-slate-400 hover:text-pibot-pink text-sm transition-colors">
                Cerrar sesión
              </button>
            </div>
          ) : (
            <a href={loginUrl} className="border border-pibot-pink text-pibot-pink hover:bg-pibot-pink hover:text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
              Iniciar sesión
            </a>
          )}

          <a
            href="https://discord.com/oauth2/authorize?client_id=1402028858223362238&permissions=8&integration_type=0&scope=applications.commands+bot"
            target="_blank"
            rel="noreferrer"
            className="bg-pibot-pink-dark hover:bg-pibot-pink text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-pibot-pink-dark/30 hover:scale-105 active:scale-95"
          >
            Añadir a Discord
          </a>
        </div>

        {/* Botón hamburguesa, solo en móvil */}
        <button
          type="button"
          onClick={() => setMenuAbierto(prev => !prev)}
          className="md:hidden text-slate-200 p-2"
          aria-label="Abrir menú"
        >
          {menuAbierto ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Menú desplegable móvil */}
      {menuAbierto && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-4 text-slate-300 font-medium border-t border-pibot-panel-hover pt-4">
          <button type="button" onClick={() => irASeccion('inicio')} className="text-left hover:text-pibot-pink transition-colors">Inicio</button>
          <button type="button" onClick={() => irASeccion('caracteristicas')} className="text-left hover:text-pibot-pink transition-colors">Características</button>
          <button type="button" onClick={() => irASeccion('leaderboard')} className="text-left hover:text-pibot-pink transition-colors">Ranking</button>
          <button type="button" onClick={() => irASeccion('comandos')} className="text-left hover:text-pibot-pink transition-colors">Comandos</button>

          <div className="border-t border-pibot-panel-hover pt-4 flex flex-col gap-3">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuAbierto(false)} className="text-slate-300 hover:text-pibot-pink text-sm">
                  Dashboard
                </Link>
                <div className="flex items-center gap-2">
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border border-pibot-pink"
                  />
                  <span className="text-slate-200 text-sm">{user.displayName}</span>
                </div>
                <button type="button" onClick={handleLogout} className="text-left text-slate-400 hover:text-pibot-pink text-sm">
                  Cerrar sesión
                </button>
              </>
            ) : (
              <a href={loginUrl} className="border border-pibot-pink text-pibot-pink text-center font-semibold px-5 py-2.5 rounded-xl">
                Iniciar sesión
              </a>
            )}

            <a
              href="https://discord.com/oauth2/authorize?client_id=1402028858223362238&permissions=8&integration_type=0&scope=applications.commands+bot"
              target="_blank"
              rel="noreferrer"
              className="bg-pibot-pink-dark text-white text-center font-semibold px-5 py-2.5 rounded-xl"
            >
              Añadir a Discord
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}