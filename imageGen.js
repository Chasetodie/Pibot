const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class ImageGenSystem {
    constructor() {
        this.providers = [
            { name: 'Cloudflare', fn: this.generateCloudflare.bind(this) },
            { name: 'ImageGPT',   fn: this.generateImageGPT.bind(this)   },
        ];

        // Cooldown por usuario: 15 segundos
        this.cooldowns = new Map();
        this.COOLDOWN_MS = 15000;
    }

    async generateImageGPT(prompt) {
        const key = process.env.IMAGEGPT;
        if (!key) throw new Error('No IMAGEGPT key');

        const res = await fetch('https://api.imagegpt.online/generate/text-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key
            },
            body: JSON.stringify({
                prompt,
                width: 512,
                height: 512,
                model: 'flux',  // ← corregido
                outputType: 'url'
            }),
            signal: AbortSignal.timeout(30000)
        });

        const text = await res.text();
        console.log(`ImageGPT status: ${res.status} | body: ${text.slice(0, 300)}`);
        if (!res.ok) throw new Error(`ImageGPT HTTP ${res.status}`);

        const data = JSON.parse(text);
        const url = data?.url || data?.image_url || data?.output || data?.data?.url;
        if (!url) throw new Error(`ImageGPT: no URL. Respuesta: ${text.slice(0, 200)}`);
        return { url, type: 'url' };
    }

    // ─── CLOUDFLARE ───────────────────────────────────────────────────────────
    // Modelo: Stable Diffusion XL via REST API de Cloudflare
    // Requiere: Account ID y API Token con permisos de Workers AI
    async generateCloudflare(prompt) {
        const token = process.env.CLOUDFARE;
        const accountId = process.env.CLOUDFARE_ACCOUNT_ID;
        if (!token || !accountId) throw new Error('No CLOUDFARE key o CLOUDFARE_ACCOUNT_ID');

        const cfModels = [
            /*'@cf/black-forest-labs/flux-1-schnell',  */       // FLUX clásico rápido
            '@cf/stabilityai/stable-diffusion-xl-base-1.0', // SDXL estable*/
            //'@cf/runwayml/stable-diffusion-v1-5',           // SD 1.5 fallback
        ];

        for (const model of cfModels) {
            try {
                console.log(`☁️ Cloudflare probando: ${model}`);
                const res = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt }),
                        signal: AbortSignal.timeout(60000)
                    }
                );

                if (!res.ok) {
                    const err = await res.text();
                    console.warn(`☁️ Cloudflare [${model}] HTTP ${res.status}: ${err.slice(0, 100)}`);
                    continue;
                }

const arrayBuffer = await res.arrayBuffer();
if (!arrayBuffer || arrayBuffer.byteLength < 100) {
    console.warn(`☁️ Cloudflare [${model}]: buffer vacío`);
    continue;
}
// Convertir correctamente a Buffer de Node.js
const buffer = Buffer.from(new Uint8Array(arrayBuffer));
console.log(`✅ Cloudflare éxito con ${model} | tamaño: ${buffer.length} bytes`);
return { buffer, type: 'buffer' };
            } catch (e) {
                console.warn(`☁️ Cloudflare [${model}] error: ${e.message}`);
            }
        }

        throw new Error('Cloudflare: todos los modelos fallaron');
    }

    // ─── COMANDO PRINCIPAL ────────────────────────────────────────────────────
    async processImagine(message, args) {
        const prompt = args.slice(1).join(' ').trim();

        if (!prompt) {
            return message.reply('❌ Debes proporcionar un prompt.\nEjemplo: `>imagine un gato astronauta en la luna`');
        }

        if (prompt.length > 500) {
            return message.reply('❌ El prompt es muy largo (máximo 500 caracteres).');
        }

        // Cooldown por usuario
        const userId = message.author.id;
        const lastUsed = this.cooldowns.get(userId) || 0;
        const remaining = this.COOLDOWN_MS - (Date.now() - lastUsed);
        if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            return message.reply(`⏳ Espera **${secs}s** antes de generar otra imagen.`);
        }

        const loadingMsg = await message.reply('🎨 Generando imagen...');
        const startTime = Date.now();

        let lastError = null;
        for (const provider of this.providers) {
            try {
                console.log(`🎨 Intentando ${provider.name}...`);
                const result = await provider.fn(prompt);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                // Éxito — actualizar cooldown
                this.cooldowns.set(userId, Date.now());

                // Construir embed
                const embed = new EmbedBuilder()
                    .setTitle('🎨 Imagen Generada')
                    .setDescription(`**Prompt:** ${prompt}`)
                    .setColor('#9932CC')
                    .setFooter({ text: `Generado con ${provider.name} • ${elapsed}s • solicitado por ${message.author.username}` })
                    .setTimestamp();

                if (result.type === 'url') {
                    embed.setImage(result.url);
                    await loadingMsg.edit({ content: '', embeds: [embed] });
} else if (result.type === 'buffer') {
    const attachment = new AttachmentBuilder(result.buffer, { name: 'imagen.png' });
    embed.setImage('attachment://imagen.png');
    await loadingMsg.edit({ content: '', embeds: [embed], files: [attachment] });
                }

                return;
            } catch (err) {
                console.warn(`⚠️ ${provider.name} falló: ${err.message}`);
                lastError = err;
            }
        }

        // Todos fallaron
        await loadingMsg.edit(`❌ No se pudo generar la imagen. Todos los proveedores fallaron.\nÚltimo error: \`${lastError?.message || 'desconocido'}\``);
    }

    async processCommand(message) {
        if (message.author.bot) return;
        
        const content = message.content.toLowerCase();
        if (!content.startsWith('>imagine') && !content.startsWith('>img')) return;

        const args = message.content.split(' '); // sin toLowerCase para preservar el prompt
        await this.processImagine(message, args);
    }
}

module.exports = ImageGenSystem;
