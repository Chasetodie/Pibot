import { useState, useMemo, useEffect } from "react";
import comandosMock from "../../../commandsData.json";

const COMANDOS_POR_PAGINA = 12;

export default function Commands() {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [paginaActual, setPaginaActual] = useState(1);

  const categorias = useMemo(() => {
    const unicas = [...new Set(comandosMock.map((c) => c.categoria))];
    return ["Todas", ...unicas];
  }, []);

    const comandosFiltrados = useMemo(() => {
        const busquedaNormalizada = busqueda.toLowerCase().trim();
        return comandosMock.filter((c) => {
        const coincideCategoria = categoriaActiva === "Todas" || c.categoria === categoriaActiva;
        const coincideBusqueda =
            c.nombre.toLowerCase().includes(busquedaNormalizada) ||
            c.sintaxis.toLowerCase().includes(busquedaNormalizada) ||
            c.descripcion.toLowerCase().includes(busquedaNormalizada);
        return coincideCategoria && coincideBusqueda;
        });
    }, [busqueda, categoriaActiva]);

    // Resetea a la página 1 cada vez que cambia el filtro o la búsqueda
    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda, categoriaActiva]);

    const totalPaginas = Math.max(1, Math.ceil(comandosFiltrados.length / COMANDOS_POR_PAGINA));
    const comandosDePagina = useMemo(() => {
        const inicio = (paginaActual - 1) * COMANDOS_POR_PAGINA;
        return comandosFiltrados.slice(inicio, inicio + COMANDOS_POR_PAGINA);
    }, [comandosFiltrados, paginaActual]);

  return (
    <section id="comandos" className="py-20 px-6 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-display font-black text-white mb-4">
          Comandos
        </h2>
        <p className="text-pibot-text-muted text-lg max-w-xl mx-auto">
          Todo lo que Pibot puede hacer por tu servidor, en un solo lugar.
        </p>
      </div>

      {/* Buscador */}
      <div className="max-w-xl mx-auto mb-8">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca un comando..."
          className="w-full bg-pibot-panel border border-pibot-panel-hover rounded-xl px-5 py-3 text-pibot-text placeholder:text-pibot-text-muted focus:outline-none focus:border-pibot-gold/60 transition-colors"
        />
      </div>

      {/* Chips de categoría */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaActiva(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              categoriaActiva === cat
                ? "bg-pibot-pink-dark border-pibot-pink-dark text-white"
                : "bg-transparent border-pibot-panel-hover text-pibot-text-muted hover:border-pibot-gold/50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lista de comandos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {comandosDePagina.map((c) => (
          <div
            key={c.id}
            className="bg-pibot-panel/60 border border-pibot-panel-hover hover:border-pibot-gold/40 rounded-2xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <code className="font-mono text-pibot-gold text-sm">{c.sintaxis}</code>
              <span className="text-xs px-2 py-1 rounded-full bg-pibot-panel-hover text-pibot-text-muted">
                {c.categoria}
              </span>
            </div>
            <p className="text-pibot-text text-sm mb-2">{c.descripcion}</p>
            <p className="text-xs text-pibot-text-muted">
              Permisos: <span className="text-pibot-pink">{c.permisos}</span>
            </p>
          </div>
        ))}

        {comandosFiltrados.length === 0 && (
          <p className="col-span-full text-center text-pibot-text-muted py-8">
            No se encontró ningún comando con esa búsqueda.
          </p>
        )}
      </div>

      {/* Controles de paginación */}
      {comandosFiltrados.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
            disabled={paginaActual === 1}
            className="px-4 py-2 rounded-lg bg-pibot-panel border border-pibot-panel-hover text-pibot-text disabled:opacity-30 disabled:cursor-not-allowed hover:border-pibot-gold/50 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-pibot-text-muted text-sm">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaActual === totalPaginas}
            className="px-4 py-2 rounded-lg bg-pibot-panel border border-pibot-panel-hover text-pibot-text disabled:opacity-30 disabled:cursor-not-allowed hover:border-pibot-gold/50 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </section>
  );
}