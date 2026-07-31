const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const ORIGENES_PERMITIDOS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://chasetodie.github.io',
];

// ── Caché simple en memoria ──
// Guarda el resultado y hace que, dentro del tiempo de vida (TTL),
// las siguientes peticiones reciban la copia guardada en vez de re-consultar todo.
const cache = new Map();

function obtenerDeCache(key, ttlMs) {
  const entrada = cache.get(key);
  if (!entrada) return null;
  const vencido = Date.now() - entrada.timestamp > ttlMs;
  return vencido ? null : entrada.data;
}

function guardarEnCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function iniciarApiServer(client, economy, port) {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || ORIGENES_PERMITIDOS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origen no permitido por CORS'));
      }
    }
  }));

  // Límite general: máximo 30 peticiones por minuto, por IP, para toda la API
  const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' }
  });
  app.use('/api/', limitador);

  // ── /api/leaderboard ──
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const tipo = req.query.type === 'level' ? 'level' : 'money';
      const cacheKey = `leaderboard-${tipo}`;

      const cacheado = obtenerDeCache(cacheKey, 60 * 1000); // 60s de vida
      if (cacheado) {
        return res.json(cacheado);
      }

      const isLevel = tipo === 'level';
      const raw = isLevel
        ? await economy.getLevelLeaderboard(10)
        : await economy.getBalanceLeaderboard(10);

      if (!raw || raw.length === 0) {
        const vacio = { tipo, jugadores: [] };
        guardarEnCache(cacheKey, vacio);
        return res.json(vacio);
      }

      const jugadores = await Promise.all(
        raw.map(async (u, index) => {
          let username = 'Usuario desconocido';
          let avatarUrl = null;
          try {
            const discordUser = await client.users.fetch(u.userId);
            username = discordUser.displayName ?? discordUser.globalName ?? discordUser.username;
            avatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 128 });
          } catch {
            // usuario no resoluble, se queda con los valores por defecto
          }

          return {
            rank: index + 1,
            userId: u.userId,
            username,
            avatarUrl,
            ...(isLevel
              ? { level: u.level, totalXp: u.totalXp }
              : { balance: u.balance })
          };
        })
      );

      const resultado = { tipo, jugadores };
      guardarEnCache(cacheKey, resultado);
      res.json(resultado);
    } catch (error) {
      console.error('❌ Error en /api/leaderboard:', error);
      res.status(500).json({ error: 'Error interno al obtener el leaderboard' });
    }
  });

  // ── /api/stats ──
  app.get('/api/stats', async (req, res) => {
    try {
      const cacheKey = 'stats-globales';
      const cacheado = obtenerDeCache(cacheKey, 120 * 1000); // 2 min de vida (cambia aún más lento)
      if (cacheado) {
        return res.json(cacheado);
      }

      const [rows] = await economy.database.pool.execute(
        'SELECT COUNT(*) as totalUsers, COALESCE(SUM(balance), 0) as totalMoney FROM users'
      );

      const resultado = {
        servidores: client.guilds.cache.size,
        usuariosRegistrados: rows[0].totalUsers,
        dineroEnCirculacion: Number(rows[0].totalMoney)
      };

      guardarEnCache(cacheKey, resultado);
      res.json(resultado);
    } catch (error) {
      console.error('❌ Error en /api/stats:', error);
      res.status(500).json({ error: 'Error interno al obtener estadísticas' });
    }
  });

  app.listen(port, async () => {
    console.log(`🌐 API de Pibot corriendo en el puerto ${port} (caché + rate limit activos)`);

    try {
      const ngrok = require('@ngrok/ngrok');
      const listener = await ngrok.connect({
        addr: port,
        authtoken: process.env.NGROK_AUTHTOKEN,
        domain: process.env.NGROK_DOMAIN, // ej: algo-random-123.ngrok-free.app
      });
      console.log(`🔒 Túnel HTTPS activo en: ${listener.url()}`);
    } catch (err) {
      console.error('❌ No se pudo iniciar el túnel de ngrok:', err.message);
    }
  });
}

module.exports = { iniciarApiServer };