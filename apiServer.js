const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const ORIGENES_PERMITIDOS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://chasetodie.github.io',
];

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

function verificarAdminDelServidor(req, res, next) {
  const authHeader = req.headers.authorization; // formato esperado: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada, vuelve a iniciar sesión' });
  }

  const { guildId } = req.params;
  const esAdminAqui = payload.adminGuilds.some(g => g.id === guildId);

  if (!esAdminAqui) {
    return res.status(403).json({ error: 'No tienes permisos de administrador en este servidor' });
  }

  req.usuario = payload;
  next();
}

function iniciarApiServer(client, economy, guildConfig, port) {
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

  app.use('/tts', express.static(path.join(__dirname, 'tts_output')));

  const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' }
  });
  app.use('/api/', limitador);

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

  app.get('/api/guild-config/:guildId', verificarAdminDelServidor, async (req, res) => {
    try {
      const { guildId } = req.params;

      const claves = [
        'levelup_channel',
        'events_channel',
        'events_role',
        'guild_levelup_channel',
        'guild_levels_enabled',
        'events_globally_enabled',
        'tts_announce_enabled'
      ];

      const config = {};
      for (const clave of claves) {
        config[clave] = await guildConfig.get(guildId, clave);
      }

      res.json(config);
    } catch (error) {
      console.error('❌ Error en GET /api/guild-config:', error);
      res.status(500).json({ error: 'Error interno al obtener la configuración' });
    }
  });

  app.post('/api/guild-config/:guildId', express.json(), verificarAdminDelServidor, async (req, res) => {
    try {
      const { guildId } = req.params;
      const cambios = req.body;

      const clavesPermitidas = [
        'levelup_channel',
        'events_channel',
        'events_role',
        'guild_levelup_channel',
        'guild_levels_enabled',
        'events_globally_enabled',
        'tts_announce_enabled'
      ];

      const entradas = Object.entries(cambios).filter(([clave]) => clavesPermitidas.includes(clave));

      if (entradas.length === 0) {
        return res.status(400).json({ error: 'No se envió ninguna clave válida para actualizar' });
      }

      for (const [clave, valor] of entradas) {
        if (valor === '') {
          await guildConfig.set(guildId, clave, null); // o el método que tengas para "borrar"
        } else {
          await guildConfig.set(guildId, clave, valor);
        }
      }

      res.json({ ok: true, actualizado: Object.fromEntries(entradas) });
    } catch (error) {
      console.error('❌ Error en POST /api/guild-config:', error);
      res.status(500).json({ error: 'Error interno al guardar la configuración' });
    }
  });

  app.get('/api/my-guilds', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      const token = authHeader.split(' ')[1];
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
      }

      const guildsConPibot = payload.adminGuilds.filter(g => client.guilds.cache.has(g.id));

      res.json({ guilds: guildsConPibot });
    } catch (error) {
      console.error('❌ Error en /api/my-guilds:', error);
      res.status(500).json({ error: 'Error interno al obtener servidores' });
    }
  });

  app.get('/api/guild-info/:guildId', verificarAdminDelServidor, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'El bot ya no está en ese servidor' });
      }

      const canales = guild.channels.cache
        .filter(c => c.type === 0) // 0 = canal de texto
        .map(c => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const roles = guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json({ canales, roles });
    } catch (error) {
      console.error('❌ Error en /api/guild-info:', error);
      res.status(500).json({ error: 'Error interno al obtener info del servidor' });
    }
  });

  app.post('/api/auth/discord', express.json(), async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Falta el code' });

      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error('❌ Error intercambiando code:', errText);
        return res.status(400).json({ error: 'Code inválido o expirado' });
      }

      const tokenData = await tokenResponse.json();

      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const user = await userResponse.json();

      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const allGuilds = await guildsResponse.json();

      const ADMIN_PERM = 0x8;
      const adminGuilds = allGuilds
        .filter(g => (BigInt(g.permissions) & BigInt(ADMIN_PERM)) === BigInt(ADMIN_PERM))
        .map(g => ({ id: g.id, name: g.name, icon: g.icon }));

      const ourToken = jwt.sign(
        { userId: user.id, username: user.username, avatar: user.avatar, adminGuilds },
        process.env.JWT_SECRET,
        { expiresIn: '3d' }
      );

      res.json({ token: ourToken, user: { id: user.id, username: user.username, displayName: user.global_name || user.username, avatar: user.avatar } });
    } catch (error) {
      console.error('❌ Error en /api/auth/discord:', error);
      res.status(500).json({ error: 'Error interno en el login' });
    }
  });

  app.listen(port, async () => {
      console.log(`🌐 API de Pibot corriendo en el puerto ${port} (caché + rate limit activos)`);

      if (process.env.ENABLE_NGROK === 'true') {
        try {
          const ngrok = require('@ngrok/ngrok');
          const listener = await ngrok.connect({
            addr: port,
            authtoken: process.env.NGROK_AUTHTOKEN,
            domain: process.env.NGROK_DOMAIN,
          });
          console.log(`🔒 Túnel HTTPS activo en: ${listener.url()}`);
        } catch (err) {
          console.error('❌ No se pudo iniciar el túnel de ngrok:', err.message);
        }
      } else {
        console.log('ℹ️ Ngrok desactivado (modo local)');
      }
  });
}

module.exports = { iniciarApiServer };