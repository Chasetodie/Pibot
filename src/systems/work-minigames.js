const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class WorkMinigames {
    constructor() {
        this.TIMEOUT = 20000;
        this.activeGames = new Map();
        this.illegalJobs = ['criminal', 'vendedordelpunto', 'damadecomp', 'sicario', 'contador'];
        this.streakBonuses = [
            { streak: 10, bonus: 0.40, label: '🔥🔥🔥 ¡RACHA LEGENDARIA!' },
            { streak: 5,  bonus: 0.25, label: '🔥🔥 ¡Racha increíble!' },
            { streak: 3,  bonus: 0.15, label: '🔥 ¡En racha!' },
        ];
    }

    getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    getStreakBonus(streak) {
        for (const s of this.streakBonuses) { if (streak >= s.streak) return s; }
        return null;
    }

    isIllegal(jobType) { return this.illegalJobs.includes(jobType); }

    getPenalty(jobType, baseReward, isTimeout = false) {
        if (this.isIllegal(jobType)) return isTimeout ? -Math.floor(baseReward * 0.10) : -Math.floor(baseReward * 0.20);
        return isTimeout ? Math.floor(baseReward * 0.25) : Math.floor(baseReward * 0.50);
    }

    // ── BUILDERS ──────────────────────────────────

    buildPoolChoice({ question, correct, wrongPool, userId, style = ButtonStyle.Primary }) {
        const wrongs = this.shuffle(wrongPool).slice(0, 3);
        const all = this.shuffle([{ label: correct, correct: true }, ...wrongs.map(w => ({ label: w, correct: false }))]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder().setCustomId(`work_mc_${userId}_${i}_${opt.correct}`).setLabel(opt.label).setStyle(style))
        );
        return { question, row, type: 'multiple_choice' };
    }

    buildReaction({ prompt, buttonLabel, userId, timeLimit = 4000 }) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`work_react_${userId}`).setLabel(buttonLabel).setStyle(ButtonStyle.Danger)
        );
        return { question: prompt, row, type: 'reaction', timeLimit };
    }

    buildSequence({ instruction, steps, userId }) {
        const shuffled = this.shuffle([...steps]);
        const row = new ActionRowBuilder().addComponents(
            shuffled.map(s => new ButtonBuilder().setCustomId(`work_seq_${userId}_${s.order}`).setLabel(s.label).setStyle(ButtonStyle.Secondary))
        );
        return { question: instruction, row, shuffled, steps, type: 'sequence' };
    }

    buildGuessNumber({ question, correct, wrongPool, userId }) {
        const wrongs = this.shuffle(wrongPool).slice(0, 3);
        const all = this.shuffle([{ label: correct.toString(), correct: true }, ...wrongs.map(w => ({ label: w.toString(), correct: false }))]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder().setCustomId(`work_mc_${userId}_${i}_${opt.correct}`).setLabel(opt.label).setStyle(ButtonStyle.Success))
        );
        return { question, row, type: 'multiple_choice' };
    }

    // NUEVO: Matemática rápida con operación aleatoria cada vez
    buildMath({ context, userId, difficulty = 'easy', customQuestion = null, customAnswer = null }) {
        let question;

        if (customQuestion && customAnswer !== null) {
            // Modo pregunta propia: usa los valores fijos que pasaste
            const wrongs = new Set();
            while (wrongs.size < 3) {
                // El offset es entre 5% y 30% del valor correcto, mínimo 2
                const range = Math.max(2, Math.floor(customAnswer * 0.30));
                const min  = Math.max(1, Math.floor(customAnswer * 0.05));
                const offset = this.getRandomInt(min, range) * (Math.random() > 0.5 ? 1 : -1);
                const w = customAnswer + offset;
                if (w !== customAnswer && w > 0) wrongs.add(w);
            }
            const all = this.shuffle([
                { label: customAnswer.toString(), correct: true },
                ...[...wrongs].map(w => ({ label: w.toString(), correct: false }))
            ]);
            const row = new ActionRowBuilder().addComponents(
                all.map((opt, i) => new ButtonBuilder()
                    .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                    .setLabel(opt.label)
                    .setStyle(ButtonStyle.Success))
            );
            return { question: `🔢 **${customQuestion}**`, row, type: 'multiple_choice' };
        }

        // Modo contexto: genera operación aleatoria
        let a, b, op, answer;
        if (difficulty === 'easy') {
            a = this.getRandomInt(10, 99); b = this.getRandomInt(10, 99);
            op = this.getRandom(['+', '-']);
            if (op === '-' && a < b) [a, b] = [b, a];
            answer = op === '+' ? a + b : a - b;
        } else if (difficulty === 'medium') {
            a = this.getRandomInt(10, 50); b = this.getRandomInt(2, 12);
            op = this.getRandom(['×', '+', '-']);
            answer = op === '×' ? a * b : op === '+' ? a + b : Math.abs(a - b);
        } else {
            a = this.getRandomInt(100, 500); b = this.getRandomInt(10, 50);
            op = this.getRandom(['+', '-', '×']);
            answer = op === '+' ? a + b : op === '-' ? Math.abs(a - b) : a * b;
        }

        const wrongs = new Set();
        while (wrongs.size < 3) {
            const offset = this.getRandomInt(1, 25) * (Math.random() > 0.5 ? 1 : -1);
            const w = answer + offset;
            if (w !== answer && w > 0) wrongs.add(w);
        }
        const all = this.shuffle([
            { label: answer.toString(), correct: true },
            ...[...wrongs].map(w => ({ label: w.toString(), correct: false }))
        ]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder()
                .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                .setLabel(opt.label)
                .setStyle(ButtonStyle.Success))
        );
        return { question: `🔢 **${context}**\n\n¿Cuánto es **${a} ${op} ${b}**?`, row, type: 'multiple_choice' };
    }

    // NUEVO: Verdadero o Falso
    buildTrueFalse({ statement, isTrue, userId }) {
        const all = this.shuffle([
            { label: '✅ Verdadero', correct: isTrue },
            { label: '❌ Falso', correct: !isTrue }
        ]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder()
                .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                .setLabel(opt.label)
                .setStyle(opt.label.includes('✅') ? ButtonStyle.Success : ButtonStyle.Danger))
        );
        return { question: `🟡 **¿Verdadero o Falso?**\n\n"${statement}"`, row, type: 'multiple_choice' };
    }

    // NUEVO: El intruso — ¿cuál NO pertenece?
    buildIntruso({ question, intruso, wrongPool, userId }) {
        const options = this.shuffle(wrongPool).slice(0, 3);
        const all = this.shuffle([{ label: intruso, correct: true }, ...options.map(w => ({ label: w, correct: false }))]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder().setCustomId(`work_mc_${userId}_${i}_${opt.correct}`).setLabel(opt.label).setStyle(ButtonStyle.Secondary))
        );
        return { question: `🧩 **¿Cuál NO pertenece?**\n\n${question}`, row, type: 'multiple_choice' };
    }

    // NUEVO: Completar la frase
    buildFillBlank({ sentence, correct, wrongPool, userId }) {
        const wrongs = this.shuffle(wrongPool).slice(0, 3);
        const all = this.shuffle([{ label: correct, correct: true }, ...wrongs.map(w => ({ label: w, correct: false }))]);
        const row = new ActionRowBuilder().addComponents(
            all.map((opt, i) => new ButtonBuilder().setCustomId(`work_mc_${userId}_${i}_${opt.correct}`).setLabel(opt.label).setStyle(ButtonStyle.Primary))
        );
        return { question: `📝 **Completa la frase:**\n\n"${sentence}"`, row, type: 'multiple_choice' };
    }

    // NUEVO: Memoria numérica
