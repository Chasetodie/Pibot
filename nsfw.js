const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class NSFWSystem {
    constructor() {
        this.isNSFWChannel = (channel) => channel.nsfw === true;
        
        // Credenciales de Rule34.xxx
        this.rule34UserId = '5895418';  // ← Tu user_id
        this.rule34ApiKey = process.env.API_34;  // ← Vacío por ahora
        
        // Ejemplos de categorías (pero acepta CUALQUIER categoría)
        this.rule34Examples = ['hentai', 'pokemon', 'anime', '1girl', 'solo', 'yaoi', 'yuri', 'furry', 'trap', 'ass', 'boobs'];
        
        this.genders = {
            male: ['pibe', 'chico', 'macho', 'men', 'boy', 'masculino', 'hombre', 'varon'],
            female: ['piba', 'chica', 'mujer', 'girl', 'woman', 'femenino', 'nena']
        };
    }

    detectGender(nickname) {
        const lower = nickname.toLowerCase();
        
        for (const word of this.genders.male) {
            if (lower.includes(word)) return 'male';
        }
        
        for (const word of this.genders.female) {
            if (lower.includes(word)) return 'female';
        }
        
        return 'unknown';
    }

    // Verificar si es GIF o video
    isAnimated(url) {
        return url.endsWith('.gif') || url.endsWith('.mp4') || url.endsWith('.webm');
    }

    // Extraer nombre del archivo
    getFileName(url) {
        try {
            const parts = url.split('/');
            const filename = parts[parts.length - 1].split('?')[0];
            return filename.length > 50 ? filename.substring(0, 50) + '...' : filename;
        } catch {
            return 'unknown';
        }
    }

    // Obtener imagen de Rule34.xxx (con JSON y autenticación)
    async getRule34(tags, amount = 1) {
        try {
            const results = [];

            const filteredTags = tags + ' -ai_generated -stable_diffusion -midjourney -dall-e';
            
            for (let i = 0; i < amount; i++) {
                const pid = Math.floor(Math.random() * 100);
                
                // Preparar params con o sin api_key
                const params = {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    limit: 100,
                    pid: pid,
                    tags: filteredTags,
                    json: 1,
                    user_id: this.rule34UserId
                };
                
                // Solo agregar api_key si no está vacío
                if (this.rule34ApiKey) {
                    params.api_key = this.rule34ApiKey;
                }
                
                const response = await axios.get('https://api.rule34.xxx/index.php', {
                    params: params,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000
                });

                console.log('[NSFW] Rule34 respuesta:', response.data ? `${response.data.length} posts` : 'Vacío');

                if (!response.data || response.data.length === 0) {
                    console.log('[NSFW] No hay posts para estos tags');
                    continue;
                }

                // Filtrar posts con file_url válido
                const validPosts = response.data.filter(post => post.file_url);

                if (validPosts.length > 0) {
                    const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];
                    
                    results.push({
                        url: randomPost.file_url,
                        source: 'Rule34.xxx',
                        category: tags,
                        artist: randomPost.owner || 'Unknown',
                        filename: this.getFileName(randomPost.file_url),
                        score: randomPost.score || 0,
                        tags: randomPost.tags || '',
                        id: randomPost.id || 'N/A'
                    });
                }
                
                if (i < amount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log('[NSFW] Rule34:', results.length, 'resultados');
            return results;

        } catch (error) {
            console.error('[NSFW] Error en Rule34:', error.message);
            return [];
        }
    }

    // Filtrar solo GIFs/videos
    filterAnimated(results) {
        return results.filter(item => this.isAnimated(item.url));
    }

    // Filtrar solo imágenes
    filterImages(results) {
        return results.filter(item => !this.isAnimated(item.url));
    }

    createNSFWEmbed(item, title = '🔞 NSFW') {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#FF69B4')
            .setFooter({ text: `Proveedor: ${item.source}` })
            .setTimestamp();

        // Detectar tipo de contenido
        const isImage = item.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        const isVideo = item.url.match(/\.(mp4|webm)$/i);

        if (isImage) {
            // Para imágenes y GIFs, usar setImage
            embed.setImage(item.url);
        } else if (isVideo) {
            // Para videos, incrustar en el mismo embed
            embed.setImage(item.url); // Discord intentará mostrar el video
            embed.setDescription(`🎬 **Video:** [Abrir en navegador](${item.url})\n*Si no se reproduce, usa el link*`);
        } else {
            // Para otros formatos
            embed.setDescription(`📎 **[Click para ver contenido](${item.url})**`);
        }

        // Campos de información
        embed.addFields(
            { name: '📂 Nombre', value: item.filename, inline: true },
            { name: '🏷️ Categoría', value: item.category, inline: true },
            { name: '🎨 Artista', value: item.artist, inline: true },
            { name: '🌐 Fuente', value: item.source, inline: true }
        );

        // Si tiene ID (de Rule34)
        if (item.id) {
            embed.addFields({ name: '🆔 ID', value: item.id.toString(), inline: true });
        }

        // Si tiene score (de Rule34)
        if (item.score !== undefined) {
            embed.addFields({ name: '⭐ Score', value: item.score.toString(), inline: true });
        }
        
        // Si tiene tags (de Rule34)
        if (item.tags) {
            const tagsArray = item.tags.split(' ').slice(0, 10);
            const tagsText = tagsArray.join(', ');
            if (tagsText.length > 0) {
                const truncatedTags = tagsText.length > 1000 ? tagsText.substring(0, 1000) + '...' : tagsText;
                embed.addFields({ 
                    name: '🏷️ Tags', 
                    value: truncatedTags, 
                    inline: false 
                });
            }
        }

        return embed;
    }

    // Comando !r34 <tags> <cantidad> (usando Rule34.xxx)
    async handleR34(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // ← NUEVO: Procesar argumentos correctamente
        let tags = 'hentai';
        let count = 1;

        if (args.length > 0) {
            // El último argumento puede ser un número
            const lastArg = args[args.length - 1];
            
            if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
                // Último arg es número -> es la cantidad
                count = Math.min(parseInt(lastArg), 10);
                tags = args.slice(0, -1).join(' '); // Todo lo demás son tags
            } else {
                // No hay número -> todos son tags
                tags = args.join(' ');
                count = 1;
            }
        }

        // Si tags quedó vacío, usar default
        if (!tags || tags.trim() === '') {
            tags = 'hentai';
        }

        console.log('[NSFW DEBUG] Tags finales:', tags);
        console.log('[NSFW DEBUG] Cantidad:', count);

        await message.channel.sendTyping();

        const results = await this.getRule34(tags, count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${tags}\`\n**Intenta con otros tags**`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 Rule34.xxx');
            await message.reply({ embeds: [embed] });
            
            if (results.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Comando !nsfw <categoría> <cantidad> (fusión de los 3 proveedores)
    async handleNSFW(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // Procesar argumentos correctamente
        let tags = 'hentai';
        let count = 1;

        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            
            if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
                // Último arg es número -> es la cantidad
                count = Math.min(parseInt(lastArg), 10);
                tags = args.slice(0, -1).join(' '); // Todo lo demás son tags
            } else {
                // No hay número -> todos son tags
                tags = args.join(' ');
                count = 1;
            }
        }

        // Si tags quedó vacío, usar default
        if (!tags || tags.trim() === '') {
            tags = 'hentai';
        }

        console.log('[NSFW DEBUG] Tags finales:', tags);
        console.log('[NSFW DEBUG] Cantidad:', count);

        await message.channel.sendTyping();

        const results = await this.getRule34(tags + ' -ai_generated', count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${tags}\`\n**Intenta con otros tags**`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 NSFW');
            await message.reply({ embeds: [embed] });
            
            if (results.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async handleGifs(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // Procesar argumentos correctamente
        let tags = 'hentai';
        let count = 1;

        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            
            if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
                // Último arg es número -> es la cantidad
                count = Math.min(parseInt(lastArg), 10);
                tags = args.slice(0, -1).join(' '); // Todo lo demás son tags
            } else {
                // No hay número -> todos son tags
                tags = args.join(' ');
                count = 1;
            }
        }

        // Si tags quedó vacío, usar default
        if (!tags || tags.trim() === '') {
            tags = 'hentai';
        }

        console.log('[GIFS DEBUG] Tags finales:', tags);
        console.log('[GIFS DEBUG] Cantidad:', count);

        await message.channel.sendTyping();

        // Buscar con "animated" para obtener GIFs
        const rule34Results = await this.getRule34(tags + ' animated -ai_generated', count * 3);
        
        // Filtrar SOLO GIFs (no videos)
        const gifs = rule34Results.filter(item => item.url.endsWith('.gif'));

        if (gifs.length === 0) {
            return message.reply(`❌ No se encontraron GIFs para: \`${tags}\`\n💡 Intenta con: hentai, pokemon, anime`);
        }

        const selected = gifs.slice(0, count);

        for (const item of selected) {
            const embed = this.createNSFWEmbed(item, '🔞 GIF');
            await message.reply({ embeds: [embed] });
            
            if (selected.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async handleVideos(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // Procesar argumentos correctamente
        let tags = 'hentai';
        let count = 1;

        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            
            if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
                // Último arg es número -> es la cantidad
                count = Math.min(parseInt(lastArg), 10);
                tags = args.slice(0, -1).join(' '); // Todo lo demás son tags
            } else {
                // No hay número -> todos son tags
                tags = args.join(' ');
                count = 1;
            }
        }

        // Si tags quedó vacío, usar default
        if (!tags || tags.trim() === '') {
            tags = 'hentai';
        }

        console.log('[VIDEOS DEBUG] Tags finales:', tags);
        console.log('[VIDEOS DEBUG] Cantidad:', count);

        await message.channel.sendTyping();

        // Buscar videos específicamente
        const rule34Results = await this.getRule34(tags + ' video animated -ai_generated', count * 5);
        
        // Filtrar SOLO videos
        const videos = rule34Results.filter(item => 
            item.url.endsWith('.mp4') || item.url.endsWith('.webm')
        );

        if (videos.length === 0) {
            return message.reply(`❌ No se encontraron videos para: \`${tags}\`\n💡 Los videos son raros, intenta: hentai, sex, pokemon`);
        }

        const selected = videos.slice(0, count);

        for (const item of selected) {
            const embed = this.createNSFWEmbed(item, '🔞 Video');
            await message.reply({ embeds: [embed] });
            
            if (selected.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Comando !fuck mejorado (requiere mención o reply)
    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        let targetUser = null;
        
        if (message.mentions.members.size > 0) {
            targetUser = message.mentions.members.first();
        } else if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = repliedMessage.member;
        }
        
        if (!targetUser) {
            return message.reply('❌ Debes mencionar a alguien o responder a su mensaje.\n**Ejemplo:** `!fuck @usuario`');
        }

        await message.channel.sendTyping();

        // ← CAMBIAR: Buscar SOLO GIFs desde el principio con límite bajo
        const rule34Results = await this.getRule34('sex animated -ai_generated', 5);
        
        // Filtrar SOLO GIFs (no videos)
        const gifs = rule34Results.filter(item => item.url.endsWith('.gif'));

        if (gifs.length === 0) {
            return message.reply('❌ No se encontraron GIFs. Intenta de nuevo.');
        }

        const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

        // ← ARREGLAR: El autor del comando se folla al mencionado
        const person1 = message.author.displayName; // Quien ejecuta el comando
        const person2 = targetUser.displayName;     // Quien fue mencionado

        const embed = new EmbedBuilder()
            .setTitle('🔞 FUCK')
            .setDescription(`💕 **${person1}** se folló a **${person2}** 💕`)
            .setImage(selectedGif.url) // GIF siempre se puede mostrar con setImage
            .setColor('#FF0069')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: 'Disfruta responsablemente 🔞' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Comando !fuckdetect mejorado (requiere mención o reply)
    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        let targetUser = null;
        
        if (message.mentions.members.size > 0) {
            targetUser = message.mentions.members.first();
        } else if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            targetUser = repliedMessage.member;
        }
        
        if (!targetUser) {
            return message.reply('❌ Debes mencionar a alguien o responder a su mensaje.\n**Ejemplo:** `!fd @usuario`');
        }

        // ← CAMBIAR: Detectar género de AMBOS usuarios
        const authorNickname = message.author.displayName;
        const targetNickname = targetUser.displayName;
        
        const authorGender = this.detectGender(authorNickname);
        const targetGender = this.detectGender(targetNickname);

        console.log('[FD DEBUG] Autor:', authorNickname, '- Género:', authorGender);
        console.log('[FD DEBUG] Target:', targetNickname, '- Género:', targetGender);

        await message.channel.sendTyping();

        let category = 'sex';
        let genderText = '👫 Hetero';

        // Determinar categoría según combinación de géneros
        if (authorGender === 'male' && targetGender === 'male') {
            category = 'yaoi';
            genderText = '👨‍❤️‍👨 Yaoi (Pibe x Pibe)';
        } else if (authorGender === 'female' && targetGender === 'female') {
            category = 'yuri';
            genderText = '👩‍❤️‍👩 Yuri (Piba x Piba)';
        } else if (
            (authorGender === 'male' && targetGender === 'female') ||
            (authorGender === 'female' && targetGender === 'male')
        ) {
            category = 'sex';
            genderText = '👫 Hetero (Pibe x Piba)';
        } else {
            // Si no detecta ninguno, asumir hetero
            category = 'sex';
            genderText = '👫 Hetero (géneros no detectados)';
        }

        console.log('[FD DEBUG] Categoría seleccionada:', category);

        // Buscar SOLO GIFs
        const rule34Results = await this.getRule34(category + ' animated -ai_generated', 5);
        const gifs = rule34Results.filter(item => item.url.endsWith('.gif'));

        if (gifs.length === 0) {
            return message.reply('❌ No se encontraron GIFs para esta categoría. Intenta de nuevo.');
        }

        const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

        const person1 = message.author.displayName;
        const person2 = targetUser.displayName;

        const embed = new EmbedBuilder()
            .setTitle('🔞 FuckDetect')
            .setDescription(
                `**Autor:** ${person1} (${authorGender || 'desconocido'})\n` +
                `**Target:** ${person2} (${targetGender || 'desconocido'})\n` +
                `**Categoría:** ${genderText}\n\n` +
                `💕 **${person1}** se folló a **${person2}** 💕`
            )
            .setImage(selectedGif.url)
            .setColor('#FF1493')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🏷️ Categoría', value: selectedGif.category, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: `Basado en apodos: ${authorNickname} + ${targetNickname}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Procesador de comandos
    async processCommand(message) {
        const args = message.content.split(' ').slice(1);
        const command = message.content.toLowerCase().split(' ')[0];

        try {
            switch (command) {
                case '>r34':
                    await this.handleR34(message, args);
                    break;

                case '>nsfw':
                    await this.handleNSFW(message, args);
                    break;

                case '>gifs':
                    await this.handleGifs(message, args);
                    break;

                case '>videos':
                    await this.handleVideos(message, args);
                    break;

                case '>fuck':
                    await this.handleFuck(message, args);
                    break;

                case '>fuckdetect':
                case '>fd':
                    await this.handleFuckDetect(message, args);
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema NSFW:', error);
            await message.reply('❌ Ocurrió un error. Intenta de nuevo.');
        }
    }
}

module.exports = NSFWSystem;