export default function Toast({ mensaje }) {
  if (!mensaje) return null;

  return (
    <div className="animar-entrada fixed bottom-6 right-6 bg-pibot-panel/90 backdrop-blur-md border border-pibot-pink text-slate-100 px-5 py-3 rounded-xl shadow-lg z-50">
      {mensaje}
    </div>
  );
}