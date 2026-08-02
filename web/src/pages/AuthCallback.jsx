import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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
            window.dispatchEvent(new Event('pibot-auth-changed')); // 👈 nuevo
            navigate('/dashboard');
        } else {
          setError('No se pudo iniciar sesión. Intenta de nuevo.');
        }
      })
      .catch(() => setError('Error de conexión con el servidor.'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-pibot-text">
      {error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <p>Iniciando sesión...</p>
      )}
    </div>
  );
}