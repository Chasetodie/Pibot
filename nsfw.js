const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

class NSFWSystem {
    constructor() {
        this.isNSFWChannel = (channel) => channel.nsfw === true;

        this.rule34UserId = '5895418';
        this.rule34ApiKey = process.env.API_34;

        this.rule34Examples = ['hentai', 'pokemon', 'anime', '1girl', 'solo', 'yaoi', 'yuri', 'furry', 'trap', 'ass', 'boobs'];

        this.genders = {
            male: ['pibe', 'chico', 'macho', 'men', 'boy', 'masculino', 'hombre', 'varon'],
            female: ['piba', 'chica', 'mujer', 'girl', 'woman', 'femenino', 'nena']
        };
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────

    detectGender(nickname) {
        const lower = nickname.toLowerCase();
        for (const word of this.genders.male) if (lower.includes(word)) return 'male';
        for (const word of this.genders.female) if (lower.includes(word)) return 'female';
        return 'unknown';
    }

    isAnimated(url) {
        return /\.(gif|mp4|webm)$/i.test(url);
    }

    getFileName(url) {
        try {
            const filename = url.split('/').pop().split('?')[0];
            return filename.length > 50 ? filename.substring(0, 50) + '...' : filename;
        } catch {
            return 'unknown';
        }
    }

    // Parsear args: último argumento numérico = cantidad, resto = tags
    parseArgs(args, defaultTags = 'hentai', maxCount = 20) {
        let tags = defaultTags;
        let count = 1;

        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
                count = Math.min(parseInt(lastArg), maxCount);
                tags = args.slice(0, -1).join(' ') || defaultTags;
            } else {
                tags = args.join(' ');
            }
        }

        // Normalizar tags: minúsculas, espacios → +
        tags = tags.toLowerCase().trim();
        if (!tags) tags = defaultTags;

