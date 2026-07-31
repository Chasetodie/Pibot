import { useState, useEffect } from "react";

export default function Hero() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stats`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null)); // si falla, simplemente no se muestra la franja
  }, []);

  return (
    <section id="inicio" className="relative isolate overflow-hidden pt-20 pb-16 px-6 text-center max-w-5xl mx-auto">
      {/* Banner de fondo (la ilustración de Pibot, muy tenue, con desvanecido radial) */}
      <div
        className="absolute inset-0 bg-cover bg-[left_9000%] -z-20"
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}pibot-banner.png')`,
          opacity: 0.22,
          maskImage: 'radial-gradient(ellipse 65% 55% at 50% 28%, black 35%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 28%, black 35%, transparent 90%)',
        }}
      />
      {/* Luz de fondo acorde a la estética */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pibot-pink-dark/20 rounded-full blur-3xl -z-10" />

      {/* Avatar del Bot */}
      <div className="relative inline-block mb-8">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-pibot-gold via-pibot-pink to-pibot-red p-[3px] shadow-2xl shadow-black/60">
        <img src={`${import.meta.env.BASE_URL}pibot-avatar.png`} alt="Pibot" className="w-full h-full rounded-full object-cover" />
        </div>
        <span className="absolute bottom-2 right-2 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-950" title="Bot Online"></span>
      </div>

      {/* Presentación & Descripción Corta */}
      <h1 className="text-4xl md:text-6xl font-display font-normal text-white tracking-wide leading-tight mb-6">
      La energía que tu servidor{" "}
      <span className="bg-gradient-to-r from-pibot-pink to-pibot-red bg-clip-text text-transparent">
          no sabía que necesitaba
      </span>
      </h1>

      <p className="text-pibot-text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
        Economía propia, tienda, minijuegos, misiones, música y una IA con la que puedes hablar. No soy solo un bot, soy parte del server.
      </p>

      {/* Botones OAuth2 y Soporte */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href="https://discord.com/oauth2/authorize?client_id=1402028858223362238&permissions=8&integration_type=0&scope=applications.commands+bot"
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto bg-pibot-pink-dark hover:bg-pibot-pink text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-xl shadow-pibot-pink-dark/30 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
        >
          <span></span> Añadir a Discord
        </a>
        <a
          href="https://discord.com/users/488110147265232898"
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto bg-pibot-panel hover:bg-pibot-panel-hover text-pibot-text font-bold text-lg px-8 py-4 rounded-xl border border-pibot-panel-hover transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
        >
          <span></span> ¿Dudas o Sugerencias? Contacta con mi desarrollador
        </a>
      </div>

      {/* Estadísticas en vivo */}
      {stats && (
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 mt-12 text-sm">
          <div className="text-center">
            <p className="font-display text-2xl text-pibot-gold">{stats.servidores}</p>
            <p className="text-pibot-text-muted">Servidores</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl text-pibot-gold">{stats.usuariosRegistrados}</p>
            <p className="text-pibot-text-muted">Usuarios registrados</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl text-pibot-gold">
              {stats.dineroEnCirculacion.toLocaleString("es-ES")}
            </p>
            <p className="text-pibot-text-muted">π-b$ en circulación</p>
          </div>
        </div>
      )}
    </section>
  );
}