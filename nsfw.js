const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class NSFWSystem {
    constructor() {
        // Verificar si el canal es NSFW
        this.isNSFWChannel = (channel) => channel.nsfw === true;
        
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

    // Obtener imagen de Rule34 (mejorado)
    async getRule34Image(tags) {
        try {
            // Usar la API XML y parsearla
            const response = await axios.get('https://rule34.xxx/index.php', {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    limit: 100,
                    tags: tags,
                    json: 1
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 10000
            });

            console.log('[NSFW] Respuesta de Rule34:', response.data ? 'OK' : 'Vacío');

            if (!response.data || response.data.length === 0) {
                return null;
            }

            const posts = response.data.filter(post => post.file_url);
            if (posts.length === 0) return null;

            const randomPost = posts[Math.floor(Math.random() * posts.length)];
            return randomPost.file_url;

        } catch (error) {
            console.error('[NSFW] Error en Rule34:', error.message);
            return null;
        }
    }

    // Alternativa: Nekos.life (más confiable)
    async getNekosLife(category) {
        try {
            const response = await axios.get(`https://nekos.life/api/v2/img/${category}`, {
                timeout: 10000
            });

            console.log('[NSFW] Respuesta de Nekos.life:', response.data);

            return response.data?.url || null;

        } catch (error) {
            console.error('[NSFW] Error en Nekos.life:', error.message);
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

        const imageUrl = await this.getRule34Image(tags);

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
            const imageUrl = await this.getRule34Image(name);

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

        // Intentar con nekos.life primero (más confiable)
        let imageUrl = await this.getNekosLife('nsfw_neko_gif');

        // Si falla, intentar con Rule34
        if (!imageUrl) {
            imageUrl = await this.getRule34Image('animated sex gif');
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
            tags = 'yaoi animated';
            genderText = '👨‍❤️‍👨 Yaoi';
            category = 'yaoi';
        } else if (gender === 'female') {
            tags = 'yuri animated';
            genderText = '👩‍❤️‍👩 Yuri';
            category = 'yuri';
        }

        // Intentar primero con nekos.life
        let imageUrl = await this.getNekosLife(category);

        // Si falla, usar Rule34
        if (!imageUrl) {
            imageUrl = await this.getRule34Image(tags);
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