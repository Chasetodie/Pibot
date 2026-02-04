const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const xml2js = require('xml2js');

class NSFWSystem {
    constructor() {
        // Verificar si el canal es NSFW
        this.isNSFWChannel = (channel) => channel.nsfw === true;
        
        this.rule34ApiKey = '5895418';  // ← Reemplazar
        this.rule34UserId = '5895418';  // ← Reemplazar

        // Géneros para fuckdetect
        this.genders = {
            male: ['pibe', 'chico', 'macho', 'men', 'boy', 'masculino', 'hombre', 'varon'],
            female: ['piba', 'chica', 'mujer', 'girl', 'woman', 'femenino', 'nena']
        };
    }

    // Detectar género por apodo
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

    // Obtener imagen de Rule34.xxx (CON autenticación + debug)
    async getRule34ImageAuth(tags, apiKey, userId) {
        try {
            console.log('[NSFW DEBUG] API Key:', apiKey ? 'Sí tiene' : 'No tiene');
            console.log('[NSFW DEBUG] User ID:', userId ? 'Sí tiene' : 'No tiene');
            console.log('[NSFW DEBUG] Tags:', tags);
            
            const response = await axios.get('https://api.rule34.xxx/index.php', {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    limit: 100,
                    tags: tags,
                    api_key: apiKey,
                    user_id: userId
                },
                headers: {
                    'User-Agent': 'DiscordBot/1.0'
                },
                timeout: 15000
            });

            console.log('[NSFW DEBUG] Respuesta tipo:', typeof response.data);
            console.log('[NSFW DEBUG] Primeros 500 caracteres:', response.data.substring(0, 500));

            if (!response.data) {
                console.log('[NSFW DEBUG] No hay data');
                return null;
            }

            const xml2js = require('xml2js');
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(response.data);

            console.log('[NSFW DEBUG] Estructura completa:', JSON.stringify(result, null, 2));

            if (!result.posts || !result.posts.post || result.posts.post.length === 0) {
                console.log('[NSFW DEBUG] No hay posts en result.posts');
                
                // Intentar ver si hay error
                if (result.posts && result.posts.$) {
                    console.log('[NSFW DEBUG] Atributos de posts:', result.posts.$);
                }
                
                return null;
            }

            const posts = result.posts.post;
            console.log('[NSFW DEBUG] Número de posts:', posts.length);
            console.log('[NSFW DEBUG] Primer post completo:', JSON.stringify(posts[0], null, 2));
            
            const validPosts = posts.filter(post => post.$ && post.$.file_url);
            console.log('[NSFW DEBUG] Posts válidos:', validPosts.length);

            if (validPosts.length === 0) {
                return null;
            }

            const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];
            const imageUrl = randomPost.$.file_url;
            
            console.log('[NSFW DEBUG] URL final:', imageUrl);

