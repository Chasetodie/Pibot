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
        this.waifuExamples = ['waifu', 'neko', 'trap', 'blowjob'];
        this.nekosExamples = ['neko', 'kitsune', 'waifu', 'husbando'];
        
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
            
            for (let i = 0; i < amount; i++) {
                const pid = Math.floor(Math.random() * 100);
                
                // Preparar params con o sin api_key
                const params = {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    limit: 100,
                    pid: pid,
                    tags: tags,
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

    // Obtener contenido de Waifu.pics (acepta cualquier categoría)
    async getWaifuPics(category = 'waifu', type = 'nsfw', amount = 1) {
        try {
            const results = [];
            
            for (let i = 0; i < amount; i++) {
                const response = await axios.get(`https://api.waifu.pics/${type}/${category}`, {
                    timeout: 10000
                });

                if (response.data && response.data.url) {
                    results.push({
                        url: response.data.url,
                        source: 'Waifu.pics',
                        category: category,
                        artist: 'Unknown',
                        filename: this.getFileName(response.data.url)
                    });
                }
                
                if (i < amount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log('[NSFW] Waifu.pics:', results.length, 'resultados');
            return results;

        } catch (error) {
            console.error('[NSFW] Error en Waifu.pics:', error.message);
            return [];
        }
    }

    // Obtener contenido de Nekos.best (acepta cualquier categoría)
    async getNekosBest(category = 'neko', amount = 1) {
        try {
            const response = await axios.get(`https://nekos.best/api/v2/${category}`, {
                params: { amount: Math.min(amount, 20) },
                timeout: 10000
            });

            if (!response.data || !response.data.results) {
                return [];
            }

            const results = response.data.results.map(item => ({
                url: item.url,
                source: 'Nekos.best',
                category: category,
                artist: item.artist_name || item.artist_href || 'Unknown',
                filename: this.getFileName(item.url),
                anime: item.anime_name || null
            }));

            console.log('[NSFW] Nekos.best:', results.length, 'resultados');
            return results;

        } catch (error) {
            console.error('[NSFW] Error en Nekos.best:', error.message);
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

    // Crear embed con información completa
    createNSFWEmbed(item, title = '🔞 NSFW') {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setImage(item.url)
            .setColor('#FF69B4')
            .addFields(
                { name: '📂 Nombre', value: item.filename, inline: true },
                { name: '🏷️ Categoría', value: item.category, inline: true },
                { name: '🎨 Artista', value: item.artist, inline: true },
                { name: '🌐 Fuente', value: item.source, inline: true }
            )
            .setFooter({ text: `Proveedor: ${item.source}` })
            .setTimestamp();

        // Si tiene ID (de Rule34)
        if (item.id) {
            embed.addFields({ name: '🆔 ID', value: item.id.toString(), inline: true });
        }

        // Si tiene score (de Rule34)
        if (item.score !== undefined) {
            embed.addFields({ name: '⭐ Score', value: item.score.toString(), inline: true });
        }

        // Si tiene anime (de Nekos.best)
        if (item.anime) {
            embed.addFields({ name: '📺 Anime', value: item.anime, inline: true });
        }
        
        // Si tiene tags (de Rule34) - mostrar solo los primeros
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

        const tags = args[0] || 'hentai';
        const count = Math.min(parseInt(args[1]) || 1, 5);

        await message.channel.sendTyping();

        const results = await this.getRule34(tags, count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${tags}\`\n**Puedes usar cualquier tag de Rule34.xxx**\n**Ejemplos:** ${this.rule34Examples.slice(0, 5).join(', ')}`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 Rule34.xxx');
            await message.reply({ embeds: [embed] });
            
            if (results.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Comando !waifu <categoría> <cantidad>
    async handleWaifu(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'waifu';
        const count = Math.min(parseInt(args[1]) || 1, 5);

        await message.channel.sendTyping();

        const results = await this.getWaifuPics(category, 'nsfw', count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${category}\`\n**Ejemplos de categorías:** ${this.waifuExamples.join(', ')}`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 Waifu.pics');
            await message.reply({ embeds: [embed] });
            
            if (results.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Comando !neko <categoría> <cantidad>
    async handleNeko(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'neko';
        const count = Math.min(parseInt(args[1]) || 1, 5);

        await message.channel.sendTyping();

        const results = await this.getNekosBest(category, count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${category}\`\n**Ejemplos de categorías:** ${this.nekosExamples.join(', ')}`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 Nekos.best');
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

        const category = args[0] || 'waifu';
        const count = Math.min(parseInt(args[1]) || 1, 5);

        await message.channel.sendTyping();

        // Intentar con los 3 proveedores en orden
        let results = [];
        
        // Intentar Rule34 primero
        results = await this.getRule34(category, count);
        
        // Si no hay resultados, intentar Waifu.pics
        if (results.length === 0) {
            results = await this.getWaifuPics(category, 'nsfw', count);
        }
        
        // Si aún no hay, intentar Nekos.best
        if (results.length === 0) {
            results = await this.getNekosBest(category, count);
        }

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${category}\`\n**Intenta con otras categorías o usa !nsfwhelp**`);
        }

        for (const item of results) {
            const embed = this.createNSFWEmbed(item, '🔞 NSFW');
            await message.reply({ embeds: [embed] });
            
            if (results.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Comando !gifs <categoría> <cantidad>
    async handleGifs(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'waifu';
        const count = Math.min(parseInt(args[1]) || 1, 3);

        await message.channel.sendTyping();

        // Obtener de los 3 proveedores
        const rule34Results = await this.getRule34(category, count * 2);
        const waifuResults = await this.getWaifuPics(category, 'nsfw', count * 2);
        const nekosResults = await this.getNekosBest(category, count * 2);
        
        const allResults = [...rule34Results, ...waifuResults, ...nekosResults];
        const gifs = this.filterAnimated(allResults);

        if (gifs.length === 0) {
            return message.reply(`❌ No se encontraron GIFs para: \`${category}\``);
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

    // Comando !videos <categoría> <cantidad>
    async handleVideos(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'waifu';
        const count = Math.min(parseInt(args[1]) || 1, 3);

        await message.channel.sendTyping();

        // Obtener de los 3 proveedores
        const rule34Results = await this.getRule34(category, count * 3);
        const waifuResults = await this.getWaifuPics(category, 'nsfw', count * 3);
        const nekosResults = await this.getNekosBest(category, count * 3);
        
        const allResults = [...rule34Results, ...waifuResults, ...nekosResults];
        const videos = allResults.filter(item => 
            item.url.endsWith('.mp4') || item.url.endsWith('.webm')
        );

        if (videos.length === 0) {
            return message.reply(`❌ No se encontraron videos para: \`${category}\``);
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

    // Comando !fuck mejorado
    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        await message.channel.sendTyping();

        // Obtener GIFs de los 3 proveedores
        const rule34Results = await this.getRule34('sex animated', 10);
        const waifuResults = await this.getWaifuPics('blowjob', 'nsfw', 5);
        
        const allResults = [...rule34Results, ...waifuResults];
        const gifs = this.filterAnimated(allResults);

        let selectedGif = null;

        if (gifs.length > 0) {
            selectedGif = gifs[Math.floor(Math.random() * gifs.length)];
        } else {
            // Fallback a cualquier resultado
            const fallback = await this.getWaifuPics('waifu', 'nsfw', 3);
            selectedGif = fallback[0];
        }

        if (!selectedGif) {
            return message.reply('❌ No se pudo obtener un GIF. Intenta de nuevo.');
        }

        // Crear nombres aleatorios para el embed
        const names1 = ['Sakura', 'Hinata', 'Asuna', 'Mikasa', 'Rem', 'Zero Two', 'Megumin', 'Nezuko', 'Rias', 'Aqua'];
        const names2 = ['Naruto', 'Kirito', 'Eren', 'Subaru', 'Hiro', 'Kazuma', 'Tanjiro', 'Issei', 'Luffy', 'Goku'];
        
        const person1 = names1[Math.floor(Math.random() * names1.length)];
        const person2 = names2[Math.floor(Math.random() * names2.length)];

        const embed = new EmbedBuilder()
            .setTitle('🔞 FUCK')
            .setDescription(`💕 **${person1}** hizo el amor con **${person2}** 💕`)
            .setImage(selectedGif.url)
            .setColor('#FF0069')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: 'Disfruta responsablemente 🔞' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Comando !fuckdetect mejorado
    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const targetUser = message.mentions.members.first() || message.member;
        const nickname = targetUser.displayName;
        const gender = this.detectGender(nickname);

        await message.channel.sendTyping();

        let category = 'sex';
        let genderText = '👫 Hetero';

        if (gender === 'male') {
            category = 'yaoi';
            genderText = '👨‍❤️‍👨 Yaoi';
        } else if (gender === 'female') {
            category = 'yuri';
            genderText = '👩‍❤️‍👩 Yuri';
        }

        // Buscar en los 3 proveedores
        const rule34Results = await this.getRule34(category + ' animated', 10);
        const waifuResults = await this.getWaifuPics(category === 'yaoi' ? 'trap' : 'waifu', 'nsfw', 5);
        
        const allResults = [...rule34Results, ...waifuResults];
        const gifs = this.filterAnimated(allResults);

        let selectedGif = null;

        if (gifs.length > 0) {
            selectedGif = gifs[Math.floor(Math.random() * gifs.length)];
        } else {
            // Fallback
            const fallback = await this.getRule34(category, 3);
            selectedGif = fallback[0];
        }

        if (!selectedGif) {
            return message.reply('❌ No se pudo obtener contenido. Intenta de nuevo.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔞 FuckDetect')
            .setDescription(`**Usuario:** ${targetUser.displayName}\n**Género detectado:** ${genderText}`)
            .setImage(selectedGif.url)
            .setColor('#FF1493')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🏷️ Categoría', value: selectedGif.category, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: `Basado en el apodo: ${nickname}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Comando !nsfwhelp
    async handleHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🔞 Sistema NSFW - Ayuda')
            .setDescription('Lista de comandos disponibles para canales NSFW\n**Nota:** Acepta CUALQUIER categoría, no hay límites')
            .setColor('#FF69B4')
            .addFields(
                {
                    name: '📌 Comandos Principales',
                    value: 
                        '`>nsfw <categoría> <cantidad>` - Buscar contenido (3 proveedores)\n' +
                        '`>fuck` - GIF aleatorio con descripción romántica\n' +
                        '`>fuckdetect` o `>fd` - Detecta género y muestra contenido\n',
                    inline: false
                },
                {
                    name: '🎨 Por Proveedor Específico',
                    value:
                        '`>r34 <tags> <cantidad>` - Rule34.xxx (cualquier tag)\n' +
                        '`>waifu <categoría> <cantidad>` - Waifu.pics\n' +
                        '`>neko <categoría> <cantidad>` - Nekos.best\n',
                    inline: false
                },
                {
                    name: '🎬 Por Tipo de Contenido',
                    value:
                        '`>gifs <categoría> <cantidad>` - Solo GIFs (3 proveedores)\n' +
                        '`>videos <categoría> <cantidad>` - Solo videos (3 proveedores)\n',
                    inline: false
                },
                {
                    name: '🏷️ Ejemplos de Categorías Rule34',
                    value: this.rule34Examples.join(', ') + ', **y cualquier otro tag**',
                    inline: false
                },
                {
                    name: '🏷️ Ejemplos de Categorías Waifu.pics',
                    value: this.waifuExamples.join(', ') + ', **prueba otras**',
                    inline: false
                },
                {
                    name: '🏷️ Ejemplos de Categorías Nekos.best',
                    value: this.nekosExamples.join(', ') + ', **prueba otras**',
                    inline: false
                },
                {
                    name: '💡 Ejemplos de Uso',
                    value:
                        '`>r34 pokemon 3` - 3 imágenes de Pokemon en Rule34\n' +
                        '`>r34 1girl+solo` - Usa + para combinar tags\n' +
                        '`>waifu trap 2` - 2 imágenes de Waifu.pics\n' +
                        '`>neko neko` - 1 imagen de Nekos.best\n' +
                        '`>nsfw hentai 5` - 5 imágenes de cualquier proveedor\n' +
                        '`>gifs neko 2` - 2 GIFs de los 3 proveedores\n' +
                        '`>videos waifu` - 1 video\n' +
                        '`>fd @usuario` - Detectar género y mostrar contenido\n' +
                        '`>fuck` - GIF aleatorio con descripción',
                    inline: false
                }
            )
            .setFooter({ text: '🔞 Solo en canales NSFW | No hay límites de categorías' })
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

                case '>waifu':
                    await this.handleWaifu(message, args);
                    break;

                case '>neko':
                    await this.handleNeko(message, args);
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

                case '>nsfwhelp':
                case '>hentaihelp':
                    await this.handleHelp(message);
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema NSFW:', error);
            await message.reply('❌ Ocurrió un error. Intenta de nuevo.');
        }
    }
}

module.exports = NSFWSystem;