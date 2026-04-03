// ============================================================
// ROB-MINIGAMES.JS — Sistema de Minijuegos de Robo
// 105 minijuegos en 7 categorías temáticas
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class RobMinigames {
    constructor() {
        this.groqApiKey = process.env.GROQ_API_KEY;
        this.categories = {
            HACKEO: 'hackeo',
            SIGILO: 'sigilo',
            CERRADURAS: 'cerraduras',
            SOCIAL: 'social',
            EJECUCION: 'ejecucion',
            CAOS: 'caos',
        };

        // Tiempos base por dificultad (en ms)
        this.timings = {
            easy:   { time: 25000, label: '25s' },
            normal: { time: 18000, label: '18s' },
            hard:   { time: 12000, label: '12s' },
        };
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Calcula dificultad según eficiencia de clicks (0–1)
    getDifficulty(clickEfficiency) {
        if (clickEfficiency === 0) return null;           // 0 clicks → fallo directo
        if (clickEfficiency >= 0.7) return 'easy';
        if (clickEfficiency >= 0.3) return 'normal';
        return 'hard';
    }

    // Genera un minijuego aleatorio del pool
    getRandomMinigame(targetUsername, difficulty) {
        const all = this.getAllMinigames(targetUsername);
        const minigame = all[Math.floor(Math.random() * all.length)];
        return { ...minigame, difficulty };
    }

    // Tiempo de respuesta ajustado
    getTimeForDifficulty(difficulty) {
        return this.timings[difficulty] || this.timings.normal;
    }

    // Construye el embed cinematográfico del minigame
    buildEmbed(minigame, targetUsername, difficulty) {
        const timing = this.getTimeForDifficulty(difficulty);
        const now = new Date();
        const utcMinus5 = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const hour = String(utcMinus5.getUTCHours()).padStart(2, '0') + ':' + String(utcMinus5.getUTCMinutes()).padStart(2, '0');

        const diffLabel = { easy: '🟢 Fácil', normal: '🟡 Normal', hard: '🔴 Difícil' }[difficulty];

        return new EmbedBuilder()
            .setColor(minigame.color || '#1a1a2e')
            .setTitle(`${minigame.emoji} ${minigame.title}`)
            .setDescription(
                `**🌃 ${hour} — Bóveda de @${targetUsername}**\n\n` +
                `*${minigame.narrative}*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `${minigame.question}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━`
            )
            .setFooter({ text: `⏱️ ${timing.label} • Dificultad: ${diffLabel}` });
    }

    // Construye los botones de opciones
    buildButtons(minigame, gameId) {
        const shuffled = this.shuffle(minigame.options);
        const buttons = shuffled.map((opt, i) =>
            new ButtonBuilder()
                .setCustomId(`robmg_${gameId}_${opt.value}`)
                .setLabel(opt.label.length > 80 ? opt.label.substring(0, 77) + '...' : opt.label)
                .setStyle(ButtonStyle.Secondary)
        );

        const rows = [];
        for (let i = 0; i < buttons.length; i += 4) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
        }
        return rows;
    }

    async generateAIMinigame(targetUsername, difficulty) {
        if (!this.groqApiKey) return null;

        const categories = [
            { name: 'hackeo', emoji: '💻', color: '#00ff88', desc: 'hackear sistemas y tecnología' },
            { name: 'sigilo', emoji: '🤫', color: '#4a0080', desc: 'moverse sin ser detectado' },
            { name: 'cerraduras', emoji: '🔓', color: '#ff6600', desc: 'abrir cerraduras y cajas fuertes' },
            { name: 'social', emoji: '🎭', color: '#cc0044', desc: 'engañar y manipular personas' },
            { name: 'ejecucion', emoji: '💼', color: '#884400', desc: 'ejecutar y escapar con el botín' },
            { name: 'caos', emoji: '🎲', color: '#5500aa', desc: 'situaciones imprevistas del robo' },
        ];

        const cat = categories[Math.floor(Math.random() * categories.length)];

        const cleanTarget = targetUsername.split('#')[0].trim();

        const prompt = `Eres un generador de minijuegos de robo. Genera uno siguiendo EXACTAMENTE este ejemplo:

        EJEMPLO:
        {"title":"Bypass de Cámara","narrative":"Las cámaras de ${cleanTarget} tienen un punto ciego justo en la esquina norte. Tienes 10 segundos.","question":"**¿Qué haces para aprovechar el punto ciego?**","correct":"Te mueves pegado a la pared norte en silencio","wrong1":"Corres directo a la caja fuerte","wrong2":"Esperas a que el guardia se distraiga","wrong3":"Lanzas algo para romper la cámara"}

        REGLAS:
        - "narrative" habla de la bóveda/guardia/sistema de ${cleanTarget} en tercera persona, NUNCA digas quién roba
        - El jugador es "tú" implícito — usa frases como "Tienes X segundos", "El sistema de ${cleanTarget}...", "Los guardias de ${cleanTarget}..."
        - Categoría: ${cat.desc}
        - Las opciones son frases completas, NUNCA letras sueltas
        - Las opciones deben tener MÁXIMO 60 caracteres cada una, sé conciso
        - Dificultad "${difficulty}": ${difficulty === 'easy' ? 'pregunta obvia con respuesta claramente correcta, opciones muy distintas entre sí' : difficulty === 'normal' ? 'pregunta moderada, opciones algo parecidas pero una claramente mejor' : 'pregunta ambigua y difícil, opciones muy similares y confusas, solo una es correcta'}
        - Responde SOLO con JSON, sin texto extra ni markdown`;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    max_tokens: 400,
                    temperature: 0.9,
                    messages: [
                        { role: 'system', content: 'Eres un generador de minijuegos de robo para Discord. Respondes SOLO con JSON válido, sin texto adicional ni markdown. Todo en español.' },
                        { role: 'user', content: prompt }
                    ]
                }),
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) return null;

            const data = await response.json();
            const raw = data.choices?.[0]?.message?.content?.trim();
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed.title || !parsed.question || !parsed.correct) return null;

            console.log(`[RobMG AI] 📝 ${parsed.title}`);
            console.log(`[RobMG AI] ❓ ${parsed.question}`);
            console.log(`[RobMG AI] ✅ ${parsed.correct}`);

            // Construir en formato compatible con buildEmbed/buildButtons
            return {
                id: `ai_${Date.now()}`,
                category: cat.name,
                emoji: cat.emoji,
                color: cat.color,
                title: parsed.title,
                narrative: parsed.narrative || `La bóveda de @${targetUsername} está esperando...`,
                question: parsed.question,
                options: this.shuffle([
                    { label: parsed.correct, value: 'correct' },
                    { label: parsed.wrong1, value: 'wrong1' },
                    { label: parsed.wrong2, value: 'wrong2' },
                    { label: parsed.wrong3, value: 'wrong3' },
                ]),
                correct: 'correct',
                isAI: true,
            };

        } catch (err) {
            console.log(`[RobMG] AI falló (${err.message}), usando pool predefinido`);
            return null;
        }
    }

    // ─────────────────────────────────────────────
    // POOL COMPLETO DE MINIJUEGOS (105 total)
    // ─────────────────────────────────────────────
    getAllMinigames(t) { // t = targetUsername
        return [
            {
                id: 'hack_01', category: 'hackeo', emoji: '💻', color: '#00ff88',
                title: 'Bypass de Firewall',
                narrative: `El firewall de @${t} tiene una brecha pequeña. Necesitas inyectar el comando correcto antes de que se cierre.`,
                question: '**¿Cuál es el comando para hacer bypass del firewall?**',
                options: [
                    { label: 'sudo iptables -F', value: 'correct' },
                    { label: 'ping 192.168.1.1', value: 'wrong1' },
                    { label: 'netstat -an', value: 'wrong2' },
                    { label: 'chmod 777 /', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_02', category: 'hackeo', emoji: '🔑', color: '#00ff88',
                title: 'Descifrar la Contraseña',
                narrative: `El sistema de @${t} usa encriptación básica. Encontraste el hash: **5f4dcc3b5aa765d61d8327deb882cf99**. ¿A qué corresponde?`,
                question: '**¿Cuál es el texto original del hash MD5?**',
                options: [
                    { label: 'password', value: 'correct' },
                    { label: 'admin123', value: 'wrong1' },
                    { label: 'qwerty', value: 'wrong2' },
                    { label: '123456', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_03', category: 'hackeo', emoji: '📡', color: '#00ff88',
                title: 'Interceptar la Señal',
                narrative: `Estás en un ataque man-in-the-middle a la red de @${t}. Tienes que identificar el paquete sospechoso antes de que llegue al servidor.`,
                question: '**¿Qué tipo de ataque estás ejecutando?**',
                options: [
                    { label: 'ARP Spoofing', value: 'correct' },
                    { label: 'SQL Injection', value: 'wrong1' },
                    { label: 'DDoS', value: 'wrong2' },
                    { label: 'Phishing', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_04', category: 'hackeo', emoji: '🧬', color: '#00ff88',
                title: 'Secuencia de Autenticación',
                narrative: `El sistema de @${t} pide autenticación en dos pasos. Interceptaste la secuencia: el primer paso fue **TOKEN-A**. ¿Cuál es el segundo?`,
                question: '**Completa la secuencia: TOKEN-A → ___**',
                options: [
                    { label: 'TOKEN-B', value: 'correct' },
                    { label: 'TOKEN-C', value: 'wrong1' },
                    { label: 'TOKEN-1', value: 'wrong2' },
                    { label: 'TOKEN-X', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_05', category: 'hackeo', emoji: '🌐', color: '#00ff88',
                title: 'Escaneo de Puertos',
                narrative: `Tu escaneo nmap en el sistema de @${t} encontró 4 puertos abiertos. Uno de ellos es el acceso al servidor de base de datos. ¿Cuál es?`,
                question: '**¿Qué puerto usa MySQL por defecto?**',
                options: [
                    { label: '3306', value: 'correct' },
                    { label: '8080', value: 'wrong1' },
                    { label: '443', value: 'wrong2' },
                    { label: '22', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_06', category: 'hackeo', emoji: '🕳️', color: '#00ff88',
                title: 'Inyección SQL',
                narrative: `El login de @${t} tiene una vulnerabilidad. Necesitas el payload correcto para saltarte la autenticación.`,
                question: "**¿Cuál payload te da acceso sin contraseña?**",
                options: [
                    { label: "' OR '1'='1", value: 'correct' },
                    { label: "SELECT * FROM users", value: 'wrong1' },
                    { label: "DROP TABLE users", value: 'wrong2' },
                    { label: "INSERT INTO admin", value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_07', category: 'hackeo', emoji: '🔐', color: '#00ff88',
                title: 'Romper el Cifrado',
                narrative: `El mensaje cifrado de @${t} dice: **KHOOR ZRUOG**. Usaron un cifrado clásico de sustitución.`,
                question: '**¿Qué cifrado usaron y qué dice el mensaje?**',
                options: [
                    { label: 'César +3: HELLO WORLD', value: 'correct' },
                    { label: 'ROT13: URYYB JBEYQ', value: 'wrong1' },
                    { label: 'Base64: HELLO', value: 'wrong2' },
                    { label: 'AES: ERROR', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_08', category: 'hackeo', emoji: '🖧', color: '#00ff88',
                title: 'IP del Servidor',
                narrative: `Rastreaste la IP interna del servidor de @${t}. Está en un rango privado. ¿Cuál de estas es una IP privada válida?`,
                question: '**¿Cuál es una dirección IP privada?**',
                options: [
                    { label: '192.168.1.100', value: 'correct' },
                    { label: '8.8.8.8', value: 'wrong1' },
                    { label: '172.217.0.0', value: 'wrong2' },
                    { label: '54.239.28.85', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_09', category: 'hackeo', emoji: '⚡', color: '#00ff88',
                title: 'Exploit Zero-Day',
                narrative: `Encontraste una vulnerabilidad desconocida en el sistema de @${t}. Tu equipo la llama "zero-day". ¿Qué significa exactamente?`,
                question: '**¿Qué es un exploit zero-day?**',
                options: [
                    { label: 'Vulnerabilidad sin parche conocido', value: 'correct' },
                    { label: 'Ataque que dura 0 días', value: 'wrong1' },
                    { label: 'Virus que se activa a medianoche', value: 'wrong2' },
                    { label: 'Hack que no deja rastros', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_10', category: 'hackeo', emoji: '🧩', color: '#00ff88',
                title: 'Decodificar Base64',
                narrative: `En los archivos de @${t} encontraste texto codificado: **aGFja2Vk**. Tu decodificador espera el resultado correcto.`,
                question: '**¿Qué dice el texto en Base64?**',
                options: [
                    { label: 'hacked', value: 'correct' },
                    { label: 'secret', value: 'wrong1' },
                    { label: 'locked', value: 'wrong2' },
                    { label: 'bypass', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_11', category: 'hackeo', emoji: '🤖', color: '#00ff88',
                title: 'Botnet Activada',
                narrative: `Tomaste control de 3 bots para atacar el servidor de @${t}. Necesitas elegir el tipo de ataque más efectivo para saturarlo.`,
                question: '**¿Qué ataque usa múltiples IPs para saturar un servidor?**',
                options: [
                    { label: 'DDoS', value: 'correct' },
                    { label: 'Brute Force', value: 'wrong1' },
                    { label: 'Keylogger', value: 'wrong2' },
                    { label: 'Ransomware', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_12', category: 'hackeo', emoji: '🕵️', color: '#00ff88',
                title: 'Rastrear la Sesión',
                narrative: `La sesión de @${t} sigue activa. Interceptaste su token de autenticación. ¿Qué tipo de ataque estás ejecutando?`,
                question: '**¿Cómo se llama reutilizar un token de sesión robado?**',
                options: [
                    { label: 'Session Hijacking', value: 'correct' },
                    { label: 'Cookie Cracking', value: 'wrong1' },
                    { label: 'Token Flooding', value: 'wrong2' },
                    { label: 'Auth Bypass', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_13', category: 'hackeo', emoji: '💾', color: '#00ff88',
                title: 'Memoria del Sistema',
                narrative: `Tu malware ya está dentro del sistema de @${t}. Para extraer datos sin dejar rastro, necesitas operar desde la memoria RAM.`,
                question: '**¿Cómo se llama el malware que opera solo en RAM sin tocar el disco?**',
                options: [
                    { label: 'Fileless Malware', value: 'correct' },
                    { label: 'Trojan Horse', value: 'wrong1' },
                    { label: 'Worm', value: 'wrong2' },
                    { label: 'Rootkit', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_14', category: 'hackeo', emoji: '🔓', color: '#00ff88',
                title: 'Acceso Root',
                narrative: `Conseguiste acceso limitado al sistema de @${t}. Necesitas escalar privilegios para llegar a los archivos de la bóveda.`,
                question: '**¿Cómo se llama la técnica de ganar permisos de administrador?**',
                options: [
                    { label: 'Privilege Escalation', value: 'correct' },
                    { label: 'Root Injection', value: 'wrong1' },
                    { label: 'Admin Flood', value: 'wrong2' },
                    { label: 'Sudo Exploit', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'hack_15', category: 'hackeo', emoji: '🌑', color: '#00ff88',
                title: 'Darknet Route',
                narrative: `Para escapar sin ser rastreado después de robar a @${t}, necesitas enrutar tu conexión correctamente.`,
                question: '**¿Qué herramienta usas para anonimizar tu conexión en capas?**',
                options: [
                    { label: 'Tor (The Onion Router)', value: 'correct' },
                    { label: 'VPN gratuita', value: 'wrong1' },
                    { label: 'Proxy HTTP', value: 'wrong2' },
                    { label: 'Incógnito del navegador', value: 'wrong3' },
                ],
                correct: 'correct',
            },

            // ══════════════════════════════════════════════
            // 🤫 CATEGORÍA 2: SIGILO (15 minijuegos)
            // ══════════════════════════════════════════════
            {
                id: 'sig_01', category: 'sigilo', emoji: '🤫', color: '#4a0080',
                title: 'Sincronizar con las Cámaras',
                narrative: `Las cámaras de @${t} tienen un ciclo de rotación. Tienes una ventana de exactamente 4 segundos. ¿En qué momento te mueves?`,
                question: '**¿Cuándo actúas?**',
                options: [
                    { label: 'Justo cuando la cámara gira', value: 'correct' },
                    { label: 'Antes de que gire', value: 'wrong1' },
                    { label: 'Cuando está de frente', value: 'wrong2' },
                    { label: 'Después de que vuelve', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_02', category: 'sigilo', emoji: '🔦', color: '#4a0080',
                title: 'Apagar el Sensor',
                narrative: `El sensor de movimiento de @${t} tiene un cable de alimentación. Son 4 cables de colores. Solo uno lo apaga sin disparar la alarma.`,
                question: '**¿Cuál cable cortas?**',
                options: [
                    { label: 'El cable azul', value: 'correct' },
                    { label: 'El cable rojo', value: 'wrong1' },
                    { label: 'El cable amarillo', value: 'wrong2' },
                    { label: 'El cable negro', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_03', category: 'sigilo', emoji: '🥷', color: '#4a0080',
                title: 'Paso Silencioso',
                narrative: `El guardia de @${t} tiene un patrón de patrulla fijo. Va de punto A → B → C → A. Acabas de verlo llegar a B.`,
                question: '**¿Hacia dónde va ahora?**',
                options: [
                    { label: 'Hacia C', value: 'correct' },
                    { label: 'De vuelta a A', value: 'wrong1' },
                    { label: 'Se queda en B', value: 'wrong2' },
                    { label: 'Va al punto D', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_04', category: 'sigilo', emoji: '👁️', color: '#4a0080',
                title: 'Campo Visual del Guardia',
                narrative: `El guardia de @${t} tiene un ángulo de visión de 90°. Está mirando al norte. ¿Desde qué dirección puedes acercarte sin ser visto?`,
                question: '**¿Por dónde te mueves?**',
                options: [
                    { label: 'Por el sur', value: 'correct' },
                    { label: 'Por el norte', value: 'wrong1' },
                    { label: 'Por el noreste', value: 'wrong2' },
                    { label: 'Por el noroeste', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_05', category: 'sigilo', emoji: '🐈', color: '#4a0080',
                title: 'Distracción Perfecta',
                narrative: `Para entrar a la bóveda de @${t} necesitas distraer al guardia de la puerta. Tienes: una moneda, un celular viejo y un ladrillo.`,
                question: '**¿Qué lanzas para crear la distracción más creíble?**',
                options: [
                    { label: 'La moneda — hace poco ruido, no levanta sospecha', value: 'correct' },
                    { label: 'El celular — hace mucho ruido', value: 'wrong1' },
                    { label: 'El ladrillo — demasiado obvio', value: 'wrong2' },
                    { label: 'Nada — esperas', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_06', category: 'sigilo', emoji: '🌫️', color: '#4a0080',
                title: 'Cobertura de Humo',
                narrative: `Activaste una granada de humo en el pasillo de @${t}. Tienes 8 segundos antes de que el humo se disipe. ¿Qué haces primero?`,
                question: '**¿Cuál es tu prioridad inmediata?**',
                options: [
                    { label: 'Llegar a la caja fuerte', value: 'correct' },
                    { label: 'Neutralizar al guardia', value: 'wrong1' },
                    { label: 'Desactivar las cámaras', value: 'wrong2' },
                    { label: 'Buscar la salida', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_07', category: 'sigilo', emoji: '🪞', color: '#4a0080',
                title: 'Reflejo en el Espejo',
                narrative: `Hay un espejo en la esquina del pasillo de @${t}. El guardia está a 10m. Puedes ver su reflejo pero él no te ve a ti... todavía.`,
                question: '**¿Cuántos segundos tienes antes de que llegue a tu posición caminando normal?**',
                options: [
                    { label: 'Unos 7 segundos', value: 'correct' },
                    { label: 'Unos 2 segundos', value: 'wrong1' },
                    { label: 'Unos 20 segundos', value: 'wrong2' },
                    { label: 'Unos 1 minuto', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_08', category: 'sigilo', emoji: '🔕', color: '#4a0080',
                title: 'Silenciar la Alarma',
                narrative: `La alarma de @${t} está a punto de activarse. Tienes el panel frente a ti. Hay 3 botones: RESET, SILENCE y DISABLE.`,
                question: '**¿Cuál presionas para que la alarma no notifique a nadie?**',
                options: [
                    { label: 'DISABLE — la desactiva completamente', value: 'correct' },
                    { label: 'SILENCE — solo apaga el sonido', value: 'wrong1' },
                    { label: 'RESET — reinicia y sigue activa', value: 'wrong2' },
                    { label: 'Ninguno — huyes', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_09', category: 'sigilo', emoji: '🎭', color: '#4a0080',
                title: 'Cambio de Ropa',
                narrative: `Te encontraste con un guardia de @${t} cara a cara. Llevas el uniforme de mantenimiento. El guardia te mira sospechoso.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: 'Actúas normal y dices que vienes a revisar el aire acondicionado', value: 'correct' },
                    { label: 'Corres en dirección contraria', value: 'wrong1' },
                    { label: 'Lo atacas', value: 'wrong2' },
                    { label: 'Te esconces detrás de él', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_10', category: 'sigilo', emoji: '🌑', color: '#4a0080',
                title: 'Apagón Controlado',
                narrative: `Cortaste la energía del edificio de @${t}. Hay luces de emergencia con batería. ¿Cuánto tiempo tienes antes de que activen el generador?`,
                question: '**¿Cuánto duran normalmente las baterías de emergencia?**',
                options: [
                    { label: '90 minutos aprox.', value: 'correct' },
                    { label: '5 minutos', value: 'wrong1' },
                    { label: '8 horas', value: 'wrong2' },
                    { label: '30 segundos', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_11', category: 'sigilo', emoji: '🎯', color: '#4a0080',
                title: 'El Punto Ciego',
                narrative: `Analizaste el plano del edificio de @${t}. Cada cámara tiene un ángulo muerto. Necesitas identificar la ruta con menos exposición.`,
                question: '**¿Qué ruta eliges?**',
                options: [
                    { label: 'La que pasa por las esquinas', value: 'correct' },
                    { label: 'La más corta en línea recta', value: 'wrong1' },
                    { label: 'La que tiene más luces', value: 'wrong2' },
                    { label: 'La entrada principal', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_12', category: 'sigilo', emoji: '🧤', color: '#4a0080',
                title: 'Sin Huellas',
                narrative: `Antes de tocar la caja fuerte de @${t}, tu equipo te recuerda algo crucial para no dejar evidencia.`,
                question: '**¿Qué te pusiste antes de entrar?**',
                options: [
                    { label: 'Guantes de látex', value: 'correct' },
                    { label: 'Guantes de cuero', value: 'wrong1' },
                    { label: 'Guantes de boxeo', value: 'wrong2' },
                    { label: 'Nada, confías en la suerte', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_13', category: 'sigilo', emoji: '🚪', color: '#4a0080',
                title: 'Puerta de Emergencia',
                narrative: `La ruta de salida normal está bloqueada por el guardia de @${t}. Ves una puerta marcada como salida de emergencia.`,
                question: '**¿Cuál es el problema de usarla?**',
                options: [
                    { label: 'Activa una alarma sonora al abrirse', value: 'correct' },
                    { label: 'Está sellada con cemento', value: 'wrong1' },
                    { label: 'Lleva de vuelta adentro', value: 'wrong2' },
                    { label: 'Requiere código de 12 dígitos', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_14', category: 'sigilo', emoji: '🌡️', color: '#4a0080',
                title: 'Sensor Térmico',
                narrative: `La bóveda de @${t} tiene detectores de calor corporal. Tu temperatura normal activa la alarma. Necesitas ocultarla.`,
                question: '**¿Qué método es más efectivo para engañar un sensor térmico?**',
                options: [
                    { label: 'Traje aislante térmico', value: 'correct' },
                    { label: 'Mucho desodorante', value: 'wrong1' },
                    { label: 'Correr muy rápido', value: 'wrong2' },
                    { label: 'Contener la respiración', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'sig_15', category: 'sigilo', emoji: '🐾', color: '#4a0080',
                title: 'Rastrear al Guardia',
                narrative: `El guardia de @${t} acaba de dejar sus huellas en el polvo del pasillo. El patrón de sus pasos te da información vital.`,
                question: '**¿Qué puedes deducir de las huellas?**',
                options: [
                    { label: 'Su velocidad y dirección de movimiento', value: 'correct' },
                    { label: 'Su fecha de nacimiento', value: 'wrong1' },
                    { label: 'Su número de guardia', value: 'wrong2' },
                    { label: 'Cuánto dinero tiene @' + t, value: 'wrong3' },
                ],
                correct: 'correct',
            },

            // ══════════════════════════════════════════════
            // 🗝️ CATEGORÍA 3: CERRADURAS (15 minijuegos)
            // ══════════════════════════════════════════════
            {
                id: 'cerr_01', category: 'cerraduras', emoji: '🔓', color: '#ff6600',
                title: 'Combinación de la Caja Fuerte',
                narrative: `La caja fuerte de @${t} tiene una combinación de 3 números. Espiaste cuando la abrió: giró derecha, izquierda, derecha.`,
                question: '**¿Qué secuencia usas para abrirla?**',
                options: [
                    { label: 'Derecha → Izquierda → Derecha', value: 'correct' },
                    { label: 'Izquierda → Derecha → Izquierda', value: 'wrong1' },
                    { label: 'Derecha → Derecha → Izquierda', value: 'wrong2' },
                    { label: 'Izquierda → Izquierda → Derecha', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_02', category: 'cerraduras', emoji: '🔑', color: '#ff6600',
                title: 'Elegir la Llave Correcta',
                narrative: `Robaste el llavero de @${t}. Tiene 5 llaves similares. Solo una abre la bóveda principal. La pista: es la más desgastada.`,
                question: '**¿Cuál llave eliges?**',
                options: [
                    { label: 'La más gastada — es la más usada', value: 'correct' },
                    { label: 'La más nueva — parece especial', value: 'wrong1' },
                    { label: 'La más grande', value: 'wrong2' },
                    { label: 'La de color dorado', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_03', category: 'cerraduras', emoji: '🧲', color: '#ff6600',
                title: 'Cerradura Magnética',
                narrative: `La puerta de @${t} usa un sistema magnético RFID. Tienes un lector de tarjetas clonado. ¿Qué distancia necesitas para clonar la señal?`,
                question: '**¿A qué distancia funciona un lector RFID estándar?**',
                options: [
                    { label: 'Menos de 10 cm', value: 'correct' },
                    { label: 'Hasta 5 metros', value: 'wrong1' },
                    { label: 'Exactamente 1 metro', value: 'wrong2' },
                    { label: 'Solo en contacto directo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_04', category: 'cerraduras', emoji: '🎰', color: '#ff6600',
                title: 'Descifrar el PIN',
                narrative: `El teclado de la bóveda de @${t} tiene marcas de grasa en solo 4 teclas: 1, 3, 5, 7. El PIN tiene 4 dígitos sin repetir.`,
                question: '**¿Cuántas combinaciones posibles hay?**',
                options: [
                    { label: '24 combinaciones', value: 'correct' },
                    { label: '4 combinaciones', value: 'wrong1' },
                    { label: '16 combinaciones', value: 'wrong2' },
                    { label: '256 combinaciones', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_05', category: 'cerraduras', emoji: '🪝', color: '#ff6600',
                title: 'Ganzúa Maestra',
                narrative: `Tienes una ganzúa frente a la cerradura de @${t}. Es de 5 pines. Empiezas a sondear. ¿Qué técnica usas?`,
                question: '**¿Cuál es la técnica básica para abrir una cerradura de pines con ganzúa?**',
                options: [
                    { label: 'Tensión + empuje de pines uno a uno', value: 'correct' },
                    { label: 'Girar con fuerza bruta', value: 'wrong1' },
                    { label: 'Insertar y agitar', value: 'wrong2' },
                    { label: 'Golpear con el mango', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_06', category: 'cerraduras', emoji: '💎', color: '#ff6600',
                title: 'Caja Fuerte Biométrica',
                narrative: `La caja de @${t} usa huella dactilar. Encontraste su vaso con su huella. ¿Cómo la usas para abrir la caja?`,
                question: '**¿Qué método funciona para replicar una huella del mundo real?**',
                options: [
                    { label: 'Polvo grafito + cinta adhesiva sobre lámina de silicona', value: 'correct' },
                    { label: 'Foto con el celular', value: 'wrong1' },
                    { label: 'Escanear con rayos X', value: 'wrong2' },
                    { label: 'Cortar el dedo (jamás)', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_07', category: 'cerraduras', emoji: '🔢', color: '#ff6600',
                title: 'Código de Colores',
                narrative: `El candado digital de @${t} usa colores en vez de números: 🔴🔵🟡🟢. Solo en un orden específico funciona.`,
                question: '**Viste que @' + t + ' usó: primero azul, luego rojo, luego verde. ¿Cuál es el orden?**',
                options: [
                    { label: '🔵 → 🔴 → 🟢', value: 'correct' },
                    { label: '🔴 → 🔵 → 🟢', value: 'wrong1' },
                    { label: '🟢 → 🔵 → 🔴', value: 'wrong2' },
                    { label: '🔴 → 🟢 → 🔵', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_08', category: 'cerraduras', emoji: '🏦', color: '#ff6600',
                title: 'Caja Fuerte de Tiempo',
                narrative: `La bóveda de @${t} tiene un temporizador de seguridad. Solo se puede abrir en una ventana de 2 minutos cada hora exacta.`,
                question: '**Son las 14:58. ¿Cuánto tiempo esperas?**',
                options: [
                    { label: '2 minutos para las 15:00', value: 'correct' },
                    { label: 'Abres ahora, está en la ventana', value: 'wrong1' },
                    { label: 'Esperas 1 hora completa', value: 'wrong2' },
                    { label: 'A las 14:59 empieza la ventana', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_09', category: 'cerraduras', emoji: '🔊', color: '#ff6600',
                title: 'Cerradura Acústica',
                narrative: `El ladrón legendario de tu gremio te enseñó a escuchar la caja fuerte de @${t}. Cuando oyes 3 clics distintos, llegaste al código.`,
                question: '**¿Qué herramienta usas para amplificar los sonidos de la cerradura?**',
                options: [
                    { label: 'Estetoscopio', value: 'correct' },
                    { label: 'Micrófono de karaoke', value: 'wrong1' },
                    { label: 'Auriculares bluetooth', value: 'wrong2' },
                    { label: 'Lupa con amplificador', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_10', category: 'cerraduras', emoji: '❄️', color: '#ff6600',
                title: 'Candado Congelado',
                narrative: `El candado exterior de la bóveda de @${t} está oxidado. Tienes nitrógeno líquido en spray. ¿Para qué lo usas?`,
                question: '**¿Qué hace el nitrógeno líquido a un candado?**',
                options: [
                    { label: 'Lo hace quebradizo para romperlo de un golpe', value: 'correct' },
                    { label: 'Lo lubrica para que gire más fácil', value: 'wrong1' },
                    { label: 'Derrite el metal', value: 'wrong2' },
                    { label: 'Activa el sistema magnético', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_11', category: 'cerraduras', emoji: '📐', color: '#ff6600',
                title: 'Medida Exacta',
                narrative: `La ranura de la cerradura de @${t} es exactamente de 4mm. Tienes ganzúas de 3mm, 4mm y 5mm.`,
                question: '**¿Cuál usas?**',
                options: [
                    { label: '4mm — encaja perfectamente', value: 'correct' },
                    { label: '3mm — más delgada, más fácil de mover', value: 'wrong1' },
                    { label: '5mm — con presión entra', value: 'wrong2' },
                    { label: 'Todas — prueba y error', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_12', category: 'cerraduras', emoji: '🧊', color: '#ff6600',
                title: 'Llave de Hielo',
                narrative: `Un viejo truco: crear una llave de hielo con la impresión correcta puede abrir ciertas cerraduras de @${t}. ¿Cuál es el problema?`,
                question: '**¿Por qué las llaves de hielo no funcionan siempre?**',
                options: [
                    { label: 'Se derriten con el calor de la mano al usarla', value: 'correct' },
                    { label: 'Son demasiado transparentes', value: 'wrong1' },
                    { label: 'Hacen demasiado ruido', value: 'wrong2' },
                    { label: 'Las cerraduras detectan el frío', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_13', category: 'cerraduras', emoji: '🪟', color: '#ff6600',
                title: 'Ventana de Acceso',
                narrative: `La ventana lateral del edificio de @${t} tiene un pestillo interno. Con una varilla delgada puedes girarlo desde afuera.`,
                question: '**¿Qué dirección giras el pestillo?**',
                options: [
                    { label: 'En sentido horario — abre hacia la derecha', value: 'correct' },
                    { label: 'Antihorario siempre', value: 'wrong1' },
                    { label: 'De arriba hacia abajo', value: 'wrong2' },
                    { label: 'No importa la dirección', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_14', category: 'cerraduras', emoji: '🔮', color: '#ff6600',
                title: 'Código Maestro',
                narrative: `Todos los sistemas de @${t} tienen un código maestro de fábrica que nunca cambiaron. Los códigos de fábrica más comunes son conocidos.`,
                question: '**¿Cuál es el código de fábrica más común en sistemas de seguridad?**',
                options: [
                    { label: '0000 o 1234', value: 'correct' },
                    { label: '9876 o 4321', value: 'wrong1' },
                    { label: '1111 o 2222', value: 'wrong2' },
                    { label: 'El fabricante nunca pone códigos', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'cerr_15', category: 'cerraduras', emoji: '🧱', color: '#ff6600',
                title: 'La Pared Falsa',
                narrative: `Investigando la bóveda de @${t}, descubriste que una de las paredes es hueca. Hay una caja fuerte oculta detrás del panel.`,
                question: '**¿Cómo detectas una pared hueca?**',
                options: [
                    { label: 'Golpeándola — el sonido es más hueco', value: 'correct' },
                    { label: 'Mirándola con cuidado', value: 'wrong1' },
                    { label: 'Oliéndola', value: 'wrong2' },
                    { label: 'Preguntándole al guardia', value: 'wrong3' },
                ],
                correct: 'correct',
            },

            // ══════════════════════════════════════════════
            // 🎭 CATEGORÍA 4: SOCIAL (15 minijuegos)
            // ══════════════════════════════════════════════
            {
                id: 'soc_01', category: 'social', emoji: '🎭', color: '#cc0044',
                title: 'Convencer al Guardia',
                narrative: `El guardia en la entrada de @${t} te bloquea el paso. Llevas identificación falsa de técnico eléctrico. Él parece desconfiado.`,
                question: '**¿Qué le dices?**',
                options: [
                    { label: '"Vengo a revisar el panel eléctrico, hay un reporte de falla"', value: 'correct' },
                    { label: '"Soy amigo de ' + t + ', déjame pasar"', value: 'wrong1' },
                    { label: '"Tengo una orden judicial"', value: 'wrong2' },
                    { label: '"¿Cuánto quieres para dejarme pasar?"', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_02', category: 'social', emoji: '🤥', color: '#cc0044',
                title: 'La Excusa Perfecta',
                narrative: `Te encontraron en un área restringida de @${t}. El supervisor se aproxima. Necesitas una excusa creíble y rápida.`,
                question: '**¿Qué dices?**',
                options: [
                    { label: '"Estaba buscando el baño, me perdí"', value: 'correct' },
                    { label: '"Soy el dueño del edificio"', value: 'wrong1' },
                    { label: '"Tengo permiso, solo no lo traigo"', value: 'wrong2' },
                    { label: '"No hablo español"', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_03', category: 'social', emoji: '💰', color: '#cc0044',
                title: 'El Soborno',
                narrative: `El guardia de @${t} está claramente mal pagado. Tu informante dice que acepta sobornos. Tienes que ofrecer la cantidad exacta: ni muy poco ni tanto que lo asuste.`,
                question: '**¿Cuánto ofreces?**',
                options: [
                    { label: 'Su sueldo de 1 semana — suficiente para tentar', value: 'correct' },
                    { label: '5π-b$ — demasiado poco', value: 'wrong1' },
                    { label: '10 millones π-b$ — lo asusta', value: 'wrong2' },
                    { label: 'Nada, intentas convencerlo con palabras', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_04', category: 'social', emoji: '🕵️', color: '#cc0044',
                title: 'Identificar al Informante',
                narrative: `Dentro del equipo de @${t} hay alguien que te está vendiendo información. Recibiste 3 mensajes anónimos. Uno de ellos miente. Los otros dos son el mismo informante.`,
                question: '**¿Cómo detectas al que miente?**',
                options: [
                    { label: 'El que da información que puedes verificar y es falsa', value: 'correct' },
                    { label: 'El que escribe más rápido', value: 'wrong1' },
                    { label: 'El que usa más emojis', value: 'wrong2' },
                    { label: 'El más corto', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_05', category: 'social', emoji: '🎩', color: '#cc0044',
                title: 'Ingeniería Social',
                narrative: `Llamaste al número de soporte técnico de @${t} haciéndote pasar por el administrador del sistema. Te piden verificación de identidad.`,
                question: '**¿Qué técnica estás usando?**',
                options: [
                    { label: 'Pretexting (crear escenario falso)', value: 'correct' },
                    { label: 'Phishing (correo falso)', value: 'wrong1' },
                    { label: 'Baiting (carnada física)', value: 'wrong2' },
                    { label: 'Tailgating (seguir a alguien)', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_06', category: 'social', emoji: '📞', color: '#cc0044',
                title: 'La Llamada Urgente',
                narrative: `Llamas a @${t} directamente haciéndote pasar por su banco. Dices que su cuenta fue comprometida. ¿Qué quieres lograr?`,
                question: '**¿Cuál es tu objetivo real en esta llamada?**',
                options: [
                    { label: 'Que te dé su PIN de seguridad voluntariamente', value: 'correct' },
                    { label: 'Distraerlo mientras tu equipo roba', value: 'wrong1' },
                    { label: 'Pedirle que salga de casa', value: 'wrong2' },
                    { label: 'Grabar su voz para clonarla', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_07', category: 'social', emoji: '🤝', color: '#cc0044',
                title: 'El Topo',
                narrative: `Lograste infiltrar a uno de tus hombres como empleado nuevo de @${t}. Lleva 3 semanas trabajando ahí. ¿Cuándo activas el plan?`,
                question: '**¿Cuándo es el momento ideal para que actúe el topo?**',
                options: [
                    { label: 'Cuando ya tiene acceso a las áreas restringidas', value: 'correct' },
                    { label: 'El primer día que entra', value: 'wrong1' },
                    { label: 'En su día de descanso', value: 'wrong2' },
                    { label: 'Antes de que lo contraten', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_08', category: 'social', emoji: '🧠', color: '#cc0044',
                title: 'Leer el Lenguaje Corporal',
                narrative: `Estás negociando con un contacto que dice tener información de @${t}. Cruza los brazos, evita el contacto visual y responde muy corto.`,
                question: '**¿Qué te dice su lenguaje corporal?**',
                options: [
                    { label: 'Está mintiendo o escondiendo algo', value: 'correct' },
                    { label: 'Está muy cómodo', value: 'wrong1' },
                    { label: 'Tiene frío', value: 'wrong2' },
                    { label: 'Está en total acuerdo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_09', category: 'social', emoji: '🏢', color: '#cc0044',
                title: 'Infiltrar la Reunión',
                narrative: `@${t} tiene una reunión privada en 10 minutos. Si entras sin invitación, necesitas una razón para estar ahí.`,
                question: '**¿Qué rol asumes para no levantar sospechas?**',
                options: [
                    { label: 'Técnico de A/V que viene a revisar el proyector', value: 'correct' },
                    { label: 'El jefe de @' + t, value: 'wrong1' },
                    { label: 'Un invitado que no fue añadido a la lista', value: 'wrong2' },
                    { label: 'El servicio de catering sin comida', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_10', category: 'social', emoji: '💌', color: '#cc0044',
                title: 'El Correo Trampa',
                narrative: `Enviaste un correo a @${t} con un link de "actualización urgente de cuenta". El correo tiene un logo falso muy convincente.`,
                question: '**¿Cómo se llama este tipo de ataque?**',
                options: [
                    { label: 'Spear Phishing', value: 'correct' },
                    { label: 'Spam masivo', value: 'wrong1' },
                    { label: 'Vishing', value: 'wrong2' },
                    { label: 'Smishing', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_11', category: 'social', emoji: '🎪', color: '#cc0044',
                title: 'La Distracción Social',
                narrative: `Mientras tu cómplice distraía al guardia de @${t} fingiendo un desmayo en la entrada, tú tenías exactamente 90 segundos.`,
                question: '**¿Qué tipo de distracción es más efectiva para el sigilo?**',
                options: [
                    { label: 'Una que requiera la atención de TODOS los guardias', value: 'correct' },
                    { label: 'Una pequeña que llame solo a un guardia', value: 'wrong1' },
                    { label: 'Un ruido fuerte sin causa visible', value: 'wrong2' },
                    { label: 'Nada, el silencio es mejor', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_12', category: 'social', emoji: '🕶️', color: '#cc0044',
                title: 'El Alias',
                narrative: `Para entrar al edificio de @${t} usaste el nombre del técnico real: "Juan Rodríguez". El guardia dice que Juan ya está adentro.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: '"Ah, ese es mi asistente, lo mandé antes" — improvisa', value: 'correct' },
                    { label: '"Mentira, soy el único Juan" — insistes', value: 'wrong1' },
                    { label: 'Sales corriendo', value: 'wrong2' },
                    { label: 'Confiesas todo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_13', category: 'social', emoji: '📋', color: '#cc0044',
                title: 'Formulario Falso',
                narrative: `Le presentas a @${t} un "formulario de verificación de cuenta" en papel para que lo llene. ¿Qué información necesitas que ponga?`,
                question: '**¿Cuál dato es el más valioso para acceder a su cuenta?**',
                options: [
                    { label: 'Contraseña actual + fecha de nacimiento', value: 'correct' },
                    { label: 'Nombre completo + dirección', value: 'wrong1' },
                    { label: 'Número de teléfono', value: 'wrong2' },
                    { label: 'Preferencias de color', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_14', category: 'social', emoji: '🃏', color: '#cc0044',
                title: 'Juego de Confianza',
                narrative: `Llevas 2 semanas construyendo confianza con @${t} sin que sepa tus intenciones. Esta técnica tiene un nombre en el mundo del crimen.`,
                question: '**¿Cómo se llama esta técnica?**',
                options: [
                    { label: 'Long Con (estafa larga)', value: 'correct' },
                    { label: 'Quick Flip', value: 'wrong1' },
                    { label: 'Trust Rush', value: 'wrong2' },
                    { label: 'Reverse Phishing', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'soc_15', category: 'social', emoji: '👔', color: '#cc0044',
                title: 'La Entrevista Falsa',
                narrative: `Publicaste una falsa oferta de trabajo y @${t} vino a la "entrevista". En el formulario de candidatura te dio toda su información personal.`,
                question: '**¿Cómo se llama este tipo de recolección de datos?**',
                options: [
                    { label: 'Pretexting con reclutamiento falso', value: 'correct' },
                    { label: 'Data Mining legal', value: 'wrong1' },
                    { label: 'Encuesta de mercado', value: 'wrong2' },
                    { label: 'Cold Calling', value: 'wrong3' },
                ],
                correct: 'correct',
            },

            // ══════════════════════════════════════════════
            // 💼 CATEGORÍA 5: EJECUCIÓN (15 minijuegos)
            // ══════════════════════════════════════════════
            {
                id: 'ejec_01', category: 'ejecucion', emoji: '💼', color: '#884400',
                title: 'Elegir la Bolsa Correcta',
                narrative: `Estás dentro de la bóveda de @${t}. Hay 4 bolsas con el mismo logo. Solo una tiene el dinero real. Las otras son señuelos.`,
                question: '**¿Cuál eliges?**',
                options: [
                    { label: 'La más pesada — el dinero tiene peso', value: 'correct' },
                    { label: 'La más nueva — cuidan lo valioso', value: 'wrong1' },
                    { label: 'La primera que ves — rapidez', value: 'wrong2' },
                    { label: 'La más pequeña — fácil de cargar', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_02', category: 'ejecucion', emoji: '📊', color: '#884400',
                title: 'Calcular el Botín',
                narrative: `Tienes 45 segundos para contar el dinero de @${t}. Ves fajos de 100 billetes de 1000π. Hay 7 fajos. ¿Cuánto hay en total?`,
                question: '**¿Cuánto dinero hay?**',
                options: [
                    { label: '700,000π', value: 'correct' },
                    { label: '70,000π', value: 'wrong1' },
                    { label: '7,000,000π', value: 'wrong2' },
                    { label: '7,000π', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_03', category: 'ejecucion', emoji: '🚗', color: '#884400',
                title: 'Vehículo de Escape',
                narrative: `Tienes 3 opciones de escape después de robar a @${t}: moto, auto sedan, o camioneta. El dinero pesa 20kg y hay un operativo policial a 3km.`,
                question: '**¿Qué vehículo eliges?**',
                options: [
                    { label: 'Auto sedan — rápido, discreto y carga el peso', value: 'correct' },
                    { label: 'Moto — muy rápida pero no carga 20kg bien', value: 'wrong1' },
                    { label: 'Camioneta — demasiado visible', value: 'wrong2' },
                    { label: 'A pie — más sigilo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_04', category: 'ejecucion', emoji: '🗺️', color: '#884400',
                title: 'Ruta de Escape',
                narrative: `Saliendo de la bóveda de @${t} tienes 3 rutas: norte (2 cámaras), este (1 guardia dormido), sur (sin obstáculos pero 3km extra).`,
                question: '**¿Qué ruta tomas?**',
                options: [
                    { label: 'Este — el guardia dormido es el menor riesgo', value: 'correct' },
                    { label: 'Norte — puedes evitar las cámaras', value: 'wrong1' },
                    { label: 'Sur — sin obstáculos aunque sea más largo', value: 'wrong2' },
                    { label: 'Vuelves por donde entraste', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_05', category: 'ejecucion', emoji: '💵', color: '#884400',
                title: 'Billete Falso',
                narrative: `Al revisar el dinero de @${t}, encuentras billetes sospechosos mezclados. Tienes 20 segundos para identificar el billete falso.`,
                question: '**¿Cómo identificas rápido un billete falso?**',
                options: [
                    { label: 'Textura del papel — el real tiene relieve y fibras especiales', value: 'correct' },
                    { label: 'El color — los falsos son más brillantes', value: 'wrong1' },
                    { label: 'El olor — los falsos huelen diferente', value: 'wrong2' },
                    { label: 'El tamaño — los falsos son más pequeños', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_06', category: 'ejecucion', emoji: '⚖️', color: '#884400',
                title: 'Peso del Botín',
                narrative: `Tu mochila tiene capacidad para 15kg. El botín de @${t} pesa 22kg. Tienes documentos (3kg), monedas (5kg), y billetes (14kg).`,
                question: '**¿Qué dejas atrás?**',
                options: [
                    { label: 'Las monedas y documentos — los billetes tienen más valor por kg', value: 'correct' },
                    { label: 'Los billetes — ocupan mucho espacio', value: 'wrong1' },
                    { label: 'La mitad de todo', value: 'wrong2' },
                    { label: 'Nada — atas la mochila más fuerte', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_07', category: 'ejecucion', emoji: '🕐', color: '#884400',
                title: 'Ventana de Tiempo',
                narrative: `El cambio de guardia en la bóveda de @${t} ocurre cada 4 horas. El último cambio fue hace 3h 45min. ¿Cuánto tiempo tienes?`,
                question: '**¿Cuántos minutos te quedan antes del próximo cambio?**',
                options: [
                    { label: '15 minutos', value: 'correct' },
                    { label: '45 minutos', value: 'wrong1' },
                    { label: '1 hora', value: 'wrong2' },
                    { label: '3 horas', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_08', category: 'ejecucion', emoji: '🌉', color: '#884400',
                title: 'El Punto de Encuentro',
                narrative: `Tu equipo acordó reunirse en el punto de escape después de robar a @${t}. El código de emergencia es "lluvia". Si alguien lo dice, significa...`,
                question: '**¿Qué significa el código "lluvia" en una operación?**',
                options: [
                    { label: 'Abortar el plan y dispersarse', value: 'correct' },
                    { label: 'Acelerar el plan', value: 'wrong1' },
                    { label: 'El dinero está asegurado', value: 'wrong2' },
                    { label: 'Literalmente está lloviendo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_09', category: 'ejecucion', emoji: '🎒', color: '#884400',
                title: 'Empacar el Botín',
                narrative: `Tienes el dinero de @${t} en efectivo. Para transportarlo sin levantar sospechas necesitas camuflarlo.`,
                question: '**¿Cuál es el mejor contenedor para no levantar sospechas?**',
                options: [
                    { label: 'Maletín de trabajo con documentos encima', value: 'correct' },
                    { label: 'Bolsa de plástico transparente', value: 'wrong1' },
                    { label: 'Una mochila con logo del banco', value: 'wrong2' },
                    { label: 'Llevarlo a mano sin bolsa', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_10', category: 'ejecucion', emoji: '🧹', color: '#884400',
                title: 'Borrar el Rastro',
                narrative: `Terminaste de robar a @${t}. Antes de salir tienes 30 segundos para reducir la evidencia al mínimo.`,
                question: '**¿Qué priorizas borrar?**',
                options: [
                    { label: 'Las cámaras de seguridad — la evidencia visual es la más dañina', value: 'correct' },
                    { label: 'Las huellas del piso', value: 'wrong1' },
                    { label: 'Dejar todo en desorden', value: 'wrong2' },
                    { label: 'Limpiar la caja fuerte', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_11', category: 'ejecucion', emoji: '💱', color: '#884400',
                title: 'Lavar el Dinero',
                narrative: `Robaste una gran suma a @${t}. Para usarla sin levantar sospechas necesitas "limpiarla". ¿Cuál es el primer paso?`,
                question: '**¿Cómo se llama el proceso de hacer parecer legítimo el dinero robado?**',
                options: [
                    { label: 'Blanqueo o lavado de activos', value: 'correct' },
                    { label: 'Reciclaje financiero', value: 'wrong1' },
                    { label: 'Conversión de moneda', value: 'wrong2' },
                    { label: 'Reinversión ilegal', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_12', category: 'ejecucion', emoji: '📦', color: '#884400',
                title: 'El Paquete Señuelo',
                narrative: `Para distraer a la policía de @${t}, tu equipo dejó un paquete con dinero falso en otro edificio. ¿Cuánto tiempo ganas normalmente?`,
                question: '**¿Cuánto tiempo da una distracción bien ejecutada?**',
                options: [
                    { label: '5-15 minutos si el señuelo es convincente', value: 'correct' },
                    { label: '2-3 días', value: 'wrong1' },
                    { label: '30 segundos', value: 'wrong2' },
                    { label: 'Depende del clima', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_13', category: 'ejecucion', emoji: '🚁', color: '#884400',
                title: 'Escape Aéreo',
                narrative: `El edificio de @${t} tiene acceso al techo. Tu cómplice tiene un helicóptero a 2 minutos. El problema: las escaleras están vigiladas.`,
                question: '**¿Cómo llegas al techo?**',
                options: [
                    { label: 'Por el montacargas de servicio ignorado', value: 'correct' },
                    { label: 'Por la escalera principal corriendo', value: 'wrong1' },
                    { label: 'Esperas que los guardias se vayan', value: 'wrong2' },
                    { label: 'Le llamas al cómplice que baje más', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_14', category: 'ejecucion', emoji: '🔥', color: '#884400',
                title: 'Incendio de Distracción',
                narrative: `Para cubrir la salida del robo a @${t}, tu equipo considera activar la alarma de incendios. ¿Cuál es el riesgo principal?`,
                question: '**¿Cuál es el mayor problema de activar la alarma de incendios?**',
                options: [
                    { label: 'Llegan los bomberos Y la policía al mismo tiempo', value: 'correct' },
                    { label: 'No funciona si es de noche', value: 'wrong1' },
                    { label: 'Cierra las puertas automáticamente', value: 'wrong2' },
                    { label: 'Activa los sprinklers y moja el dinero', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'ejec_15', category: 'ejecucion', emoji: '🌃', color: '#884400',
                title: 'El Momento Perfecto',
                narrative: `Llevas semanas observando los patrones de @${t}. Finalmente elegiste el momento del robo. ¿Cuándo es el mejor momento?`,
                question: '**¿Cuándo es estadísticamente el mejor momento para un robo?**',
                options: [
                    { label: 'Madrugada 2-4 AM — mínima vigilancia activa', value: 'correct' },
                    { label: 'Mediodía — mucho movimiento para mezclarse', value: 'wrong1' },
                    { label: 'Lunes 9 AM — inicio de semana laboral', value: 'wrong2' },
                    { label: 'Hora pico — aprovechas el caos', value: 'wrong3' },
                ],
                correct: 'correct',
            },

            // ══════════════════════════════════════════════
            // 🎲 CATEGORÍA 6: CAOS (15+ minijuegos)
            // ══════════════════════════════════════════════
            {
                id: 'caos_01', category: 'caos', emoji: '🎲', color: '#5500aa',
                title: 'Memoria del Ladrón',
                narrative: `Antes de entrar a la bóveda de @${t}, tu líder te mostró el plano por 10 segundos. Ahora está guardado. ¿Cuántas salidas tenía el plano?`,
                question: '**Viste el plano brevemente. ¿Cuántas salidas de emergencia había marcadas?**',
                options: [
                    { label: '3 salidas', value: 'correct' },
                    { label: '1 salida', value: 'wrong1' },
                    { label: '5 salidas', value: 'wrong2' },
                    { label: '7 salidas', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_02', category: 'caos', emoji: '🃏', color: '#5500aa',
                title: 'El Plan B',
                narrative: `El plan original para robar a @${t} falló. El guardia está en el lugar equivocado. Tienes 10 segundos para improvisar.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: 'Activas el plan B de contingencia que preparaste', value: 'correct' },
                    { label: 'Sigues con el plan original de todas formas', value: 'wrong1' },
                    { label: 'Te rindes y te vas', value: 'wrong2' },
                    { label: 'Llamas a tu cómplice por teléfono ahí mismo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_03', category: 'caos', emoji: '🌪️', color: '#5500aa',
                title: 'Variables Inesperadas',
                narrative: `A mitad del robo a @${t}, aparece un perro guardián que no estaba en tu reporte de inteligencia. No es agresivo todavía, pero te mira.`,
                question: '**¿Qué haces para neutralizarlo sin hacerle daño?**',
                options: [
                    { label: 'Le das las galletas de tu mochila para calmarlo', value: 'correct' },
                    { label: 'Corres — los perros no persiguen si corres', value: 'wrong1' },
                    { label: 'Le gritas para asustarlo', value: 'wrong2' },
                    { label: 'Te quedas inmóvil eternamente', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_04', category: 'caos', emoji: '🧮', color: '#5500aa',
                title: 'Matemática del Botín',
                narrative: `Robaste a @${t}. Tienes socios: a tu cómplice le toca 30%, al informante 15%, y el resto es tuyo. Robaste 200,000π.`,
                question: '**¿Cuánto te llevas tú?**',
                options: [
                    { label: '110,000π (55%)', value: 'correct' },
                    { label: '60,000π (30%)', value: 'wrong1' },
                    { label: '100,000π (50%)', value: 'wrong2' },
                    { label: '200,000π (todo)', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_05', category: 'caos', emoji: '🔍', color: '#5500aa',
                title: 'Verdadero o Falso',
                narrative: `Tu informante dentro del equipo de @${t} te dio 4 datos. Uno de ellos es falso y lo podría arruinar todo.`,
                question: '**¿Cuál dato es definitivamente FALSO?**',
                options: [
                    { label: '"La caja fuerte no tiene alarma" — todas las cajas tienen', value: 'correct' },
                    { label: '"El guardia trabaja de noche" — es común', value: 'wrong1' },
                    { label: '"Hay cámaras en el pasillo" — es normal', value: 'wrong2' },
                    { label: '"El edificio tiene 3 pisos" — verosímil', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_06', category: 'caos', emoji: '⏰', color: '#5500aa',
                title: 'Contrarreloj',
                narrative: `La alarma silenciosa de @${t} ya fue activada. La policía llega en 4 minutos. Estás a 2 min de la caja y 2 min de la salida.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: 'Sales inmediatamente — el riesgo no vale', value: 'correct' },
                    { label: 'Corres a la caja, la abres y escapas en 4 min exactos', value: 'wrong1' },
                    { label: 'Te escondes en el edificio y esperas', value: 'wrong2' },
                    { label: 'Llamas a la policía tú mismo para confundirlos', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_07', category: 'caos', emoji: '🎯', color: '#5500aa',
                title: 'Prioridad de Acción',
                narrative: `Estás en la bóveda de @${t} y pasan 3 cosas simultáneamente: suena un teléfono, un guardia se acerca, y la puerta empieza a cerrarse sola.`,
                question: '**¿Qué atiendes primero?**',
                options: [
                    { label: 'La puerta — si se cierra quedas atrapado', value: 'correct' },
                    { label: 'El teléfono — podrías darte información', value: 'wrong1' },
                    { label: 'El guardia — es la amenaza humana', value: 'wrong2' },
                    { label: 'El dinero — para eso viniste', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_08', category: 'caos', emoji: '🌊', color: '#5500aa',
                title: 'El Efecto Dominó',
                narrative: `En el robo a @${t}, activaste sin querer una alarma menor. Tienes 30 segundos antes de que active la alarma principal.`,
                question: '**¿Qué haces en esos 30 segundos?**',
                options: [
                    { label: 'Reseteas el panel de alarmas si sabes dónde está', value: 'correct' },
                    { label: 'Huyes inmediatamente sin el botín', value: 'wrong1' },
                    { label: 'Ignoras la alarma y sigues con el plan', value: 'wrong2' },
                    { label: 'Gritas "¡FALSA ALARMA!" en el pasillo', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_09', category: 'caos', emoji: '🧩', color: '#5500aa',
                title: 'El Intruso en el Equipo',
                narrative: `Uno de tus 4 compañeros en el robo a @${t} es un informante policial. Pistas: llega tarde a los meetings, hace preguntas raras sobre rutas de escape.`,
                question: '**¿Cómo lo identificas con certeza?**',
                options: [
                    { label: 'Le das información falsa y ves si llega policía a ese lugar', value: 'correct' },
                    { label: 'Le preguntas directamente si es topo', value: 'wrong1' },
                    { label: 'Lo expulsas sin pruebas', value: 'wrong2' },
                    { label: 'Cancelas todo el plan', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_10', category: 'caos', emoji: '🔄', color: '#5500aa',
                title: 'Reversión del Plan',
                narrative: `A mitad del robo te enteras que @${t} trasladó su dinero a otra bóveda ayer. La bóveda actual está vacía.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: 'Sales limpiamente y reagendas con nueva inteligencia', value: 'correct' },
                    { label: 'Buscas la otra bóveda improvisando', value: 'wrong1' },
                    { label: 'Robas lo que encuentres aunque sea poco', value: 'wrong2' },
                    { label: 'Te niegas a creerlo y sigues buscando', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_11', category: 'caos', emoji: '💡', color: '#5500aa',
                title: 'El Detalle Olvidado',
                narrative: `Ya afuera con el botín de @${t}, tu cómplice te recuerda algo que olvidaste adentro. Si la policía lo encuentra, te identifica.`,
                question: '**¿Qué objeto sería el más comprometedor que pudieras haber olvidado?**',
                options: [
                    { label: 'Tu teléfono personal con tu número e historial', value: 'correct' },
                    { label: 'Un guante sin huellas', value: 'wrong1' },
                    { label: 'La linterna que compraste en efectivo', value: 'wrong2' },
                    { label: 'Un caramelo de cualquier tienda', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_12', category: 'caos', emoji: '📻', color: '#5500aa',
                title: 'Comunicación Segura',
                narrative: `Tu equipo necesita comunicarse durante el robo a @${t} sin que los escaneen las radios policiales.`,
                question: '**¿Qué método de comunicación es más seguro en una operación?**',
                options: [
                    { label: 'Radios cifrados en frecuencia privada', value: 'correct' },
                    { label: 'WhatsApp normal', value: 'wrong1' },
                    { label: 'Mensajes de texto SMS', value: 'wrong2' },
                    { label: 'Gritos en clave', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_13', category: 'caos', emoji: '🌍', color: '#5500aa',
                title: 'Geografía del Escape',
                narrative: `Después de robar a @${t} necesitas desaparecer de la ciudad. Tienes 3 opciones de transporte disponibles ahora mismo.`,
                question: '**¿Cuál es el más difícil de rastrear?**',
                options: [
                    { label: 'Bus intermunicipal pagado en efectivo', value: 'correct' },
                    { label: 'Avión con pasaje a nombre tuyo', value: 'wrong1' },
                    { label: 'Uber desde tu celular', value: 'wrong2' },
                    { label: 'Tren con tarjeta de crédito', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_14', category: 'caos', emoji: '🏆', color: '#5500aa',
                title: 'El Robo Perfecto',
                narrative: `Evaluando el robo a @${t}, tu mentor dice que fue casi perfecto. Solo hubo un error que podría comprometerte a largo plazo.`,
                question: '**¿Cuál es el error más común que arruina a los ladrones después del crimen?**',
                options: [
                    { label: 'Gastar el dinero de forma notoria y rápida', value: 'correct' },
                    { label: 'No haber robado suficiente', value: 'wrong1' },
                    { label: 'Hablar con la víctima después', value: 'wrong2' },
                    { label: 'No haber usado guantes', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_15', category: 'caos', emoji: '🎰', color: '#5500aa',
                title: 'El Todo o Nada',
                narrative: `Es tu último chance. Estás frente a la caja fuerte de @${t} con 2 intentos de código antes de que se bloquee permanentemente.`,
                question: '**¿Qué estrategia tomas?**',
                options: [
                    { label: 'Usas solo 1 intento con el código más probable y te guardas el otro', value: 'correct' },
                    { label: 'Usas ambos intentos lo más rápido posible', value: 'wrong1' },
                    { label: 'No intentas nada — esperas más información', value: 'wrong2' },
                    { label: 'La fuerzas con herramientas físicas', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_16', category: 'caos', emoji: '🌀', color: '#5500aa',
                title: 'El Robo Dentro del Robo',
                narrative: `Mientras robas a @${t}, descubres que alguien más ya entró antes que tú. El botín fue parcialmente tomado. Hay 40% del dinero original.`,
                question: '**¿Qué haces?**',
                options: [
                    { label: 'Tomas el 40% restante y sales rápido — menos tiempo de riesgo', value: 'correct' },
                    { label: 'Buscas al otro ladrón para dividir lo que queda', value: 'wrong1' },
                    { label: 'Sales sin nada — no era lo planeado', value: 'wrong2' },
                    { label: 'Esperas al otro ladrón para robarle a él también', value: 'wrong3' },
                ],
                correct: 'correct',
            },
            {
                id: 'caos_17', category: 'caos', emoji: '🎭', color: '#5500aa',
                title: 'Máscara Caída',
                narrative: `Tu máscara se cayó por un segundo frente a una cámara de @${t}. El video es borroso pero algo se vio. ¿Cuál es tu siguiente movimiento?`,
                question: '**¿Qué priorizas?**',
                options: [
                    { label: 'Destruir o formatear el DVR de grabación antes de salir', value: 'correct' },
                    { label: 'Huir inmediatamente sin mirar atrás', value: 'wrong1' },
                    { label: 'Cambiar tu look radicalmente esa noche', value: 'wrong2' },
                    { label: 'Asumir que el video es demasiado borroso', value: 'wrong3' },
                ],
                correct: 'correct',
            },
        ];
    }
}

module.exports = RobMinigames;