import { useState, useEffect, useRef } from 'react';

export function useContador(valorFinal, duracionMs = 2200) {
  const [valor, setValor] = useState(0);
  const yaAnimado = useRef(false);

  useEffect(() => {
    if (valorFinal == null || yaAnimado.current) return;
    yaAnimado.current = true;

    const inicio = performance.now();

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function paso(ahora) {
      const progreso = Math.min((ahora - inicio) / duracionMs, 1);
      const facilitado = easeInOutCubic(progreso);
      setValor(Math.floor(facilitado * valorFinal));
      if (progreso < 1) requestAnimationFrame(paso);
    }

    requestAnimationFrame(paso);
  }, [valorFinal]);

  return valor;
}