buildMemory({ context, userId }) {
    const secret = this.getRandomInt(1000, 9999); // siempre 4 dígitos
    const digits = [0,1,2,3,4,5,6,7,8,9];
    const rows = [
        new ActionRowBuilder().addComponents(
            [1,2,3,4,5].map(d => new ButtonBuilder()
                .setCustomId(`work_mem_${userId}_${d}`)
                .setLabel(d.toString())
                .setStyle(ButtonStyle.Primary))
        ),
        new ActionRowBuilder().addComponents(
            [6,7,8,9,0].map(d => new ButtonBuilder()
                .setCustomId(`work_mem_${userId}_${d}`)
                .setLabel(d.toString())
                .setStyle(ButtonStyle.Primary))
        ),
    ];
    return {
        question: `🧠 **¡Memoriza este número!**\n\n# ${secret}\n\n${context}\n\n*(Tienes unos segundos para memorizarlo)*`,
        rows, type: 'memory', memoryNumber: secret
    };
}
    // NUEVO: Prioridad urgente (variante de secuencia)
    buildPriority({ situation, items, userId }) {
        const shuffled = this.shuffle([...items]);
        const row = new ActionRowBuilder().addComponents(
            shuffled.map(item => new ButtonBuilder().setCustomId(`work_seq_${userId}_${item.order}`).setLabel(item.label).setStyle(ButtonStyle.Danger))
        );
        return {
            question: `🚨 **SITUACIÓN DE EMERGENCIA:**\n\n${situation}\n\n📌 Atiende **de mayor a menor urgencia**:`,
            row, shuffled, steps: items, type: 'sequence'
        };
    }

    // ── ROUTER ────────────────────────────────────

    getMinigamesForJob(jobType, userId) {
        const map = {
            limpiador:       () => this.getLimpiadorGames(userId),
            paseador:        () => this.getPaseadorGames(userId),
            streamer:        () => this.getStreamerGames(userId),
            delivery:        () => this.getDeliveryGames(userId),
            pizzero:         () => this.getPizzeroGames(userId),
            bartender:       () => this.getBartenderGames(userId),
            uber:            () => this.getUberGames(userId),
            croupier:        () => this.getCroupierGames(userId),
            barista_casino:  () => this.getBaristaGames(userId),
            programmer:      () => this.getProgrammerGames(userId),
            abrepuertasoxxo: () => this.getOxxoGames(userId),
            mecanico:        () => this.getMecanicoGames(userId),
            doctor:          () => this.getDoctorGames(userId),
            botargadrsimi:   () => this.getSimiGames(userId),
            criminal:        () => this.getCriminalGames(userId),
            vendedordelpunto:() => this.getVendedorGames(userId),
            ofseller:        () => this.getOfsellerGames(userId),
            damadecomp:      () => this.getDamaGames(userId),
            paranormalinv:   () => this.getParanormalGames(userId),
            contador:        () => this.getContadorGames(userId),
            joyero:          () => this.getJoyeroGames(userId),
            actor_porno:     () => this.getActorGames(userId),
            sicario:         () => this.getSicarioGames(userId),
        };
        return map[jobType]?.() || null;
    }

    // ── LIMPIADOR ─────────────────────────────────
    getLimpiadorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🔍 Encuentras $500 en el cajón del gerente. ¿Qué haces?', correct: 'Lo dejas exactamente donde estaba', wrongPool: ['Te lo quedas, nadie lo vio', 'Lo reportas a la policía', 'Lo guardas "por seguridad"', 'Se lo das al guardia', 'Lo fotografías y lo dejas'] }),
            this.buildPoolChoice({ userId: u, question: '🚽 El baño está en estado apocalíptico. ¿Por dónde empiezas?', correct: 'Inodoros con desinfectante primero', wrongPool: ['Pisos primero', 'Lavabos primero', 'Espejos primero', 'Llamas a un exorcista', 'La puerta primero'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Volcaste el balde en la alfombra del jefe! ¡Limpia RÁPIDO!', buttonLabel: '🧻 ¡LIMPIAR!' }),
            this.buildSequence({ userId: u, instruction: '🧹 Ordena la rutina de limpieza correcta:', steps: [{ label: '🪣 Preparar materiales', order: 0 }, { label: '🧹 Barrer antes de trapear', order: 1 }, { label: '🧽 Limpiar superficies', order: 2 }] }),
            this.buildMath({ userId: u, customQuestion: 'Tienes 2 horas para 10 oficinas. ¿Cuántos minutos por oficina?', customAnswer: 12 }),
            this.buildTrueFalse({ userId: u, statement: 'Se debe mezclar cloro con amoníaco para limpiar más rápido y efectivo', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un producto de limpieza?', intruso: 'Mayonesa', wrongPool: ['Cloro', 'Desinfectante', 'Amoníaco', 'Detergente', 'Jabón líquido'] }),
            this.buildFillBlank({ userId: u, sentence: 'Antes de trapear siempre hay que ___ el piso primero', correct: 'barrer', wrongPool: ['mojar', 'encerar', 'pintar', 'ignorar', 'fotografiar'] }),
            this.buildMemory({ userId: u, context: '🔐 Ese es el código de la alarma del piso 8. ¡Memorízalo!' }),
            this.buildPriority({ userId: u, situation: 'Tienes 3 emergencias simultáneas. ¿Cuál atiendes primero?', items: [{ label: '🔥 Humo en el baño del 3er piso', order: 0 }, { label: '💧 Derrame de agua en pasillo', order: 1 }, { label: '🗑️ Bote de basura lleno', order: 2 }] }),
            this.buildPoolChoice({ userId: u, question: '🧴 ¿Con qué limpias una pantalla de computadora?', correct: 'Paño de microfibra ligeramente húmedo', wrongPool: ['Alcohol puro directo', 'Agua con jabón abundante', 'Cloro diluido', 'Papel periódico', 'Toalla de cocina'] }),
            this.buildTrueFalse({ userId: u, statement: 'Es correcto usar el mismo trapo para baños y cocinas si lo enjuagas bien', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🐀 ¡Hay una rata en la cocina y el cocinero llega en 2 min! ¡Atrápala!', buttonLabel: '🥅 ¡ATRAPAR!', timeLimit: 3000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es parte de una rutina de limpieza de oficina?', intruso: 'Cocinar el almuerzo del jefe', wrongPool: ['Vaciar papeleras', 'Limpiar escritorios', 'Barrer pisos', 'Limpiar ventanas', 'Desinfectar baños'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para evitar rayaduras en pisos de mármol se usa ___ en lugar de escoba metálica', correct: 'mopa suave', wrongPool: ['cepillo de metal', 'espátula', 'estropajo', 'papel de lija', 'escoba normal'] }),
            this.buildGuessNumber({ userId: u, question: '⏰ Tienes 2 horas para 10 oficinas. ¿Cuántos min por oficina?', correct: '12 min', wrongPool: ['8 min', '15 min', '20 min', '6 min', '18 min'] }),
            this.buildPoolChoice({ userId: u, question: '🧪 Mezclaste cloro con amoníaco sin querer. ¿Qué haces primero?', correct: 'Ventilas el área y sales inmediatamente', wrongPool: ['Sigues limpiando con guantes', 'Agregas agua para diluir', 'Ignoras el olor', 'Usas mascarilla y sigues', 'Llamas a un amigo'] }),
            this.buildMath({ userId: u, context: 'Calculas el pago por horas extras de limpieza nocturna', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── PASEADOR ──────────────────────────────────
    getPaseadorGames(u) {
        return this.shuffle([
            this.buildReaction({ userId: u, prompt: '🐕 ¡El Golden vio una ardilla y salió disparado! ¡Aguanta la correa!', buttonLabel: '💪 ¡AGUANTAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u, question: '🐕🐕 El Chihuahua y el Rottweiler están a punto de pelearse. ¿Qué haces?', correct: 'Los separas inmediatamente y cambias de ruta', wrongPool: ['Los dejas pelear', 'Gritas fuerte', 'Sueltas las correas', 'Les das comida a los dos', 'Jalas solo al Chihuahua'] }),
            this.buildMath({ userId: u, customQuestion: 'Cobras $15 por perro, paseas 5 perros 3 veces a la semana. ¿Cuánto ganas?', customAnswer: 225 }),
            this.buildTrueFalse({ userId: u, statement: 'Se puede llevar 10 perros grandes al mismo tiempo sin problema de seguridad', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO deberías llevar en tu bolsa de paseador?', intruso: 'Salchicha sin empacar', wrongPool: ['Bolsas para heces', 'Agua', 'Correas de repuesto', 'Golosinas', 'Botiquín básico'] }),
            this.buildSequence({ userId: u, instruction: '🎒 Ordena la preparación antes del paseo:', steps: [{ label: '🔍 Revisar las correas', order: 0 }, { label: '💧 Llevar agua y bolsas', order: 1 }, { label: '🐕 Recoger a los perros', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Si un perro se niega a caminar, la mejor técnica es motivarlo con ___ y paciencia', correct: 'una golosina', wrongPool: ['gritos', 'jalones fuertes', 'un palo', 'ignorarlo', 'música clásica'] }),
            this.buildReaction({ userId: u, prompt: '🚗 ¡Un carro casi atropella a uno de los perros! ¡Jálalo!', buttonLabel: '🐕 ¡JALAR!', timeLimit: 2500 }),
            this.buildMemory({ userId: u, context: '📱 Ese es el número del dueño del Labrador para emergencias. ¡Memorízalo!' }),
            this.buildPriority({ userId: u, situation: 'Varios perros tienen problemas simultáneos. ¿Cuál atiendes primero?', items: [{ label: '🐕 Perro con pata sangrando', order: 0 }, { label: '😮‍💨 Perro que jadea por calor', order: 1 }, { label: '💩 Perro que hizo en la acera', order: 2 }] }),
            this.buildPoolChoice({ userId: u, question: '🤧 Un perro estornuda mucho y lagrimea. ¿Qué haces?', correct: 'Terminas el paseo y avisas al dueño', wrongPool: ['Ignoras y continúas', 'Le das medicamento humano', 'Lo bañas en el parque', 'Lo dejas en una banca'] }),
            this.buildTrueFalse({ userId: u, statement: 'Los perros deben hidratarse durante el paseo, especialmente en días calurosos', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '🐿️ ¡Todos los perros vieron una ardilla a la vez! ¡Aguanta TODOS!', buttonLabel: '🦾 ¡FUERZA!', timeLimit: 2500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál de estas razas NO es de alta energía?', intruso: 'Bulldog Inglés', wrongPool: ['Border Collie', 'Husky Siberiano', 'Jack Russell', 'Golden Retriever', 'Labrador'] }),
            this.buildFillBlank({ userId: u, sentence: 'Al devolver a un perro, siempre debes ___ al dueño sobre cómo estuvo el paseo', correct: 'informar brevemente', wrongPool: ['mentirle si fue mal', 'no decirle nada', 'cobrarle extra si fue difícil', 'pedirle que lo evalúe con 5 estrellas', 'ignorarlo'] }),
            this.buildGuessNumber({ userId: u, question: '🐕 Tienes 6 correas enredadas. ¿Cuántos minutos mínimo para desenredarlas?', correct: '5 min', wrongPool: ['1 min', '2 min', '20 min', '30 min', '10 min'] }),
            this.buildMath({ userId: u, context: 'Calculas el cambio que le debes al dueño por el pago adelantado', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── STREAMER ──────────────────────────────────
    getStreamerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '💬 Tu chat está spameando sin parar. ¿Qué haces?', correct: 'Reaccionas con energía y agradeces el hype', wrongPool: ['Baneas a todos', 'Ignoras el chat', 'Apagas el stream', 'Lloras en cámara', 'Pones modo solo subs'] }),
            this.buildReaction({ userId: u, prompt: '🔴 ¡Un sub de 5 años acaba de subscribirse! ¡Agradécelo AHORA!', buttonLabel: '🎉 ¡HYPE!' }),
            this.buildMath({ userId: u, customQuestion: '1000 subs a $5/mes, Twitch se queda el 50%. ¿Cuánto ganas al mes?', customAnswer: 2500 }),
            this.buildTrueFalse({ userId: u, statement: 'Streamear 20 horas seguidas sin descanso es una buena estrategia de crecimiento sostenible', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una plataforma de streaming en vivo?', intruso: 'LinkedIn', wrongPool: ['Twitch', 'YouTube', 'Kick', 'Facebook Gaming', 'TikTok Live'] }),
            this.buildSequence({ userId: u, instruction: '🎮 Ordena cómo manejar un raid de 500 personas:', steps: [{ label: '👋 Dar bienvenida al raider', order: 0 }, { label: '📢 Presentarte al nuevo público', order: 1 }, { label: '🎮 Continuar con el contenido', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'El algoritmo de Twitch favorece streamers con horario ___ y consistente', correct: 'fijo', wrongPool: ['aleatorio', 'nocturno', 'mensual', 'corto', 'secreto'] }),
            this.buildPoolChoice({ userId: u, question: '😡 Un troll es tóxico en el chat. ¿Qué haces?', correct: 'Timeout y sigues con el stream normal', wrongPool: ['Peleas con él en cámara', 'Cierras el chat para todos', 'Terminas el stream', 'Le dedicas 10 minutos de explicación'] }),
            this.buildMemory({ userId: u, context: '🎫 Ese es el código de afiliado de tu sponsor. ¡Memorízalo para mencionarlo!' }),
            this.buildPriority({ userId: u, situation: 'Tu stream está en vivo y varias cosas van mal. ¿Qué arreglas primero?', items: [{ label: '🎤 El micrófono dejó de funcionar', order: 0 }, { label: '📹 La cámara está desenfocada', order: 1 }, { label: '🎮 El juego tiene lag menor', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'En Twitch, el Afiliado recibe el 50% de las suscripciones y el Partner puede negociar hasta el 70%', isTrue: true }),
            this.buildPoolChoice({ userId: u, question: '📉 Llevas 3 horas con 0 viewers. ¿Qué haces?', correct: 'Sigues con la misma energía y mejoras título/tags', wrongPool: ['Terminas el stream llorando', 'Gritas pidiendo viewers', 'Pagas bots de viewers', 'Haces contenido inapropiado para llamar atención'] }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una forma legítima de crecer en Twitch?', intruso: 'Comprar seguidores falsos', wrongPool: ['Hacer raid a otros streamers', 'Colaborar con otros creadores', 'Tener horario consistente', 'Interactuar con el chat', 'Hacer networking en eventos'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para evitar el burnout como streamer, los expertos recomiendan tomar al menos ___ de descanso por semana', correct: '1 día completo', wrongPool: ['5 minutos', '1 hora al mes', 'un año sabático', 'solo navidades', 'descanso nunca'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡Tu stream está en la página principal de Twitch! ¡Aprovecha el momento!', buttonLabel: '⭐ ¡BRILLAR!', timeLimit: 4000 }),
            this.buildGuessNumber({ userId: u, question: '📊 Tienes 500 seguidores. Si el 2% se suscribe, ¿cuántos subs tienes?', correct: '10 subs', wrongPool: ['5 subs', '15 subs', '25 subs', '50 subs', '20 subs'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántos subs necesitas para pagar tu nuevo micro', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── DELIVERY ──────────────────────────────────
    getDeliveryGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🗺️ Tienes 4 rutas. ¿Cuál es la más eficiente?', correct: 'Ruta Sur: 8 min sin semáforos', wrongPool: ['Ruta Norte: 15 min', 'Ruta Este: 22 min con obras', 'Ruta Oeste: 11 min con tráfico', 'Ruta Centro: 18 min lento'] }),
            this.buildReaction({ userId: u, prompt: '🚦 ¡El semáforo está en VERDE! ¡Arranca YA!', buttonLabel: '🚗 ¡ARRANCAR!' }),
            this.buildMath({ userId: u, context: 'El cliente paga con un billete grande. Calcula el cambio exacto', difficulty: 'easy' }),
            this.buildTrueFalse({ userId: u, statement: 'Si el cliente no está en casa, puedes dejar el pedido con cualquier vecino sin avisar', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es equipo esencial para un repartidor?', intruso: 'Cámara fotográfica profesional', wrongPool: ['Casco', 'Bolsa térmica', 'GPS', 'Chaleco reflectante', 'Documentos del vehículo'] }),
            this.buildSequence({ userId: u, instruction: '📋 Ordena las entregas de forma lógica:', steps: [{ label: '🏠 Calle A (2km)', order: 0 }, { label: '🏬 Calle C (3km)', order: 1 }, { label: '🏢 Calle B (5km)', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Cuando hay un problema con un pedido, lo primero es ___ al restaurante', correct: 'llamar', wrongPool: ['ignorar', 'tirar el pedido', 'culpar al cliente', 'devolverlo sin avisar', 'comérselo'] }),
            this.buildPoolChoice({ userId: u, question: '📍 El cliente no responde y no encuentras la dirección. ¿Qué haces?', correct: 'Llamas 3 veces, esperas 10 min y reportas', wrongPool: ['Dejas el pedido en la calle', 'Te comes la comida', 'Regresas sin entregar', 'Lo vendes a otro cliente'] }),
            this.buildMemory({ userId: u, context: '🏠 Ese es el número del departamento al que debes entregar. ¡No lo olvides!' }),
            this.buildPriority({ userId: u, situation: 'Tienes 3 pedidos urgentes. ¿Cuál entregas primero?', items: [{ label: '🏥 Medicamento urgente para paciente', order: 0 }, { label: '🍕 Pizza lista hace 30 min', order: 1 }, { label: '📦 Paquete sin urgencia indicada', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Las bolsas térmicas mantienen la comida caliente perfectamente hasta 4 horas', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🐕 ¡Un perro está persiguiendo tu moto! ¡Acelera!', buttonLabel: '💨 ¡ACELERAR!', timeLimit: 3500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es buena práctica al entregar comida?', intruso: 'Abrir el pedido para ver si está completo', wrongPool: ['Llevar bolsa térmica', 'Confirmar la dirección', 'Avisar al llegar', 'Entregar en tiempo prometido', 'Ser amable'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para mantener las 5 estrellas como repartidor lo más importante es la ___ y el buen trato', correct: 'puntualidad', wrongPool: ['velocidad extrema', 'cantidad de pedidos', 'precio del vehículo', 'distancia recorrida', 'cantidad de seguidores'] }),
            this.buildGuessNumber({ userId: u, question: '⏱️ Tienes 30 min para 4 entregas. ¿Cuántos minutos máximo por entrega?', correct: '7 min', wrongPool: ['5 min', '10 min', '12 min', '15 min', '3 min'] }),
            this.buildPoolChoice({ userId: u, question: '🥶 El cliente dice que la comida llegó fría. ¿Qué haces?', correct: 'Te disculpas y reportas el caso a la empresa', wrongPool: ['Le dices que use el microondas', 'Culpas al restaurante', 'Ignoras el mensaje', 'Le dices que llegaste en tiempo récord'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántas entregas necesitas para llegar a tu meta del día', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── PIZZERO ───────────────────────────────────
    getPizzeroGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🍕 Cliente alérgico al gluten pide pizza. ¿Qué haces?', correct: 'Le ofreces base sin gluten', wrongPool: ['Le das la normal igual', 'No hay opciones, que busque otro lado', 'Ignoras la alergia', 'Le ofreces solo la salsa'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡La pizza se está QUEMANDO! ¡Sácala AHORA!', buttonLabel: '🧤 ¡SACAR!', timeLimit: 3000 }),
            this.buildMath({ userId: u, customQuestion: 'Pizza grande ($12) + extra queso ($2) + delivery ($3). ¿Total?', customAnswer: 17 }),
            this.buildTrueFalse({ userId: u, statement: 'La pizza Margherita lleva pepperoni como ingrediente principal', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es ingrediente de una pizza Cuatro Quesos?', intruso: 'Jamón serrano', wrongPool: ['Mozzarella', 'Gorgonzola', 'Parmesano', 'Emmental', 'Provolone'] }),
            this.buildSequence({ userId: u, instruction: '👨‍🍳 Ordena los pasos para hacer una pizza:', steps: [{ label: '🍞 Preparar la masa', order: 0 }, { label: '🫙 Agregar salsa', order: 1 }, { label: '🧀 Poner queso y toppings', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'La temperatura ideal del horno para pizza napolitana es de aproximadamente ___ grados', correct: '480°C', wrongPool: ['150°C', '200°C', '300°C', '600°C', '100°C'] }),
            this.buildPoolChoice({ userId: u, question: '📞 El cliente llama furioso porque llegó fría. ¿Qué le dices?', correct: '"Le enviamos otra sin costo"', wrongPool: ['"Es culpa del delivery"', '"Caliéntela"', '"No es mi problema"', '"La salsa era fría de por sí"'] }),
            this.buildMemory({ userId: u, context: '⏱️ Ese es el número del pedido especial VIP. ¡No lo confundas con otros!' }),
            this.buildPriority({ userId: u, situation: 'Emergencias simultáneas en la cocina. ¿Cuál atiendes primero?', items: [{ label: '🔥 Pizza quemándose en el horno', order: 0 }, { label: '📞 Cliente esperando respuesta', order: 1 }, { label: '🧹 Harina derramada en el piso', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'La masa de pizza puede reutilizarse sin refrigerar si solo pasaron 4 horas fuera', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Hora pico! ¡10 pedidos de golpe! ¡Empieza YA!', buttonLabel: '👊 ¡A TRABAJAR!', timeLimit: 4500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una salsa base para pizza?', intruso: 'Salsa de soya', wrongPool: ['Tomate', 'Crema blanca', 'Pesto', 'Salsa BBQ', 'Salsa de ajo'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para que la masa de pizza tenga buen sabor, debe fermentar al menos ___ horas en frío', correct: '24', wrongPool: ['2', '10 min', '72h a temperatura ambiente', '5 segundos', '1 semana'] }),
            this.buildGuessNumber({ userId: u, question: '🌡️ ¿A qué temperatura debe estar el horno para pizza perfecta?', correct: '280°C', wrongPool: ['150°C', '220°C', '400°C', '180°C', '350°C'] }),
            this.buildPoolChoice({ userId: u, question: '🫙 La salsa de tomate quedó muy ácida. ¿Cómo la corriges?', correct: 'Agrega una pizca de azúcar', wrongPool: ['Más sal', 'Agua fría', 'Vinagre extra', 'Ketchup', 'Jugo de limón'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántas pizzas puedes hacer con la harina que queda', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── BARTENDER ─────────────────────────────────
    getBartenderGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🍸 ¿Qué lleva un Cosmopolitan clásico?', correct: 'Vodka, arándano, triple sec, limón', wrongPool: ['Gin, vermut, aceituna', 'Tequila, sal, limón', 'Ron, coca, limón', 'Whisky, miel, limón'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡El cliente quiere un trago flameado! ¡Enciéndelo antes de que se enfríe!', buttonLabel: '🔥 ¡ENCENDER!', timeLimit: 3500 }),
            this.buildMath({ userId: u, customQuestion: 'La cuenta es $47.50 y pagan con $60. ¿Cuánto de cambio?', customAnswer: 13 }),
            this.buildTrueFalse({ userId: u, statement: 'El Dry Martini clásico se prepara con vodka y jugo de naranja', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es ingrediente del Mojito clásico?', intruso: 'Tequila', wrongPool: ['Ron blanco', 'Menta fresca', 'Azúcar', 'Limón', 'Soda'] }),
            this.buildSequence({ userId: u, instruction: '🍹 Prepara un Mojito en orden correcto:', steps: [{ label: '🌿 Muele la menta con azúcar', order: 0 }, { label: '🥃 Agrega ron y hielo', order: 1 }, { label: '🫧 Completa con soda', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'El vaso correcto para un Old Fashioned es el vaso ___ o rocks glass', correct: 'bajo/tumbler', wrongPool: ['de flauta', 'copa de vino', 'jarra de cerveza', 'de chupito', 'largo highball'] }),
            this.buildPoolChoice({ userId: u, question: '🥴 Un cliente ya está muy borracho y pide otro. ¿Qué haces?', correct: 'Le ofreces agua y le dices que es suficiente', wrongPool: ['Le sirves igual', 'Le cobras extra', 'Llamas a la policía de inmediato', 'Lo expulsas gritando'] }),
            this.buildMemory({ userId: u, context: '🎫 Ese es el número de mesa VIP con servicio prioritario esta noche' }),
            this.buildPriority({ userId: u, situation: 'La barra está llena y hay varias situaciones simultáneas. ¿Qué atiendes primero?', items: [{ label: '🤢 Cliente que se ve muy mal', order: 0 }, { label: '🍸 5 clientes esperando pedido', order: 1 }, { label: '🧹 Vaso roto en el suelo', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El Negroni lleva partes iguales de gin, Campari y vermut rojo', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '🍾 ¡El champagne del VIP está desbordándose! ¡Controla!', buttonLabel: '🥂 ¡CONTROLAR!', timeLimit: 3500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es ingrediente del Negroni?', intruso: 'Jugo de piña', wrongPool: ['Gin', 'Campari', 'Vermut rojo', 'Hielo', 'Naranja (guarnición)'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para agitar correctamente un cóctel se usa el ___ y se agita 10-15 segundos vigorosamente', correct: 'shaker', wrongPool: ['tenedor', 'licuadora', 'batidora eléctrica', 'cuchara de madera', 'vaso de vidrio'] }),
            this.buildGuessNumber({ userId: u, question: '🍹 3 Mojitos ($8 c/u) + 2 cervezas ($4 c/u). ¿Total?', correct: '$32', wrongPool: ['$28', '$36', '$30', '$40', '$26'] }),
            this.buildPoolChoice({ userId: u, question: '🤬 Un cliente borracho te insulta frente a todos. ¿Qué haces?', correct: 'Mantienes la calma y llamas al guardia de seguridad', wrongPool: ['Le insultas de vuelta', 'Le tiras el trago encima', 'Lloras en la barra', 'Le sirves más para calmarlo'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántas botellas necesitas para el evento de mañana de 50 personas', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── UBER ──────────────────────────────────────
    getUberGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🗺️ El GPS dice una ruta pero hay obras. ¿Qué haces?', correct: 'Tomas la ruta alterna que conoces', wrongPool: ['Sigues el GPS ciegamente', 'Cancelas el viaje', 'Cobras extra por el desvío', 'Esperas a que terminen las obras'] }),
            this.buildReaction({ userId: u, prompt: '🟢 ¡Llegó una solicitud a 2 minutos! ¡Acéptala RÁPIDO!', buttonLabel: '✅ ¡ACEPTAR!' }),
            this.buildMath({ userId: u, customQuestion: '15km a $1.20/km + $2 base. ¿Total del viaje?', customAnswer: 20 }),
            this.buildTrueFalse({ userId: u, statement: 'Puedes cancelar un viaje de Uber sin penalización si lo haces antes de los 5 minutos', isTrue: true }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un factor que afecta tu calificación en Uber?', intruso: 'El color de tu carro', wrongPool: ['Puntualidad', 'Limpieza del vehículo', 'Actitud con el pasajero', 'Ruta eficiente', 'Música apropiada'] }),
            this.buildSequence({ userId: u, instruction: '⭐ Ordena las prioridades para tener 5 estrellas:', steps: [{ label: '🚗 Auto limpio y con buen olor', order: 0 }, { label: '🗺️ Ruta eficiente', order: 1 }, { label: '😊 Actitud amable', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'El surge pricing de Uber se activa cuando hay ___ conductores disponibles en la zona', correct: 'pocos', wrongPool: ['muchos', 'exactamente 10', 'cero', 'demasiados', '100'] }),
            this.buildPoolChoice({ userId: u, question: '😤 El pasajero te da 1 estrella sin razón. ¿Qué haces?', correct: 'Reportas el viaje a Uber Support', wrongPool: ['Le escribes insultos', 'Dejas de trabajar', 'Le pones también 1 estrella', 'Publicas su foto en redes'] }),
            this.buildMemory({ userId: u, context: '🚗 Esa es la placa del vehículo que debes recoger en el aeropuerto. ¡Memorízala!' }),
            this.buildPriority({ userId: u, situation: 'Varias solicitudes llegaron al mismo tiempo. ¿Cuál aceptas primero?', items: [{ label: '🏥 Viaje urgente al hospital', order: 0 }, { label: '✈️ Cliente con vuelo en 2 horas', order: 1 }, { label: '🛍️ Viaje normal al mall', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Es obligatorio dejar subir mascotas en todos los viajes de Uber normal', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Un policía te hace señas de parar! ¡Frena con calma!', buttonLabel: '🛑 ¡FRENAR!', timeLimit: 3000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un tipo de servicio de Uber?', intruso: 'Uber Helicóptero Estándar', wrongPool: ['UberX', 'Uber Comfort', 'Uber Black', 'Uber Pool', 'Uber XL'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para mantener buena calificación, cuando el pasajero sube debes ___ su nombre antes de arrancar', correct: 'confirmar', wrongPool: ['ignorar', 'adivinar', 'fotografiar', 'gritarle', 'inventar'] }),
            this.buildGuessNumber({ userId: u, question: '⭐ ¿Cuántas estrellas mínimas necesitas para no ser desactivado en Uber?', correct: '4.6', wrongPool: ['3.0', '4.0', '5.0', '3.5', '4.2'] }),
            this.buildPoolChoice({ userId: u, question: '🤢 El pasajero dice que se marea. ¿Qué haces?', correct: 'Bajas la velocidad, abres ventanas y ofreces parar', wrongPool: ['Aceleras para llegar antes', 'Ignoras y sigues', 'Lo bajas inmediatamente', 'Llamas al 911'] }),
            this.buildMath({ userId: u, context: 'Calculas tus ganancias del día después de la comisión de Uber', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── CROUPIER ──────────────────────────────────
    getCroupierGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🃏 En blackjack, el jugador tiene 16 y tú muestras un 7. ¿Qué hace correctamente?', correct: 'Pide carta', wrongPool: ['Se planta con 16', 'Dobla la apuesta', 'Se rinde', 'Divide los 16'] }),
            this.buildReaction({ userId: u, prompt: '🎴 ¡Es tu turno de repartir! ¡Hazlo RÁPIDO y con elegancia!', buttonLabel: '🃏 ¡REPARTIR!', timeLimit: 3500 }),
            this.buildMath({ userId: u, customQuestion: 'Jugador apuesta $200 al rojo en ruleta y gana. ¿Cuánto recibe en total?', customAnswer: 400 }),
            this.buildTrueFalse({ userId: u, statement: 'La ruleta europea tiene 38 números, incluyendo el 0 y el 00', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un juego de mesa de casino?', intruso: 'Bingo de granja', wrongPool: ['Blackjack', 'Baccarat', 'Ruleta', 'Póker', 'Craps'] }),
            this.buildSequence({ userId: u, instruction: '🃏 Ordena el inicio de una mesa de blackjack:', steps: [{ label: '🔀 Barajar el mazo', order: 0 }, { label: '💰 Recolectar apuestas', order: 1 }, { label: '🃏 Repartir las cartas', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'En blackjack, el objetivo es llegar a ___ puntos sin pasarse', correct: '21', wrongPool: ['10', '15', '30', 'los más posibles', '18'] }),
            this.buildPoolChoice({ userId: u, question: '😤 Un jugador acusa al casino de trampa. ¿Cómo respondes?', correct: 'Llamas al supervisor con calma', wrongPool: ['Te pones nervioso', 'Le dices que tiene razón', 'Ignoras al jugador', 'Discutes públicamente'] }),
            this.buildMemory({ userId: u, context: '🎰 Ese es el límite máximo de apuesta autorizado en tu mesa esta noche' }),
            this.buildPriority({ userId: u, situation: 'Varias situaciones ocurren en tu mesa. ¿Cuál atiendes primero?', items: [{ label: '🕵️ Jugador posiblemente contando cartas', order: 0 }, { label: '💰 Pago pendiente al ganador', order: 1 }, { label: '🎴 Mazo que hay que barajar', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El blackjack natural (As + figura) paga 3 a 2 en la mayoría de casinos', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '💰 ¡El jugador ganó y quiere cobrar inmediatamente! ¡Paga con precisión!', buttonLabel: '💵 ¡PAGAR!', timeLimit: 4000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es señal de alguien contando cartas?', intruso: 'Pedir agua frecuentemente', wrongPool: ['Variar drásticamente el tamaño de apuestas', 'Hacer señas discretas a otro jugador', 'Siempre saber cuándo pedir carta', 'Aumentar apuestas cuando el mazo es favorable', 'Llevar libro de matemáticas'] }),
            this.buildFillBlank({ userId: u, sentence: 'Cuando un jugador quiere "doblar" en blackjack solo puede hacerlo con ___ cartas en mano', correct: 'las primeras 2', wrongPool: ['cualquier cantidad', '3 o más', '4 cartas exactas', '1 sola carta', 'ninguna'] }),
            this.buildGuessNumber({ userId: u, question: '🎲 ¿Cuántos números tiene la ruleta europea?', correct: '37', wrongPool: ['36', '38', '32', '40', '34'] }),
            this.buildPoolChoice({ userId: u, question: '🤑 Un jugador ganó $50,000 en tu mesa. ¿Qué debes hacer?', correct: 'Notificar al supervisor y completar el papeleo requerido', wrongPool: ['Felicitarlo y seguir normal', 'Pedirle propina en privado', 'Reportarlo como sospechoso', 'Negarle más juego'] }),
            this.buildMath({ userId: u, customQuestion: 'Pago de blackjack natural (3:2) sobre apuesta de $100. ¿Cuánto recibe el jugador en total?', customAnswer: 250 }),
        ]).slice(0, 10);
    }

    // ── BARISTA CASINO ────────────────────────────
    getBaristaGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '☕ Un VIP pide "Espresso Romano". ¿Qué lleva?', correct: 'Espresso + rodaja de limón', wrongPool: ['Espresso + leche', 'Espresso + caramelo', 'Espresso + crema batida', 'Espresso + canela'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Derramaste café sobre la mesa de blackjack! ¡Limpia AHORA!', buttonLabel: '🧹 ¡LIMPIAR!', timeLimit: 3500 }),
            this.buildMath({ userId: u, customQuestion: 'Jugador ganó $5000, te da propina del 5%. ¿Cuánto recibes?', customAnswer: 250 }),
            this.buildTrueFalse({ userId: u, statement: 'El espresso debe prepararse con agua a temperatura de ebullición exacta (100°C)', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un tipo de preparación de café espresso?', intruso: 'Café americano con leche de soya y hielo frappé', wrongPool: ['Ristretto', 'Lungo', 'Cortado', 'Macchiato', 'Doppio'] }),
            this.buildSequence({ userId: u, instruction: '☕ Ordena cómo preparar un cappuccino perfecto:', steps: [{ label: '☕ Preparar el espresso', order: 0 }, { label: '🥛 Vaporizar la leche', order: 1 }, { label: '🎨 Verter haciendo latte art', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'La temperatura ideal del agua para espresso está entre ___ grados', correct: '88-92°C', wrongPool: ['60-65°C', '100°C exactos', '50°C', '75-80°C', '95-99°C'] }),
            this.buildPoolChoice({ userId: u, question: '😤 Un jugador perdió todo y está siendo agresivo. ¿Qué haces?', correct: 'Llamas a seguridad con calma', wrongPool: ['Le gritas de vuelta', 'Le ofreces trago gratis', 'Te escondes', 'Lo grabas para redes'] }),
            this.buildMemory({ userId: u, context: '🎰 Ese es el número de mesa del cliente VIP con pedido especial recurrente cada semana' }),
            this.buildPriority({ userId: u, situation: 'Múltiples situaciones en el bar del casino. ¿Cuál atiendes primero?', items: [{ label: '🤢 Cliente que se ve muy mal', order: 0 }, { label: '☕ 8 pedidos de café esperando', order: 1 }, { label: '🧹 Vaso roto en el piso', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El latte art solo funciona con leche entera y no con leche de avena o almendra', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🎰 ¡Jackpot en las máquinas! ¡Todos piden bebidas al mismo tiempo!', buttonLabel: '🥂 ¡PREPARAR!', timeLimit: 4000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es ingrediente del Mojito?', intruso: 'Vodka', wrongPool: ['Ron blanco', 'Menta', 'Azúcar', 'Limón', 'Soda'] }),
            this.buildFillBlank({ userId: u, sentence: 'En un casino de lujo cuando llega un VIP, lo primero es ___ y ofrecerle su bebida habitual', correct: 'saludarlo por su nombre', wrongPool: ['pedirle identificación', 'preguntarle cuánto dinero trae', 'ignorarlo hasta que pida', 'llamar a seguridad', 'revisar su tarjeta de crédito'] }),
            this.buildGuessNumber({ userId: u, question: '🍹 3 Gin Tonic ($12 c/u) + 2 jugos ($6 c/u). ¿Total?', correct: '$48', wrongPool: ['$36', '$54', '$42', '$60', '$45'] }),
            this.buildPoolChoice({ userId: u, question: '🌙 Son las 4am y un jugador pide su décima bebida. ¿Qué haces?', correct: 'Le ofreces agua o jugo y evalúas si servirle más', wrongPool: ['Le sirves sin problema', 'Lo expulsas del casino', 'Le cobras triple', 'Le dices que el bar cerró'] }),
            this.buildMath({ userId: u, context: 'Calculas el total de una mesa de 6 personas con cocktails variados', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── PROGRAMADOR ───────────────────────────────
    getProgrammerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🐛 `let y = "3"; let z = 5 + y;` ¿Qué valor tiene z?', correct: '"53" (concatenación de string)', wrongPool: ['8 (suma normal)', 'Error de compilación', 'undefined', 'null'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡EL SERVIDOR SE CAYÓ EN PRODUCCIÓN! ¡REINICIA YA!', buttonLabel: '🔄 ¡REINICIAR!', timeLimit: 5000 }),
            this.buildMath({ userId: u, context: 'Cotizas un proyecto. Calculas el total de horas × tu tarifa', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'En JavaScript, === compara valor Y tipo de dato, mientras que == solo compara el valor', isTrue: true }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un lenguaje de programación?', intruso: 'HTML puro', wrongPool: ['Python', 'JavaScript', 'Rust', 'Go', 'TypeScript'] }),
            this.buildSequence({ userId: u, instruction: '🚀 Ordena los pasos de un deploy correcto:', steps: [{ label: '📦 Build del proyecto', order: 0 }, { label: '🧪 Correr tests', order: 1 }, { label: '☁️ Deploy a producción', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'El comando para clonar un repositorio en Git es `git ___`', correct: 'clone', wrongPool: ['copy', 'download', 'fetch', 'pull', 'get'] }),
            this.buildPoolChoice({ userId: u, question: '🎯 Un junior rompió la rama main en git. ¿Qué haces primero?', correct: 'git revert al último commit estable', wrongPool: ['Renunciar', 'Culpar al junior', 'Apagar el servidor', 'Borrar el repo'] }),
            this.buildMemory({ userId: u, context: '🔑 Esa es la API key del cliente que necesitas para el proyecto. ¡No la pierdas!' }),
            this.buildPriority({ userId: u, situation: 'Varios bugs llegaron al mismo tiempo. ¿Cuál arreglas primero?', items: [{ label: '💳 Bug en el sistema de pagos', order: 0 }, { label: '🎨 Botón con color incorrecto', order: 1 }, { label: '📝 Typo en el footer', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Una función recursiva sin caso base producirá inevitablemente un stack overflow', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '📧 ¡El cliente envió 47 correos en 10 minutos! ¡Responde el importante!', buttonLabel: '📬 ¡RESPONDER!', timeLimit: 4500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un tipo de base de datos?', intruso: 'FileScript DB', wrongPool: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para guardar contraseñas de forma segura en base de datos se usa ___ y nunca texto plano', correct: 'hashing (bcrypt/argon2)', wrongPool: ['Base64', 'cifrado reversible', 'compresión ZIP', 'ROT13', 'solo minúsculas'] }),
            this.buildGuessNumber({ userId: u, question: '🖥️ ¿Cuántos bits tiene un byte?', correct: '8', wrongPool: ['4', '16', '12', '6', '10'] }),
            this.buildPoolChoice({ userId: u, question: '⚡ ¿Qué algoritmo es más eficiente para ordenar listas grandes?', correct: 'Quick Sort O(n log n)', wrongPool: ['Bubble Sort O(n²)', 'Selection Sort O(n²)', 'Bogo Sort O(n·n!)', 'Insertion Sort O(n²)'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántas horas extras te deben pagar este mes', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── OXXO ──────────────────────────────────────
    getOxxoGames(u) {
        return this.shuffle([
            this.buildReaction({ userId: u, prompt: '🚪 ¡Es exactamente tu hora de apertura! ¡Abre AHORA!', buttonLabel: '🔑 ¡ABRIR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u, question: '🔞 Un joven quiere comprar alcohol. ¿Qué haces?', correct: 'Pides identificación oficial antes de vender', wrongPool: ['Le vendes si parece mayor', 'Le preguntas la edad y le crees', 'No vendes a nadie', 'Lo dejas si viene con adulto'] }),
            this.buildMath({ userId: u, customQuestion: 'El cliente paga $50 por una compra de $37.50. ¿Cuánto de cambio?', customAnswer: 13 }),
            this.buildTrueFalse({ userId: u, statement: 'En México, los Oxxo pueden vender alcohol las 24 horas sin ninguna restricción legal', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un servicio que puedes pagar en Oxxo?', intruso: 'Trámite de pasaporte', wrongPool: ['Recarga de celular', 'Pago de luz', 'Pago de agua', 'Recarga de transporte', 'Pago de internet'] }),
            this.buildSequence({ userId: u, instruction: '🔐 Protocolo de apertura del Oxxo:', steps: [{ label: '🔍 Verificar área exterior', order: 0 }, { label: '🔑 Desactivar alarma', order: 1 }, { label: '🚪 Abrir puertas al público', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Al recibir un billete de alta denominación, siempre debes ___ con el marcador especial', correct: 'verificar su autenticidad', wrongPool: ['fotografiarlo', 'rechazarlo siempre', 'guardarlo para ti', 'mostrárselo al cliente', 'devolverlo sin revisar'] }),
            this.buildPoolChoice({ userId: u, question: '💡 Al abrir, notas que falta mercancía. ¿Qué haces?', correct: 'Reportas al encargado y documentas con fotos', wrongPool: ['Ignoras y sigues', 'Culpas al turno anterior', 'Lo llenas de tu bolsillo', 'Lo publicas en Facebook'] }),
            this.buildMemory({ userId: u, context: '🔐 Ese es el código de desactivación de la alarma del turno de hoy. ¡Memorízalo!' }),
            this.buildPriority({ userId: u, situation: 'Múltiples situaciones en la tienda. ¿Cuál atiendes primero?', items: [{ label: '🔥 Humo saliendo del microondas', order: 0 }, { label: '🚨 Alarma de la caja sonando', order: 1 }, { label: '😤 Cliente molesto en la fila', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El Oxxo cobra una comisión al cliente por pagar servicios como luz o teléfono', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '💸 ¡Larga fila y la caja se trabó! ¡Reiníciala rápido!', buttonLabel: '🖥️ ¡REINICIAR!', timeLimit: 4000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es parte del uniforme estándar de un empleado Oxxo?', intruso: 'Corbata de moño roja', wrongPool: ['Polo naranja', 'Gafete con nombre', 'Pantalón negro', 'Zapatos cerrados', 'Delantal del logo'] }),
            this.buildFillBlank({ userId: u, sentence: 'Si el sistema de cobro cae, debes ___ hasta que se restaure el servicio', correct: 'notificar al gerente y esperar', wrongPool: ['cobrar en papel y ya', 'cerrar la tienda', 'atender gratis a todos', 'inventar los precios', 'usar la calculadora del celular y fiarse'] }),
            this.buildGuessNumber({ userId: u, question: '⏰ La alarma tiene 30 seg antes de activarse. ¿Cuántos tienes para el código?', correct: '30 seg', wrongPool: ['10 seg', '20 seg', '45 seg', '60 seg', '5 seg'] }),
            this.buildPoolChoice({ userId: u, question: '🕵️ Notas que un cliente metió algo en su ropa. ¿Qué haces?', correct: 'Alertas al supervisor discretamente', wrongPool: ['Lo confrontas en voz alta', 'Lo ignoras', 'Lo persigues por la tienda', 'Lo acusas por el altavoz'] }),
            this.buildMath({ userId: u, context: 'Calculas el cuadre de caja al final del turno', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── MECÁNICO ──────────────────────────────────
    getMecanicoGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🔧 El cliente dice que el carro "hace ruido raro al frenar". ¿Qué revisas primero?', correct: 'Discos y pastillas de freno', wrongPool: ['El motor', 'La batería', 'El aceite', 'El radio'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡El motor está sobrecalentado! ¡Apágalo RÁPIDO!', buttonLabel: '🔑 ¡APAGAR!', timeLimit: 3500 }),
            this.buildMath({ userId: u, customQuestion: '$350 en piezas + 3 horas a $50/hora. ¿Total de la reparación?', customAnswer: 500 }),
            this.buildTrueFalse({ userId: u, statement: 'El aceite sintético de motor dura más entre cambios que el aceite convencional', isTrue: true }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es síntoma de batería fallando?', intruso: 'El auto acelera más rápido de lo normal', wrongPool: ['Motor que no enciende fácil', 'Luces más tenues', 'Radio que falla', 'Clic al encender', 'Luz de batería encendida'] }),
            this.buildSequence({ userId: u, instruction: '🛢️ Ordena un cambio de aceite correcto:', steps: [{ label: '🔩 Drenar el aceite viejo', order: 0 }, { label: '🔧 Cambiar el filtro', order: 1 }, { label: '🛢️ Llenar con aceite nuevo', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Cuando el Check Engine se enciende lo primero es conectar un escáner ___ para leer los códigos', correct: 'OBD-II', wrongPool: ['Bluetooth genérico', 'Radio FM', 'USB tipo C', 'HDMI', 'VGA'] }),
            this.buildPoolChoice({ userId: u, question: '💡 El Check Engine está encendido. ¿Qué haces primero?', correct: 'Conectas el escáner OBD para leer el código', wrongPool: ['Lo ignoras', 'Cambias la batería', 'Cubres la luz con cinta', 'Reinicias el carro 3 veces'] }),
            this.buildMemory({ userId: u, context: '🔑 Esa es la matrícula del vehículo del cliente VIP. ¡Memorízala para no confundirla!' }),
            this.buildPriority({ userId: u, situation: 'Varios vehículos necesitan atención. ¿Cuál atiendes primero?', items: [{ label: '🚨 Frenos fallando en carro con familia', order: 0 }, { label: '⛽ Auto sin aceite desde hace tiempo', order: 1 }, { label: '💡 Check Engine encendido solo', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'La presión de los neumáticos debe revisarse cuando están calientes después de manejar para mayor precisión', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🚗 ¡El carro cayó del gato hidráulico! ¡Salta!', buttonLabel: '🏃 ¡SALTAR!', timeLimit: 2500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es herramienta básica del mecánico?', intruso: 'Violín de cuerdas', wrongPool: ['Llave inglesa', 'Destornillador de cruz', 'Gato hidráulico', 'Multímetro', 'Torquímetro'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para levantar un vehículo con seguridad, siempre debes usar el gato y ___ en los puntos de apoyo correctos', correct: 'caballetes de seguridad', wrongPool: ['solo el gato de emergencia', 'una caja de herramientas', 'ladrillos o maderas', 'el parachoques del auto', 'tus manos'] }),
            this.buildGuessNumber({ userId: u, question: '🔩 ¿Cuántos tornillos tiene típicamente una rueda de carro?', correct: '4 o 5', wrongPool: ['2', '8', '3', '6', '10'] }),
            this.buildPoolChoice({ userId: u, question: '💧 El cliente ve líquido verde debajo del carro. ¿Qué es?', correct: 'Refrigerante — fuga en el sistema de enfriamiento', wrongPool: ['Aceite de motor pintado', 'Agua del AC normal', 'Líquido de frenos', 'Combustible', 'Agua de lluvia acumulada'] }),
            this.buildMath({ userId: u, context: 'Calculas el descuento del 15% para un cliente frecuente', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── DOCTOR ────────────────────────────────────
    getDoctorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🩺 Paciente con fiebre 39°C, dolor de garganta y ganglios. ¿Diagnóstico más probable?', correct: 'Amigdalitis bacteriana', wrongPool: ['Gripe común', 'COVID-19', 'Alergia estacional', 'Laringitis viral'] }),
            this.buildReaction({ userId: u, prompt: '💔 ¡PACIENTE EN PARO CARDÍACO! ¡USA EL DESFIBRILADOR!', buttonLabel: '⚡ ¡DESFIBRILA!', timeLimit: 4000 }),
            this.buildMath({ userId: u, customQuestion: 'Paciente de 70kg necesita 10mg/kg. ¿Cuántos mg administras?', customAnswer: 700 }),
            this.buildTrueFalse({ userId: u, statement: 'La penicilina es antibiótico seguro para pacientes alérgicos a la amoxicilina', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un signo vital básico?', intruso: 'Color del cabello', wrongPool: ['Presión arterial', 'Frecuencia cardíaca', 'Temperatura corporal', 'Frecuencia respiratoria', 'Saturación de oxígeno'] }),
            this.buildSequence({ userId: u, instruction: '🏥 Ordena los pasos de atención en urgencias:', steps: [{ label: '📋 Triaje inicial', order: 0 }, { label: '🩺 Diagnóstico y tratamiento', order: 1 }, { label: '📝 Alta o ingreso', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'La presión arterial normal en un adulto sano es aproximadamente ___', correct: '120/80 mmHg', wrongPool: ['200/120 mmHg', '80/40 mmHg', '160/100 mmHg', '90/60 mmHg siempre', '50/30 mmHg'] }),
            this.buildPoolChoice({ userId: u, question: '⚠️ Paciente alérgico a penicilina necesita antibiótico. ¿Qué usas?', correct: 'Azitromicina', wrongPool: ['Amoxicilina', 'Ampicilina', 'Cloxacilina', 'Oxacilina'] }),
            this.buildMemory({ userId: u, context: '🏥 Ese es el número de cama del paciente crítico que necesita seguimiento cada 30 minutos' }),
            this.buildPriority({ userId: u, situation: 'Urgencias llena con varios pacientes. ¿Cuál atiendes primero?', items: [{ label: '💔 Paciente con dolor en el pecho', order: 0 }, { label: '🤒 Niño con fiebre de 38.5°C', order: 1 }, { label: '🤧 Adulto con gripe leve', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'La fiebre siempre debe bajarse inmediatamente con medicamentos sin importar el valor', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Código azul en el pasillo! ¡Corre!', buttonLabel: '🏃 ¡CORRER!', timeLimit: 3000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un antibiótico?', intruso: 'Ibuprofeno', wrongPool: ['Amoxicilina', 'Azitromicina', 'Ciprofloxacino', 'Metronidazol', 'Clindamicina'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para evaluar el nivel de consciencia de un paciente se usa la escala de coma de ___', correct: 'Glasgow', wrongPool: ['Richter', 'Beaufort', 'Fujita', 'Newton', 'Fahrenheit'] }),
            this.buildGuessNumber({ userId: u, question: '🫀 ¿Cuál es la frecuencia cardíaca normal en adultos en reposo?', correct: '60-100 lpm', wrongPool: ['30-50 lpm', '120-140 lpm', '100-120 lpm', '150-180 lpm', '20-40 lpm'] }),
            this.buildPoolChoice({ userId: u, question: '🧠 Dolor de cabeza "el peor de su vida" de inicio súbito. ¿Qué sospechas?', correct: 'Hemorragia subaracnoidea', wrongPool: ['Migraña común', 'Tensión muscular', 'Deshidratación', 'Sinusitis'] }),
            this.buildMath({ userId: u, context: 'Calculas la dosis de solución IV según peso y horas del paciente', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── BOTARGA DR. SIMI ──────────────────────────
    getSimiGames(u) {
        return this.shuffle([
            this.buildSequence({ userId: u, instruction: '🕺 Ejecuta el baile icónico del Dr. Simi:', steps: [{ label: '🙌 Palmas arriba', order: 0 }, { label: '💃 Giro completo', order: 1 }, { label: '🎉 Salto final', order: 2 }] }),
            this.buildReaction({ userId: u, prompt: '📸 ¡Un niño quiere foto con el Dr. Simi! ¡Posa AHORA!', buttonLabel: '😄 ¡POSAR!', timeLimit: 3000 }),
            this.buildMath({ userId: u, customQuestion: '8 horas como botarga a $15/hora. ¿Cuánto ganas?', customAnswer: 120 }),
            this.buildTrueFalse({ userId: u, statement: 'Dentro de la botarga del Dr. Simi puede hacer hasta 15°C más que la temperatura exterior', isTrue: true }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es riesgo real de trabajar como botarga?', intruso: 'Volverse famoso instantáneamente', wrongPool: ['Golpe de calor', 'Visibilidad reducida', 'Dificultad para respirar', 'Problemas de movilidad', 'Deshidratación'] }),
            this.buildFillBlank({ userId: u, sentence: 'Si sientes mareo dentro de la botarga, lo correcto es ___ y buscar ayuda de inmediato', correct: 'parar inmediatamente', wrongPool: ['seguir bailando más fuerte', 'quitarte la cabeza del disfraz en público', 'pedir agua a un niño', 'ignorarlo', 'echarte al suelo'] }),
            this.buildPoolChoice({ userId: u, question: '😤 Un adulto borracho quiere pelear con la botarga. ¿Qué haces?', correct: 'Te alejas y llamas a seguridad', wrongPool: ['Le pegas', 'Te quitas la botarga', 'Lo retas a bailar', 'Lo grabas para TikTok'] }),
            this.buildReaction({ userId: u, prompt: '💃 ¡Están tocando tu canción en el evento! ¡Empieza a bailar!', buttonLabel: '🎶 ¡BAILAR!', timeLimit: 3500 }),
            this.buildMemory({ userId: u, context: '📍 Esa es la ubicación exacta donde debes estar parado durante el evento. ¡Memorízala!' }),
            this.buildPriority({ userId: u, situation: 'Varias situaciones en el evento. ¿Cuál atiendes primero?', items: [{ label: '🌡️ Te sientes mareado del calor', order: 0 }, { label: '📸 Fila de 50 niños queriendo foto', order: 1 }, { label: '🎵 El DJ cambió tu canción', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El Dr. Simi es la mascota oficial de Farmacias del Ahorro', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🏆 ¡El evento terminó y el público pide un último baile! ¡Dale todo!', buttonLabel: '⭐ ¡ÚLTIMO BAILE!', timeLimit: 4000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una emoción que debe transmitir la botarga del Dr. Simi?', intruso: 'Terror y amenaza', wrongPool: ['Alegría', 'Diversión', 'Energía', 'Amabilidad', 'Simpatía'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para que el público interactúe contigo como botarga, el truco es ___ de forma exagerada', correct: 'exagerar los movimientos', wrongPool: ['hablar normalmente', 'quedarte quieto', 'ignorar a la gente', 'quitarte la cabeza', 'usar un megáfono'] }),
            this.buildGuessNumber({ userId: u, question: '💰 Evento de 5 horas a $18/hora. ¿Cuánto cobras?', correct: '$90', wrongPool: ['$80', '$100', '$75', '$110', '$85'] }),
            this.buildPoolChoice({ userId: u, question: '👶 Un bebé llora de miedo al verte. ¿Qué haces?', correct: 'Te alejas para no asustar más al bebé', wrongPool: ['Te acercas más para que se acostumbre', 'Te quitas la cabeza del disfraz', 'Le haces sonidos para calmarlo', 'Ignoras al bebé y sigues bailando'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántos minutos de descanso te corresponden en un evento de 6 horas', difficulty: 'easy' }),
        ]).slice(0, 10);
    }

    // ── CRIMINAL ──────────────────────────────────
    getCriminalGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🕵️ Necesitas escapar. ¿Qué ruta eliges?', correct: 'Callejón trasero despejado', wrongPool: ['Calle principal con patrullas', 'Plaza central con testigos', 'Metro con cámaras', 'Autopista con peaje'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡LLEGA LA POLICÍA! ¡ESCÓNDETE AHORA!', buttonLabel: '🏃 ¡ESCONDERSE!', timeLimit: 3000 }),
            this.buildMath({ userId: u, context: 'Calculas la ganancia neta después de pagarle al intermediario', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'Un cliente que paga siempre en efectivo con billetes nuevos no levanta ninguna sospecha', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es señal de que alguien podría ser policía encubierto?', intruso: 'Usar ropa cómoda', wrongPool: ['Auricular en la oreja', 'Hacer preguntas muy específicas', 'Ofrecer pagar inmediatamente sin negociar', 'Llegar con "cliente" que no conoces', 'Grabar la zona discretamente'] }),
            this.buildSequence({ userId: u, instruction: '📦 Ordena el intercambio para no levantar sospechas:', steps: [{ label: '👀 Verificar el área', order: 0 }, { label: '🤝 Confirmar con el contacto', order: 1 }, { label: '💼 Hacer el intercambio', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Para no levantar sospechas, nunca debes llevar más efectivo del que puedas ___ si te para la policía', correct: 'explicar de dónde viene', wrongPool: ['guardar en el calcetín', 'mostrar orgullosamente', 'contar en público', 'fotografiar para el recuerdo', 'dar a quien pida'] }),
            this.buildPoolChoice({ userId: u, question: '📱 El contacto no responde hace 2 horas. ¿Qué haces?', correct: 'Cancelas la operación y te retiras', wrongPool: ['Sigues esperando indefinidamente', 'Llamas de tu celular personal', 'Vas al punto de todas formas', 'Preguntas a sus conocidos'] }),
            this.buildMemory({ userId: u, context: '🔑 Esa es la contraseña para el punto de entrega de esta noche. ¡Memorízala, no la escribas!' }),
            this.buildPriority({ userId: u, situation: 'Varias alertas simultáneas. ¿Cuál atiendes primero?', items: [{ label: '🚔 Patrulla girando hacia ti', order: 0 }, { label: '📱 Mensaje urgente del contacto', order: 1 }, { label: '💰 El comprador quiere renegociar', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Las cámaras de tráfico solo graban de noche y no funcionan durante el día', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🔦 ¡Una linterna te apunta desde un carro oscuro! ¡Actúa!', buttonLabel: '🏃 ¡CORRER!', timeLimit: 2500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es buena práctica para no dejar rastro?', intruso: 'Publicar fotos del trabajo en Instagram', wrongPool: ['Usar teléfonos desechables', 'Cambiar rutas constantemente', 'No hablar de trabajo por teléfono', 'Variar los horarios', 'Usar efectivo siempre'] }),
            this.buildFillBlank({ userId: u, sentence: 'Cuando sientes que te siguen, lo correcto es entrar a un lugar ___ y observar si la persona también entra', correct: 'concurrido', wrongPool: ['abandonado', 'oscuro', 'tu casa directamente', 'un callejón sin salida', 'la comisaría'] }),
            this.buildGuessNumber({ userId: u, question: '💸 Trato por $500. Comprador trae $350. ¿Cuánto falta?', correct: '$150', wrongPool: ['$100', '$200', '$250', '$175', '$50'] }),
            this.buildPoolChoice({ userId: u, question: '🎭 La policía te pregunta dónde estabas anoche. ¿Qué dices?', correct: 'Dices que estabas en casa y pides hablar con un abogado', wrongPool: ['Inventas una historia complicada', 'Confiesas todo', 'Te niegas agresivamente', 'Corres en el momento'] }),
            this.buildMath({ userId: u, context: 'Calculas la ganancia de la semana después de todos los gastos operativos', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── VENDEDOR DEL PUNTO ────────────────────────
    getVendedorGames(u) {
        return this.shuffle([
            this.buildGuessNumber({ userId: u, question: '💰 Te costó $200. ¿Qué precio maximiza ganancia sin asustar al cliente?', correct: '$320', wrongPool: ['$250', '$500', '$180', '$280', '$450'] }),
            this.buildReaction({ userId: u, prompt: '👮 ¡PASÓ UNA PATRULLA! ¡ACTÚA NORMAL!', buttonLabel: '😇 ¡NORMAL!', timeLimit: 3000 }),
            this.buildMath({ userId: u, context: 'Calculas la ganancia de la semana descontando gastos y el pago al proveedor', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'Vender a menores de edad tiene exactamente el mismo riesgo legal que vender a adultos', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es señal de que un cliente podría ser informante?', intruso: 'Pagar en efectivo sin negociar', wrongPool: ['Hacer preguntas muy específicas', 'Grabar el área discretamente', 'Traer siempre al mismo "amigo" nuevo', 'Querer hablar en lugares muy públicos', 'Preguntar por cantidades exactas inusuales'] }),
            this.buildSequence({ userId: u, instruction: '🤫 Ordena una entrega segura:', steps: [{ label: '👀 Chequear el área', order: 0 }, { label: '📲 Confirmar con el cliente', order: 1 }, { label: '💼 Entregar y cobrar', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Para mantener clientes fieles, lo más importante es la ___ y la discreción absoluta', correct: 'consistencia del producto', wrongPool: ['publicidad en redes sociales', 'precios más bajos siempre', 'regalar muestras a todos', 'tener local fijo visible', 'hacer descuentos masivos'] }),
            this.buildPoolChoice({ userId: u, question: '🤝 Proveedor quiere el doble por adelantado. ¿Qué haces?', correct: 'Negocias: mitad ahora, mitad al recibir', wrongPool: ['Pagas todo de inmediato', 'Rechazas sin negociar', 'Pides fiado', 'Le ofreces el triple después'] }),
            this.buildMemory({ userId: u, context: '📍 Esa es la ubicación del nuevo punto de entrega que acordaron. ¡No la escribas en ningún lado!' }),
            this.buildPriority({ userId: u, situation: 'Varias alertas al mismo tiempo en el punto. ¿Cuál atiendes primero?', items: [{ label: '🚔 Patrulla estacionándose cerca', order: 0 }, { label: '📱 Proveedor con entrega pendiente', order: 1 }, { label: '💰 Cliente esperando hace 10 minutos', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Usar siempre el mismo punto de encuentro es buena práctica porque los clientes ya lo conocen', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '🚁 ¡Hay un helicóptero sobrevolando! ¡Métete adentro!', buttonLabel: '🏠 ¡ADENTRO!', timeLimit: 3000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una forma de pago que prefieres en este negocio?', intruso: 'Cheque personal a tu nombre completo', wrongPool: ['Efectivo', 'Transferencia a cuenta de tercero', 'Criptomonedas', 'Efectivo en partes', 'Trueque de valor equivalente'] }),
            this.buildFillBlank({ userId: u, sentence: 'Si sientes que un comprador es policía encubierto, lo más seguro es ___ y no completar la transacción', correct: 'cancelar discretamente', wrongPool: ['seguir para no levantar sospechas', 'preguntarle directamente si es policía', 'correr inmediatamente', 'llamar a tu proveedor delante de él', 'ofrecerle un descuento'] }),
            this.buildGuessNumber({ userId: u, question: '💵 Cliente paga 3 billetes de $100. Precio era $280. ¿Cuánto de cambio?', correct: '$20', wrongPool: ['$10', '$30', '$40', '$15', '$50'] }),
            this.buildPoolChoice({ userId: u, question: '👶 Se acerca un menor de edad. ¿Qué haces?', correct: 'Lo mandas de regreso sin venderle nada', wrongPool: ['Le vendes si trae suficiente dinero', 'Le preguntas su edad y le crees', 'Le vendes menos cantidad', 'Finges que no lo ves'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántas unidades necesitas vender para llegar a tu meta semanal', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── OF SELLER ─────────────────────────────────
    getOfsellerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '📸 ¿Cuál es el mejor título para tu publicación?', correct: '"Contenido exclusivo para mis fans más especiales 💋"', wrongPool: ['"Foto mía"', '"Nuevo post"', '"Miren esto"', '"Subí algo"'] }),
            this.buildReaction({ userId: u, prompt: '✅ ¡El sitio pide verificación de identidad! ¡Complétala AHORA!', buttonLabel: '📋 ¡VERIFICAR!' }),
            this.buildMath({ userId: u, context: '500 subs a $10/mes. La plataforma cobra 20%. ¿Cuánto ganas?', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'Las plataformas de contenido adulto están obligadas a verificar la edad de los creadores de contenido', isTrue: true }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una plataforma legítima para creadores?', intruso: 'VirusShare.net', wrongPool: ['OnlyFans', 'Fansly', 'Patreon', 'Fanvue', 'ManyVids'] }),
            this.buildSequence({ userId: u, instruction: '📤 Ordena cómo publicar contenido exitosamente:', steps: [{ label: '📸 Tomar y editar la foto', order: 0 }, { label: '✏️ Escribir descripción atractiva', order: 1 }, { label: '🏷️ Agregar precio y tags', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Para retener suscriptores, lo más efectivo es publicar contenido ___ y mantener comunicación personal', correct: 'regularmente', wrongPool: ['solo cuando tienes ganas', 'una vez al año', 'solo los domingos', 'de forma completamente aleatoria', 'cuando el precio de suscripción sube'] }),
            this.buildPoolChoice({ userId: u, question: '🚫 Un suscriptor pide contenido que no quieres hacer. ¿Qué respondes?', correct: '"No hago ese tipo de contenido, pero tengo otras opciones 😊"', wrongPool: ['"Lo haré por el precio correcto"', '"Bloqueas sin decir nada"', '"Le preguntas cuánto paga"', '"Le insultas y bloqueas"'] }),
            this.buildMemory({ userId: u, context: '🔑 Ese es el código de descuento especial para mencionar en tu próximo live. ¡Memorízalo!' }),
            this.buildPriority({ userId: u, situation: 'Varias situaciones en tu cuenta. ¿Cuál atiendes primero?', items: [{ label: '🚨 Alguien filtrando tu contenido', order: 0 }, { label: '💬 50 mensajes sin responder de subs', order: 1 }, { label: '📊 Estadísticas bajando esta semana', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Publicar contenido a las 3am del martes es la hora con mayor engagement en plataformas de suscripción', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '📱 ¡Tu post llegó al trending! ¡Responde comentarios rápido para aprovechar!', buttonLabel: '💬 ¡RESPONDER!', timeLimit: 4500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es buena estrategia de marketing para creadores?', intruso: 'Comprar seguidores falsos masivamente', wrongPool: ['Colaborar con otros creadores', 'Hacer promociones por tiempo limitado', 'Responder mensajes de fans', 'Publicar contenido gratuito de muestra', 'Anunciar en redes sociales'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para proteger tu identidad, nunca debes mostrar ___ en el contenido sin editar', correct: 'tu rostro ni señas identificadoras', wrongPool: ['tus manos', 'ropa de colores brillantes', 'el fondo con plantas', 'tus pies descalzos', 'cualquier parte de tu cuerpo'] }),
            this.buildGuessNumber({ userId: u, question: '💰 Básico $10 + VIP $25. Fan quiere ambos tiers. ¿Cuánto cobras?', correct: '$35', wrongPool: ['$30', '$40', '$25', '$45', '$50'] }),
            this.buildPoolChoice({ userId: u, question: '🔒 Un ex-suscriptor amenaza con filtrar tu contenido. ¿Qué haces?', correct: 'Documentas todo y consultas con un abogado sobre DMCA', wrongPool: ['Le pagas para que no lo haga', 'Publicas sus datos personales', 'Cierras todas tus cuentas', 'Lo ignoras completamente'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántos subs necesitas para pagar todos tus gastos del mes', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── DAMA DE COMPAÑÍA ──────────────────────────
    getDamaGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '👥 Tres perfiles de clientes. ¿Cuál eliges?', correct: 'El regular de buen trato y pago puntual', wrongPool: ['El que ofrece más con reseñas malas', 'El nuevo sin historial', 'El que negocia demasiado', 'El que insiste más'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡LLEGÓ LA POLICÍA AL HOTEL! ¡SAL POR LA ESCALERA!', buttonLabel: '🚪 ¡ESCAPAR!', timeLimit: 3000 }),
            this.buildMath({ userId: u, context: 'Cobras $150/hora. El encuentro duró 2.5 horas. ¿Cuánto es?', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'Aceptar clientes sin verificación previa es igual de seguro que con verificación', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una medida de seguridad básica para este trabajo?', intruso: 'Publicar tu dirección real en redes sociales', wrongPool: ['Avisar tu ubicación a alguien de confianza', 'Verificar al cliente antes', 'Tener plan de salida', 'Usar nombre ficticio', 'Cobrar por adelantado'] }),
            this.buildSequence({ userId: u, instruction: '🔒 Ordena el protocolo de seguridad antes de un encuentro:', steps: [{ label: '✅ Verificar al cliente', order: 0 }, { label: '📲 Avisar ubicación a persona de confianza', order: 1 }, { label: '🚗 Llegar con plan de salida', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Para tu seguridad, siempre debes ___ antes de cada encuentro con un cliente nuevo', correct: 'verificar su identidad y referencias', wrongPool: ['confiar en tu instinto únicamente', 'pedirle que traiga flores', 'pedirle foto de su casa', 'preguntarle sus redes sociales', 'pedirle que llegue sin carro'] }),
            this.buildPoolChoice({ userId: u, question: '😠 El cliente está siendo irrespetuoso. ¿Qué haces?', correct: 'Pones límites claros y si no respeta, te vas', wrongPool: ['Lo aguantas por el dinero', 'Le pides más dinero', 'Lo ignoras', 'Le contestas igual'] }),
            this.buildMemory({ userId: u, context: '📱 Ese es el número de tu persona de confianza para emergencias. ¡Memorízalo siempre!' }),
            this.buildPriority({ userId: u, situation: 'Varias situaciones en un encuentro. ¿Cuál atiendes primero?', items: [{ label: '🚨 El cliente se puso agresivo', order: 0 }, { label: '💰 El cliente no quiere pagar el total', order: 1 }, { label: '📱 Tu persona de confianza llama a checar', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Cobrar el 100% por adelantado es una práctica estándar y recomendada en este trabajo', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '⚠️ ¡El cliente se puso agresivo! ¡Activa tu protocolo de seguridad!', buttonLabel: '🆘 ¡PROTOCOLO!', timeLimit: 3000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una señal de alerta en un cliente nuevo?', intruso: 'Pagar puntualmente sin negociar', wrongPool: ['Insistir en cambiar el lugar acordado', 'Querer traer a "un amigo" sin avisar', 'No querer dar ninguna referencia', 'Cambiar el plan de último momento siempre', 'Pedir descuento antes de confirmar'] }),
            this.buildFillBlank({ userId: u, sentence: 'Si un cliente empieza a comportarse de manera controladora, lo correcto es ___ de inmediato', correct: 'establecer límites claros o retirarse', wrongPool: ['ceder para no conflictuarlo', 'pedirle más dinero', 'ignorarlo y seguir', 'preguntarle por qué lo hace', 'amenazarlo también'] }),
            this.buildGuessNumber({ userId: u, question: '💰 20% de descuento sobre $300. ¿Cuánto pagaría el cliente?', correct: '$240', wrongPool: ['$220', '$260', '$280', '$200', '$250'] }),
            this.buildPoolChoice({ userId: u, question: '📸 El cliente quiere tomar fotos. ¿Qué dices?', correct: '"Sin fotos, es parte de mis condiciones"', wrongPool: ['"Claro, es normal"', '"Solo si no muestras mi cara"', '"Por $50 extra te dejo"', '"Solo una rápida"'] }),
            this.buildMath({ userId: u, context: 'Calculas tu ingreso mensual con los clientes habituales y los extras', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── PARANORMAL ────────────────────────────────
    getParanormalGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '👻 El EMF sube al nivel 5 en la cocina. ¿Qué usas para confirmar?', correct: 'Grabadora de voz para EVP', wrongPool: ['Termómetro infrarrojo', 'Cámara UV', 'Detector de humo', 'Brújula', 'Telémetro láser'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡ALGO SE MOVIÓ EN LA ESQUINA! ¡GRABA AHORA!', buttonLabel: '🎥 ¡GRABAR!', timeLimit: 3000 }),
            this.buildTrueFalse({ userId: u, statement: 'Una bajada repentina de temperatura de 10°C en una habitación cerrada es siempre de origen paranormal', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es equipo legítimo de investigación paranormal?', intruso: 'Detector de terraplanismo', wrongPool: ['EMF meter', 'Grabadora de EVP', 'Termómetro infrarrojo', 'Cámara de visión nocturna', 'Sensor de movimiento'] }),
            this.buildSequence({ userId: u, instruction: '🔍 Ordena el protocolo de investigación:', steps: [{ label: '📊 Medir niveles base', order: 0 }, { label: '🚶 Recorrer el lugar', order: 1 }, { label: '📝 Documentar evidencias', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Antes de concluir que algo es paranormal, primero debes ___ todas las causas naturales posibles', correct: 'descartar', wrongPool: ['confirmar', 'ignorar', 'grabar', 'publicar', 'cobrar al cliente'] }),
            this.buildPoolChoice({ userId: u, question: '🎭 El cliente está claramente fingiendo los fenómenos. ¿Cómo lo descubres?', correct: 'Cambias el horario de investigación sin avisar', wrongPool: ['Lo acusas directamente', 'Instalas cámaras ocultas sin decirle', 'Le preguntas si está mintiendo', 'Terminas la investigación'] }),
            this.buildPoolChoice({ userId: u, question: '👤 ¿Qué tipo de entidad mueve objetos pero no se comunica verbalmente?', correct: 'Poltergeist', wrongPool: ['Fantasma consciente', 'Demonio', 'Eco residual', 'Elemental', 'Shadow person'] }),
            this.buildReaction({ userId: u, prompt: '📡 ¡El detector de movimiento se activó solo! ¡Analiza!', buttonLabel: '🔍 ¡ANALIZAR!' }),
            this.buildMemory({ userId: u, context: '📍 Esa es la habitación con mayor actividad registrada en la casa. ¡Memorízala para el reporte!' }),
            this.buildPriority({ userId: u, situation: 'Varias anomalías ocurren simultáneamente. ¿Cuál documentas primero?', items: [{ label: '📉 Temperatura bajó 8°C de golpe', order: 0 }, { label: '🎙️ EVP captó una voz en la grabadora', order: 1 }, { label: '💡 Las luces parpadearon una vez', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'La evidencia obtenida sin control de variables tiene el mismo peso científico que la obtenida con controles', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una metodología válida de investigación paranormal?', intruso: 'Rezar para que aparezca el fantasma', wrongPool: ['Establecer niveles base de EMF', 'Usar cámara de visión nocturna', 'Documentar temperatura ambiente', 'Grabar audio continuo', 'Controlar variables de entorno'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para verificar si una casa realmente tuvo fallecidos, debes revisar ___ públicos históricos', correct: 'registros', wrongPool: ['rumores', 'redes sociales', 'testimonios de vecinos únicamente', 'lo que te diga el cliente', 'tu intuición'] }),
            this.buildReaction({ userId: u, prompt: '🚪 ¡Una puerta se cerró sola! ¡Documenta antes de que pase otra vez!', buttonLabel: '📹 ¡DOCUMENTAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u, question: '💰 El cliente quiere que confirmes que su casa está "maldita" para venderla más barata. ¿Qué haces?', correct: 'Presentas solo lo que encontraste, sin inventar', wrongPool: ['Le confirmas lo que pide por dinero extra', 'Niegas todo para no involucrarte', 'Le cobras extra por el "informe especial"', 'Lo haces por ser honesto con su problema'] }),
            this.buildMath({ userId: u, context: 'Calculas el costo total de la investigación de 3 noches con tu equipo de 2 personas', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── CONTADOR ──────────────────────────────────
    getContadorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '📊 El cliente quiere "reducir impuestos creativamente". ¿Qué estrategia usas?', correct: 'Buscas deducciones legítimas al límite legal', wrongPool: ['Reportas todo fielmente sin buscar nada', 'Inventas gastos falsos', 'Les dices que no puedes ayudar', 'Creas empresas fantasma'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡LLEGA UNA AUDITORÍA SORPRESA! ¡ORDENA LOS LIBROS!', buttonLabel: '📁 ¡ORDENAR!', timeLimit: 3500 }),
            this.buildMath({ userId: u, context: 'Ingresos $500,000 - Gastos $320,000. ¿Cuál es la utilidad bruta?', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'La evasión fiscal y la elusión fiscal son exactamente lo mismo en términos legales', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un estado financiero estándar?', intruso: 'Estado de Deseos del Director', wrongPool: ['Balance General', 'Estado de Resultados', 'Flujo de Efectivo', 'Estado de Capital', 'Notas a los Estados Financieros'] }),
            this.buildSequence({ userId: u, instruction: '📋 Ordena el cierre contable del mes:', steps: [{ label: '🔢 Cuadrar los libros', order: 0 }, { label: '📊 Generar estados financieros', order: 1 }, { label: '📤 Presentar declaración', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'La diferencia entre activo y pasivo de una empresa se llama ___', correct: 'capital o patrimonio neto', wrongPool: ['deuda flotante', 'ingreso bruto', 'margen operativo', 'flujo de caja libre', 'utilidad neta'] }),
            this.buildPoolChoice({ userId: u, question: '😬 El auditor pregunta por una transferencia de $50,000 a las Islas Caimán. ¿Qué dices?', correct: '"Es una inversión internacional con todos sus documentos"', wrongPool: ['Confiesas todo', 'Te niegas a responder', '"No sé de qué habla"', '"Pregunte a mi cliente"'] }),
            this.buildMemory({ userId: u, context: '🔐 Ese es el NIT/RFC del cliente nuevo cuya declaración debes presentar esta semana' }),
            this.buildPriority({ userId: u, situation: 'Varias urgencias contables al mismo tiempo. ¿Cuál atiendes primero?', items: [{ label: '🚨 Auditoría del SAT llegando HOY', order: 0 }, { label: '📅 Declaración mensual vence en 3 días', order: 1 }, { label: '📊 Reporte interno para el director', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Un contador puede negarse a firmar estados financieros que sabe son incorrectos sin consecuencias legales', isTrue: false }),
            this.buildReaction({ userId: u, prompt: '💻 ¡El sistema se cuelga a las 11:58pm con fecha límite a medianoche!', buttonLabel: '🔄 ¡REINICIAR!', timeLimit: 4000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una práctica contable legítima?', intruso: 'Cambiar fechas de transacciones para pagar menos impuestos', wrongPool: ['Depreciar activos fijos', 'Usar deducciones legales', 'Amortizar gastos diferidos', 'Aplicar créditos fiscales disponibles', 'Reconocer ingresos devengados'] }),
            this.buildFillBlank({ userId: u, sentence: 'El IVA del 16% sobre una venta de $10,000 es de ___', correct: '$1,600', wrongPool: ['$160', '$16,000', '$1,060', '$1,006', '$16'] }),
            this.buildGuessNumber({ userId: u, question: '📈 Empresa con activos $500K y pasivos $300K. ¿Cuál es el capital?', correct: '$200,000', wrongPool: ['$800,000', '$150,000', '$300,000', '$250,000', '$400,000'] }),
            this.buildPoolChoice({ userId: u, question: '🤔 El cliente quiere que gastos personales aparezcan como gastos de empresa. ¿Qué haces?', correct: 'Le explicas que eso es ilegal y no lo registras', wrongPool: ['Lo haces si son montos pequeños', 'Lo haces si te paga extra', 'Lo haces pero sin factura', 'Lo haces esta vez y luego lo corriges'] }),
            this.buildMath({ userId: u, context: 'Calculas el ISR mensual sobre la utilidad del cliente', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── JOYERO ────────────────────────────────────
    getJoyeroGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '💍 Un anillo "oro 24k" no reacciona al ácido nítrico. ¿Qué es?', correct: 'Oro bañado o chapado (falso)', wrongPool: ['Oro puro de 24k confirmado', 'Platino', 'Plata con baño de oro', 'Titanio dorado', 'Acero inoxidable dorado'] }),
            this.buildReaction({ userId: u, prompt: '💎 ¡Un diamante se cayó de la mesa! ¡Atrápalo!', buttonLabel: '✋ ¡ATRAPAR!', timeLimit: 3000 }),
            this.buildMath({ userId: u, context: 'Collar de oro 18k, 15 gramos, oro a $60/gramo. ¿Cuánto vale?', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'El oro de 24 kilates es 100% puro y el más duro para joyería', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una piedra preciosa reconocida?', intruso: 'Cuarzo rosado falso certificado GIA', wrongPool: ['Rubí', 'Esmeralda', 'Zafiro', 'Diamante', 'Alejandrita'] }),
            this.buildSequence({ userId: u, instruction: '💍 Ordena la reparación de un anillo:', steps: [{ label: '🔍 Evaluar el daño', order: 0 }, { label: '🔥 Soldar la pieza', order: 1 }, { label: '✨ Pulir y limpiar', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'El "oro de 18 kilates" significa que tiene ___ de oro puro', correct: '75% (18/24 partes)', wrongPool: ['100%', '50%', '90%', '18 gramos exactos', '18% de pureza'] }),
            this.buildPoolChoice({ userId: u, question: '🤨 Un cliente quiere vender joyas de dudosa procedencia. ¿Qué haces?', correct: 'Pides documentación y si no tiene, rechazas', wrongPool: ['Las compras sin preguntar', 'Llamas a la policía de inmediato', 'Las compras más baratas', 'Las valutas pero no compras'] }),
            this.buildMemory({ userId: u, context: '🔬 Ese es el número de certificado GIA del diamante del cliente VIP. ¡No lo pierdas!' }),
            this.buildPriority({ userId: u, situation: 'Varios clientes con necesidades urgentes. ¿Cuál atiendes primero?', items: [{ label: '💍 Cliente con anillo de compromiso roto hoy', order: 0 }, { label: '🔍 Cliente que quiere que valores sus joyas', order: 1 }, { label: '🛒 Cliente que solo viene a ver precios', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'El platino es más valioso que el oro porque es más raro y denso', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '⚡ ¡El soldador está a temperatura máxima! ¡Retira la pieza!', buttonLabel: '🔧 ¡RETIRAR!', timeLimit: 3500 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una característica de valuación de diamantes (las 4 C)?', intruso: 'Chemisty (composición química)', wrongPool: ['Cut (corte)', 'Color', 'Clarity (claridad)', 'Carat (quilates)', 'Certificate (certificado)'] }),
            this.buildFillBlank({ userId: u, sentence: 'Para distinguir un diamante real de un cristal se usa el probador de conductividad ___', correct: 'térmica', wrongPool: ['eléctrica básica', 'acústica', 'magnética', 'gravitacional', 'óptica simple'] }),
            this.buildGuessNumber({ userId: u, question: '💍 Anillo valuado $2,000. Cliente pide 15% descuento. ¿Cuánto paga?', correct: '$1,700', wrongPool: ['$1,500', '$1,800', '$1,600', '$1,750', '$1,900'] }),
            this.buildPoolChoice({ userId: u, question: '📦 ¿Cómo guardas joyas para evitar rayones?', correct: 'Cada pieza en compartimento separado con tela suave', wrongPool: ['Todas juntas en una caja', 'En bolsas de plástico zip', 'En el congelador', 'Colgadas todas juntas', 'En papel de periódico'] }),
            this.buildMath({ userId: u, context: 'Calculas el precio de venta con 40% de margen sobre el costo de las piezas', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── ACTOR ─────────────────────────────────────
    getActorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🎬 El director quiere que improvises una escena "apasionada". ¿Qué haces?', correct: 'Entras en personaje con total profesionalismo', wrongPool: ['Te quedas paralizado', 'Pides el guión completo', 'Llamas a tu agente en ese momento', 'Preguntas cuánto pagan extra'] }),
            this.buildReaction({ userId: u, prompt: '🎥 ¡EL DIRECTOR DICE "ACCIÓN"! ¡ES TU MOMENTO!', buttonLabel: '⭐ ¡ACTUAR!' }),
            this.buildMath({ userId: u, context: 'Caché $800, agente cobra 20%. ¿Cuánto te llevas?', difficulty: 'medium' }),
            this.buildTrueFalse({ userId: u, statement: 'Firmar un contrato de exclusividad sin leerlo completamente es una práctica normal en la industria', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es un elemento clave en un contrato de actor?', intruso: 'Color favorito del director', wrongPool: ['Caché acordado', 'Tipo de contenido a filmar', 'Cláusula de exclusividad', 'Fechas de grabación', 'Derechos de imagen'] }),
            this.buildSequence({ userId: u, instruction: '🎬 Ordena el proceso de un rodaje profesional:', steps: [{ label: '📋 Revisar el contrato y guión', order: 0 }, { label: '💆 Prepararte mentalmente', order: 1 }, { label: '🎥 Grabar la escena', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'La regla más importante en un set de filmación profesional es respetar los ___ acordados en el contrato', correct: 'límites', wrongPool: ['deseos del director sin importar qué', 'horarios del catering', 'gustos personales del productor', 'precios del mercado', 'rumores del gremio'] }),
            this.buildPoolChoice({ userId: u, question: '😤 La co-estrella llegó 2 horas tarde al rodaje. ¿Qué haces?', correct: 'Lo reportas al productor profesionalmente', wrongPool: ['Le gritas en el set', 'Te vas tú también', 'Lo publicas en Instagram', 'Lo confrontas frente a todo el equipo'] }),
            this.buildMemory({ userId: u, context: '🎫 Ese es el número de escena que debes memorizar para el rodaje de mañana. ¡No lo confundas!' }),
            this.buildPriority({ userId: u, situation: 'Varias situaciones en el set. ¿Cuál atiendes primero?', items: [{ label: '📋 Director pide hablar contigo urgente', order: 0 }, { label: '💆 Necesitas memorizar las líneas del día', order: 1 }, { label: '🎭 Un colega quiere ensayar su escena contigo', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'En la industria del entretenimiento adulto, toda actividad en el set debe estar establecida en el contrato previo', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '🏆 ¡Ganaste el premio al mejor actor del año! ¡Da tu discurso!', buttonLabel: '🎤 ¡DISCURSO!', timeLimit: 5000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una señal de que un estudio es confiable?', intruso: 'Piden filmar antes de firmar contrato', wrongPool: ['Contrato escrito detallado', 'Referencias de otros actores', 'Instalaciones profesionales', 'Proceso de verificación de edad', 'Comunicación transparente'] }),
            this.buildFillBlank({ userId: u, sentence: 'Si una escena te incomoda, el momento correcto para decirlo es ___ empezar a grabar', correct: 'antes de', wrongPool: ['después de', 'durante', 'al terminar todo el rodaje', 'cuando te paguen', 'nunca, eres profesional'] }),
            this.buildGuessNumber({ userId: u, question: '🎬 8 escenas a $200 c/u. Agente cobra 15%. ¿Cuánto ganas neto?', correct: '$1,360', wrongPool: ['$1,200', '$1,600', '$1,400', '$1,000', '$1,500'] }),
            this.buildPoolChoice({ userId: u, question: '💼 Alguien te ofrece un rol sin contrato escrito. ¿Qué haces?', correct: 'Exiges contrato antes de cualquier grabación', wrongPool: ['Aceptas por la oportunidad', 'Confías en la palabra', 'Grabas una escena "de prueba"', 'Pides la mitad del pago sin contrato'] }),
            this.buildMath({ userId: u, context: 'Calculas cuántos proyectos necesitas al mes para cubrir tus gastos', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ── SICARIO ───────────────────────────────────
    getSicarioGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u, question: '🕶️ Tu contacto envió 3 fotos. Una no es el objetivo. ¿Cuál descartas?', correct: 'La foto borrosa de una mujer diferente', wrongPool: ['El hombre de traje gris con maletín', 'El tipo con guardaespaldas', 'El hombre en el restaurante descrito', 'La foto con el mismo auto del objetivo'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡DETECTARON TU POSICIÓN! ¡MUÉVETE AHORA!', buttonLabel: '🏃 ¡MOVERME!', timeLimit: 2500 }),
            this.buildMath({ userId: u, context: 'Contrato $10,000. Intermediario cobra $2,500. ¿Cuánto queda?', difficulty: 'easy' }),
            this.buildTrueFalse({ userId: u, statement: 'Aceptar contratos sin verificar al cliente previamente es igual de seguro que con verificación', isTrue: false }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una buena práctica de seguridad operacional?', intruso: 'Publicar actualizaciones de tu ubicación en tiempo real', wrongPool: ['Usar teléfonos desechables', 'Variar las rutas constantemente', 'No hablar del trabajo por teléfono', 'Memorizar en lugar de escribir', 'Usar identidades alternativas'] }),
            this.buildSequence({ userId: u, instruction: '🎯 Ordena la operación de forma profesional:', steps: [{ label: '🔍 Reconocer el área días antes', order: 0 }, { label: '⏰ Esperar el momento exacto', order: 1 }, { label: '🚗 Activar ruta de escape', order: 2 }] }),
            this.buildFillBlank({ userId: u, sentence: 'Para no levantar sospechas en el área de reconocimiento, siempre debes tener una ___ creíble', correct: 'coartada o razón de estar ahí', wrongPool: ['lista de objetivos visible', 'cámara fotográfica grande', 'maleta negra llamativa', 'expresión de sospecha', 'prisa evidente'] }),
            this.buildPoolChoice({ userId: u, question: '📞 El cliente quiere cancelar el contrato a mitad. ¿Qué respondes?', correct: '"No hay devoluciones una vez iniciado"', wrongPool: ['"Entendido, te devuelvo todo"', '"Entonces eres el siguiente"', '"Me alegra, era muy riesgoso"', '"Pausa por $500 extra"'] }),
            this.buildMemory({ userId: u, context: '🔑 Esa es la contraseña del punto de entrega de esta noche. ¡Memorízala y no la escribas en ningún lado!' }),
            this.buildPriority({ userId: u, situation: 'Varias alertas simultáneas en la operación. ¿Cuál atiendes primero?', items: [{ label: '🚔 Patrulla girando hacia tu posición', order: 0 }, { label: '📱 Mensaje urgente del cliente', order: 1 }, { label: '🎯 Ventana de oportunidad abriéndose', order: 2 }] }),
            this.buildTrueFalse({ userId: u, statement: 'Las cámaras de seguridad modernas pueden identificar rostros incluso con gorra y gafas de sol', isTrue: true }),
            this.buildReaction({ userId: u, prompt: '🎯 ¡Ventana de oportunidad de 10 segundos! ¡Actúa!', buttonLabel: '⚡ ¡AHORA!', timeLimit: 2000 }),
            this.buildIntruso({ userId: u, question: '¿Cuál NO es una ruta de escape confiable?', intruso: 'Tu domicilio real directamente', wrongPool: ['Transporte público en zona concurrida', 'Ruta secundaria poco obvia', 'Cambio de vehículo en punto acordado', 'Zona comercial donde perderse', 'Ruta previamente reconocida'] }),
            this.buildFillBlank({ userId: u, sentence: 'Cuando sientes que te están siguiendo lo correcto es ___ múltiples veces para confirmar antes de actuar', correct: 'cambiar de dirección', wrongPool: ['correr inmediatamente', 'ir directamente a casa', 'llamar al cliente', 'confrontar a quien te sigue', 'entrar a la comisaría'] }),
            this.buildGuessNumber({ userId: u, question: '💰 5 contratos a $8,000 promedio. Gastos operativos: $12,000. ¿Ganancia?', correct: '$28,000', wrongPool: ['$40,000', '$20,000', '$32,000', '$25,000', '$35,000'] }),
            this.buildPoolChoice({ userId: u, question: '🤝 Un colega quiere asociarse permanentemente. ¿Qué dices?', correct: '"Trabajo solo, es más seguro para ambos"', wrongPool: ['Aceptas de inmediato', 'Aceptas pero lo vigilas', '"Solo en trabajos grandes"', '"Dame tiempo para investigarte"'] }),
            this.buildMath({ userId: u, context: 'Calculas cuánto te queda después de gastos y el pago al intermediario', difficulty: 'medium' }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  LAUNCH
    // ─────────────────────────────────────────────

    async launch(message, jobType, baseReward, workStreak = 0) {
        const userId = message.author.id;

        if (this.activeGames.has(userId)) {
            await message.reply('⚠️ Ya tienes un minijuego activo. Complétalo primero.');
            return null;
        }

        const games = this.getMinigamesForJob(jobType, userId);
        if (!games) return null;

        const game = this.getRandom(games);
        const streakBonus = this.getStreakBonus(workStreak);

        this.activeGames.set(userId, {
            jobType, baseReward, game,
            startTime: Date.now(),
            resolved: false,
        });

        const streakText = streakBonus
            ? `\n${streakBonus.label} (+${streakBonus.bonus * 100}% bonus activo!)`
            : workStreak > 0 ? `\n🔥 Racha actual: **${workStreak}** éxitos` : '';

        const timeLimit = game.type === 'reaction' ? (game.timeLimit || 4000) : this.TIMEOUT;

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('💼 Minijuego de Trabajo')
            .setDescription(`${game.question}\n\n⏰ Tienes **${timeLimit / 1000} segundos** para responder${streakText}`)
            .setFooter({ text: `Recompensa base: ${baseReward.toLocaleString()} π-b$` });

        if (game.type === 'sequence') {
            embed.addFields({ name: '📋 Opciones disponibles', value: game.shuffled.map(s => `• ${s.label}`).join('\n'), inline: false });
            embed.setDescription(`${game.question}\n\n📌 Presiona los botones **en el orden correcto**\n⏰ Tienes **${timeLimit / 1000} segundos**${streakText}`);
            this.activeGames.get(userId).sequenceProgress = [];
        }

const isMemory = game.type === 'memory';
const components = isMemory ? [] : [game.row];
const sentMessage = await message.reply({ embeds: [embed], components });

if (isMemory) {
    await new Promise(r => setTimeout(r, 4000));
    const gameData = this.activeGames.get(userId);
    if (!gameData || gameData.resolved) return;
    gameData.memoryInput = []; // array de dígitos ingresados
    const revealEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💼 Minijuego de Trabajo')
        .setDescription(`🧠 **¿Cuál era el número de 4 dígitos?**\n\n**Ingresado:** \`_ _ _ _\`\n\n⏰ Tienes **${timeLimit / 1000} segundos** para responder${streakText}`)
        .setFooter({ text: `Recompensa base: ${baseReward.toLocaleString()} π-b$` });
    await sentMessage.edit({ embeds: [revealEmbed], components: game.rows }).catch(() => {});
}
        
        const timeout = setTimeout(async () => {
            const gameData = this.activeGames.get(userId);
            if (!gameData || gameData.resolved) return;
            gameData.resolved = true;
            this.activeGames.delete(userId);

            const penalty = this.getPenalty(jobType, baseReward, true);
            const isIllegal = this.isIllegal(jobType);

            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⏰ ¡Tiempo agotado!')
                .setDescription(isIllegal
                    ? `Te distrajiste demasiado...\n💸 **Perdiste ${Math.abs(penalty).toLocaleString()} π-b$**`
                    : `No respondiste a tiempo.\n💰 **Recibirás ${penalty.toLocaleString()} π-b$** (25% por timeout)`)
                .setFooter({ text: 'La racha fue reseteada' });

            await sentMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            gameData.resolve?.({ success: false, isTimeout: true, reward: penalty, resetStreak: true });
        }, timeLimit);

        return new Promise((resolve) => {
            const gameData = this.activeGames.get(userId);
            if (gameData) {
                gameData.resolve = resolve;
                gameData.timeout = timeout;
                gameData.sentMessage = sentMessage;
            }
        });
    }

    // ─────────────────────────────────────────────
    //  HANDLE INTERACTION
    // ─────────────────────────────────────────────

    async handleInteraction(interaction) {
        const customId = interaction.customId;
        const userId = interaction.user.id;

        if (!customId.startsWith('work_')) return false;

        const gameData = this.activeGames.get(userId);
        if (!gameData || gameData.resolved) {
            await interaction.reply({ content: '❌ No tienes un minijuego activo o ya fue resuelto.', ephemeral: true });
            return true;
        }

        if (!customId.includes(`_${userId}_`) && !customId.includes(`_${userId}`)) {
            await interaction.reply({ content: '❌ Este minijuego no es tuyo.', ephemeral: true });
            return true;
        }

        const { jobType, baseReward, game } = gameData;

        if (customId.startsWith('work_mc_')) {
            const parts = customId.split('_');
            const isCorrect = parts[parts.length - 1] === 'true';
            await this.resolveGame(interaction, gameData, isCorrect, jobType, baseReward);
            return true;
        }

        if (customId.startsWith('work_react_')) {
            await this.resolveGame(interaction, gameData, true, jobType, baseReward);
            return true;
        }

        if (customId.startsWith('work_seq_')) {
            const parts = customId.split('_');
            const pressedOrder = parseInt(parts[parts.length - 1]);
            const expectedOrder = gameData.sequenceProgress.length;

            if (pressedOrder === expectedOrder) {
                gameData.sequenceProgress.push(pressedOrder);
                if (gameData.sequenceProgress.length === game.steps.length) {
                    await this.resolveGame(interaction, gameData, true, jobType, baseReward);
                } else {
                    const nextStep = game.steps.find(s => s.order === expectedOrder + 1);
                    await interaction.reply({ content: `✅ ¡Correcto! Siguiente paso: **${nextStep?.label || '???'}**`, ephemeral: true });
                }
            } else {
                await this.resolveGame(interaction, gameData, false, jobType, baseReward);
            }
            return true;
        }

if (customId.startsWith('work_mem_')) {
    const parts = customId.split('_');
    const digit = parts[parts.length - 1];
    if (!gameData.memoryInput) gameData.memoryInput = [];
    gameData.memoryInput.push(digit);

    const display = gameData.memoryInput.join(' ') + ' ' + '_ '.repeat(4 - gameData.memoryInput.length).trim();

    if (gameData.memoryInput.length < 4) {
        // Actualizar embed con progreso
        const progressEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('💼 Minijuego de Trabajo')
            .setDescription(`🧠 **¿Cuál era el número de 4 dígitos?**\n\n**Ingresado:** \`${display}\`\n\n⏰ Sigue ingresando...`)
            .setFooter({ text: `Recompensa base: ${gameData.baseReward.toLocaleString()} π-b$` });
        await interaction.update({ embeds: [progressEmbed], components: game.rows }).catch(() => {});
    } else {
        // 4 dígitos completos — verificar
        const entered = gameData.memoryInput.join('');
        const isCorrect = entered === gameData.game.memoryNumber.toString();
        await this.resolveGame(interaction, gameData, isCorrect, gameData.jobType, gameData.baseReward);
    }
    return true;
}
        
        return false;
    }

    // ─────────────────────────────────────────────
    //  RESOLVE
    // ─────────────────────────────────────────────

    async resolveGame(interaction, gameData, isCorrect, jobType, baseReward) {
        if (gameData.resolved) return;
        gameData.resolved = true;
        clearTimeout(gameData.timeout);
        this.activeGames.delete(interaction.user.id);

        const reward = isCorrect ? baseReward : this.getPenalty(jobType, baseReward, false);
        const isIllegal = this.isIllegal(jobType);

        const resultEmbed = new EmbedBuilder()
            .setColor(isCorrect ? '#00FF88' : '#FF4444')
            .setTitle(isCorrect ? '✅ ¡Minijuego completado!' : '❌ Fallaste el minijuego')
            .setDescription(isCorrect
                ? `¡Lo lograste! Recibirás tu sueldo completo.`
                : isIllegal
                    ? `Algo salió muy mal...\n💸 **Perdiste ${Math.abs(reward).toLocaleString()} π-b$**`
                    : `No era correcto.\n💰 **Recibirás ${reward.toLocaleString()} π-b$** (50% del sueldo)`)
            .setFooter({ text: isCorrect ? '¡Sigue así para mantener la racha!' : 'La racha fue reseteada' });

        await interaction.update({ embeds: [resultEmbed], components: [] }).catch(async () => {
            await interaction.reply({ embeds: [resultEmbed] }).catch(() => {});
        });

        gameData.resolve?.({ success: isCorrect, isTimeout: false, reward, resetStreak: !isCorrect });
    }
}

module.exports = WorkMinigames;
