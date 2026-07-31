import { Compass, MessageCircle, Gamepad2, ShieldCheck } from "lucide-react";

export default function Features() {
  const razones = [
    {
      numero: "I",
      Icono: Compass,
      titulo: "Un Mundo Entero",
      descripcion: "Economía, mazmorras, mascotas, matrimonio y crafteo — no es un bot con un truco, es un ecosistema completo."
    },
    {
      numero: "II",
      Icono: ShieldCheck,
      titulo: "Fácil de Usar",
      descripcion: "Configuración sencilla en pocos pasos sin complicarte con comandos confusos."
    },
    {
      numero: "III",
      Icono: Gamepad2,
      titulo: "Entretenimiento Total",
      descripcion: "Sistemas interactivos y divertidos diseñados para mantener activa a tu comunidad."
    },
    {
      numero: "IV",
      Icono: MessageCircle,
      titulo: "Habla de Verdad",
      descripcion: "Pibot no solo ejecuta comandos — puedes conversar con su IA como con alguien más del server."
    }
  ];

  return (
    <section id="caracteristicas" className="py-20 px-6 max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-display font-black text-white mb-4">
          ¿Por qué elegir nuestro bot?
        </h2>
        <p className="text-pibot-text-muted text-lg max-w-xl mx-auto">
          4 razones principales por las que las comunidades prefieren usar nuestra herramienta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {razones.map((razon, index) => (
          <div
            key={index}
            className="group relative bg-pibot-panel/60 border border-pibot-panel-hover hover:border-pibot-gold/40 p-6 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 overflow-hidden"
          >
            {/* Acento superior dorado, se enciende en hover */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-pibot-gold/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Numeral romano de fondo, decorativo */}
            <span className="absolute top-3 right-4 font-display text-4xl text-pibot-panel-hover select-none">
              {razon.numero}
            </span>

            <div className="relative w-14 h-14 mb-5 rounded-full border border-pibot-gold/40 bg-pibot-bg/60 flex items-center justify-center">
              <razon.Icono size={24} className="text-pibot-gold" strokeWidth={1.75} />
            </div>

            <h3 className="text-xl font-display font-bold text-white mb-2">{razon.titulo}</h3>
            <p className="text-pibot-text-muted text-sm leading-relaxed">{razon.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}