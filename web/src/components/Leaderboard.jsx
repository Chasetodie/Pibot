import { useState, useEffect } from "react";

const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api/leaderboard`;

export default function Leaderboard() {
  const [tipo, setTipo] = useState("money");
  const [jugadores, setJugadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    setError(null);

    fetch(`${API_URL}?type=${tipo}`)
      .then((res) => {
        if (!res.ok) throw new Error("Respuesta no válida del servidor");
        return res.json();
      })
      .then((data) => {
        setJugadores(data.jugadores || []);
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error cargando leaderboard:", err);
        setError("No se pudo cargar el ranking en este momento.");
        setCargando(false);
      });
  }, [tipo]);

  const colorPuesto = (rank) => {
    if (rank === 1) return "text-pibot-gold";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-amber-700";
    return "text-pibot-text-muted";
  };

  return (
    <section id="leaderboard" className="py-20 px-6 max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-display font-black text-white mb-4">
          Ranking Global
        </h2>
        <p className="text-pibot-text-muted text-lg max-w-xl mx-auto">
          Los usuarios más destacados de Pibot, en tiempo real.
        </p>
      </div>

      {/* Selector de tipo */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setTipo("money")}
          className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
            tipo === "money"
              ? "bg-pibot-pink-dark border-pibot-pink-dark text-white"
              : "bg-transparent border-pibot-panel-hover text-pibot-text-muted hover:border-pibot-gold/50"
          }`}
        >
          💰 Dinero
        </button>
        <button
          onClick={() => setTipo("level")}
          className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
            tipo === "level"
              ? "bg-pibot-pink-dark border-pibot-pink-dark text-white"
              : "bg-transparent border-pibot-panel-hover text-pibot-text-muted hover:border-pibot-gold/50"
          }`}
        >
          📊 Nivel
        </button>
      </div>

      {/* Estados de carga / error */}
      {cargando && (
        <p className="text-center text-pibot-text-muted py-10">Cargando ranking...</p>
      )}

      {!cargando && error && (
        <p className="text-center text-pibot-pink py-10">{error}</p>
      )}

      {!cargando && !error && jugadores.length === 0 && (
        <p className="text-center text-pibot-text-muted py-10">
          Todavía no hay usuarios en el ranking.
        </p>
      )}

      {/* Lista */}
      {!cargando && !error && jugadores.length > 0 && (
        <div className="flex flex-col gap-3">
          {jugadores.map((j) => (
            <div
              key={j.userId}
              className="flex items-center gap-4 bg-pibot-panel/60 border border-pibot-panel-hover hover:border-pibot-gold/40 rounded-xl px-4 py-3 transition-colors"
            >
              <span className="w-8 text-center font-display text-lg text-pibot-gold shrink-0">
                {j.rank}
              </span>

              <img
                src={j.avatarUrl || `${import.meta.env.BASE_URL}pibot-avatar.png`}
                alt={j.username}
                className="w-10 h-10 rounded-full border border-pibot-panel-hover object-cover shrink-0"
              />

              <span className="flex-1 text-pibot-text font-medium truncate">
                {j.username}
              </span>

              <span className="text-pibot-pink font-mono text-sm shrink-0">
                {tipo === "money"
                  ? `${j.balance?.toLocaleString("es-ES")} π-b$`
                  : `Nv. ${j.level} · ${j.totalXp?.toLocaleString("es-ES")} XP`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}