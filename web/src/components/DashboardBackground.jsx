export default function DashboardBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Imagen de fondo, agrandada y borrosa para tapar los bordes */}
      <img
        src={`${import.meta.env.BASE_URL}fondo-textura.jpg`}
        alt=""
        className="fondo-animado absolute inset-0 w-full h-full object-cover object-[20%_70%] blur-md opacity-80"
      />

      {/* Overlay oscuro encima, para que el texto siga siendo legible */}
      <div className="absolute inset-0 bg-pibot-bg/30" />

      {/* Capas de humo flotante */}
      <div className="capa-humo absolute -inset-20 bg-gradient-radial from-white/[0.03] via-transparent to-transparent" />
      <div className="capa-humo-lenta absolute -inset-20 bg-gradient-radial from-pibot-pink/[0.04] via-transparent to-transparent" style={{ top: '20%', left: '30%' }} />

      {/* Las manchas de luz que ya teníamos, encima de todo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-pibot-pink-dark/20 rounded-full blur-3xl" />
      <div className="absolute top-1/4 -right-40 w-[28rem] h-[28rem] bg-pibot-pink/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pibot-pink-dark/15 rounded-full blur-3xl" />
      <div className="absolute top-2/3 right-1/3 w-72 h-72 bg-pibot-pink/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-pibot-pink-dark/10 rounded-full blur-3xl" />
    </div>
  );
}