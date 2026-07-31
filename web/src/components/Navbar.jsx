export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-pibot-panel/80 backdrop-blur-md border-b border-pibot-panel-hover sticky top-0 z-50">
      {/* Logo / Nombre del Bot */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-pibot-pink shadow-lg shadow-pibot-pink-dark/30">
        <img src="/pibot-avatar.png" alt="Pibot" className="w-full h-full object-cover" />
        </div>
        <span className="text-xl font-display font-bold text-white tracking-wide">
        Pibot
        </span>
      </div>

      {/* Menú de Navegación */}
      <div className="hidden md:flex items-center gap-8 text-slate-300 font-medium">
        <a href="#inicio" className="hover:text-pibot-pink transition-colors">Inicio</a>
        <a href="#caracteristicas" className="hover:text-pibot-pink transition-colors">Características</a>
        <a href="#comandos" className="hover:text-pibot-pink transition-colors">Comandos</a>
        <a href="#soporte" className="hover:text-pibot-pink transition-colors">Soporte</a>
      </div>

      {/* Botón rápido */}
      <a
        href="https://discord.com"
        target="_blank"
        rel="noreferrer"
        className="bg-pibot-pink-dark hover:bg-pibot-pink text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-pibot-pink-dark/30 hover:scale-105 active:scale-95"
      >
        Añadir a Discord
      </a>
    </nav>
  );
}