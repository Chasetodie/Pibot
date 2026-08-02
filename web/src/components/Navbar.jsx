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

  const IconoDashboard = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <nav className="bg-pibot-panel/80 backdrop-blur-md border-b border-pibot-panel-hover sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 sm:px-8 py-4">
        <Link to="/" className="text-xl font-display font-bold text-white tracking-wide hover:text-pibot-pink transition-colors">
          Pibot
        </Link>

        <div className="hidden md:flex items-center gap-8 text-slate-300 font-medium">
          <button type="button" onClick={() => irASeccion('inicio')} className="hover:text-pibot-pink transition-colors">Inicio</button>
          <button type="button" onClick={() => irASeccion('caracteristicas')} className="hover:text-pibot-pink transition-colors">Características</button>
          <button type="button" onClick={() => irASeccion('leaderboard')} className="hover:text-pibot-pink transition-colors">Ranking</button>
          <button type="button" onClick={() => irASeccion('comandos')} className="hover:text-pibot-pink transition-colors">Comandos</button>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-3">
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
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 bg-pibot-pink-dark hover:bg-pibot-pink hover:scale-105 active:scale-95 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-pibot-pink-dark/30"
              >
                <IconoDashboard />
                Dashboard
              </Link>
            </>
          ) : (
            <a
              href={loginUrl}
              className="border border-pibot-pink text-white hover:bg-pibot-pink hover:scale-105 active:scale-95 font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              Iniciar sesión
            </a>
          )}
        </div>

        <div className="md:hidden flex items-center gap-1">
          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-white hover:text-pibot-pink hover:scale-105 active:scale-95 text-sm font-medium px-3 py-2 transition-all"
            >
              <IconoDashboard />
              Dashboard
            </Link>
          ) : (
            <a
              href={loginUrl}
              className="text-white hover:text-pibot-pink hover:scale-105 active:scale-95 text-sm font-semibold px-3 py-2 transition-all"
            >
              Iniciar sesión
            </a>
          )}

          <button
            type="button"
            onClick={() => setMenuAbierto(prev => !prev)}
            className="text-slate-200 p-2"
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
      </div>

      {menuAbierto && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-4 text-slate-300 font-medium border-t border-pibot-panel-hover pt-4">
          <button type="button" onClick={() => irASeccion('inicio')} className="text-left hover:text-pibot-pink transition-colors">Inicio</button>
          <button type="button" onClick={() => irASeccion('caracteristicas')} className="text-left hover:text-pibot-pink transition-colors">Características</button>
          <button type="button" onClick={() => irASeccion('leaderboard')} className="text-left hover:text-pibot-pink transition-colors">Ranking</button>
          <button type="button" onClick={() => irASeccion('comandos')} className="text-left hover:text-pibot-pink transition-colors">Comandos</button>

          {user && (
            <div className="border-t border-pibot-panel-hover pt-4 flex flex-col gap-3">
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
            </div>
          )}
        </div>
      )}
    </nav>
  );
}