            return imageUrl;

        } catch (error) {
            console.error('[NSFW ERROR] Error completo:', error);
            console.error('[NSFW ERROR] Mensaje:', error.message);
            if (error.response) {
                console.error('[NSFW ERROR] Status:', error.response.status);
                console.error('[NSFW ERROR] Data:', error.response.data);
            }
            return null;
        }
    }

    // Obtener GIF de Gelbooru (usando API JSON)
    async getGelbooruGif(tags) {
        try {
            const pid = Math.floor(Math.random() * 50);
            
            const response = await axios.get('https://gelbooru.com/index.php', {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    json: 1,
                    limit: 100,
                    pid: pid,
                    tags: tags + ' animated sort:random'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });

            console.log('[NSFW] Respuesta de Gelbooru:', response.data ? 'OK' : 'Vacío');

            if (!response.data || !response.data.post || response.data.post.length === 0) {
                console.log('[NSFW] No hay posts en Gelbooru');
                return null;
            }

            // Filtrar solo GIFs y videos
            const gifs = response.data.post.filter(post => 
                post.file_url && (
                    post.file_url.endsWith('.gif') || 
                    post.file_url.endsWith('.mp4') || 
                    post.file_url.endsWith('.webm')
                )
            );

            if (gifs.length === 0) {
                console.log('[NSFW] No se encontraron GIFs en Gelbooru');
                return null;
            }

            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            console.log('[NSFW] GIF obtenido de Gelbooru:', randomGif.file_url);

            return randomGif.file_url;

        } catch (error) {
            console.error('[NSFW] Error en Gelbooru:', error.message);
            return null;
        }
    }

    // Obtener GIF solo de Rule34
    async getRule34Gif(tags) {
        try {
            const pid = Math.floor(Math.random() * 100);
            
            const response = await axios.get('https://api.rule34.xxx/index.php', {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    limit: 100,
                    pid: pid,
                    tags: tags + ' animated'
                },
                headers: {
                    'User-Agent': 'DiscordBot/1.0'
                },
                timeout: 15000
            });

            if (!response.data) return null;

            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(response.data);

            if (!result.posts || !result.posts.post || result.posts.post.length === 0) {
                return null;
            }

            // Filtrar solo GIFs
            const posts = result.posts.post.filter(post => {
                const url = post.$.file_url;
                return url && (url.endsWith('.gif') || url.endsWith('.mp4') || url.endsWith('.webm'));
            });

            if (posts.length === 0) return null;

            const randomPost = posts[Math.floor(Math.random() * posts.length)];
            return randomPost.$.file_url;

        } catch (error) {
            console.error('[NSFW] Error obteniendo GIF:', error.message);
            return null;
        }
    }

    // Comando !r34 <tags>
    async handleRule34(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const tags = args.join('_') || 'hentai';
        
        await message.channel.sendTyping();

        const imageUrl = await this.getRule34ImageAuth(tags, this.rule34ApiKey, this.rule34UserId);

        if (!imageUrl) {
            return message.reply(`❌ No se encontraron resultados para: \`${tags}\`\nIntenta con otros tags.`);
        }

        const embed = new EmbedBuilder()
            .setTitle('🔞 Rule34')
            .setDescription(`**Tags:** ${tags.replace(/_/g, ' ')}`)
            .setImage(imageUrl)
            .setColor('#FF69B4')
            .setFooter({ text: 'Rule34.xxx' });

        await message.reply({ embeds: [embed] });
    }

    // Comando !img <name> <cantidad>
    async handleImage(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const name = args[0] || 'hentai';
        const count = Math.min(parseInt(args[1]) || 1, 3); // Máximo 3 para no hacer spam

        await message.channel.sendTyping();

        for (let i = 0; i < count; i++) {
            const imageUrl = await this.getRule34ImageAuth(tags, this.rule34ApiKey, this.rule34UserId);

            if (imageUrl) {
                const embed = new EmbedBuilder()
                    .setTitle(`🔞 ${name}`)
                    .setImage(imageUrl)
                    .setColor('#FF1493');

                await message.reply({ embeds: [embed] });
            }
        }
    }

    // Comando !fuck
    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        await message.channel.sendTyping();

        // Usar Gelbooru para GIFs
        let imageUrl = await this.getGelbooruGif('sex');
        //let imageUrl = await this.getRule34Gif('sex');

        // Si falla, intentar con Rule34
        if (!imageUrl) {
            imageUrl = await this.getRule34ImageAuth('sex animated', this.rule34ApiKey, this.rule34UserId);
        }

        if (!imageUrl) {
            return message.reply('❌ No se pudo obtener el GIF. Intenta de nuevo.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔞 NSFW')
            .setImage(imageUrl)
            .setColor('#FF0000');

        await message.reply({ embeds: [embed] });
    }

    // Comando !fuckdetect
    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const targetUser = message.mentions.members.first() || message.member;
        const nickname = targetUser.displayName;
        const gender = this.detectGender(nickname);

        await message.channel.sendTyping();

        let tags = 'sex animated';
        let genderText = '👫 Hetero';
        let category = 'nsfw_neko_gif';

        // Determinar tags según género detectado
        if (gender === 'male') {
            tags = 'yaoi';
            genderText = '👨‍❤️‍👨 Yaoi';
        } else if (gender === 'female') {
            tags = 'yuri';
            genderText = '👩‍❤️‍👩 Yuri';
        } else {
            tags = 'sex';
            genderText = '👫 Hetero';
        }

        // Usar Gelbooru para GIFs
        let imageUrl = await this.getGelbooruGif(tags);
        //let imageUrl = await this.getRule34Gif('sex');

        // Si falla, usar Rule34
        if (!imageUrl) {
            imageUrl = await this.getRule34ImageAuth(tags + ' animated', this.rule34ApiKey, this.rule34UserId);
        }

        if (!imageUrl) {
            return message.reply('❌ No se pudo obtener el contenido. Intenta de nuevo.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔞 FuckDetect')
            .setDescription(`**Usuario:** ${targetUser.displayName}\n**Género detectado:** ${genderText}`)
            .setImage(imageUrl)
            .setColor('#FF1493')
            .setFooter({ text: `Basado en el apodo: ${nickname}` });

        await message.reply({ embeds: [embed] });
    }

    // Procesador de comandos
    async processCommand(message) {
        const args = message.content.split(' ').slice(1);
        const command = message.content.toLowerCase().split(' ')[0];

        try {
            switch (command) {
                case '>r34':
                    await this.handleRule34(message, args);
                    break;

                case '>img':
                    await this.handleImage(message, args);
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