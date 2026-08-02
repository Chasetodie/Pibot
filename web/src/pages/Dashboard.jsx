import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardBackground from '../components/DashboardBackground';

export default function Dashboard() {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('pibot_token');
    if (!token) {
      navigate('/');
      return;
    }

    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-guilds`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem('pibot_token');
          localStorage.removeItem('pibot_user');
          navigate('/');
          return null;
        }
        return res.json();
      })
      .then(data => { if (data) setGuilds(data.guilds); })
      .catch(() => setError('No se pudo cargar tus servidores.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <DashboardBackground />
        <div className="relative px-6 sm:px-8 py-16 max-w-5xl mx-auto">
          <div className="h-10 w-64 bg-pibot-panel-hover rounded animate-pulse mb-2" />
          <div className="h-5 w-80 bg-pibot-panel-hover rounded animate-pulse mb-12" />
  
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col items-center gap-3 p-7 bg-pibot-panel/60 backdrop-blur-md rounded-2xl border border-pibot-panel-hover">
                <div className="w-20 h-20 rounded-full bg-pibot-panel-hover animate-pulse" />
                <div className="h-4 w-24 bg-pibot-panel-hover rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <DashboardBackground />

      <div className="relative px-6 sm:px-8 py-16 max-w-5xl mx-auto">
        <h1 className="text-4xl font-display font-bold text-white mb-2">Tus Servidores</h1>
        <p className="text-slate-400 mb-12">Elige un servidor para configurarme.</p>

        {guilds.length === 0 ? (
          <div className="bg-pibot-panel/60 backdrop-blur-md border border-pibot-panel-hover rounded-2xl p-10 text-center">
            <p className="text-slate-400">No eres administrador de ningún servidor donde esté Pibot.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {guilds.map(g => (
              <button
                type="button"
                key={g.id}
                onClick={() => navigate(`/dashboard/${g.id}`)}
                className="group relative flex flex-col items-center gap-3 p-7 bg-pibot-panel/60 backdrop-blur-md rounded-2xl border border-pibot-panel-hover hover:border-pibot-pink transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-pibot-pink-dark/20"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-pibot-pink/0 to-pibot-pink/0 group-hover:from-pibot-pink/5 group-hover:to-transparent transition-all pointer-events-none" />

                {g.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                    alt={g.name}
                    className="w-20 h-20 rounded-full border-2 border-pibot-panel-hover group-hover:border-pibot-pink transition-colors"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-pibot-pink-dark flex items-center justify-center text-white font-display font-bold text-2xl border-2 border-pibot-panel-hover group-hover:border-pibot-pink transition-colors">
                    {g.name.charAt(0)}
                  </div>
                )}

                <span className="text-slate-200 font-medium text-center group-hover:text-white transition-colors">
                  {g.name}
                </span>

                <span className="text-xs text-pibot-gold opacity-0 group-hover:opacity-100 transition-opacity">
                  Configurar →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}