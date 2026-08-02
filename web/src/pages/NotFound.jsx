import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardBackground from '../components/DashboardBackground';

const MENSAJES_404 = [
  { texto1: 'Esta página se perdió en la oscuridad.', texto2: 'No encontramos lo que buscabas.' },
  { texto1: 'Ups... esto se desvaneció como un fantasma.', texto2: 'Aquí ya no queda nada.' },
  { texto1: 'Ni las velas alcanzan a iluminar esto.', texto2: 'Esta ruta no existe.' },
  { texto1: 'Parece que cruzaste al vacío.', texto2: 'Nada por aquí, solo silencio.' },
  { texto1: 'Este camino termina en niebla.', texto2: 'Mejor regresemos.' },
];

const MENSAJES_DENEGADO = [
  { texto1: 'No tienes permiso para cruzar esta puerta.', texto2: 'Esta sala es solo para administradores.' },
  { texto1: 'Algo te detiene aquí.', texto2: 'No tienes las llaves de este lugar.' },
  { texto1: 'Acceso restringido.', texto2: 'No cuentas con permisos suficientes.' },
];

export default function NotFound({ tipo = '404' }) {
  const mensajes = tipo === 'denegado' ? MENSAJES_DENEGADO : MENSAJES_404;
  const elegido = useMemo(() => mensajes[Math.floor(Math.random() * mensajes.length)], []);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center">
      <DashboardBackground />

      <svg className="w-24 h-24 text-purple-400 drop-shadow-lg mb-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7 2 3 5.5 3 10c0 2.8 1.5 5.2 3.8 6.7l-.6 2.8c-.1.5.3 1 .8 1h1.2c.4 0 .7-.3.8-.6l.4-1.4c.5.1 1 .1 1.6.1s1.1 0 1.6-.1l.4 1.4c.1.3.4.6.8.6h1.2c.5 0 .9-.5.8-1l-.6-2.8C19.5 15.2 21 12.8 21 10c0-4.5-4-8-9-8zm-4 9.5c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2zm8 0c-.8 0-1.5-.9-1.5-2s.7-2 1.5-2 1.5.9 1.5 2-.7 2-1.5 2z" />
      </svg>

      <h1 className="text-5xl font-display font-black text-white mb-3 drop-shadow-lg">404</h1>
      <p className="text-slate-100 text-lg mb-2 drop-shadow-md">{elegido.texto1}</p>
      <p className="text-slate-300 mb-8 drop-shadow-sm">{elegido.texto2}</p>

      <Link
        to="/"
        className="relative z-10 bg-pibot-pink hover:bg-pibot-pink-dark text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-black/50"
      >
        Volver al inicio
      </Link>
    </div>
  );
}