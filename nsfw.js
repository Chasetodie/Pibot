const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class NSFWSystem {
    constructor() {
        // APIs disponibles
        this.apis = {
            nekotina: 'https://nekotina.com/api/v2.1',
            rule34: 'https://api.rule34.xxx/index.php',
            gelbooru: 'https://gelbooru.com/index.php'
        };
        
        // Géneros para fuckdetect
        this.genders = {
            male: ['pibe', 'chico', 'macho', 'men', 'boy', 'masculino', 'hombre', 'varon'],
            female: ['piba', 'chica', 'mujer', 'girl', 'woman', 'femenino', 'nena']
        };
    }

    // Verificar si el canal es NSFW
    isNSFWChannel(channel) {
        return channel.nsfw === true;
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

    // Comando !r34 <tags>
    async handleRule34(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const tags = args.join(' ') || 'rating:explicit';
        
        try {
            const response = await axios.get(this.apis.rule34, {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    json: 1,
                    limit: 100,
                    tags: tags
                },
                timeout: 10000
            });

            if (!response.data || response.data.length === 0) {
                return message.reply('❌ No se encontraron resultados para esos tags.');
            }

            const randomPost = response.data[Math.floor(Math.random() * response.data.length)];
            
            const embed = new EmbedBuilder()
                .setTitle('🔞 Rule34')
                .setDescription(`**Tags:** ${tags}`)
                .setImage(randomPost.file_url)
                .setColor('#FF69B4')
                .setFooter({ text: `ID: ${randomPost.id} | Score: ${randomPost.score}` });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en Rule34:', error);
            await message.reply('❌ Error al obtener la imagen. Intenta con otros tags.');
        }
    }

    // Comando !img <name> <cantidad>
    async handleImage(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const name = args[0] || 'random';
        const count = Math.min(parseInt(args[1]) || 1, 5); // Máximo 5 imágenes

        try {
            const images = [];
            
            for (let i = 0; i < count; i++) {
                const response = await axios.get(this.apis.rule34, {
                    params: {
                        page: 'dapi',
                        s: 'post',
                        q: 'index',
                        json: 1,
                        limit: 100,
                        tags: `${name} rating:explicit`
                    },
                    timeout: 10000
                });

                if (response.data && response.data.length > 0) {
                    const randomPost = response.data[Math.floor(Math.random() * response.data.length)];
                    images.push(randomPost.file_url);
                }
            }

            if (images.length === 0) {
                return message.reply('❌ No se encontraron imágenes.');
            }

            for (const img of images) {
                const embed = new EmbedBuilder()
                    .setTitle(`🔞 ${name}`)
                    .setImage(img)
                    .setColor('#FF1493');

                await message.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error en !img:', error);
            await message.reply('❌ Error al obtener imágenes.');
        }
    }

    // Comando !fuck
    async handleFuck(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        try {
            const response = await axios.get(this.apis.rule34, {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    json: 1,
                    limit: 100,
                    tags: 'sex animated gif rating:explicit'
                },
                timeout: 10000
            });

            if (!response.data || response.data.length === 0) {
                return message.reply('❌ No se encontraron GIFs.');
            }

            const randomPost = response.data[Math.floor(Math.random() * response.data.length)];
            
            const embed = new EmbedBuilder()
                .setTitle('🔞 NSFW')
                .setImage(randomPost.file_url)
                .setColor('#FF0000');

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en !fuck:', error);
            await message.reply('❌ Error al obtener el GIF.');
        }
    }

    // Comando !fuckdetect
    async handleFuckDetect(message, args) {
        if (!this.isNSFWChannel(message.channel)) {
            return message.reply('🔞 Este comando solo funciona en canales NSFW.');
        }

        const targetUser = message.mentions.members.first() || message.member;
        const nickname = targetUser.displayName;
        const gender = this.detectGender(nickname);

        let tags = 'sex animated gif rating:explicit';

        // Determinar tags según género detectado
        if (gender === 'male') {
            tags = 'yaoi animated gif rating:explicit'; // Pibe x Pibe
        } else if (gender === 'female') {
            tags = 'yuri animated gif rating:explicit'; // Piba x Piba
        } else {
            tags = 'sex animated gif rating:explicit'; // Hetero por defecto
        }

        try {
            const response = await axios.get(this.apis.rule34, {
                params: {
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    json: 1,
                    limit: 100,
                    tags: tags
                },
                timeout: 10000
            });

            if (!response.data || response.data.length === 0) {
                return message.reply('❌ No se encontraron GIFs para este género.');
            }

            const randomPost = response.data[Math.floor(Math.random() * response.data.length)];
            
            let genderText = '👫 Hetero';
            if (gender === 'male') genderText = '👨‍❤️‍👨 Yaoi';
            if (gender === 'female') genderText = '👩‍❤️‍👩 Yuri';

            const embed = new EmbedBuilder()
                .setTitle('🔞 FuckDetect')
                .setDescription(`**Usuario:** ${targetUser.displayName}\n**Género detectado:** ${genderText}`)
                .setImage(randomPost.file_url)
                .setColor('#FF1493');

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en !fuckdetect:', error);
            await message.reply('❌ Error al obtener el GIF.');
        }
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