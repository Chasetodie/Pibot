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
            .setURL(item.url) // ← Cambiar de setImage a setURL para videos
            .setDescription(`**[Clic aquí para ver el contenido](${item.url})**`) // ← Agregar link clickeable
            .setColor('#FF69B4')
            .addFields(
                { name: '📂 Nombre', value: item.filename, inline: true },
                { name: '🏷️ Categoría', value: item.category, inline: true },
                { name: '🎨 Artista', value: item.artist, inline: true },
                { name: '🌐 Fuente', value: item.source, inline: true }
            )
            .setFooter({ text: `Proveedor: ${item.source}` })
            .setTimestamp();
        
        // Intentar poner imagen/video (puede fallar con algunos formatos)
        try {
            if (item.url.endsWith('.jpg') || item.url.endsWith('.png') || item.url.endsWith('.gif')) {
                embed.setImage(item.url);
            }
        } catch (e) {
            console.log('[NSFW] No se pudo setear imagen:', e.message);
        }

        // Si tiene ID (de Rule34)
        if (item.id) {
            embed.addFields({ name: '🆔 ID', value: item.id.toString(), inline: true });
        }

        // Si tiene score (de Rule34)
        if (item.score !== undefined) {
            embed.addFields({ name: '⭐ Score', value: item.score.toString(), inline: true });
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
        const count = Math.min(parseInt(args[1]) || 1, 10);

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

    // Comando !nsfw <categoría> <cantidad> (fusión de los 3 proveedores)
    async handleNSFW(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'hentai';
        const count = Math.min(parseInt(args[1]) || 1, 10);

        await message.channel.sendTyping();

        const results = await this.getRule34(category + ' -ai_generated', count);

        if (results.length === 0) {
            return message.reply(`❌ No se encontraron imágenes para: \`${category}\``);
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

        const category = args[0] || 'hentai';
        const count = Math.min(parseInt(args[1]) || 1, 10);

        await message.channel.sendTyping();

        const rule34Results = await this.getRule34(category + ' animated -ai_generated', count * 3);
        const gifs = this.filterAnimated(rule34Results);

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

    async handleVideos(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const category = args[0] || 'hentai';
        const count = Math.min(parseInt(args[1]) || 1, 10);

        await message.channel.sendTyping();

        const rule34Results = await this.getRule34(category + ' video animated -ai_generated', count * 5);
        const videos = rule34Results.filter(item => 
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

    // Comando !fuck mejorado (requiere mención o reply)
    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // Obtener usuario mencionado o reply
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

        // Obtener GIFs animados
        const rule34Results = await this.getRule34('sex animated -ai_generated', 20);
        const gifs = this.filterAnimated(rule34Results);

        let selectedGif = null;

        if (gifs.length > 0) {
            selectedGif = gifs[Math.floor(Math.random() * gifs.length)];
        } else {
            // Fallback sin filtro de GIF
            if (rule34Results.length > 0) {
                selectedGif = rule34Results[Math.floor(Math.random() * rule34Results.length)];
            }
        }

        if (!selectedGif) {
            return message.reply('❌ No se pudo obtener contenido. Intenta de nuevo.');
        }

        const person1 = message.author.displayName;
        const person2 = targetUser.displayName;

        const embed = new EmbedBuilder()
            .setTitle('🔞 FUCK')
            .setDescription(`💕 **${person1}** se folló a **${person2}** 💕`)
            .setURL(selectedGif.url)
            .setColor('#FF0069')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: 'Disfruta responsablemente 🔞' })
            .setTimestamp();
        
        // Intentar setear imagen si es .gif o .jpg
        try {
            if (selectedGif.url.endsWith('.gif') || selectedGif.url.endsWith('.jpg') || selectedGif.url.endsWith('.png')) {
                embed.setImage(selectedGif.url);
            }
        } catch (e) {
            console.log('[NSFW] No se pudo setear imagen');
        }

        await message.reply({ embeds: [embed] });
    }

    // Comando !fuckdetect mejorado (requiere mención o reply)
    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        // Obtener usuario mencionado o reply
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

        // Buscar GIFs
        const rule34Results = await this.getRule34(category + ' animated -ai_generated', 20);
        const gifs = this.filterAnimated(rule34Results);

        let selectedGif = null;

        if (gifs.length > 0) {
            selectedGif = gifs[Math.floor(Math.random() * gifs.length)];
        } else {
            // Fallback
            const fallback = await this.getRule34(category + ' -ai_generated', 10);
            if (fallback.length > 0) {
                selectedGif = fallback[0];
            }
        }

        if (!selectedGif) {
            return message.reply('❌ No se pudo obtener contenido. Intenta de nuevo.');
        }

        const person1 = message.author.displayName;
        const person2 = targetUser.displayName;

        const embed = new EmbedBuilder()
            .setTitle('🔞 FuckDetect')
            .setDescription(
                `**Usuario detectado:** ${targetUser.displayName}\n` +
                `**Género:** ${genderText}\n\n` +
                `💕 **${person1}** se folló a **${person2}** 💕`
            )
            .setURL(selectedGif.url)
            .setColor('#FF1493')
            .addFields(
                { name: '📂 Nombre', value: selectedGif.filename, inline: true },
                { name: '🏷️ Categoría', value: selectedGif.category, inline: true },
                { name: '🌐 Fuente', value: selectedGif.source, inline: true }
            )
            .setFooter({ text: `Basado en el apodo: ${nickname}` })
            .setTimestamp();
        
        // Intentar setear imagen
        try {
            if (selectedGif.url.endsWith('.gif') || selectedGif.url.endsWith('.jpg') || selectedGif.url.endsWith('.png')) {
                embed.setImage(selectedGif.url);
            }
        } catch (e) {
            console.log('[NSFW] No se pudo setear imagen');
        }

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