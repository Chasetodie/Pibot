import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardBackground from '../components/DashboardBackground';

export default function AuthCallback() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const yaEjecutado = useRef(false);

  useEffect(() => {
    if (yaEjecutado.current) return;
    yaEjecutado.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('No se recibió el código de Discord.');
      return;
    }

    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/discord`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('pibot_token', data.token);
          localStorage.setItem('pibot_user', JSON.stringify(data.user));
          window.dispatchEvent(new Event('pibot-auth-changed'));
          navigate('/dashboard');
        } else {
          setError('No se pudo iniciar sesión. Intenta de nuevo.');
        }
      })
      .catch(() => setError('Error de conexión con el servidor.'));
  }, []);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center">
      <DashboardBackground />

      {error ? (
        <>
          <svg className="w-24 h-24 text-red-400 drop-shadow-lg mb-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C7 2 3 5.5 3 10c0 2.8 1.5 5.2 3.8 6.7l-.6 2.8c-.1.5.3 1 .8 1h1.2c.4 0 .7-.3.8-.6l.4-1.4c.5.1 1 .1 1.6.1s1.1 0 1.6-.1l.4 1.4c.1.3.4.6.8.6h1.2c.5 0 .9-.5.8-1l-.6-2.8C19.5 15.2 21 12.8 21 10c0-4.5-4-8-9-8zm-4 9.5c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2zm8 0c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2z" />
          </svg>
          <p className="text-red-400 drop-shadow-md">{error}</p>
        </>
      ) : (
        <>
          <div className="relative w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-pibot-panel-hover" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-pibot-pink border-r-pibot-pink animate-spin" />
            <svg className="absolute inset-0 m-auto w-14 h-14 text-purple-400 drop-shadow-lg animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C7 2 3 5.5 3 10c0 2.8 1.5 5.2 3.8 6.7l-.6 2.8c-.1.5.3 1 .8 1h1.2c.4 0 .7-.3.8-.6l.4-1.4c.5.1 1 .1 1.6.1s1.1 0 1.6-.1l.4 1.4c.1.3.4.6.8.6h1.2c.5 0 .9-.5.8-1l-.6-2.8C19.5 15.2 21 12.8 21 10c0-4.5-4-8-9-8zm-4 9.5c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2zm8 0c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2z" />
            </svg>
          </div>
          <p className="text-white text-lg font-display drop-shadow-md mb-1">Invocando tu sesión...</p>
          <p className="text-slate-400 text-sm drop-shadow-sm">Un momento, las sombras están confirmando quién eres.</p>
        </>
      )}
    </div>
  );
}