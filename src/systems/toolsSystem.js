const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs/promises');
const path = require('path');
const DDG = require('duck-duck-scrape');
const { H2MParser } = require('h2m-parser');

const TTS_OUTPUT_DIR = path.join(__dirname, '..', '..', 'tts_output');

const VOZ_TTS = 'es-US-PalomaNeural';
const MAX_BYTES_TTS = 3500;

function escaparSSML(texto) {
    return texto
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function dividirTextoTTS(texto, maxBytes = MAX_BYTES_TTS) {
    const trozos = [];
    let actual = '';
    const bytes = (s) => Buffer.byteLength(s, 'utf8');

    const agregar = (frag) => {
        const unido = actual ? `${actual} ${frag}` : frag;
        if (bytes(unido) <= maxBytes) { actual = unido; return; }
        if (actual) { trozos.push(actual); actual = ''; }
        if (bytes(frag) <= maxBytes) { actual = frag; return; }
        for (const palabra of frag.split(/\s+/)) {
            const partes = bytes(palabra) > maxBytes ? palabra.match(/[\s\S]{1,800}/g) : [palabra];
            for (const p of partes) {
                const j = actual ? `${actual} ${p}` : p;
                if (bytes(j) > maxBytes && actual) { trozos.push(actual); actual = p; }
                else actual = j;
            }
        }
    };

    for (const oracion of texto.split(/(?<=[.!?…\n])\s+/)) if (oracion.trim()) agregar(oracion.trim());
    if (actual) trozos.push(actual);
    return trozos;
}

class ToolsSystem {
    constructor(musicSystem = null) {
        this.musicSystem = musicSystem;

        this.audioCache = new Map();
        this.CACHE_TTL = 10 * 60 * 1000;

    }

    get tools() {
        return [
            {
                type: "function",
                function: {
                    name: "controlar_musica",
                    description: "Controla la reproducción de música: reproducir, pausar, reanudar, saltar, detener o ver la cola",
                    parameters: {
                        type: "object",
                        properties: {
                            accion: {
                                type: "string",
                                enum: ["reproducir", "pausar", "reanudar", "saltar", "detener", "ver_cola"],
                                description: "Qué acción hacer con la música"
                            },
                            busqueda: {
                                type: "string",
                                description: "Nombre de la canción/artista (solo si accion es 'reproducir')"
                            }
                        },
                        required: ["accion"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "narrar_historia",
                    description: "Genera un audio narrado del texto respondido (reply) o la última historia contada, como adjunto",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "buscar_web",
                    description: `Busca información actual en internet (hoy: ${new Date().toLocaleDateString('es-ES')}). 
                    DEBES usarla siempre que el usuario pida buscar algo, o pregunte por datos concretos que no conozcas con total certeza: personas, eventos, noticias, lanzamientos, precios, versiones, videojuegos, o cualquier cosa posterior a tu entrenamiento. NUNCA inventes esos datos: busca primero.
                    IMPORTANTE: Para obtener buenos resultados, formula la "consulta" de manera inteligente:
                    - Si es sobre videojuegos (Fortnite, Minecraft, etc.), agrega "noticias" o "evento" al final.
                    - Si es sobre programación (Node.js, JavaScript, Python), agrega "documentación" o "stackoverflow".
                    - Si es sobre un tema general o noticia, sé directo.`,
                    parameters: {
                        type: "object",
                        properties: {
                            consulta: { type: "string", description: "Consulta de búsqueda optimizada (ej: 'evento pirata fortnite noticias' o 'error de memoria nodejs documentación')" },
                            que_tan_reciente: {
                                type: "string",
                                enum: ["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"],
                                description: "Qué tan reciente debe ser"
                            }
                        },
                        required: ["consulta"]
                    }
                }
            }
        ];
    }

    async _sintetizarEdge(texto, timeoutMs) {
        const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: timeoutMs });
        try {
            await tts.setMetadata(VOZ_TTS, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const buffers = [];
            for (const trozo of dividirTextoTTS(texto)) {
                const { audioStream } = tts.toStream(escaparSSML(trozo));
                for await (const chunk of audioStream) buffers.push(chunk);
            }
            const audio = Buffer.concat(buffers);
            if (!audio.length) throw new Error('Edge TTS no devolvió audio');
            return audio;
        } finally {
            tts.close();
        }
    }

    async generateAudio(text, timeoutMs = 30000) {
        const cached = this.audioCache.get(text);
        if (cached && cached.expira > Date.now()) {
            const archivoCache = path.join(TTS_OUTPUT_DIR, cached.url.split('/').pop());
            if (await fs.access(archivoCache).then(() => true).catch(() => false)) return cached.url;
            this.audioCache.delete(text);
        }

        let audioBuffer = null;
        for (let intento = 1; intento <= 2 && !audioBuffer; intento++) {
            try {
                audioBuffer = await this._sintetizarEdge(text, timeoutMs);
            } catch (err) {
                console.error(`Error generando TTS (edge-tts) [intento ${intento}/2]:`, err.message);
                if (intento < 2) await new Promise(r => setTimeout(r, 1000));
            }
        }
        if (!audioBuffer) return null;

        try {
            await fs.mkdir(TTS_OUTPUT_DIR, { recursive: true });
            const fileName = `tts_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
            await fs.writeFile(path.join(TTS_OUTPUT_DIR, fileName), audioBuffer);

            const dominio = process.env.NGROK_DOMAIN
                ? (process.env.NGROK_DOMAIN.startsWith('http') ? process.env.NGROK_DOMAIN : `https://${process.env.NGROK_DOMAIN}`)
                : '';
            const url = `${dominio}/tts/${fileName}`;

            this.audioCache.set(text, { url, expira: Date.now() + this.CACHE_TTL });
            setTimeout(() => fs.unlink(path.join(TTS_OUTPUT_DIR, fileName)).catch(() => {}), 120000);
            return url;
        } catch (err) {
            console.error('Error guardando audio TTS:', err.message);
            return null;
        }
    }

    limpiarParaNarrar(texto) {
        return texto
            .replace(/\*[^*"“”‘’.\n]{1,40}\*/g, '')  
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    armarNombreVisible(texto) {
        const trozo = texto
            .slice(0, 30)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        return `pibot-dice-${trozo || 'algo'}.mp3`;
    }

    async ejecutarMusicTool(args, message) {
        const { guild, member, channel, author } = message;

        try {
            switch (args.accion) {
                case 'reproducir':
                    await this.musicSystem.playCommand(message, ['_', '_', args.busqueda], member, channel, guild, author);
                    return `Se puso a reproducir: ${args.busqueda}`;
                case 'detener':
                    await this.musicSystem.stopCommand(message, guild, member);
                    return 'Se detuvo la música y se limpió la cola.';
                case 'pausar':
                    await this.musicSystem.pauseCommand(message, guild, member);
                    return 'La música quedó pausada.';
                case 'reanudar':
                    await this.musicSystem.resumeCommand(message, guild, member);
                    return 'La música se reanudó.';
                case 'saltar':
                    await this.musicSystem.skipCommand(message, [], guild, member);
                    return 'Se saltó a la siguiente canción.';
                case 'ver_cola':
                    await this.musicSystem.queueCommand(message, [], guild);
                    return 'Se mostró la cola de canciones (ya se mandó el embed, no hace falta que lo describas de nuevo).';
                default:
                    return 'Acción de música desconocida.';
            }
        } catch (err) {
            return `Error al ejecutar la acción: ${err.message}`;
        }
    }

    async ejecutarNarrarHistoria(message, userId, chatBotSystem, repliedToMessage) {
        try {
            let textoParaNarrar = repliedToMessage
                ? await chatBotSystem.getUltimoMensajeLargo(userId, repliedToMessage)
                : null;

            if (!textoParaNarrar) {
                textoParaNarrar = await chatBotSystem.getUltimoMensajeLargo(userId);
            }

            if (!textoParaNarrar) {
                return 'No encontré ninguna historia reciente para narrar. Podés responder (reply) al mensaje que quieras narrar y pedírmelo de nuevo.';
            }

            const textoLimpio = this.limpiarParaNarrar(textoParaNarrar);
            const audioUrl = await this.generateAudio(textoLimpio, 45000);
            if (!audioUrl) {
                return 'No se pudo generar el audio.';
            }

            const nombreArchivo = audioUrl.split('/').pop();
            const rutaLocal = path.join(TTS_OUTPUT_DIR, nombreArchivo);

            await message.channel.send({
                files: [{ attachment: rutaLocal, name: 'pibot-narra-esto.mp3' }]
            });

            return 'Se mandó el audio como adjunto (no hace falta que lo describas de nuevo).';
        } catch (err) {
            console.error('❌ Error en ejecutarNarrarHistoria:', err.message);
            return `Error al narrar: ${err.message}`;
        }
    }

    async buscarEnSearxng(query) {
        try {
            console.log(`[Búsqueda Profunda] Buscando en DuckDuckGo...`);
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            
            const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { 
                signal: AbortSignal.timeout(10000),
                headers: { 'Accept': 'text/plain' }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            let texto = await res.text();
            
            let articuloUrl = null;
            const uddgMatch = texto.match(/uddg=([^&"\s]+)/);
            if (uddgMatch && uddgMatch[1]) {
                articuloUrl = decodeURIComponent(uddgMatch[1]);
            } else {
                let urlsEncontradas = [];
                const uddgMatches = texto.matchAll(/uddg=([^&"\s]+)/g);
                for (const match of uddgMatches) {
                    urlsEncontradas.push(decodeURIComponent(match[1]));
                }
                
                if (urlsEncontradas.length === 0) {
                    urlsEncontradas = texto.match(/https?:\/\/(?!external-content)[^\s\]\)"']+/g) || [];
                }

                const dominiosBloqueados = [
                    'youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com',
                    'twitter.com', 'x.com', 'facebook.com', 'twitch.tv',
                    /*'reddit.com',*/ 'pinterest.com'
                ];

                const urlValida = urlsEncontradas.find(u => {
                    const esArchivo = u.match(/\.(ico|png|jpe?g|gif|svg|css|js)$/i);
                    const esDDG = u.includes('duckduckgo.com');
                    const esBloqueado = dominiosBloqueados.some(dom => u.includes(dom));

                    return !esArchivo && !esDDG && !esBloqueado;
                });

                if (urlValida) {
                    console.log(`[Búsqueda Profunda] 📄 Leyendo artículo: ${urlValida}`);
                    
                    if (!resArticulo.ok || !articuloLimpio) {
                        console.log(`[Búsqueda Profunda] ❌ No se pudo leer el artículo. Usando texto de búsqueda.`);
                        let textoLimpio = texto.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/https?:\/\/[^\s]+/g, '').trim();
                        return textoLimpio.slice(0, 1500);
                    }
                } else {
                    console.log(`[Búsqueda Profunda] ⚠️ No se encontraron artículos válidos. Usando texto de búsqueda.`);
                    let textoLimpio = texto.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/https?:\/\/[^\s]+/g, '').trim();
                    return textoLimpio.slice(0, 1500);
                }
            }
            
            if (articuloUrl) {
                console.log(`[Búsqueda Profunda] 📄 Leyendo artículo: ${articuloUrl}`);

                const resArticulo = await fetch(articuloUrl, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (compatible; Pibot/1.0)',
                        'Accept': 'text/html'
                    },
                    signal: AbortSignal.timeout(12000)
                });
                
                if (resArticulo.ok) {
                    const html = await resArticulo.text();
                    
                    const converter = new H2MParser({
                        extract: { readability: true },
                        markdown: { linkStyle: 'inline' }
                    });
                    
                    const result = await converter.process(html, articuloUrl);
                    const articuloLimpio = result.markdown;

                    if (articuloLimpio && articuloLimpio.length > 200) {
                        console.log(`[Búsqueda Profunda] ✅ Artículo leído con éxito (h2m-parser).`);
                        return `ARTÍCULO COMPLETO ENCONTRADO EN:\n${articuloUrl}\n\nCONTENIDO:\n${articuloLimpio.slice(0, 3000)}`;
                    } else {
                        console.log(`[Búsqueda Profunda] ⚠️ El artículo parecía vacío. Usando resumen de búsqueda.`);
                    }
                }
            }

            let textoLimpio = texto.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/https?:\/\/[^\s]+/g, '').trim();
            return textoLimpio.slice(0, 2500);

        } catch (error) {
            console.log(`[Búsqueda Profunda] ❌ Falló: ${error.message}`);
            return null;
        }
    }

    async ejecutarBusqueda(args) {
        const query = args.consulta;
        
        const resultadoJina = await this.buscarEnSearxng(query);
        if (resultadoJina) {
            return resultadoJina;
        }

        console.log('⚠️ Jina/SearXNG falló. Usando LangSearch de respaldo...');
        try {
            const response = await fetch('https://api.langsearch.com/v1/web-search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.LANGSEARCH_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    freshness: args.que_tan_reciente || 'oneYear',
                    count: 3,
                    contents: { text: true }
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                const errTxt = await response.text().catch(() => '');
                console.log(`[Búsqueda] ❌ LangSearch HTTP ${response.status} | redirected: ${response.redirected} | url final: ${response.url} | key definida: ${!!process.env.LANGSEARCH_API_KEY} | ${errTxt.slice(0, 200)}`);
            } else {
                const data = await response.json();
                const resultados = data.data?.webPages?.value || [];

                if (resultados.length > 0) {
                    const textoCompleto = resultados
                        .map((r, i) => `${i + 1}. ${r.name}\n${(r.summary || r.text || r.snippet || '').slice(0, 400)}\nFuente: ${r.url}`)
                        .join('\n\n');

                    console.log(`[Búsqueda] ✅ Éxito con LangSearch (Respaldo)`);
                    return textoCompleto.slice(0, 1500);
                }
            }
        } catch (e) {
            console.log(`[Búsqueda] ❌ LangSearch falló: ${e.message}`);
        }

        try {
            const ddgResults = await DDG.search(query, { safeSearch: DDG.SafeSearchType.MODERATE });
            if (ddgResults && ddgResults.results && ddgResults.results.length > 0) {
                const textoDdg = ddgResults.results.slice(0, 3).map((r, i) => 
                    `${i + 1}. ${r.title}\n${(r.description || '').slice(0, 200)}\nFuente: ${r.url}`
                ).join('\n\n');
                return textoDdg.slice(0, 1200);
            }
        } catch (ddgError) {
            console.log(`[Búsqueda] ❌ DuckDuckGo falló: ${ddgError.message}`);
        }

        return 'No se pudo buscar en internet en este momento. No tienes información actualizada.';
    }

    async clasificarPedido(toolCall, args, message, userId, chatBotSystem, repliedToMessage) {
        const nombre = toolCall.function.name;

        if (nombre === 'narrar_historia') {
            console.log("Audio Historia");
            return await this.ejecutarNarrarHistoria(message, userId, chatBotSystem, repliedToMessage);
        }

        if (nombre === 'buscar_web') {
            console.log("Busqueda Web");
            return await this.ejecutarBusqueda(args);
        }

        console.log("Reproducir Musica");        
        return await this.ejecutarMusicTool(args, message); 
    }
}

module.exports = ToolsSystem;