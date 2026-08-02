export default function PreviaEmbed({ tipo = 'evento', rolNombre, canalNombre }) {
  return (
    <div className="mt-4 mb-2">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Vista previa</p>
      <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4 border-pibot-pink font-sans">
        {tipo === 'evento' ? (
          <>
            <p className="text-slate-300 text-sm mb-2">
              {rolNombre ? (
                <span className="bg-[#3c4270] text-[#c9cdfb] px-1 rounded font-medium">@{rolNombre}</span>
              ) : (
                <span className="text-slate-500 italic">Sin rol configurado</span>
              )}
            </p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pibot-gold to-pibot-pink flex items-center justify-center text-lg shrink-0">
                🎉
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-1">¡Evento Doble XP activado!</p>
                <p className="text-slate-300 text-sm">Durante los próximos 30 minutos, todo el XP ganado se duplica.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pibot-gold to-pibot-pink flex items-center justify-center text-lg shrink-0">
              📈
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">¡Felicidades, @Usuario!</p>
              <p className="text-slate-300 text-sm">Subiste al <span className="text-pibot-gold font-semibold">Nivel 12</span> 🎉</p>
            </div>
          </div>
        )}
        <p className="text-slate-500 text-xs mt-3">
          Se anunciará en:{' '}
          {canalNombre ? (
            <span className="text-[#949cf7]">#{canalNombre}</span>
          ) : (
            <span className="italic">sin canal configurado</span>
          )}
        </p>
      </div>
    </div>
  );
}