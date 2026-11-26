const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class ImageGenSystem {
    constructor() {
        this.providers = [
            { name: 'HuggingFace', fn: this.generateHuggingFace.bind(this) },
            { name: 'Pollinations', fn: this.generatePollinations.bind(this) },
            { name: 'Cloudflare',  fn: this.generateCloudflare.bind(this) },
        ];

        this.cooldowns = new Map();
        this.COOLDOWN_MS = 15000;
    }

    isValidImage(buffer) {
        if (!buffer || buffer.length < 10000) return false;
        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isWEBP = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
        return isPNG || isJPEG || isWEBP;
    }

    async generateHuggingFace(prompt) {
        const token = process.env.HUGGINGFACE_API_KEY;
        if (!token) throw new Error('HuggingFace: Falta HUGGINGFACE_API_KEY');

        const model = 'black-forest-labs/FLUX.1-schnell';
        const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: prompt }),
            signal: AbortSignal.timeout(60000)
        });

        if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));
        
        if (!this.isValidImage(buffer)) throw new Error('HuggingFace: Imagen vacía o corrupta');
        return { buffer, type: 'buffer' };
    }

    async generatePollinations(prompt) {
        const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=flux&width=768&height=768&safe=false`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));
        
        if (!this.isValidImage(buffer)) throw new Error('Pollinations: Imagen vacía o corrupta');
        return { buffer, type: 'buffer' };
    }

    async generateCloudflare(prompt) {
        const token = process.env.CLOUDFARE;
        const accountId = process.env.CLOUDFARE_ACCOUNT_ID;
        if (!token || !accountId) throw new Error('Cloudflare: Faltan credenciales');

        const model = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
        const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal: AbortSignal.timeout(60000)
            }
        );

        if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));
        
        if (!this.isValidImage(buffer)) throw new Error('Cloudflare: Imagen vacía o corrupta');
        return { buffer, type: 'buffer' };
    }

    async processImagine(message, args) {
        const prompt = args.slice(1).join(' ').trim();
        if (!prompt) return message.reply('❌ Debes proporcionar un prompt.');
        if (prompt.length > 500) return message.reply('❌ El prompt es muy largo (máximo 500 caracteres).');

        const userId = message.author.id;
        const lastUsed = this.cooldowns.get(userId) || 0;
        const remaining = this.COOLDOWN_MS - (Date.now() - lastUsed);
        if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            return message.reply(`⏳ Espera **${secs}s** antes de generar otra imagen.`);
        }

        const loadingMsg = await message.reply('🎨 Generando imagen...');
        const startTime = Date.now();
        const emojis = ['🎨', '🖌️', '✨', '🖼️'];
        let emojiIndex = 0;
        const loadingInterval = setInterval(() => {
            emojiIndex = (emojiIndex + 1) % emojis.length;
            loadingMsg.edit(`${emojis[emojiIndex]} Generando imagen...`).catch(() => {});
        }, 1500);

        let lastError = null;
        for (const provider of this.providers) {
            try {
                console.log(`🎨 Intentando ${provider.name}...`);
                const result = await provider.fn(prompt);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                this.cooldowns.set(userId, Date.now());

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

                clearInterval(loadingInterval);
                return;
            } catch (err) {
                console.warn(`⚠️ ${provider.name} falló: ${err.message}`);
                lastError = err;
            }
        }

        clearInterval(loadingInterval);
        await loadingMsg.edit(`❌ No se pudo generar la imagen. Todos los proveedores fallaron.\nÚltimo error: \`${lastError?.message || 'desconocido'}\``);
    }

    async processCommand(message) {
        if (message.author.bot) return;
        const content = message.content.toLowerCase();
        if (!content.startsWith('>imagine') && !content.startsWith('>img')) return;
        const args = message.content.split(' ');
        await this.processImagine(message, args);
    }
}

module.exports = ImageGenSystem;