        return { tags, count };
    }

    // ─────────────────────────────────────────────
    // API RULE34 — UNA SOLA REQUEST, MÚLTIPLES POSTS
    // ─────────────────────────────────────────────

    async getRule34(tags, amount = 1) {
        try {
            // Normalizar tags y agregar filtros
            const normalizedTags = tags.toLowerCase().trim();
            const filteredTags = `${normalizedTags} -ai_generated -stable_diffusion -midjourney -dall-e`;

            // Pedir más del necesario para compensar filtros posteriores
            const requestLimit = Math.min(amount * 3, 100);
            const pid = Math.floor(Math.random() * 20); // Primeras páginas tienen más resultados

            const params = {
                page: 'dapi',
                s: 'post',
                q: 'index',
                limit: requestLimit,
                pid,
                tags: filteredTags,
                json: 1,
                user_id: this.rule34UserId
            };

            if (this.rule34ApiKey) params.api_key = this.rule34ApiKey;

            const response = await axios.get('https://api.rule34.xxx/index.php', {
                params,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000
            });

            console.log(`[NSFW] Rule34 tags="${filteredTags}" → ${response.data?.length ?? 0} posts`);

            if (!response.data || response.data.length === 0) return [];

            // Filtrar posts válidos y mezclar aleatoriamente
            const validPosts = response.data
                .filter(post => post.file_url)
                .sort(() => Math.random() - 0.5) // shuffle
                .slice(0, amount);

            return validPosts.map(post => ({
                url: post.file_url,
                source: 'Rule34.xxx',
                category: tags,
                artist: post.owner || 'Unknown',
                filename: this.getFileName(post.file_url),
                score: post.score || 0,
                tags: post.tags || '',
                id: post.id || 'N/A'
            }));

        } catch (error) {
            console.error('[NSFW] Error en Rule34:', error.message);
            return [];
        }
    }

    // ─────────────────────────────────────────────
    // EMBED + ENVÍO DE MEDIA
    // ─────────────────────────────────────────────

    createNSFWEmbed(item, title = '🔞 NSFW', extraDescription = '') {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#FF69B4')
            .setFooter({ text: `Proveedor: ${item.source}` })
            .setTimestamp();

        // Solo setImage para imágenes estáticas — GIFs y videos van como attachment
        const isStaticImage = /\.(jpg|jpeg|png|webp)$/i.test(item.url);
        if (isStaticImage) embed.setImage(item.url);

        if (extraDescription) embed.setDescription(extraDescription);

        embed.addFields(
            { name: '🏷️ Categoría', value: item.category.replace(/\+/g, ' '), inline: true },
            { name: '🎨 Artista', value: item.artist, inline: true },
            { name: '🌐 Fuente', value: item.source, inline: true }
        );

        if (item.id) embed.addFields({ name: '🆔 ID', value: item.id.toString(), inline: true });
        if (item.score !== undefined) embed.addFields({ name: '⭐ Score', value: item.score.toString(), inline: true });

        if (item.tags) {
            const tagsText = item.tags.split(' ').slice(0, 10).join(', ');
            if (tagsText) embed.addFields({
                name: '🏷️ Tags',
                value: tagsText.length > 1000 ? tagsText.substring(0, 1000) + '...' : tagsText,
                inline: false
            });
        }

        return embed;
    }

    // Envía media correctamente: adjunto para GIFs/videos, embed normal para imágenes
    async sendMediaReply(message, item, title = '🔞 NSFW', extraDescription = '') {
        const isGif = /\.gif$/i.test(item.url);
        const isVideo = /\.(mp4|webm)$/i.test(item.url);

        if (isGif || isVideo) {
            try {
const head = await axios.head(item.url, { timeout: 5000 }).catch(() => null);
const contentLength = head?.headers?.['content-length'];
if (contentLength && parseInt(contentLength) > 7 * 1024 * 1024) {
    // Muy grande — solo enviar link
    throw new Error('Request entity too large');
}

const response = await axios.get(item.url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
});

                const ext = item.url.split('.').pop().split('?')[0].toLowerCase();
                const filename = `media.${ext}`;
                const attachment = new AttachmentBuilder(Buffer.from(response.data), { name: filename });

                const embed = this.createNSFWEmbed(item, title, extraDescription);

                if (isGif) {
                    embed.setImage(`attachment://${filename}`);
                } else {
                    // Videos: no se pueden incrustar, solo link
                    embed.setDescription(`${extraDescription ? extraDescription + '\n\n' : ''}🎬 [Ver video en navegador](${item.url})`);
                }

                await message.reply({ embeds: [embed], files: [attachment] });

            } catch (err) {
                console.error('[NSFW] Error descargando media:', err.message);
                // Fallback: solo link
                const embed = this.createNSFWEmbed(item, title, extraDescription);
                embed.setDescription(`${extraDescription ? extraDescription + '\n\n' : ''}📎 [Click para ver](${item.url})\n*No se pudo adjuntar el archivo*`);
                await message.reply({ embeds: [embed] });
            }
        } else {
            // Imagen estática normal
            const embed = this.createNSFWEmbed(item, title, extraDescription);
            await message.reply({ embeds: [embed] });
        }
    }

    // ─────────────────────────────────────────────
    // COMANDOS
    // ─────────────────────────────────────────────

    async handleR34(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        const { tags, count } = this.parseArgs(args, 'hentai', 20);
        console.log(`[R34] tags="${tags}" count=${count}`);

        await message.channel.sendTyping();

        const results = await this.getRule34(tags, count);

        if (results.length === 0)
            return message.reply(`❌ No se encontraron resultados para: \`${tags.replace(/\+/g, ' ')}\`\n💡 Intenta con otros tags`);

        for (const item of results) {
            await this.sendMediaReply(message, item, '🔞 Rule34.xxx');
            if (results.length > 1) await new Promise(r => setTimeout(r, 800));
        }
    }

    async handleNSFW(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        const { tags, count } = this.parseArgs(args, 'hentai', 20);
        console.log(`[NSFW] tags="${tags}" count=${count}`);

        await message.channel.sendTyping();

        const results = await this.getRule34(tags, count);

        if (results.length === 0)
            return message.reply(`❌ No se encontraron resultados para: \`${tags.replace(/\+/g, ' ')}\`\n💡 Intenta con otros tags`);

        for (const item of results) {
            await this.sendMediaReply(message, item, '🔞 NSFW');
            if (results.length > 1) await new Promise(r => setTimeout(r, 800));
        }
    }

    async handleGifs(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        const { tags, count } = this.parseArgs(args, 'hentai', 20);
        console.log(`[GIFS] tags="${tags}" count=${count}`);

        await message.channel.sendTyping();

        // Pedir más para compensar el filtro de solo GIFs
        const results = await this.getRule34(`${tags}+animated`, count * 4);
        const gifs = results.filter(item => /\.gif$/i.test(item.url)).slice(0, count);

        if (gifs.length === 0)
            return message.reply(`❌ No se encontraron GIFs para: \`${tags.replace(/\+/g, ' ')}\`\n💡 Intenta con: hentai, pokemon, anime`);

        for (const item of gifs) {
            await this.sendMediaReply(message, item, '🔞 GIF');
            if (gifs.length > 1) await new Promise(r => setTimeout(r, 800));
        }
    }

    async handleVideos(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        const { tags, count } = this.parseArgs(args, 'hentai', 10);
        console.log(`[VIDEOS] tags="${tags}" count=${count}`);

        await message.channel.sendTyping();

        const results = await this.getRule34(`${tags}+video+animated`, count * 5);
        const videos = results.filter(item => /\.(mp4|webm)$/i.test(item.url)).slice(0, count);

        if (videos.length === 0)
            return message.reply(`❌ No se encontraron videos para: \`${tags.replace(/\+/g, ' ')}\`\n💡 Los videos son más escasos, intenta: hentai, sex`);

        for (const item of videos) {
            await this.sendMediaReply(message, item, '🔞 Video');
            if (videos.length > 1) await new Promise(r => setTimeout(r, 800));
        }
    }

    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        let targetUser = null;
        if (message.mentions.members.size > 0) {
            targetUser = message.mentions.members.first();
        } else if (message.reference) {
            const replied = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = replied.member;
        }

        if (!targetUser)
            return message.reply('❌ Debes mencionar a alguien o responder a su mensaje.\n**Ejemplo:** `>fuck @usuario`');

        await message.channel.sendTyping();

        const results = await this.getRule34('sex+animated', 15);
        const gifs = results.filter(item => /\.gif$/i.test(item.url));

        if (gifs.length === 0)
            return message.reply('❌ No se encontraron GIFs. Intenta de nuevo.');

        const selected = gifs[Math.floor(Math.random() * gifs.length)];
        const person1 = message.author.displayName;
        const person2 = targetUser.displayName;

        await this.sendMediaReply(message, selected, '🔞 FUCK', `💕 **${person1}** se folló a **${person2}** 💕`);
    }

    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel))
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');

        let targetUser = null;
        if (message.mentions.members.size > 0) {
            targetUser = message.mentions.members.first();
        } else if (message.reference) {
            const replied = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = replied.member;
        }

        if (!targetUser)
            return message.reply('❌ Debes mencionar a alguien o responder a su mensaje.\n**Ejemplo:** `>fd @usuario`');

        const authorNickname = message.author.displayName;
        const targetNickname = targetUser.displayName;
        const authorGender = this.detectGender(authorNickname);
        const targetGender = this.detectGender(targetNickname);

        console.log(`[FD] ${authorNickname}(${authorGender}) x ${targetNickname}(${targetGender})`);

        await message.channel.sendTyping();

        let category = 'sex';
        let genderText = '👫 Hetero';

        if (authorGender === 'male' && targetGender === 'male') {
            category = 'yaoi'; genderText = '👨‍❤️‍👨 Yaoi (Pibe x Pibe)';
        } else if (authorGender === 'female' && targetGender === 'female') {
            category = 'yuri'; genderText = '👩‍❤️‍👩 Yuri (Piba x Piba)';
        } else if (
            (authorGender === 'male' && targetGender === 'female') ||
            (authorGender === 'female' && targetGender === 'male')
        ) {
            category = 'sex'; genderText = '👫 Hetero (Pibe x Piba)';
        } else {
            category = 'sex'; genderText = '👫 Hetero (géneros no detectados)';
        }

        const results = await this.getRule34(`${category}+animated`, 15);
        const gifs = results.filter(item => /\.gif$/i.test(item.url));

        if (gifs.length === 0)
            return message.reply('❌ No se encontraron GIFs para esta categoría. Intenta de nuevo.');

        const selected = gifs[Math.floor(Math.random() * gifs.length)];
        const person1 = message.author.displayName;
        const person2 = targetUser.displayName;

        const description =
            `**Autor:** ${person1} (${authorGender})\n` +
            `**Target:** ${person2} (${targetGender})\n` +
            `**Categoría:** ${genderText}\n\n` +
            `💕 **${person1}** se folló a **${person2}** 💕`;

        await this.sendMediaReply(message, selected, '🔞 FuckDetect', description);
    }

    // ─────────────────────────────────────────────
    // ROUTER
    // ─────────────────────────────────────────────

    async processCommand(message) {
        const args = message.content.split(' ').slice(1);
        const command = message.content.toLowerCase().split(' ')[0];

        try {
            switch (command) {
                case '>r34':      await this.handleR34(message, args); break;
                case '>nsfw':     await this.handleNSFW(message, args); break;
                case '>gifs':     await this.handleGifs(message, args); break;
                case '>videos':   await this.handleVideos(message, args); break;
                case '>fuck':     await this.handleFuck(message, args); break;
                case '>fuckdetect':
                case '>fd':       await this.handleFuckDetect(message, args); break;
            }
        } catch (error) {
            console.error('❌ Error en sistema NSFW:', error);
            await message.reply('❌ Ocurrió un error. Intenta de nuevo.');
        }
    }
}

module.exports = NSFWSystem;
