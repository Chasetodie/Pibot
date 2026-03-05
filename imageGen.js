const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class ImageGenSystem {
    constructor() {
        // Orden de fallback: Pixazo → ImageGPT → ModelsLab → Cloudflare
        this.providers = [
            { name: 'Pixazo',     fn: this.generatePixazo.bind(this)     },
            { name: 'ImageGPT',   fn: this.generateImageGPT.bind(this)   },
            { name: 'Cloudflare', fn: this.generateCloudflare.bind(this) },
        ];

        // Cooldown por usuario: 15 segundos
        this.cooldowns = new Map();
        this.COOLDOWN_MS = 15000;
    }

    async generatePixazo(prompt) {
        const key = process.env.PIXAZO;
        if (!key) throw new Error('No PIXAZO key');

        const pixazoModels = [
            {
                name: 'Flux Schnell (FREE)',
                url: 'https://gateway.pixazo.ai/flux-schnell/v1/schnell/textToImage',
                body: {
                    prompt,
                    image_size: 'square_hd',
                    num_inference_steps: 4,
                    num_images: 1,
                    enable_safety_checker: true
                }
            },
            {
                name: 'Nano Banana 2',
                url: 'https://gateway.pixazo.ai/nano-banana-2/v1/nano-banana-2/generate',
                body: {
                    prompt,
                    aspect_ratio: '1:1'
                }
            },
            {
                name: 'Studio Ghibli',
                url: 'https://gateway.pixazo.ai/studio-ghibli/v1/studio-ghibli/generate',
                body: { prompt }
            },
            {
                name: 'Hunyuan',
                url: 'https://gateway.pixazo.ai/hunyuan-image/v1/hunyuan-image/generateRequest',
                body: {
                    prompt,
                    negative_prompt: 'blurry, cartoon, low quality, watermark',
                    image_size: 'square',
                    num_images: 1,
                    num_inference_steps: 28,
                    guidance_scale: 7.5,
                    enable_safety_checker: true,
                    output_format: 'png',
                    enable_prompt_expansion: true
                }
            },
            {
                name: 'Recraft v4 Pro',
                url: 'https://gateway.pixazo.ai/recraft-v4-pro/v1/recraft-v4-pro-request',
                body: {
                    prompt,
                    image_size: 'square_hd',
                    colors: [],
                    enable_safety_checker: true
                }
            },
            {
                name: 'P-Video (imagen)',
                url: 'https://gateway.pixazo.ai/p-video/v1/p-video/generate',
                body: { prompt }
            }
        ];

        for (const model of pixazoModels) {
            try {
                console.log(`🎨 Pixazo probando: ${model.name}`);
                const res = await fetch(model.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        'Ocp-Apim-Subscription-Key': key
                    },
                    body: JSON.stringify(model.body),
                    signal: AbortSignal.timeout(30000)
                });

                const text = await res.text();
                console.log(`Pixazo [${model.name}] status: ${res.status} | body: ${text.slice(0, 200)}`);
                if (!res.ok) {
                    console.warn(`Pixazo [${model.name}] falló HTTP ${res.status}, probando siguiente...`);
                    continue;
                }

                const data = JSON.parse(text);

                // Intentar extraer URL de distintas estructuras de respuesta
                const url = data?.images?.[0]?.url
                    || data?.url
                    || data?.image_url
                    || data?.output
                    || data?.output_url
                    || data?.result?.url
                    || data?.data?.url;

                if (!url) {
                    console.warn(`Pixazo [${model.name}]: no URL en respuesta, probando siguiente...`);
                    continue;
                }

                console.log(`✅ Pixazo éxito con ${model.name}`);
                return { url, type: 'url' };

            } catch (e) {
                console.warn(`Pixazo [${model.name}] error: ${e.message}, probando siguiente...`);
            }
        }

        throw new Error('Pixazo: todos los modelos fallaron');
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

        const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
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

        if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);

        // Cloudflare devuelve la imagen como binario directo
        const buffer = await res.arrayBuffer();
        if (!buffer || buffer.byteLength === 0) throw new Error('Cloudflare: respuesta vacía');
        return { buffer: Buffer.from(buffer), type: 'buffer' };
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