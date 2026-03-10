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

    // ─────────────────────────────────────────────
    //  UTILIDADES
    // ─────────────────────────────────────────────

    getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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

    // ─────────────────────────────────────────────
    //  BUILDERS
    // ─────────────────────────────────────────────

    // Builder clásico — 4 opciones fijas
    buildMultipleChoice({ question, options, correctIndex, userId }) {
        const shuffledOptions = this.shuffle(options.map((opt, i) => ({ label: opt, correct: i === correctIndex })));
        const row = new ActionRowBuilder().addComponents(
            shuffledOptions.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                    .setLabel(opt.label)
                    .setStyle(ButtonStyle.Primary)
            )
        );
        return { question, row, shuffledOptions, type: 'multiple_choice' };
    }

    // Builder con pool — elige 3 incorrectas al azar del pool + 1 correcta
    buildPoolChoice({ question, correct, wrongPool, userId }) {
        const wrongs = this.shuffle(wrongPool).slice(0, 3);
        const allOptions = this.shuffle([
            { label: correct, correct: true },
            ...wrongs.map(w => ({ label: w, correct: false }))
        ]);
        const row = new ActionRowBuilder().addComponents(
            allOptions.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                    .setLabel(opt.label)
                    .setStyle(ButtonStyle.Primary)
            )
        );
        return { question, row, type: 'multiple_choice' };
    }

    buildReaction({ prompt, buttonLabel, userId, timeLimit = 4000 }) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`work_react_${userId}`)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Danger)
        );
        return { question: prompt, row, type: 'reaction', timeLimit };
    }

    buildSequence({ instruction, steps, userId }) {
        const shuffled = this.shuffle([...steps]);
        const row = new ActionRowBuilder().addComponents(
            shuffled.map(step =>
                new ButtonBuilder()
                    .setCustomId(`work_seq_${userId}_${step.order}`)
                    .setLabel(step.label)
                    .setStyle(ButtonStyle.Secondary)
            )
        );
        return { question: instruction, row, shuffled, steps, type: 'sequence', currentStep: 0 };
    }

    buildGuessNumber({ question, correct, wrongPool, userId }) {
        const wrongs = this.shuffle(wrongPool).slice(0, 3);
        const allOptions = this.shuffle([
            { label: correct, correct: true },
            ...wrongs.map(w => ({ label: w, correct: false }))
        ]);
        const row = new ActionRowBuilder().addComponents(
            allOptions.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`work_mc_${userId}_${i}_${opt.correct}`)
                    .setLabel(opt.label.toString())
                    .setStyle(ButtonStyle.Success)
            )
        );
        return { question, row, type: 'multiple_choice' };
    }

    // ─────────────────────────────────────────────
    //  ROUTER
    // ─────────────────────────────────────────────

    getMinigamesForJob(jobType, userId) {
        const map = {
            limpiador:      () => this.getLimpiadorGames(userId),
            paseador:       () => this.getPaseadorGames(userId),
            streamer:       () => this.getStreamerGames(userId),
            delivery:       () => this.getDeliveryGames(userId),
            pizzero:        () => this.getPizzeroGames(userId),
            bartender:      () => this.getBartenderGames(userId),
            uber:           () => this.getUberGames(userId),
            croupier:       () => this.getCroupierGames(userId),
            barista_casino: () => this.getBaristaGames(userId),
            programmer:     () => this.getProgrammerGames(userId),
            abrepuertasoxxo:() => this.getOxxoGames(userId),
            mecanico:       () => this.getMecanicoGames(userId),
            doctor:         () => this.getDoctorGames(userId),
            botargadrsimi:  () => this.getSimiGames(userId),
            criminal:       () => this.getCriminalGames(userId),
            vendedordelpunto:()=> this.getVendedorGames(userId),
            ofseller:       () => this.getOfsellerGames(userId),
            damadecomp:     () => this.getDamaGames(userId),
            paranormalinv:  () => this.getParanormalGames(userId),
            contador:       () => this.getContadorGames(userId),
            joyero:         () => this.getJoyeroGames(userId),
            actor_porno:    () => this.getActorGames(userId),
            sicario:        () => this.getSicarioGames(userId),
        };
        return map[jobType]?.() || null;
    }

    // ─────────────────────────────────────────────
    //  LIMPIADOR
    // ─────────────────────────────────────────────
    getLimpiadorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🔍 Al limpiar encuentras $500 en efectivo en el cajón del gerente. ¿Qué haces?',
                correct: 'Lo dejas exactamente donde estaba',
                wrongPool: ['Te lo quedas, nadie lo vio', 'Lo reportas a la policía', 'Lo guardas "por seguridad"', 'Lo dejas en otro cajón', 'Se lo das al guardia de seguridad', 'Lo fotografías y lo dejas'] }),
            this.buildPoolChoice({ userId: u,
                question: '🚽 El baño está en estado apocalíptico. ¿Por dónde empiezas?',
                correct: 'Inodoros con desinfectante primero',
                wrongPool: ['Pisos primero', 'Lavabos primero', 'Espejos primero', 'Llamas a un exorcista', 'Esperas a que se limpie solo', 'La puerta primero'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Volcaste el balde de agua sucia en la alfombra del jefe! ¡Limpia RÁPIDO!', buttonLabel: '🧻 ¡LIMPIAR!' }),
            this.buildSequence({ userId: u,
                instruction: '🧹 Ordena la rutina de limpieza correcta:',
                steps: [{ label: '🪣 Preparar materiales', order: 0 }, { label: '🧹 Barrer antes de trapear', order: 1 }, { label: '🧽 Limpiar superficies', order: 2 }] }),
            this.buildGuessNumber({ userId: u,
                question: '⏰ Tienes 2 horas para limpiar 10 oficinas. ¿Cuántos minutos por oficina?',
                correct: '12 min', wrongPool: ['8 min', '15 min', '20 min', '10 min', '6 min', '18 min'] }),
            this.buildReaction({ userId: u, prompt: '🔒 ¡La alarma del edificio se activó por accidente! ¡Desactívala!', buttonLabel: '🔴 ¡CÓDIGO!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🎧 Son las 2am, estás solo y escuchas ruidos en el piso 13. ¿Qué haces?',
                correct: 'Llamas a seguridad del edificio',
                wrongPool: ['Investigas solo con el trapeador', 'Sales corriendo', 'Ignoras y sigues trabajando', 'Llamas al 911', 'Grabas un video para redes', 'Te escondes en el baño'] }),
            this.buildPoolChoice({ userId: u,
                question: '💡 Notas que falta mercancía del mostrador al abrir. ¿Qué haces?',
                correct: 'Reportas al encargado y documentas',
                wrongPool: ['Ignoras y sigues', 'Culpas al turno anterior', 'Llenas el faltante de tu bolsillo', 'Lo publicas en redes', 'Renuncias inmediatamente'] }),
            this.buildPoolChoice({ userId: u,
                question: '🧴 ¿Con qué producto limpias una pantalla de computadora?',
                correct: 'Paño de microfibra ligeramente húmedo',
                wrongPool: ['Alcohol puro directo', 'Agua con jabón abundante', 'Cloro diluido', 'Papel periódico', 'Toalla de cocina', 'Spray multiusos'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌙 Tu jefe te pide quedarte 2 horas extra sin pago. ¿Qué haces?',
                correct: 'Preguntas si habrá compensación o tiempo libre',
                wrongPool: ['Aceptas sin decir nada', 'Renuncias en el momento', 'Te vas sin avisar', 'Lloras en el baño', 'Aceptas y luego te quejas con todos'] }),
            this.buildReaction({ userId: u, prompt: '🐀 ¡Hay una rata en la cocina y el cocinero está por llegar! ¡Atrápala!', buttonLabel: '🥅 ¡ATRAPAR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🧪 Mezclaste sin querer cloro con amoníaco. ¿Qué haces?',
                correct: 'Ventilas el área y sales inmediatamente',
                wrongPool: ['Sigues limpiando con guantes', 'Agregas más agua para diluir', 'Ignoras el olor', 'Usas mascarilla y sigues', 'Llamas a un amigo'] }),
            this.buildSequence({ userId: u,
                instruction: '🪟 Ordena cómo limpiar una ventana correctamente:',
                steps: [{ label: '💧 Aplicar limpiador', order: 0 }, { label: '🔄 Frotar en círculos', order: 1 }, { label: '📰 Secar con paño seco', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📦 Te piden limpiar la bodega llena de cajas pesadas. ¿Qué pides primero?',
                correct: 'Guantes y faja de carga',
                wrongPool: ['Nada, empiezas de una', 'Solo guantes', 'Un ayudante', 'Música para motivarte', 'Un café', 'Permiso para no hacerlo'] }),
            this.buildReaction({ userId: u, prompt: '🚿 ¡El jefe llega en 5 minutos y el baño sigue sucio! ¡Apúrate!', buttonLabel: '⚡ ¡RÁPIDO!', timeLimit: 3500 }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  PASEADOR
    // ─────────────────────────────────────────────
    getPaseadorGames(u) {
        return this.shuffle([
            this.buildReaction({ userId: u, prompt: '🐕 ¡El Golden vio una ardilla y salió disparado! ¡Aguanta la correa!', buttonLabel: '💪 ¡AGUANTAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '🐕🐕 El Chihuahua y el Rottweiler están a punto de pelearse. ¿Qué haces?',
                correct: 'Los separas inmediatamente y cambias de ruta',
                wrongPool: ['Los dejas pelear para que se conozcan', 'Gritas fuerte', 'Sueltas las correas', 'Llamas al dueño mientras los ves pelear', 'Les das comida a ambos', 'Jalas solo al Chihuahua'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Cobras $15 por perro, paseas 5 perros 3 veces a la semana. ¿Cuánto ganas?',
                correct: '$225', wrongPool: ['$175', '$250', '$200', '$300', '$150', '$275'] }),
            this.buildSequence({ userId: u,
                instruction: '🎒 Ordena la preparación antes del paseo:',
                steps: [{ label: '🔍 Revisar las correas', order: 0 }, { label: '💧 Llevar agua y bolsas', order: 1 }, { label: '🐕 Recoger a los perros', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🌧️ Empieza a llover fuerte. ¿Qué haces?',
                correct: 'Buscas refugio y avisas a los dueños',
                wrongPool: ['Los dejas mojarse', 'Terminas el paseo corriendo', 'Los atas a un árbol y esperas', 'Llamas un taxi para todos', 'Sigues caminando normal', 'Los devuelves a sus casas corriendo'] }),
            this.buildReaction({ userId: u, prompt: '🚗 ¡Un carro casi atropella a uno de los perros! ¡Jálalo!', buttonLabel: '🐕 ¡JALAR!', timeLimit: 2500 }),
            this.buildPoolChoice({ userId: u,
                question: '💩 El Labrador hizo sus necesidades y el dueño del parque te mira. ¿Qué haces?',
                correct: 'Recoges con la bolsa sin dudar',
                wrongPool: ['Finges no ver nada', 'Culpas a otro perro', 'Sales corriendo del parque', 'Le dices que ya se lo comes el pasto', 'Esperas a que nadie te vea'] }),
            this.buildPoolChoice({ userId: u,
                question: '🐕 Un perro se niega a caminar y se tira al suelo. ¿Qué haces?',
                correct: 'Lo motivas con una golosina y sigues despacio',
                wrongPool: ['Lo arrastras', 'Lo cargas todo el camino', 'Lo dejas ahí y sigues con los demás', 'Llamas al dueño para que venga', 'Le gritas', 'Le das toda tu merienda'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤧 Un perro estornuda mucho y sus ojos lagrimean. ¿Qué haces?',
                correct: 'Terminas el paseo antes y avisas al dueño',
                wrongPool: ['Ignoras y continúas', 'Le das medicamento humano', 'Lo bañas en el parque', 'Lo dejas en una banca y sigues', 'Lo llevas al veterinario sin avisar al dueño'] }),
            this.buildReaction({ userId: u, prompt: '🐿️ ¡Todos los perros vieron una ardilla a la vez! ¡Aguanta!', buttonLabel: '🦾 ¡FUERZA!', timeLimit: 2500 }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Un dueño te llama furioso porque llegaste tarde. ¿Qué dices?',
                correct: 'Te disculpas, explicas qué pasó y ofreces solución',
                wrongPool: ['Le dices que el tráfico es impredecible', 'Le cuelgas', 'Le dices que llegaste a tiempo', 'Le culpas al perro anterior', 'Le dices que baje el tono'] }),
            this.buildGuessNumber({ userId: u,
                question: '🐕 Tienes 6 correas enredadas. ¿Cuántos minutos mínimo para desenredarlas?',
                correct: '5 min', wrongPool: ['1 min', '2 min', '10 min', '15 min', '30 min', '20 min'] }),
            this.buildSequence({ userId: u,
                instruction: '🏠 Ordena cómo devolver a los perros correctamente:',
                steps: [{ label: '📲 Avisar al dueño que vas llegando', order: 0 }, { label: '🐕 Entregar el perro limpio', order: 1 }, { label: '💰 Cobrar el servicio', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '☀️ Hace mucho calor y los perros jadean mucho. ¿Qué haces?',
                correct: 'Buscas sombra y les das agua',
                wrongPool: ['Aceleras para terminar rápido', 'Los mojas con la manguera de alguien', 'Ignoras, son perros', 'Los llevas al río más cercano', 'Compras hielo de una tienda'] }),
            this.buildReaction({ userId: u, prompt: '🎾 ¡Un perro encontró una pelota y todos quieren jugar! ¡Controla el caos!', buttonLabel: '🎮 ¡CONTROLAR!', timeLimit: 3000 }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  STREAMER
    // ─────────────────────────────────────────────
    getStreamerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '💬 Tu chat está spameando sin parar. ¿Qué haces?',
                correct: 'Reaccionas con energía y agradeces el hype',
                wrongPool: ['Baneas a todos', 'Ignoras el chat', 'Apagas el stream', 'Pones modo solo subs', 'Lloras en cámara', 'Gritas que paren'] }),
            this.buildReaction({ userId: u, prompt: '🔴 ¡Un sub de 5 años acaba de subscribirse! ¡Agradécelo AHORA!', buttonLabel: '🎉 ¡HYPE!' }),
            this.buildGuessNumber({ userId: u,
                question: '💰 1000 subs a $5/mes, Twitch se queda el 50%. ¿Cuánto ganas al mes?',
                correct: '$2,500', wrongPool: ['$2,000', '$3,000', '$5,000', '$1,500', '$4,000', '$1,000'] }),
            this.buildSequence({ userId: u,
                instruction: '🎮 Ordena cómo manejar un raid de 500 personas:',
                steps: [{ label: '👋 Dar bienvenida al raider', order: 0 }, { label: '📢 Presentarte al nuevo público', order: 1 }, { label: '🎮 Continuar con el contenido', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😡 Un troll es tóxico en el chat. ¿Qué haces?',
                correct: 'Timeout y sigues con el stream normal',
                wrongPool: ['Peleas con él en cámara', 'Cierras el chat para todos', 'Lloras en cámara', 'Le dedicas 10 minutos de explicación', 'Terminas el stream', 'Le mandas a tus fans'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌐 Tu internet se cayó a mitad del stream. ¿Qué publicas en redes?',
                correct: '"Tuve problemas técnicos, vuelvo en X minutos 🔧"',
                wrongPool: ['"El stream terminó para siempre"', '"Culpa del proveedor"', 'No publicas nada', '"Me fui de vacaciones"', '"Stream cancelado por hoy"', '"El chat me hizo enojar"'] }),
            this.buildReaction({ userId: u, prompt: '💸 ¡Una donación de $100 en plena gameplay! ¡Reacciona!', buttonLabel: '😱 ¡REACCIONAR!', timeLimit: 5000 }),
            this.buildPoolChoice({ userId: u,
                question: '📉 Llevas 3 horas streamando y tienes 0 viewers. ¿Qué haces?',
                correct: 'Sigues con la misma energía y mejoras el título/tags',
                wrongPool: ['Terminas el stream llorando', 'Gritas pidiendo viewers', 'Empiezas a insultarte', 'Pagas bots de viewers', 'Haces contenido inapropiado para llamar atención', 'Mandas mensajes masivos pidiendo que entren'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎮 ¿Cuál es la mejor hora para streamear según el algoritmo de Twitch?',
                correct: 'Tarde-noche entre semana y mediodía los fines de semana',
                wrongPool: ['3am para menos competencia', 'A las 6am cuando hay pocos streamers', 'Solo domingos', 'Cualquier hora es igual', 'Solo cuando hay torneos', 'Entre semana a las 10am'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Una marca te ofrece $50 por mencionar su producto. ¿Qué haces?',
                correct: 'Aceptas si el producto es relevante y lo dices al chat',
                wrongPool: ['Rechazas toda sponsorship siempre', 'Aceptas sin decirle al chat', 'Pides $500 sin negociar', 'Lo mencionas como si fuera tuyo', 'Insultas a la marca en stream'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡Tu stream está en la página principal de Twitch! ¡Aprovecha el momento!', buttonLabel: '⭐ ¡BRILLAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '😴 Llevas 8 horas streamando y te estás quedando dormido. ¿Qué haces?',
                correct: 'Avisas al chat y terminas el stream',
                wrongPool: ['Sigues hasta caerte', 'Pones una película de fondo', 'Dejas el stream solo sin cámara', 'Tomas 5 energizantes', 'Le pides al chat que te hablen para no dormirte'] }),
            this.buildGuessNumber({ userId: u,
                question: '📊 Tienes 500 seguidores. Si el 2% se suscribe, ¿cuántos subs tienes?',
                correct: '10 subs', wrongPool: ['5 subs', '15 subs', '25 subs', '50 subs', '20 subs', '8 subs'] }),
            this.buildSequence({ userId: u,
                instruction: '📋 Ordena cómo preparar un stream exitoso:',
                steps: [{ label: '🎮 Probar el juego antes', order: 0 }, { label: '🎥 Revisar cámara y audio', order: 1 }, { label: '📢 Anunciar en redes el stream', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🎤 Alguien en el chat dice que eres el peor streamer que ha visto. ¿Qué respondes?',
                correct: 'Un "gracias por el feedback 😄" y sigues',
                wrongPool: ['Lo baneas y explicas por qué por 10 minutos', 'Lloras en cámara', 'Le dedicas una canción de despedida', 'Terminas el stream', 'Le insultas de vuelta', 'Preguntas a todo el chat si es verdad'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  DELIVERY
    // ─────────────────────────────────────────────
    getDeliveryGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🗺️ Tienes 4 rutas. ¿Cuál es la más eficiente?',
                correct: 'Ruta Sur: 8 min sin semáforos',
                wrongPool: ['Ruta Norte: 15 min por autopista', 'Ruta Este: 22 min con obras', 'Ruta Oeste: 11 min con tráfico', 'Ruta Centro: 18 min siempre lento', 'Ruta Costera: 25 min pero bonita', 'Ruta Alterna: 30 min pero segura'] }),
            this.buildReaction({ userId: u, prompt: '🚦 ¡El semáforo está en VERDE! ¡Arranca YA!', buttonLabel: '🚗 ¡ARRANCAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '📦 El cliente dice que pidió otra pizza. ¿Qué haces?',
                correct: 'Llamas a la tienda y corriges el pedido',
                wrongPool: ['Entregas igual y te vas rápido', 'Culpas al cliente', 'Tiras la pizza y te vas', 'Le dices que la coma igual', 'Ofreces descuento de tu bolsillo', 'Discutes que sí es la correcta'] }),
            this.buildSequence({ userId: u,
                instruction: '📋 Ordena las entregas de forma lógica:',
                steps: [{ label: '🏠 Calle A (2km)', order: 0 }, { label: '🏬 Calle C (3km)', order: 1 }, { label: '🏢 Calle B (5km)', order: 2 }] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 La orden fue $45, el cliente paga con $100. ¿Cuánto de cambio?',
                correct: '$55', wrongPool: ['$45', '$65', '$35', '$50', '$40', '$60'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌧️ Llueve a cántaros y tu moto está rota. ¿Qué haces?',
                correct: 'Tomas el bus y sigues entregando',
                wrongPool: ['Cancelas todas las entregas', 'Esperas a que pare la lluvia', 'Lloras en la esquina', 'Pides Uber para cada entrega', 'Renuncias por WhatsApp', 'Entregas todo mojado sin avisar'] }),
            this.buildReaction({ userId: u, prompt: '🐕 ¡Un perro está persiguiendo tu moto! ¡Acelera!', buttonLabel: '💨 ¡ACELERAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '📍 El cliente no responde y no encuentras la dirección. ¿Qué haces?',
                correct: 'Llamas 3 veces, esperas 10 min y reportas a la empresa',
                wrongPool: ['Dejas el pedido en la calle', 'Te comes la comida', 'Regresas sin entregar', 'Adivinas la casa y lanzas el paquete', 'Vendes el pedido a otro cliente', 'Lo dejas con el vecino sin avisar'] }),
            this.buildPoolChoice({ userId: u,
                question: '💥 Chocas levemente y el pedido se cae. ¿Qué haces?',
                correct: 'Revisas el pedido, avisas a la empresa y al cliente',
                wrongPool: ['Entregas igual sin decir nada', 'Corres sin el pedido', 'Culpas al otro conductor', 'Tomas fotos y te vas', 'Llamas al cliente y le dices que ya no hay pedido'] }),
            this.buildGuessNumber({ userId: u,
                question: '⏱️ Tienes 30 min para 4 entregas. ¿Cuántos minutos máximo por entrega?',
                correct: '7.5 min', wrongPool: ['5 min', '10 min', '8 min', '6 min', '12 min', '15 min'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Semáforo en rojo pero llegas tarde! ¡Frena a tiempo!', buttonLabel: '🛑 ¡FRENAR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🥶 El cliente dice que la comida llegó fría. ¿Qué haces?',
                correct: 'Te disculpas y reportas el caso a la empresa',
                wrongPool: ['Le dices que use el microondas', 'Le culpas al restaurante', 'Ignoras el mensaje', 'Le ofreces un descuento de tu sueldo', 'Le dices que llegaste en tiempo récord'] }),
            this.buildPoolChoice({ userId: u,
                question: '🗓️ Es tu 5to pedido consecutivo sin descanso. ¿Qué haces?',
                correct: 'Tomas 5 minutos de descanso entre pedidos',
                wrongPool: ['Sigues sin parar hasta desvanecerte', 'Rechazas todos los siguientes pedidos', 'Reduces la velocidad a la mitad', 'Haces el último pedido y te vas a casa', 'Llamas a un amigo para que te ayude'] }),
            this.buildSequence({ userId: u,
                instruction: '📦 Ordena cómo manejar un pedido frágil:',
                steps: [{ label: '🔍 Revisar el empaque', order: 0 }, { label: '🚗 Conducir con cuidado extra', order: 1 }, { label: '🤝 Entregar con las dos manos', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '⭐ ¿Qué hace que un cliente te deje 5 estrellas?',
                correct: 'Puntualidad, buena actitud y comida en buen estado',
                wrongPool: ['Llegar rapidísimo aunque se derrame', 'Dar propina de vuelta', 'Mandar mensajes cada 5 minutos', 'Llevar globos y confeti', 'Tocar el timbre 10 veces', 'Llamar antes de salir del restaurante'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  PIZZERO
    // ─────────────────────────────────────────────
    getPizzeroGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🍕 Un cliente alérgico al gluten pide pizza. ¿Qué haces?',
                correct: 'Le ofreces base sin gluten',
                wrongPool: ['Le das la normal igual', 'Le dices que no tienes opciones', 'Ignoras la alergia', 'Le dices que se la quite la masa', 'Le ofreces solo la salsa', 'Le recomiendas otro restaurante'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡La pizza se está QUEMANDO! ¡Sácala AHORA!', buttonLabel: '🧤 ¡SACAR!', timeLimit: 3000 }),
            this.buildGuessNumber({ userId: u,
                question: '🌡️ ¿A qué temperatura debe estar el horno para pizza perfecta?',
                correct: '280°C', wrongPool: ['150°C', '220°C', '350°C', '180°C', '400°C', '120°C'] }),
            this.buildSequence({ userId: u,
                instruction: '👨‍🍳 Ordena los pasos para hacer una pizza:',
                steps: [{ label: '🍞 Preparar la masa', order: 0 }, { label: '🫙 Agregar salsa', order: 1 }, { label: '🧀 Poner el queso', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📞 El cliente llama furioso porque llegó fría. ¿Qué le dices?',
                correct: '"Le enviamos otra sin costo"',
                wrongPool: ['"Es culpa del delivery"', '"Caliéntela en el micro"', '"No es mi problema"', '"La pizza salió caliente de aquí"', '"Debió comerla más rápido"', '"Llame al delivery, no a nosotros"'] }),
            this.buildPoolChoice({ userId: u,
                question: '🍕 ¿Cuál es el ingrediente clásico de una Margherita?',
                correct: 'Albahaca fresca',
                wrongPool: ['Pepperoni', 'Champiñones', 'Pimiento', 'Aceitunas', 'Carne molida', 'Tocino'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Hora pico! ¡10 pedidos de golpe! ¡Empieza a trabajar!', buttonLabel: '👊 ¡A TRABAJAR!', timeLimit: 4500 }),
            this.buildPoolChoice({ userId: u,
                question: '🧂 ¿Cuánto tiempo necesita la masa para fermentar bien?',
                correct: 'Mínimo 24 horas en frío',
                wrongPool: ['10 minutos al calor', '1 hora a temperatura ambiente', '5 minutos en microondas', '3 días a temperatura ambiente', '30 minutos en el horno apagado'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Tu compañero no llegó y hay 20 pedidos. ¿Qué haces?',
                correct: 'Avisas al jefe y priorizas los pedidos más antiguos',
                wrongPool: ['Cancelas todos los pedidos', 'Te vas también', 'Haces las pizzas sin salsa para ahorrar tiempo', 'Llamas a un amigo que no trabaja ahí', 'Subes los precios para reducir pedidos'] }),
            this.buildGuessNumber({ userId: u,
                question: '🍕 Pizza grande ($12) + extra queso ($2) + delivery ($3). ¿Total?',
                correct: '$17', wrongPool: ['$14', '$15', '$16', '$18', '$20', '$19'] }),
            this.buildReaction({ userId: u, prompt: '⏰ ¡El timer del horno suena! ¡Saca las 3 pizzas!', buttonLabel: '🍕 ¡SACAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '🌿 Se te acabó la albahaca fresca. ¿Qué haces para las Margheritas?',
                correct: 'Avisas al jefe y al cliente, ofreces alternativa',
                wrongPool: ['Usas perejil sin decir nada', 'Mandas sin ingrediente', 'Cierras la pizzería', 'Cobras igual y pones lechuga', 'Le dices al cliente que ya no hay Margheritas nunca más'] }),
            this.buildSequence({ userId: u,
                instruction: '📦 Ordena cómo empacar una pizza para delivery:',
                steps: [{ label: '🍕 Dejar enfriar 2 min', order: 0 }, { label: '📦 Colocar en caja caliente', order: 1 }, { label: '🏷️ Etiquetar con el pedido', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🧑‍🍳 ¿Cuántas pizzas puede manejar bien un pizzero solo por hora?',
                correct: '15-20 pizzas',
                wrongPool: ['50-60 pizzas', '5-8 pizzas', '100 pizzas', '30-40 pizzas', '2-3 pizzas', '25-30 pizzas'] }),
            this.buildPoolChoice({ userId: u,
                question: '🫙 La salsa de tomate quedó muy ácida. ¿Cómo la corriges?',
                correct: 'Agrega una pizca de azúcar',
                wrongPool: ['Más sal', 'Agua fría', 'Vinagre extra', 'Nada, así está bien', 'Ketchup', 'Jugo de limón'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  BARTENDER
    // ─────────────────────────────────────────────
    getBartenderGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🍸 ¿Qué lleva un Cosmopolitan clásico?',
                correct: 'Vodka, arándano, triple sec, limón',
                wrongPool: ['Gin, vermut, aceituna', 'Tequila, sal, limón', 'Ron, coca, limón', 'Whisky, miel, limón', 'Vodka, naranja, granadina', 'Ginebra, tónica, pepino'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡El cliente quiere un trago flameado! ¡Enciéndelo antes de que se enfríe!', buttonLabel: '🔥 ¡ENCENDER!', timeLimit: 3500 }),
            this.buildSequence({ userId: u,
                instruction: '🍹 Prepara un Mojito en orden correcto:',
                steps: [{ label: '🌿 Muele la menta con azúcar', order: 0 }, { label: '🥃 Agrega ron y hielo', order: 1 }, { label: '🫧 Completa con soda', order: 2 }] }),
            this.buildGuessNumber({ userId: u,
                question: '🍺 Cuenta: $47.50. Paga con $60. ¿Cuánto de cambio?',
                correct: '$12.50', wrongPool: ['$10.50', '$13.50', '$15', '$11', '$14', '$12'] }),
            this.buildPoolChoice({ userId: u,
                question: '🥴 Un cliente ya está muy borracho y pide otro. ¿Qué haces?',
                correct: 'Le ofreces agua y le dices que es suficiente',
                wrongPool: ['Le sirves igual', 'Le cobras extra', 'Llamas a la policía', 'Le sirves uno sin alcohol sin decirle', 'Lo expulsas del bar gritando', 'Le pides que se vaya solo'] }),
            this.buildPoolChoice({ userId: u,
                question: '🍋 ¿Cuál es la diferencia entre un Mojito y un Caipirinha?',
                correct: 'Mojito usa ron y menta; Caipirinha usa cachaça y limón',
                wrongPool: ['Son exactamente iguales', 'Solo cambia el color', 'El Caipirinha lleva vodka', 'El Mojito lleva tequila', 'Ambos llevan gin', 'Solo cambia el vaso'] }),
            this.buildReaction({ userId: u, prompt: '📞 ¡Te llaman desde la cocina con emergencia! ¡Responde!', buttonLabel: '📞 ¡CONTESTAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '💰 Un cliente VIP dejó su tarjeta olvidada. ¿Qué haces?',
                correct: 'La guardas en caja fuerte y le avisas por teléfono',
                wrongPool: ['La dejas en la barra', 'La usas para ver cuánto tiene', 'La cortas por seguridad', 'La guardas en tu bolsillo', 'La tiras a la basura'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎂 8 personas piden 2 shots cada una. ¿Cuántas botellas de 750ml de tequila necesitas?',
                correct: '1 botella (alcanza)',
                wrongPool: ['2 botellas', '3 botellas', 'Media botella', '4 botellas', '1.5 botellas'] }),
            this.buildPoolChoice({ userId: u,
                question: '🍾 Un cliente pide el vino más caro ($300). ¿Cómo lo sirves?',
                correct: 'Lo presentas, lo abres con sacacorchos y sirves para degustar',
                wrongPool: ['Lo abres con los dientes para impresionar', 'Lo viertes todo de golpe', 'Lo sirves frío aunque sea tinto', 'Lo abres en la cocina y lo traes ya servido', 'Le dices que no tienes ese vino'] }),
            this.buildReaction({ userId: u, prompt: '🍸 ¡El shaker se atoró y el cliente espera! ¡Ábrelo!', buttonLabel: '💪 ¡ABRIR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '🤬 Un cliente borracho te insulta frente a todos. ¿Qué haces?',
                correct: 'Mantienes la calma y llamas al guardia de seguridad',
                wrongPool: ['Le insultas de vuelta', 'Le tiras el trago encima', 'Lloras en la barra', 'Le sirves más para calmarlo', 'Cierras el bar', 'Le pides a todos los clientes que lo juzguen'] }),
            this.buildGuessNumber({ userId: u,
                question: '🍹 3 Mojitos ($8 c/u) + 2 cervezas ($4 c/u). ¿Total de la cuenta?',
                correct: '$32', wrongPool: ['$28', '$36', '$30', '$24', '$40', '$26'] }),
            this.buildSequence({ userId: u,
                instruction: '🍷 Ordena cómo abrir una botella de vino correctamente:',
                steps: [{ label: '🔪 Cortar la cápsula', order: 0 }, { label: '🔩 Insertar el sacacorchos', order: 1 }, { label: '🍾 Extraer el corcho suavemente', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🧊 ¿Cuánto hielo lleva un Old Fashioned clásico?',
                correct: 'Un cubo grande de hielo',
                wrongPool: ['Hielo picado abundante', 'Sin hielo', 'Hielo frappé', 'Dos cubitos normales', 'Hielo en bola pequeña', 'Hielo con sal'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  UBER
    // ─────────────────────────────────────────────
    getUberGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🗺️ El GPS dice una ruta pero hay obras. ¿Qué haces?',
                correct: 'Tomas la ruta alterna que conoces',
                wrongPool: ['Sigues el GPS ciegamente', 'Le preguntas al pasajero cada 2 min', 'Cancelas el viaje', 'Esperas a que las obras terminen', 'Vuelves a empezar la ruta desde el inicio', 'Le cobras extra por el desvío'] }),
            this.buildReaction({ userId: u, prompt: '🟢 ¡Llegó una solicitud a 2 minutos! ¡Acéptala RÁPIDO!', buttonLabel: '✅ ¡ACEPTAR!' }),
            this.buildGuessNumber({ userId: u,
                question: '💰 15km a $1.20/km + $2 base. ¿Total del viaje?',
                correct: '$20', wrongPool: ['$18', '$22', '$25', '$17', '$24', '$15'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤔 El pasajero huele muy mal, el viaje dura 40 min. ¿Qué haces?',
                correct: 'Abres las ventanas discretamente y aguantas',
                wrongPool: ['Le dices que baje', 'Cancelas en pleno viaje', 'Te pones mascarilla dramáticamente', 'Aceleras al doble para terminar antes', 'Le rocías desodorante', 'Lloras en silencio'] }),
            this.buildSequence({ userId: u,
                instruction: '⭐ Ordena las prioridades para tener 5 estrellas:',
                steps: [{ label: '🚗 Auto limpio y con buen olor', order: 0 }, { label: '🗺️ Ruta eficiente', order: 1 }, { label: '😊 Actitud amable', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 El pasajero te da 1 estrella sin razón. ¿Qué haces?',
                correct: 'Reportas el viaje a Uber Support',
                wrongPool: ['Le escribes insultos', 'Te quedas callado y aceptas', 'Dejas de trabajar', 'Le pones también 1 estrella', 'Publicas su foto en redes', 'Llamas a sus contactos'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Un policía te hace señas de parar! ¡Frena con calma!', buttonLabel: '🛑 ¡FRENAR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🌙 Son las 2am y el pasajero te pide ir a una zona peligrosa. ¿Qué haces?',
                correct: 'Evalúas la zona y si es muy peligrosa, cancelas con explicación',
                wrongPool: ['Vas sin pensar', 'Cancelas sin decir nada', 'Le cobras triple', 'Le preguntas para qué va ahí', 'Llamas a la policía antes de ir', 'Le pides que vaya caminando'] }),
            this.buildPoolChoice({ userId: u,
                question: '📱 El pasajero habla por teléfono muy fuerte durante todo el viaje. ¿Qué haces?',
                correct: 'Lo aguantas con paciencia y sigues manejando',
                wrongPool: ['Le pides que cuelgue', 'Subes el volumen de la radio al máximo', 'Cancelas el viaje', 'Le grabas para ponerlo en redes', 'Le hablas también por teléfono', 'Finges que el auto se descompone'] }),
            this.buildGuessNumber({ userId: u,
                question: '⭐ ¿Cuántas estrellas necesitas mantener para no ser desactivado en Uber?',
                correct: '4.6 estrellas', wrongPool: ['3.0 estrellas', '4.0 estrellas', '5.0 estrellas', '3.5 estrellas', '4.2 estrellas', '4.8 estrellas'] }),
            this.buildReaction({ userId: u, prompt: '🐕 ¡El pasajero trae un perro grande sin avisarte! ¡Decide rápido!', buttonLabel: '🤔 ¡DECIDIR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🤢 El pasajero dice que se marea. ¿Qué haces?',
                correct: 'Bajas la velocidad, abres ventanas y ofreces parar',
                wrongPool: ['Aceleras para llegar antes', 'Ignoras y sigues', 'Lo bajas inmediatamente', 'Le das agua de tu botella sin preguntar', 'Llamas al 911', 'Le dices que aguante'] }),
            this.buildPoolChoice({ userId: u,
                question: '💸 ¿En qué horario ganas más con el surge pricing de Uber?',
                correct: 'Viernes y sábado de noche, días lluviosos, hora pico',
                wrongPool: ['Siempre ganas igual', 'Solo los domingos a las 6am', 'Solo en Navidad', 'Entre semana al mediodía', 'Los lunes por la mañana', 'Solo cuando hay eventos deportivos'] }),
            this.buildSequence({ userId: u,
                instruction: '🚗 Ordena cómo iniciar correctamente un viaje:',
                steps: [{ label: '✅ Confirmar el nombre del pasajero', order: 0 }, { label: '🗺️ Iniciar el viaje en la app', order: 1 }, { label: '🚗 Arrancar hacia el destino', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😴 Llevas 10 horas manejando y tienes sueño. ¿Qué haces?',
                correct: 'Paras, descansas y comes algo antes de continuar',
                wrongPool: ['Tomas 4 cafés y sigues', 'Pones música a todo volumen', 'Abres todas las ventanas y sigues', 'Aceptas un viaje más y luego descansas', 'Lloras para despertarte'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  CROUPIER
    // ─────────────────────────────────────────────
    getCroupierGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🃏 En blackjack, el jugador tiene 16 y el croupier muestra un 7. ¿Qué hace correctamente?',
                correct: 'Pide carta',
                wrongPool: ['Se planta con 16', 'Dobla la apuesta', 'Se rinde', 'Divide los 16 en dos manos', 'Apuesta todo', 'Pide dos cartas a la vez'] }),
            this.buildReaction({ userId: u, prompt: '🎴 ¡Es tu turno de repartir! ¡Hazlo RÁPIDO y con elegancia!', buttonLabel: '🃏 ¡REPARTIR!', timeLimit: 3500 }),
            this.buildGuessNumber({ userId: u,
                question: '🎲 Jugador apuesta $200 al rojo en ruleta. Si gana, ¿cuánto recibe?',
                correct: '$400', wrongPool: ['$200', '$600', '$100', '$800', '$300', '$1000'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Un jugador acusa al casino de trampa. ¿Cómo respondes?',
                correct: 'Llamas al supervisor con calma',
                wrongPool: ['Te pones nervioso y te disculpas', 'Le dices que tiene razón', 'Ignoras al jugador', 'Le ofreces dinero para que se calle', 'Discutes con él públicamente', 'Llamas a seguridad agresivamente'] }),
            this.buildSequence({ userId: u,
                instruction: '🃏 Ordena el inicio correcto de una mesa de blackjack:',
                steps: [{ label: '🔀 Barajar el mazo', order: 0 }, { label: '💰 Recolectar apuestas', order: 1 }, { label: '🃏 Repartir las cartas', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🎰 ¿Cuál es la ventaja de la casa en ruleta americana?',
                correct: '5.26%',
                wrongPool: ['2.7%', '1%', '10%', '3.5%', '7%', '0.5%'] }),
            this.buildReaction({ userId: u, prompt: '👁️ ¡Detectaste a alguien contando cartas! ¡Avisa a seguridad!', buttonLabel: '🚨 ¡AVISAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '🤑 Un jugador ganó $50,000 en tu mesa. ¿Qué debes hacer?',
                correct: 'Notificar al supervisor y completar el papeleo requerido',
                wrongPool: ['Felicitarlo y seguir normal', 'Pedirle propina en privado', 'Reportarlo como sospechoso', 'Preguntarle su secreto', 'Negarle más juego', 'Llamar a la prensa'] }),
            this.buildPoolChoice({ userId: u,
                question: '😓 Son las 3am y llevas 8 horas en la mesa sin descanso. ¿Qué haces?',
                correct: 'Pides tu descanso reglamentario al supervisor',
                wrongPool: ['Sigues hasta el amanecer', 'Te sientas un momento sin avisar', 'Tomas los chips del jugador para comprarte un café', 'Cierras la mesa sin autorización', 'Pides que otro dealer tome tu lugar sin avisar'] }),
            this.buildGuessNumber({ userId: u,
                question: '🎲 En dados, ¿cuál es la probabilidad de sacar un 7?',
                correct: '16.7% (6/36)',
                wrongPool: ['10%', '25%', '8.3%', '20%', '33%', '12.5%'] }),
            this.buildReaction({ userId: u, prompt: '💰 ¡El jugador ganó y quiere cobrar inmediatamente! ¡Paga con precisión!', buttonLabel: '💵 ¡PAGAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🕶️ Un jugador lleva gafas de sol raras y no habla. ¿Qué sospechas?',
                correct: 'Podría estar usando dispositivo para contar cartas',
                wrongPool: ['Que es famoso y no quiere ser reconocido', 'Que tiene problemas de visión', 'Absolutamente nada', 'Que es un robot', 'Que viene del sol', 'Que es agente encubierto del casino'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎯 ¿Cuántos mazos se usan normalmente en blackjack de casino?',
                correct: '6 a 8 mazos',
                wrongPool: ['1 mazo', '2 mazos', '10 mazos', '4 mazos', '3 mazos', '12 mazos'] }),
            this.buildSequence({ userId: u,
                instruction: '💰 Ordena cómo procesar una apuesta ganadora:',
                steps: [{ label: '✅ Verificar el resultado', order: 0 }, { label: '🧮 Calcular el pago', order: 1 }, { label: '💰 Pagar al jugador', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🎭 Un jugador famoso llega a tu mesa y todos sacan el teléfono. ¿Qué haces?',
                correct: 'Pides discreción y sigues el juego normal',
                wrongPool: ['Pides foto también', 'Cierras la mesa', 'Le das ventaja en el juego', 'Lo expulsas para proteger su privacidad', 'Anuncias su nombre por el micrófono'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  BARISTA CASINO
    // ─────────────────────────────────────────────
    getBaristaGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '☕ Un VIP pide un "Espresso Romano". ¿Qué lleva?',
                correct: 'Espresso + rodaja de limón',
                wrongPool: ['Espresso + leche', 'Espresso + caramelo', 'Espresso + crema batida', 'Espresso + azúcar morena', 'Espresso + canela', 'Espresso + chocolate'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡Derramaste café sobre la mesa de blackjack! ¡Limpia AHORA!', buttonLabel: '🧹 ¡LIMPIAR!', timeLimit: 3500 }),
            this.buildGuessNumber({ userId: u,
                question: '🎰 Jugador ganó $5,000. Te da propina del 5%. ¿Cuánto recibes?',
                correct: '$250', wrongPool: ['$150', '$500', '$200', '$100', '$350', '$400'] }),
            this.buildSequence({ userId: u,
                instruction: '🍹 Ordena los pasos de un Mojito:',
                steps: [{ label: '🌿 Muele la menta', order: 0 }, { label: '🍋 Exprime el limón', order: 1 }, { label: '🧊 Agrega hielo y ron', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Un jugador perdió todo y está siendo agresivo. ¿Qué haces?',
                correct: 'Llamas a seguridad con calma',
                wrongPool: ['Le gritas de vuelta', 'Le ofreces un trago gratis', 'Te escondes en el baño', 'Le dices que se lo merecía', 'Lo grabas para redes', 'Le ríes en la cara'] }),
            this.buildPoolChoice({ userId: u,
                question: '🃏 ¿Cuál de estas bebidas NO existe en un casino de lujo?',
                correct: 'Agua con Milo',
                wrongPool: ['Dry Martini', 'Negroni', 'Old Fashioned', 'Manhattan', 'Cosmopolitan', 'Whisky Sour'] }),
            this.buildReaction({ userId: u, prompt: '🔔 ¡El gerente te llama! ¡Responde antes de que se moleste!', buttonLabel: '📞 ¡CONTESTAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '☕ ¿Cuál es la temperatura ideal para servir un espresso?',
                correct: '88-92°C',
                wrongPool: ['60°C', '100°C', '70°C', '50°C', '95°C', '80°C'] }),
            this.buildPoolChoice({ userId: u,
                question: '💎 Un jugador VIP pide su bebida "de siempre". No lo conoces. ¿Qué haces?',
                correct: 'Le preguntas amablemente qué es "lo de siempre"',
                wrongPool: ['Inventas una bebida cara', 'Le traes agua', 'Le dices que no eres su barista habitual', 'Le traes lo más caro del menú', 'Preguntas a tus compañeros discretamente primero', 'Le dices que espere mientras revisas notas'] }),
            this.buildGuessNumber({ userId: u,
                question: '🍹 3 Gin Tonic ($12 c/u) + 2 jugos ($6 c/u). ¿Total?',
                correct: '$48', wrongPool: ['$36', '$54', '$42', '$60', '$45', '$50'] }),
            this.buildReaction({ userId: u, prompt: '🎰 ¡Un jugador ganó el jackpot y todos celebran! ¡Prepara rondas rápido!', buttonLabel: '🥂 ¡PREPARAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🧊 ¿Cuántos hielos lleva un vaso de whisky on the rocks?',
                correct: '2-3 cubos grandes',
                wrongPool: ['Hielo picado hasta el tope', 'Sin hielo', '10 cubitos pequeños', 'Solo uno enorme', 'Hielo en polvo', 'Los que quepan'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌙 Son las 4am y un jugador pide su décima bebida. ¿Qué haces?',
                correct: 'Le ofreces agua o jugo y evalúas si servirle más',
                wrongPool: ['Le sirves sin problema', 'Lo expulsas del casino', 'Llamas a sus familiares', 'Le cobras triple', 'Le dices que el bar cerró', 'Le pides que firme un documento'] }),
            this.buildSequence({ userId: u,
                instruction: '☕ Ordena cómo preparar un cappuccino perfecto:',
                steps: [{ label: '☕ Preparar el espresso', order: 0 }, { label: '🥛 Vaporizar la leche', order: 1 }, { label: '🎨 Verter haciendo latte art', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💰 Al final del turno, ¿qué haces con las propinas?',
                correct: 'Las reportas y repartes según la política del casino',
                wrongPool: ['Te quedas todo', 'Las tiras a la basura', 'Las pones en la caja del casino', 'Las usas para jugar en las máquinas', 'Las escodes en el locker'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  PROGRAMADOR
    // ─────────────────────────────────────────────
    getProgrammerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🐛 `let y = "3"; let z = 5 + y;` ¿Qué valor tiene z?',
                correct: '"53" (concatenación de string)',
                wrongPool: ['8 (suma normal)', 'Error de compilación', 'undefined', 'null', '"8"', '53'] }),
            this.buildPoolChoice({ userId: u,
                question: '💻 El cliente quiere un botón que "haga cosas". ¿Qué respondes?',
                correct: '"Claro, ¿qué cosas específicamente?"',
                wrongPool: ['"Eso no es posible"', '"Hecho, dame 2 minutos"', '"Eso cuesta extra"', '"Te mando el presupuesto"', '"No trabajo con clientes así"', '"Primero págame"'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡EL SERVIDOR SE CAYÓ EN PRODUCCIÓN! ¡REINICIA YA!', buttonLabel: '🔄 ¡REINICIAR!', timeLimit: 5000 }),
            this.buildSequence({ userId: u,
                instruction: '🚀 Ordena los pasos de un deploy:',
                steps: [{ label: '📦 Build del proyecto', order: 0 }, { label: '🧪 Correr tests', order: 1 }, { label: '☁️ Deploy a producción', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '⚡ ¿Qué algoritmo es más eficiente para ordenar listas grandes?',
                correct: 'Quick Sort O(n log n)',
                wrongPool: ['Bubble Sort O(n²)', 'Insertion Sort O(n²)', 'Selection Sort O(n²)', 'Bogo Sort O(n·n!)', 'Sleep Sort O(max)', 'Stalin Sort O(n)'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Cambios "pequeños" del cliente. ¿Cuántas horas cobras?',
                correct: '4 horas', wrongPool: ['1 hora', '8 horas', '2 horas', '30 min', '12 horas', '6 horas'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎯 Un junior rompió la rama main en git. ¿Qué haces primero?',
                correct: 'git revert al último commit estable',
                wrongPool: ['Renunciar', 'Culpar al junior públicamente', 'Apagar el servidor', 'Borrar el repo y empezar de cero', 'Crear una rama nueva y abandonar main', 'Llamar a llorar con mamá'] }),
            this.buildPoolChoice({ userId: u,
                question: '🐞 ¿Cuál es la causa más común de un bug en producción?',
                correct: 'Un edge case no considerado en el testing',
                wrongPool: ['El compilador está roto', 'La computadora está cansada', 'Mercurio retrógrado', 'El cliente cambió de idea', 'La luna llena', 'El WiFi del cliente'] }),
            this.buildPoolChoice({ userId: u,
                question: '📱 El cliente dice "la app se ve rara en mi teléfono". ¿Qué le preguntas primero?',
                correct: '¿Qué dispositivo y versión del sistema operativo tienes?',
                wrongPool: ['¿Compraste el plan premium?', '¿Reiniciaste el teléfono?', '¿Es tu internet?', 'Nada, lo arreglas a ciegas', '¿Tienes el último iPhone?', '¿Lo instalaste bien?'] }),
            this.buildReaction({ userId: u, prompt: '📧 ¡El cliente envió 47 correos en 10 minutos! ¡Responde el importante!', buttonLabel: '📬 ¡RESPONDER!', timeLimit: 4500 }),
            this.buildPoolChoice({ userId: u,
                question: '🔒 ¿Cómo guardas contraseñas en una base de datos?',
                correct: 'Hasheadas con bcrypt o argon2',
                wrongPool: ['En texto plano', 'Encriptadas con Base64', 'En un Excel aparte', 'En MD5', 'Codificadas en el código', 'Solo las primeras letras'] }),
            this.buildPoolChoice({ userId: u,
                question: '⏰ El cliente pide algo "para ayer". ¿Qué haces?',
                correct: 'Negotias el alcance real para el tiempo disponible',
                wrongPool: ['Prometes todo y no cumples', 'Le dices que es imposible y cuelgas', 'Trabajas 48 horas sin dormir', 'Le cobras triple y lo haces igual de lento', 'Le mandas lo que tenías de otro cliente'] }),
            this.buildSequence({ userId: u,
                instruction: '🔍 Ordena el proceso de debugging:',
                steps: [{ label: '🔍 Reproducir el error', order: 0 }, { label: '🧪 Aislar la causa', order: 1 }, { label: '✅ Implementar y testear el fix', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 El cliente pide acceso total al servidor de producción. ¿Qué haces?',
                correct: 'Le das acceso limitado solo a lo que necesita',
                wrongPool: ['Le das root access sin pensarlo', 'Le niegas todo acceso', 'Le mandas la contraseña por WhatsApp', 'Le dices que hable con tu jefe', 'Le cambias la contraseña cada hora'] }),
            this.buildGuessNumber({ userId: u,
                question: '🖥️ ¿Cuántos bits tiene un byte?',
                correct: '8 bits', wrongPool: ['4 bits', '16 bits', '2 bits', '12 bits', '6 bits', '10 bits'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  OXXO
    // ─────────────────────────────────────────────
    getOxxoGames(u) {
        return this.shuffle([
            this.buildReaction({ userId: u, prompt: '🚪 ¡Es exactamente tu hora de apertura! ¡Abre AHORA!', buttonLabel: '🔑 ¡ABRIR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🕐 Son las 5:59am y tu turno es a las 6:00. ¿Qué haces?',
                correct: 'Esperas exactamente a las 6:00',
                wrongPool: ['Abres un minuto antes', 'Llegas a las 6:15', 'Mandas a alguien más', 'Abres a las 6:05 después del café', 'Esperas a que alguien toque', 'Abres a las 5:50 por si acaso'] }),
            this.buildSequence({ userId: u,
                instruction: '🔐 Protocolo de apertura del Oxxo:',
                steps: [{ label: '🔍 Verificar área exterior', order: 0 }, { label: '🔑 Desactivar alarma', order: 1 }, { label: '🚪 Abrir puertas al público', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '👤 Un tipo sospechoso merodeó toda la noche afuera. ¿Qué haces al abrir?',
                correct: 'Llamas a seguridad y esperas confirmación',
                wrongPool: ['Abres normal y rezas', 'Le preguntas qué quiere', 'No abres ese día', 'Lo invitas a pasar', 'Llamas a la policía pero abres igual', 'Le tomas foto y subes a redes'] }),
            this.buildGuessNumber({ userId: u,
                question: '⏰ La alarma tiene 30 seg antes de activarse. ¿Cuántos segundos tienes para el código?',
                correct: '30 seg', wrongPool: ['10 seg', '20 seg', '45 seg', '60 seg', '15 seg', '5 seg'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡La alarma se activó por accidente! ¡Desactívala RÁPIDO!', buttonLabel: '🔴 ¡DESACTIVAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '💡 Al abrir, notas que falta mercancía. ¿Qué haces?',
                correct: 'Reportas al encargado y documentas con fotos',
                wrongPool: ['Ignoras y sigues', 'Culpas al turno anterior', 'Llenas el faltante de tu bolsillo', 'Lo publicas en Facebook', 'Cierras la tienda como medida'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Un cliente enojado dice que el precio del refresco está mal. ¿Qué haces?',
                correct: 'Verificas el precio en el sistema y le explicas amablemente',
                wrongPool: ['Le dices que está equivocado sin revisar', 'Le das el refresco gratis para que se calle', 'Le dices que hable con el gerente y lo ignoras', 'Discutes el precio frente a todos', 'Le cobras el precio que él dice'] }),
            this.buildPoolChoice({ userId: u,
                question: '🔞 Un joven quiere comprar alcohol. ¿Qué haces?',
                correct: 'Pides identificación oficial antes de vender',
                wrongPool: ['Le vendes si parece mayor', 'Le preguntas su edad y le crees', 'Le vendes si viene con un adulto', 'No vendes alcohol a nadie por precaución', 'Le dices que vuelva con sus papás'] }),
            this.buildReaction({ userId: u, prompt: '💸 ¡Larga fila y la caja se trabó! ¡Reiníciala rápido!', buttonLabel: '🖥️ ¡REINICIAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🌧️ Se fue la luz en plena hora pico. ¿Qué haces?',
                correct: 'Activas el generador de emergencia y reportas a la empresa',
                wrongPool: ['Cierras la tienda inmediatamente', 'Sigues vendiendo a oscuras', 'Mandas a todos a casa', 'Usas el celular como linterna y continúas normal', 'Esperas sentado a que vuelva la luz'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 El cliente paga $50 por una compra de $37.50. ¿Cuánto de cambio?',
                correct: '$12.50', wrongPool: ['$12', '$13', '$13.50', '$11.50', '$14', '$10.50'] }),
            this.buildPoolChoice({ userId: u,
                question: '📦 Llega un proveedor a dejar mercancía sin cita. ¿Qué haces?',
                correct: 'Verificas la orden de compra antes de recibir nada',
                wrongPool: ['Recibes todo sin revisar', 'Lo mandas a regresar de una', 'Llamas al gerente y esperas sin hacer nada', 'Recibes la mitad nada más', 'Le preguntas si trae algo de propina'] }),
            this.buildSequence({ userId: u,
                instruction: '💳 Ordena cómo procesar un pago de servicios:',
                steps: [{ label: '📱 Escanear el código de barras', order: 0 }, { label: '💰 Recibir el pago', order: 1 }, { label: '🧾 Entregar el comprobante', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🕵️ Notas que un cliente metió algo en su ropa. ¿Qué haces?',
                correct: 'Alertas al supervisor discretamente',
                wrongPool: ['Lo confrontas en voz alta frente a todos', 'Lo ignoras', 'Lo persigues por la tienda', 'Llamas a la policía de inmediato sin verificar', 'Lo acusas públicamente por el altavoz'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  MECÁNICO
    // ─────────────────────────────────────────────
    getMecanicoGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🔧 El cliente dice que el carro "hace ruido raro al frenar". ¿Qué revisas primero?',
                correct: 'Discos y pastillas de freno',
                wrongPool: ['El motor', 'La batería', 'El aceite', 'Los limpiaparabrisas', 'El radio', 'El claxon'] }),
            this.buildReaction({ userId: u, prompt: '🔥 ¡El motor está sobrecalentado! ¡Apágalo RÁPIDO!', buttonLabel: '🔑 ¡APAGAR!', timeLimit: 3500 }),
            this.buildSequence({ userId: u,
                instruction: '🛢️ Ordena un cambio de aceite correcto:',
                steps: [{ label: '🔩 Drenar el aceite viejo', order: 0 }, { label: '🔧 Cambiar el filtro', order: 1 }, { label: '🛢️ Llenar con aceite nuevo', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💡 El Check Engine está encendido. ¿Qué haces primero?',
                correct: 'Conectas el escáner OBD para leer el código',
                wrongPool: ['Lo ignoras', 'Cambias la batería', 'Cambias todo el motor', 'Cubres la luz con cinta', 'Reinicias el carro 3 veces', 'Llamas al concesionario antes de revisar'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 $350 en piezas + 3 horas a $50/hora. ¿Total?',
                correct: '$500', wrongPool: ['$450', '$550', '$400', '$600', '$475', '$525'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 El cliente regresa porque el carro que "reparaste" no enciende. ¿Qué haces?',
                correct: 'Revisas sin costo adicional hasta encontrar la falla',
                wrongPool: ['Niegas haber tocado la batería', 'Le cobras otra consulta', 'Le dices que es otro problema', 'Le dices que lo llevó mal', 'Le culpas al tiempo'] }),
            this.buildReaction({ userId: u, prompt: '⚠️ ¡La llave de impacto está atascada! ¡Aplica fuerza!', buttonLabel: '💪 ¡FUERZA!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🔋 El cliente dice que la batería se agota rápido. ¿Qué revisas?',
                correct: 'La batería, el alternador y las conexiones eléctricas',
                wrongPool: ['Solo la batería', 'El motor de arranque', 'Los fusibles del radio', 'El aceite de motor', 'Los neumáticos', 'El sistema de frenos'] }),
            this.buildPoolChoice({ userId: u,
                question: '🚗 ¿Cada cuántos km se recomienda cambiar el aceite?',
                correct: 'Cada 5,000-10,000 km según el tipo de aceite',
                wrongPool: ['Cada 500 km', 'Cada 50,000 km', 'Una vez al año sin importar los km', 'Solo cuando sale humo', 'Cada 2,000 km siempre', 'Nunca si usas sintético'] }),
            this.buildGuessNumber({ userId: u,
                question: '🔩 ¿Cuántos tornillos tiene típicamente una rueda de carro?',
                correct: '4 o 5 tornillos', wrongPool: ['2 tornillos', '8 tornillos', '3 tornillos', '6 tornillos', '10 tornillos', '1 tornillo central'] }),
            this.buildReaction({ userId: u, prompt: '🚗 ¡El carro cayó del gato hidráulico! ¡Salta!', buttonLabel: '🏃 ¡SALTAR!', timeLimit: 2500 }),
            this.buildPoolChoice({ userId: u,
                question: '🌡️ ¿Cuándo debes revisar la presión de los neumáticos?',
                correct: 'Con los neumáticos fríos, antes de manejar',
                wrongPool: ['Después de manejar 30 min', 'Solo cuando se vean desinflados', 'En cualquier momento da igual', 'Solo en gasolineras', 'Con el motor encendido', 'Una vez al año en revisión general'] }),
            this.buildPoolChoice({ userId: u,
                question: '💧 El cliente ve líquido verde debajo del carro. ¿Qué es?',
                correct: 'Refrigerante — hay una fuga en el sistema de enfriamiento',
                wrongPool: ['Aceite de motor pintado', 'Agua del aire acondicionado normal', 'Líquido de frenos', 'Combustible', 'Agua de lluvia acumulada', 'Líquido del parabrisas'] }),
            this.buildSequence({ userId: u,
                instruction: '🔧 Ordena el diagnóstico de un carro que no enciende:',
                steps: [{ label: '🔋 Revisar batería', order: 0 }, { label: '⛽ Verificar combustible', order: 1 }, { label: '🔩 Revisar motor de arranque', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💰 Un cliente pide solo revisar el carro "a ver qué tiene". ¿Qué cobras?',
                correct: 'Una tarifa de diagnóstico que se descuenta si hace la reparación',
                wrongPool: ['Nada, el diagnóstico es gratis siempre', 'El precio de la reparación completa anticipado', 'No lo revisas sin saber qué es', 'Le cobras por hora de revisión', 'Le cobras según lo grave que sea'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  DOCTOR
    // ─────────────────────────────────────────────
    getDoctorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🩺 Paciente con fiebre 39°C, dolor de garganta y ganglios. ¿Diagnóstico?',
                correct: 'Amigdalitis bacteriana',
                wrongPool: ['Gripe común', 'COVID-19', 'Alergia estacional', 'Laringitis viral', 'Mononucleosis', 'Reflujo gastroesofágico'] }),
            this.buildReaction({ userId: u, prompt: '💔 ¡PACIENTE EN PARO CARDÍACO! ¡USA EL DESFIBRILADOR!', buttonLabel: '⚡ ¡DESFIBRILA!', timeLimit: 4000 }),
            this.buildGuessNumber({ userId: u,
                question: '💊 Paciente de 70kg necesita 10mg/kg. ¿Cuántos mg administras?',
                correct: '700mg', wrongPool: ['500mg', '1000mg', '350mg', '800mg', '600mg', '900mg'] }),
            this.buildSequence({ userId: u,
                instruction: '🏥 Ordena los pasos de una cirugía de emergencia:',
                steps: [{ label: '💉 Anestesia', order: 0 }, { label: '🔪 Incisión', order: 1 }, { label: '🩹 Sutura', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '⚠️ Paciente alérgico a penicilina necesita antibiótico. ¿Qué usas?',
                correct: 'Azitromicina',
                wrongPool: ['Amoxicilina', 'Ampicilina', 'Cloxacilina', 'Dicloxacilina', 'Oxacilina', 'Nafcilina'] }),
            this.buildPoolChoice({ userId: u,
                question: '🧠 Dolor de cabeza "el peor de su vida" de inicio súbito. ¿Qué sospechas?',
                correct: 'Hemorragia subaracnoidea',
                wrongPool: ['Migraña común', 'Tensión muscular', 'Deshidratación', 'Sinusitis', 'Hipertensión leve', 'Resaca'] }),
            this.buildReaction({ userId: u, prompt: '🩸 ¡El paciente está sangrando abundantemente! ¡Aplica presión!', buttonLabel: '🖐️ ¡PRESIONAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '🫀 ¿Cuál es la frecuencia cardíaca normal en adultos en reposo?',
                correct: '60-100 latidos por minuto',
                wrongPool: ['30-50 lpm', '120-140 lpm', '100-120 lpm', '40-60 lpm', '150-180 lpm', '20-40 lpm'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤒 Paciente con fiebre de 41°C. ¿Qué es lo más urgente?',
                correct: 'Bajar la fiebre con antipiréticos y medios físicos',
                wrongPool: ['Darle antibióticos inmediatamente', 'Esperar a ver si baja sola', 'Solo hidratarlo', 'Hacer análisis antes de tratar', 'Mandarlo a casa a descansar', 'Darle corticoides'] }),
            this.buildGuessNumber({ userId: u,
                question: '🫁 ¿Cuántas respiraciones por minuto es normal en un adulto?',
                correct: '12-20 rpm', wrongPool: ['5-8 rpm', '25-35 rpm', '30-40 rpm', '8-10 rpm', '40-50 rpm', '6-8 rpm'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Código azul en el pasillo! ¡Corre!', buttonLabel: '🏃 ¡CORRER!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '💉 ¿En qué brazo NO se debe tomar la presión arterial?',
                correct: 'En el brazo con fístula arteriovenosa',
                wrongPool: ['En el brazo dominante', 'En el brazo izquierdo', 'En el brazo derecho', 'Da igual cualquier brazo', 'En el brazo más grueso', 'En el brazo sin tatuajes'] }),
            this.buildPoolChoice({ userId: u,
                question: '🩻 ¿Para qué sirve una radiografía de tórax?',
                correct: 'Ver pulmones, corazón y estructura ósea del tórax',
                wrongPool: ['Solo para ver huesos rotos', 'Para diagnosticar cualquier enfermedad', 'Solo para ver el corazón', 'Para ver órganos abdominales', 'Para ver el cerebro', 'Solo en emergencias traumáticas'] }),
            this.buildSequence({ userId: u,
                instruction: '🏥 Ordena la atención de un paciente en urgencias:',
                steps: [{ label: '📋 Triaje y evaluación inicial', order: 0 }, { label: '🩺 Diagnóstico y tratamiento', order: 1 }, { label: '📝 Alta o ingreso hospitalario', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😷 Un colega llega al turno claramente enfermo con gripe. ¿Qué haces?',
                correct: 'Le dices que no puede atender pacientes y lo mandas a casa',
                wrongPool: ['Nada, él sabrá', 'Le pides que use mascarilla y siga', 'Le cubres todos sus pacientes solo', 'Avisas al jefe sin decirle al colega', 'Lo reportas formalmente con recursos humanos', 'Le das medicamento y que siga'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  BOTARGA DR. SIMI
    // ─────────────────────────────────────────────
    getSimiGames(u) {
        return this.shuffle([
            this.buildSequence({ userId: u,
                instruction: '🕺 Ejecuta el baile icónico del Dr. Simi:',
                steps: [{ label: '🙌 Palmas arriba', order: 0 }, { label: '💃 Giro completo', order: 1 }, { label: '🎉 Salto final', order: 2 }] }),
            this.buildReaction({ userId: u, prompt: '📸 ¡Un niño quiere foto con el Dr. Simi! ¡Posa AHORA!', buttonLabel: '😄 ¡POSAR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🌡️ Llevas 3 horas en la botarga con 35°C. ¿Cuándo descansas?',
                correct: 'Cada hora tomas 10 minutos',
                wrongPool: ['Aguantas hasta el final', 'Cuando ya no puedas respirar', 'Nunca, eres profesional', 'Cada 30 minutos 5 segundos', 'Solo si alguien te lo pide', 'Al mediodía y ya'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎵 ¿Cuál es el jingle correcto del Doctor Simi?',
                correct: '"Similares, los mismos"',
                wrongPool: ['"Por tu salud, por tu bien"', '"Primero la salud"', '"Doctor Simi, tu amigo"', '"Farmacia del pueblo"', '"Lo mismo pero más barato"', '"Salud y bienestar"'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Un adulto borracho quiere pelear con la botarga. ¿Qué haces?',
                correct: 'Te alejas y llamas a seguridad',
                wrongPool: ['Le pegas con el disfraz', 'Te quitas la botarga y le hablas', 'Bailas más fuerte para ignorarlo', 'Lo grabas y lo subes a TikTok', 'Le preguntas cuál es su problema', 'Lo retas a bailar mejor que tú'] }),
            this.buildReaction({ userId: u, prompt: '💃 ¡Están tocando tu canción en el evento! ¡Empieza a bailar!', buttonLabel: '🎶 ¡BAILAR!', timeLimit: 3500 }),
            this.buildGuessNumber({ userId: u,
                question: '💰 8 horas como botarga a $15/hora. ¿Cuánto ganas?',
                correct: '$120', wrongPool: ['$100', '$150', '$80', '$160', '$90', '$140'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌧️ Está lloviendo a cántaros. ¿Puede la botarga mojarse?',
                correct: 'No, debes buscar refugio o la tela se arruina',
                wrongPool: ['Sí, está diseñada para lluvia', 'Solo un poco está bien', 'Depende del material', 'Sí, el disfraz es lavable', 'La lluvia lo limpia', 'Solo si hace calor'] }),
            this.buildPoolChoice({ userId: u,
                question: '👶 Un bebé llora de miedo al ver la botarga. ¿Qué haces?',
                correct: 'Te alejas para no asustar más al bebé',
                wrongPool: ['Te acercas más para que se acostumbre', 'Te quitas la cabeza de la botarga', 'Le haces sonidos para calmarlo', 'Ignoras al bebé y sigues bailando', 'Le preguntas a los papás qué hacer'] }),
            this.buildReaction({ userId: u, prompt: '🏆 ¡El evento terminó y el público pide un último baile! ¡Dale todo!', buttonLabel: '⭐ ¡ÚLTIMO BAILE!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🎪 Hay 500 personas en el evento. ¿Cómo gestionas las fotos?',
                correct: 'Haces filas ordenadas y das tiempo justo a cada uno',
                wrongPool: ['Cobras por foto', 'Solo poses con niños', 'Ignoras a la gente y bailas', 'Tomas fotos con todos a la vez caóticamente', 'Solo 10 fotos y te retiras', 'Pides que traigan sus propios fotógrafos'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌡️ Dentro de la botarga hace 45°C. ¿Cuáles son síntomas de golpe de calor?',
                correct: 'Mareo, confusión, piel caliente y seca, sin sudor',
                wrongPool: ['Solo sudor excesivo', 'Frío y escalofríos', 'Hambre y sueño', 'Solo dolor de cabeza', 'Náuseas leves normales', 'Todo es normal en la botarga'] }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Un influencer te pide que te quites la cabeza para un video "más auténtico". ¿Qué haces?',
                correct: 'Te niegas — nunca se rompe el personaje en público',
                wrongPool: ['Aceptas por la fama', 'Le preguntas a tu jefe por teléfono en ese momento', 'Te la quitas solo un segundo', 'Le pides que te pague', 'Lo piensas y luego decides'] }),
            this.buildSequence({ userId: u,
                instruction: '🎭 Ordena cómo prepararte para un evento como botarga:',
                steps: [{ label: '💧 Hidratarte bien antes', order: 0 }, { label: '🎭 Ponerte el disfraz con ayuda', order: 1 }, { label: '🎵 Calentar los pasos de baile', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💊 El Dr. Simi representa a Farmacias Similares. ¿Qué venden principalmente?',
                correct: 'Medicamentos genéricos de menor precio',
                wrongPool: ['Medicamentos de marca exclusivos', 'Solo vitaminas y suplementos', 'Ropa médica', 'Solo medicamentos importados', 'Cosméticos y perfumes', 'Productos naturistas únicamente'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  CRIMINAL
    // ─────────────────────────────────────────────
    getCriminalGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🕵️ Necesitas escapar. ¿Qué ruta eliges?',
                correct: 'Callejón trasero despejado',
                wrongPool: ['Calle principal con patrullas', 'Plaza central con testigos', 'Metro con cámaras', 'Autopista con peaje', 'Parque iluminado', 'Centro comercial con seguridad'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡LLEGA LA POLICÍA! ¡ESCÓNDETE AHORA!', buttonLabel: '🏃 ¡ESCONDERSE!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🤔 Uno de tus "clientes" parece policía encubierto. ¿Cuál es?',
                correct: 'El que tiene auricular en la oreja',
                wrongPool: ['El que lleva ropa de trabajo sucia', 'El que está nervioso', 'El que masca chicle', 'El que llegó primero', 'El más joven del grupo', 'El que trae mochila'] }),
            this.buildSequence({ userId: u,
                instruction: '📦 Ordena el intercambio para no levantar sospechas:',
                steps: [{ label: '👀 Verificar el área', order: 0 }, { label: '🤝 Confirmar con el contacto', order: 1 }, { label: '💼 Hacer el intercambio', order: 2 }] }),
            this.buildGuessNumber({ userId: u,
                question: '💸 Trato por $500, comprador trae $350. ¿Cuánto falta?',
                correct: '$150', wrongPool: ['$100', '$200', '$250', '$175', '$125', '$50'] }),
            this.buildPoolChoice({ userId: u,
                question: '🔐 La contraseña del punto es una fruta. ¿Cuál evitas decir en público?',
                correct: '"Guanábana" — muy inusual llama la atención',
                wrongPool: ['"Manzana"', '"Naranja"', '"Plátano"', '"Mango"', '"Uva"', '"Pera"'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Alguien te reconoció! ¡Actúa normal RÁPIDO!', buttonLabel: '😐 ¡CARA POKER!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '📱 El contacto no responde hace 2 horas en una operación activa. ¿Qué haces?',
                correct: 'Cancelas la operación y te retiras',
                wrongPool: ['Sigues esperando indefinidamente', 'Llamas desde tu teléfono personal', 'Vas al punto de encuentro de todas formas', 'Preguntas a sus conocidos', 'Publicas en redes buscándolo'] }),
            this.buildPoolChoice({ userId: u,
                question: '💰 Tu proveedor subió el precio 40%. ¿Qué haces?',
                correct: 'Negocias o buscas otro proveedor',
                wrongPool: ['Aceptas sin negociar', 'Dejas el negocio', 'Subes tus precios al doble', 'Le robas el producto', 'Denuncias al proveedor', 'Le pagas en cuotas sin avisar'] }),
            this.buildReaction({ userId: u, prompt: '🔦 ¡Una linterna te apunta desde un carro oscuro! ¡Actúa!', buttonLabel: '🏃 ¡CORRER!', timeLimit: 2500 }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Un nuevo "socio" quiere saber todos los detalles de tu operación. ¿Qué haces?',
                correct: 'Le das solo la información mínima necesaria',
                wrongPool: ['Le cuentas todo para ganarte su confianza', 'Lo rechazas completamente', 'Lo llevas a conocer a todos tus contactos', 'Le muestras tus registros contables', 'Le presentas a tu familia'] }),
            this.buildPoolChoice({ userId: u,
                question: '🎭 La policía te pregunta dónde estabas anoche. ¿Qué dices?',
                correct: 'Dices que estabas en casa y pides hablar con un abogado',
                wrongPool: ['Inventas una historia complicada', 'Confiesas todo de una vez', 'Te niegas a decir cualquier cosa agresivamente', 'Corres en el momento', 'Les preguntas cómo saben tu nombre'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Vendiste 10 unidades a $50 c/u. Le pagas $200 al intermediario. ¿Cuánto te queda?',
                correct: '$300', wrongPool: ['$200', '$400', '$250', '$350', '$150', '$450'] }),
            this.buildSequence({ userId: u,
                instruction: '🕶️ Ordena cómo preparar una operación segura:',
                steps: [{ label: '🔍 Reconocer el área días antes', order: 0 }, { label: '📞 Confirmar con todos los involucrados', order: 1 }, { label: '🚗 Tener ruta de escape lista', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😰 Sientes que te están siguiendo. ¿Qué haces?',
                correct: 'Cambias tu ruta varias veces para confirmar y luego te pierdes en una zona concurrida',
                wrongPool: ['Corres directamente a tu casa', 'Los confrontas', 'Los llamas por teléfono', 'Entras al primer negocio que veas y esperas horas', 'Los sigues tú también'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  VENDEDOR DEL PUNTO
    // ─────────────────────────────────────────────
    getVendedorGames(u) {
        return this.shuffle([
            this.buildGuessNumber({ userId: u,
                question: '💰 Te costó $200. ¿Qué precio maximiza ganancia sin asustar?',
                correct: '$320', wrongPool: ['$250', '$500', '$180', '$280', '$450', '$350'] }),
            this.buildReaction({ userId: u, prompt: '👮 ¡PASÓ UNA PATRULLA! ¡ACTÚA NORMAL!', buttonLabel: '😇 ¡NORMAL!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '😒 El cliente desconfía de la calidad. ¿Cómo lo convences?',
                correct: 'Le ofreces una muestra pequeña',
                wrongPool: ['Le juras que es lo mejor', 'Le bajas el precio a la mitad', 'Le dices que es lo único disponible', 'Le muestras las reseñas de otros', 'Le dices que se vaya si no confía'] }),
            this.buildGuessNumber({ userId: u,
                question: '💵 Cliente paga 3 billetes de $100. Precio era $280. ¿Cuánto de cambio?',
                correct: '$20', wrongPool: ['$10', '$30', '$40', '$15', '$25', '$50'] }),
            this.buildSequence({ userId: u,
                instruction: '🤫 Ordena una entrega segura:',
                steps: [{ label: '👀 Chequear el área', order: 0 }, { label: '📲 Confirmar con el cliente', order: 1 }, { label: '💼 Entregar y cobrar', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Proveedor quiere el doble por adelantado. ¿Qué haces?',
                correct: 'Negocias: mitad ahora, mitad al recibir',
                wrongPool: ['Pagas todo de inmediato', 'Rechazas la oferta', 'Pides fiado', 'Le ofreces el triple después', 'Buscas otro proveedor sin negociar'] }),
            this.buildReaction({ userId: u, prompt: '🔦 ¡Una linterna te apunta! ¡Corre!', buttonLabel: '🏃 ¡CORRER!', timeLimit: 2500 }),
            this.buildPoolChoice({ userId: u,
                question: '💸 Un cliente habitual quiere crédito. ¿Qué haces?',
                correct: 'Solo si tiene historial de pago perfecto y es monto pequeño',
                wrongPool: ['Le das crédito ilimitado', 'Nunca das crédito a nadie', 'Le cobras el doble después', 'Le dices que hable con el banco', 'Le das todo y rezas'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 Un cliente quiere devolver la mercancía. ¿Qué le dices?',
                correct: '"No hay devoluciones en este tipo de negocio"',
                wrongPool: ['"Con mucho gusto"', '"Habla con mi proveedor"', '"Solo si viene con el recibo"', '"Depende del motivo"', '"Te devuelvo la mitad"'] }),
            this.buildReaction({ userId: u, prompt: '🚁 ¡Hay un helicóptero sobrevolando el área! ¡Métete adentro!', buttonLabel: '🏠 ¡ADENTRO!', timeLimit: 3000 }),
            this.buildGuessNumber({ userId: u,
                question: '📦 Tienes 20 unidades a $50 c/u. Vendes el 60%. ¿Cuánto ingresaste?',
                correct: '$600', wrongPool: ['$500', '$700', '$400', '$550', '$650', '$450'] }),
            this.buildPoolChoice({ userId: u,
                question: '🌙 Ya es medianoche y no has vendido nada. ¿Qué haces?',
                correct: 'Te retiras y vuelves mañana',
                wrongPool: ['Bajas los precios al 50%', 'Llamas a todos tus contactos a esa hora', 'Te quedas hasta las 4am', 'Regalas una muestra a quien pase', 'Vendes al primer precio que ofrezcan'] }),
            this.buildPoolChoice({ userId: u,
                question: '👶 Se acerca un menor de edad. ¿Qué haces?',
                correct: 'Lo mandas de regreso sin venderle nada',
                wrongPool: ['Le vendes si trae suficiente dinero', 'Le preguntas su edad y si dice 18 le crees', 'Le vendes menos cantidad', 'Finges que no lo ves', 'Lo llamas para que se acerque'] }),
            this.buildSequence({ userId: u,
                instruction: '💰 Ordena cómo manejar el dinero del día:',
                steps: [{ label: '🧮 Contar todo lo recaudado', order: 0 }, { label: '💸 Separar el pago al proveedor', order: 1 }, { label: '💰 Guardar la ganancia', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Recibes un mensaje desconocido: "Sé lo que vendes, $500 o te denuncio". ¿Qué haces?',
                correct: 'Ignoras, cambias de punto y avisas a tu red',
                wrongPool: ['Pagas los $500', 'Lo confrontas en persona', 'Le dices que te denuncie', 'Le mandas más dinero para ganar confianza', 'Le das tu ubicación para hablar'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  OF SELLER
    // ─────────────────────────────────────────────
    getOfsellerGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '📸 ¿Cuál es el mejor título para tu publicación?',
                correct: '"Contenido exclusivo para mis fans más especiales 💋"',
                wrongPool: ['"Foto mía"', '"Nuevo post disponible"', '"Miren esto"', '"Subí algo"', '"Foto nueva"', '"Post de hoy"'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Básico $10, VIP $25. Fan quiere ambos. ¿Cuánto cobras?',
                correct: '$35', wrongPool: ['$30', '$40', '$25', '$45', '$50', '$20'] }),
            this.buildReaction({ userId: u, prompt: '✅ ¡El sitio pide verificación de identidad! ¡Complétala AHORA!', buttonLabel: '📋 ¡VERIFICAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '💬 Suscriptor VIP pregunta si hay contenido nuevo. ¿Qué respondes?',
                correct: '"Claro mi amor, acabo de subir algo especial solo para ti 😘"',
                wrongPool: ['"Sí, en un rato"', '"Revisa mi perfil"', '"No tengo tiempo ahora"', '"Ya lo subí ayer"', '"Suscríbete al tier premium"'] }),
            this.buildSequence({ userId: u,
                instruction: '📤 Ordena cómo publicar contenido exitosamente:',
                steps: [{ label: '📸 Tomar y editar la foto', order: 0 }, { label: '✏️ Escribir descripción atractiva', order: 1 }, { label: '🏷️ Agregar precio y tags', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📉 Otra creadora bajó sus precios a la mitad. ¿Tu estrategia?',
                correct: 'Mejoras la calidad y te diferencias',
                wrongPool: ['Bajas precios igual', 'Atacas a la competencia en redes', 'Cierras la cuenta', 'Copias su contenido', 'Reduces la frecuencia de posts'] }),
            this.buildReaction({ userId: u, prompt: '💰 ¡Llegó una donación enorme! ¡Agradécela rápido!', buttonLabel: '🙏 ¡AGRADECER!' }),
            this.buildPoolChoice({ userId: u,
                question: '🚫 Un suscriptor pide contenido que no quieres hacer. ¿Qué respondes?',
                correct: '"No hago ese tipo de contenido, pero tengo otras opciones especiales 😊"',
                wrongPool: ['"Lo haré por el precio correcto"', '"Bloqueas sin decir nada"', '"Le preguntas cuánto paga"', '"Le dices que nunca lo harás con insultos"', '"Le ofreces el contenido de otra creadora"'] }),
            this.buildGuessNumber({ userId: u,
                question: '📊 500 suscriptores a $10/mes. La plataforma cobra 20%. ¿Cuánto ganas?',
                correct: '$4,000', wrongPool: ['$5,000', '$3,000', '$4,500', '$3,500', '$2,000', '$6,000'] }),
            this.buildPoolChoice({ userId: u,
                question: '🔒 Un ex-suscriptor amenaza con filtrar tu contenido. ¿Qué haces?',
                correct: 'Documentas todo y consultas con un abogado sobre DMCA',
                wrongPool: ['Le pagas para que no lo haga', 'Publicas sus datos personales', 'Cierras todas tus cuentas', 'Lo ignoras completamente', 'Le mandas amenazas de vuelta'] }),
            this.buildReaction({ userId: u, prompt: '📱 ¡Tu post llegó al trending! ¡Responde comentarios rápido para aprovechar!', buttonLabel: '💬 ¡RESPONDER!', timeLimit: 4500 }),
            this.buildPoolChoice({ userId: u,
                question: '🤳 ¿Cuál es la mejor hora para publicar contenido?',
                correct: 'Noche entre semana y tarde los fines de semana',
                wrongPool: ['3am para menos competencia', 'Solo domingos', 'Cualquier hora es igual', 'Solo en días festivos', 'A las 6am cuando hay menos posts'] }),
            this.buildPoolChoice({ userId: u,
                question: '💎 ¿Cuántos tiers de suscripción recomienda tener?',
                correct: '3 tiers: básico, medio y VIP',
                wrongPool: ['Solo uno para no confundir', '10 tiers para más opciones', 'Solo VIP para maximizar', 'Ninguno, todo por DM', '2 tiers máximo siempre'] }),
            this.buildSequence({ userId: u,
                instruction: '💰 Ordena cómo responder a un fan nuevo:',
                steps: [{ label: '👋 Saludo personalizado', order: 0 }, { label: '💝 Agradecer la suscripción', order: 1 }, { label: '🎁 Mencionar el contenido exclusivo que recibirá', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😴 Llevas 2 semanas sin publicar. Los suscriptores se quejan. ¿Qué haces?',
                correct: 'Publicas una disculpa honesta y ofreces contenido extra',
                wrongPool: ['Ignoras los mensajes', 'Cierras la cuenta temporalmente', 'Bloqueas a los que se quejan', 'Les dices que la vida real es más importante', 'Subes 20 posts de golpe sin calidad'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  DAMA DE COMPAÑÍA
    // ─────────────────────────────────────────────
    getDamaGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '👥 Tres perfiles de clientes. ¿Cuál eliges?',
                correct: 'El regular de buen trato y pago puntual',
                wrongPool: ['El que ofrece más pero tiene reseñas malas', 'El nuevo sin historial', 'El que negocia demasiado', 'El que insiste más', 'El que dice ser "especial"'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡LLEGÓ LA POLICÍA AL HOTEL! ¡SAL POR LA ESCALERA!', buttonLabel: '🚪 ¡ESCAPAR!', timeLimit: 3000 }),
            this.buildGuessNumber({ userId: u,
                question: '💰 El cliente quiere 20% de descuento sobre $300. ¿Cuánto pagaría?',
                correct: '$240', wrongPool: ['$220', '$260', '$280', '$200', '$250', '$270'] }),
            this.buildPoolChoice({ userId: u,
                question: '📍 ¿Dónde propones el encuentro más discreto?',
                correct: 'Hotel de paso conocido y seguro',
                wrongPool: ['Tu casa', 'Parque público', 'Bar del centro', 'Su oficina', 'Un mall', 'La calle fuera de un restaurante'] }),
            this.buildSequence({ userId: u,
                instruction: '💋 Para maximizar la propina, ordena la estrategia:',
                steps: [{ label: '😊 Generar confianza y comodidad', order: 0 }, { label: '🥂 Velada agradable', order: 1 }, { label: '💰 Cobrar + propina', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😠 El cliente está siendo irrespetuoso. ¿Qué haces?',
                correct: 'Pones límites claros y si no respeta, te vas',
                wrongPool: ['Lo aguantas por el dinero', 'Le pides más dinero', 'Lo ignoras completamente', 'Le contestas igual de mal', 'Llamas a una amiga para que te "rescate"'] }),
            this.buildReaction({ userId: u, prompt: '💸 ¡El cliente quiere pagar y se le hace tarde! ¡Cobra AHORA!', buttonLabel: '💰 ¡COBRAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Un cliente nuevo no para de mandar mensajes a todas horas. ¿Qué haces?',
                correct: 'Estableces horarios de comunicación claros',
                wrongPool: ['Respondes todo siempre', 'Lo bloqueas de una vez', 'Le cobras por mensaje', 'Le das otro número', 'Finges que el teléfono está roto'] }),
            this.buildPoolChoice({ userId: u,
                question: '💳 El cliente quiere pagar con transferencia desde un banco extraño. ¿Qué haces?',
                correct: 'Solo aceptas efectivo o métodos verificados',
                wrongPool: ['Aceptas cualquier método', 'Preguntas si es seguro y aceptas', 'Aceptas la mitad y mitad', 'Pides ver el comprobante antes del encuentro y confías'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Cobras $150/hora. El encuentro duró 2.5 horas. ¿Cuánto es?',
                correct: '$375', wrongPool: ['$300', '$350', '$400', '$325', '$450', '$250'] }),
            this.buildReaction({ userId: u, prompt: '⚠️ ¡El cliente se puso agresivo! ¡Activa tu protocolo de seguridad!', buttonLabel: '🆘 ¡PROTOCOLO!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Una colega quiere referirte a sus clientes. ¿Qué le ofreces?',
                correct: 'Una comisión justa por cada referido',
                wrongPool: ['Nada, los clientes son tuyos ahora', 'El 80% de lo que ganes', 'Solo agradecimiento', 'Que ella les atienda también', 'Tu lista de clientes a cambio'] }),
            this.buildPoolChoice({ userId: u,
                question: '📸 El cliente quiere tomar fotos. ¿Qué dices?',
                correct: '"Sin fotos, es parte de mis condiciones"',
                wrongPool: ['"Claro, es normal"', '"Solo si no muestras mi cara"', '"Por $50 extra te dejo"', '"Solo una"', '"Si me mandas las fotos después"'] }),
            this.buildSequence({ userId: u,
                instruction: '🔒 Ordena el protocolo de seguridad antes de un encuentro:',
                steps: [{ label: '✅ Verificar al cliente', order: 0 }, { label: '📲 Avisar ubicación a persona de confianza', order: 1 }, { label: '🚗 Llegar con plan de salida', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💔 Un cliente se está enamorando y quiere exclusividad. ¿Qué haces?',
                correct: 'Eres clara sobre los límites del acuerdo desde el inicio',
                wrongPool: ['Aceptas la exclusividad si paga bien', 'Lo dejas creer lo que quiera', 'Lo bloqueas sin explicación', 'Le presentas a una amiga como alternativa', 'Le cobras una tarifa de "novia" diferente'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  PARANORMAL
    // ─────────────────────────────────────────────
    getParanormalGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '👻 El EMF sube al nivel 5 en la cocina. ¿Qué usas para confirmar?',
                correct: 'Grabadora de voz para EVP',
                wrongPool: ['Termómetro infrarrojo', 'Cámara UV', 'Detector de humo', 'Brújula', 'Telémetro láser', 'Linterna UV'] }),
            this.buildReaction({ userId: u, prompt: '😱 ¡ALGO SE MOVIÓ EN LA ESQUINA! ¡GRABA AHORA!', buttonLabel: '🎥 ¡GRABAR!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '🌡️ La temperatura bajó 10°C de golpe en una habitación. ¿Qué significa?',
                correct: 'Posible punto frío de actividad paranormal',
                wrongPool: ['El AC está roto', 'La ventana está abierta', 'Es normal en casas viejas', 'Hay una fuga de gas', 'El termómetro está mal calibrado', 'Es una corriente de aire'] }),
            this.buildSequence({ userId: u,
                instruction: '🔍 Ordena el protocolo de investigación:',
                steps: [{ label: '📊 Medir niveles base', order: 0 }, { label: '🚶 Recorrer el lugar', order: 1 }, { label: '📝 Documentar evidencias', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🎭 El cliente está claramente fingiendo los fenómenos. ¿Cómo lo descubres?',
                correct: 'Cambias el horario de investigación sin avisar',
                wrongPool: ['Lo acusas directamente', 'Instalas cámaras ocultas sin decirle', 'Le preguntas si está mintiendo', 'Terminas la investigación', 'Le cobras extra por el tiempo perdido'] }),
            this.buildPoolChoice({ userId: u,
                question: '👤 ¿Qué tipo de entidad mueve objetos pero no se comunica?',
                correct: 'Poltergeist',
                wrongPool: ['Fantasma consciente', 'Demonio', 'Eco residual', 'Elemental', 'Shadow person', 'Apparition'] }),
            this.buildReaction({ userId: u, prompt: '📡 ¡El detector de movimiento se activó solo! ¡Analiza!', buttonLabel: '🔍 ¡ANALIZAR!' }),
            this.buildPoolChoice({ userId: u,
                question: '📷 Capturas una figura en la cámara a las 3am. ¿Qué haces primero?',
                correct: 'Verificas si puede ser explicado naturalmente antes de concluir',
                wrongPool: ['Lo publicas en redes inmediatamente', 'Confirmas que es paranormal y cobras', 'Llamas al cliente emocionado', 'Huyes del lugar', 'Lo eliminas por si acaso'] }),
            this.buildPoolChoice({ userId: u,
                question: '🕯️ El cliente quiere hacer una sesión de ouija durante la investigación. ¿Qué dices?',
                correct: 'Lo desaconsejas por razones metodológicas',
                wrongPool: ['Aceptas, más evidencia', 'Te niegas rotundamente y te vas', 'Lo haces tú solo sin el cliente', 'Cobras extra por el servicio adicional', 'Le dices que solo los domingos'] }),
            this.buildGuessNumber({ userId: u,
                question: '🔋 El EMF detecta anomalías sobre este nivel. ¿Cuál?',
                correct: 'Nivel 3 o superior', wrongPool: ['Nivel 1', 'Nivel 5 solo', 'Cualquier nivel es paranormal', 'Solo nivel 7', 'Nivel 0.5', 'Nivel 10 exclusivamente'] }),
            this.buildReaction({ userId: u, prompt: '🚪 ¡Una puerta se cerró sola! ¡Documenta antes de que pase otra vez!', buttonLabel: '📹 ¡DOCUMENTAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '😨 Uno de tus compañeros entra en pánico durante la investigación. ¿Qué haces?',
                correct: 'Lo sacas del lugar calmadamente y continúas tú',
                wrongPool: ['Le dices que se calme y siga', 'Entras en pánico también', 'Terminas la investigación', 'Le dices que son imaginaciones', 'Lo grabas para el documental'] }),
            this.buildPoolChoice({ userId: u,
                question: '📜 El dueño dice que murió alguien en la casa hace 80 años. ¿Cómo verificas?',
                correct: 'Revisas registros públicos históricos y archivos locales',
                wrongPool: ['Le crees inmediatamente', 'Preguntas a los vecinos', 'Haces una ouija para preguntarle al difunto', 'No verificas, no importa', 'Contratas un psíquico'] }),
            this.buildSequence({ userId: u,
                instruction: '📋 Ordena el reporte final para el cliente:',
                steps: [{ label: '📊 Presentar datos medidos', order: 0 }, { label: '🎥 Mostrar evidencia audiovisual', order: 1 }, { label: '💬 Dar conclusión y recomendaciones', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💰 El cliente quiere que confirmes que su casa está "maldita" para venderla más barata. ¿Qué haces?',
                correct: 'Presentas solo lo que encontraste, sin inventar',
                wrongPool: ['Le confirmas lo que pide por dinero extra', 'Niegas todo para no involucrarte', 'Le dices que todas las casas están malditas', 'Terminas el contrato inmediatamente', 'Le cobras por el informe y lo haces a su gusto'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  CONTADOR
    // ─────────────────────────────────────────────
    getContadorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '📊 El cliente quiere "reducir impuestos creativamente". ¿Qué estrategia usas?',
                correct: 'Buscas deducciones legítimas al límite legal',
                wrongPool: ['Reportas todo fielmente sin buscar nada', 'Inventas gastos falsos', 'Les dices que no puedes ayudar', 'Creas empresas fantasma', 'Lo reportas a hacienda de una vez'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡LLEGA UNA AUDITORÍA SORPRESA! ¡ORDENA LOS LIBROS!', buttonLabel: '📁 ¡ORDENAR!', timeLimit: 3500 }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Ingresos $500,000. Gastos $320,000. ¿Cuál es la utilidad?',
                correct: '$180,000', wrongPool: ['$160,000', '$200,000', '$140,000', '$220,000', '$150,000', '$250,000'] }),
            this.buildSequence({ userId: u,
                instruction: '📋 Ordena el cierre contable del mes:',
                steps: [{ label: '🔢 Cuadrar los libros', order: 0 }, { label: '📊 Generar estados financieros', order: 1 }, { label: '📤 Presentar declaración', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😬 El auditor pregunta por una transferencia de $50,000 a las Islas Caimán. ¿Qué dices?',
                correct: '"Es una inversión internacional con todos sus documentos"',
                wrongPool: ['Confiesas todo', 'Te niegas a responder', 'Sales corriendo', '"No sé de qué habla"', '"Eso fue antes de que yo llegara"', '"Pregunte a mi cliente"'] }),
            this.buildPoolChoice({ userId: u,
                question: '📉 El balance no cuadra por $0.01. El director dice que lo ignores. ¿Qué haces?',
                correct: 'Buscas el error hasta que cuadre',
                wrongPool: ['Lo ignoras como dice el director', 'Pones el centavo de tu bolsillo', 'Presentas el reporte con error', 'Le dices que lo haga él entonces', 'Renuncias'] }),
            this.buildReaction({ userId: u, prompt: '💻 ¡El sistema se cuelga a las 11:58pm con fecha límite a medianoche!', buttonLabel: '🔄 ¡REINICIAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '💼 Un nuevo cliente trae libros contables del año anterior hechos a mano con errores obvios. ¿Qué haces?',
                correct: 'Lo documentas, corriges y presentas el estado real',
                wrongPool: ['Los aceptas como están', 'Rechazas al cliente', 'Inventas los números faltantes', 'Lo reportas de inmediato a las autoridades', 'Los rehaces completamente sin decirle'] }),
            this.buildGuessNumber({ userId: u,
                question: '📊 IVA del 16% sobre una venta de $10,000. ¿Cuánto es el IVA?',
                correct: '$1,600', wrongPool: ['$1,000', '$2,000', '$1,200', '$1,800', '$800', '$1,400'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤔 El cliente quiere que sus gastos personales aparezcan como gastos de empresa. ¿Qué haces?',
                correct: 'Le explicas que eso es ilegal y no lo registras',
                wrongPool: ['Lo haces si son montos pequeños', 'Lo haces si te paga extra', 'Lo haces pero sin factura', 'Lo haces esta vez y luego lo corriges', 'Renuncias sin explicar'] }),
            this.buildReaction({ userId: u, prompt: '📞 ¡El SAT llama para una revisión urgente! ¡Prepara los documentos!', buttonLabel: '📋 ¡PREPARAR!', timeLimit: 4500 }),
            this.buildPoolChoice({ userId: u,
                question: '💰 ¿Cuál es la diferencia entre evasión y elusión fiscal?',
                correct: 'Evasión es ilegal; elusión usa vacíos legales',
                wrongPool: ['Son exactamente lo mismo', 'Elusión es siempre ilegal', 'Evasión es legal con montos pequeños', 'La elusión es peor', 'Depende del país siempre'] }),
            this.buildGuessNumber({ userId: u,
                question: '📈 Empresa con activos de $500K y pasivos de $300K. ¿Cuál es el capital?',
                correct: '$200,000', wrongPool: ['$800,000', '$150,000', '$300,000', '$250,000', '$100,000', '$400,000'] }),
            this.buildSequence({ userId: u,
                instruction: '📑 Ordena los estados financieros principales:',
                steps: [{ label: '📊 Balance General', order: 0 }, { label: '📈 Estado de Resultados', order: 1 }, { label: '💵 Flujo de Efectivo', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🏦 El cliente tiene una cuenta en Suiza que no ha declarado. ¿Qué le dices?',
                correct: 'Le explicas los riesgos y le orientas sobre regularización voluntaria',
                wrongPool: ['La registras en los libros normalmente', 'La ignoras, tú solo haces lo local', 'Lo denuncias de inmediato', 'Le dices que está bien así', 'Le cobras extra por el "servicio especial"'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  JOYERO
    // ─────────────────────────────────────────────
    getJoyeroGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '💍 Un anillo supuestamente de oro 24k no reacciona al ácido nítrico. ¿Qué es?',
                correct: 'Oro bañado o chapado (falso)',
                wrongPool: ['Oro puro de 24k confirmado', 'Platino', 'Plata con baño de oro', 'Titanio dorado', 'Oro blanco', 'Acero inoxidable dorado'] }),
            this.buildReaction({ userId: u, prompt: '💎 ¡Un diamante se cayó de la mesa! ¡Atrápalo!', buttonLabel: '✋ ¡ATRAPAR!', timeLimit: 3000 }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Collar de oro 18k, 15 gramos, oro a $60/gramo. ¿Cuánto vale?',
                correct: '$900', wrongPool: ['$750', '$1,050', '$600', '$1,200', '$800', '$1,000'] }),
            this.buildPoolChoice({ userId: u,
                question: '🔬 ¿Cómo distingues un diamante real de uno de cristal?',
                correct: 'Con el probador de conductividad térmica',
                wrongPool: ['Por el color bajo luz normal', 'Por el peso', 'Raspándolo con las uñas', 'Poniéndolo en agua', 'Por el brillo al sol', 'Mordiéndolo suavemente'] }),
            this.buildSequence({ userId: u,
                instruction: '💍 Ordena la reparación de un anillo:',
                steps: [{ label: '🔍 Evaluar el daño', order: 0 }, { label: '🔥 Soldar la pieza', order: 1 }, { label: '✨ Pulir y limpiar', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🤨 Un cliente quiere vender joyas de dudosa procedencia. ¿Qué haces?',
                correct: 'Pides documentación y si no tiene, rechazas',
                wrongPool: ['Las compras sin preguntar', 'Llamas a la policía de inmediato', 'Las compras más baratas', 'Las valutas pero no compras', 'Las recibes en consignación'] }),
            this.buildReaction({ userId: u, prompt: '🔭 ¡El cliente trae el diamante más grande que has visto! ¡Evalúalo!', buttonLabel: '🔬 ¡EVALUAR!', timeLimit: 4500 }),
            this.buildPoolChoice({ userId: u,
                question: '💎 ¿Qué significa que un diamante sea de "corte excelente"?',
                correct: 'Sus proporciones maximizan el brillo y destellos',
                wrongPool: ['Que es el más grande posible', 'Que no tiene ninguna inclusión', 'Que fue cortado a mano', 'Que es completamente incoloro', 'Que tiene certificado GIA únicamente'] }),
            this.buildPoolChoice({ userId: u,
                question: '🥇 ¿Qué significa "oro de 18 kilates"?',
                correct: '75% oro puro (18/24 partes)',
                wrongPool: ['100% oro puro', '50% oro', '90% oro', '60% oro', '80% oro', '18 gramos de oro puro'] }),
            this.buildGuessNumber({ userId: u,
                question: '💍 Anillo valuado en $2,000. El cliente pide 15% de descuento. ¿Cuánto paga?',
                correct: '$1,700', wrongPool: ['$1,500', '$1,800', '$1,600', '$1,750', '$1,900', '$1,650'] }),
            this.buildReaction({ userId: u, prompt: '⚡ ¡El soldador está a temperatura máxima! ¡Retira la pieza!', buttonLabel: '🔧 ¡RETIRAR!', timeLimit: 3500 }),
            this.buildPoolChoice({ userId: u,
                question: '📦 ¿Cómo guardas correctamente las joyas para evitar rayones?',
                correct: 'Cada pieza en compartimento separado con tela suave',
                wrongPool: ['Todas juntas en una caja', 'En bolsas de plástico zip', 'En el congelador para conservar', 'Colgadas todas juntas', 'En un frasco de agua', 'En papel de periódico'] }),
            this.buildPoolChoice({ userId: u,
                question: '🔴 ¿Cómo distingues un rubí de un granate a simple vista?',
                correct: 'El rubí tiene mayor dureza y brillo vítreo superior',
                wrongPool: ['Son idénticos, imposible sin laboratorio', 'El rubí es siempre más oscuro', 'El granate es siempre más grande', 'Por el precio en el mercado', 'El rubí siempre es redondo'] }),
            this.buildSequence({ userId: u,
                instruction: '✨ Ordena el proceso de limpieza de una joya de plata:',
                steps: [{ label: '🧴 Aplicar limpiador especial', order: 0 }, { label: '🪥 Frotar suavemente con cepillo', order: 1 }, { label: '💧 Enjuagar y secar completamente', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '💰 El cliente quiere el anillo de compromiso más impresionante por $500. ¿Qué recomiendas?',
                correct: 'Oro de 14k con moissanita — excelente relación calidad-precio',
                wrongPool: ['Diamante real de 2 quilates (imposible en ese precio)', 'Platino con rubí', 'Plata con circonita', 'Lo que sea que entre en el presupuesto sin importar calidad', 'Le dices que con $500 no hay nada decente'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  ACTOR
    // ─────────────────────────────────────────────
    getActorGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🎬 El director quiere que improvises una escena "apasionada". ¿Qué haces?',
                correct: 'Entras en personaje con total profesionalismo',
                wrongPool: ['Te quedas paralizado', 'Pides el guión completo', 'Llamas a tu agente', 'Preguntas cuánto pagan extra', 'Propones hacer la escena sin cámara primero'] }),
            this.buildReaction({ userId: u, prompt: '🎥 ¡EL DIRECTOR DICE "ACCIÓN"! ¡ES TU MOMENTO!', buttonLabel: '⭐ ¡ACTUAR!' }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Caché $800, agente cobra 20%. ¿Cuánto te llevas?',
                correct: '$640', wrongPool: ['$560', '$720', '$800', '$600', '$700', '$680'] }),
            this.buildPoolChoice({ userId: u,
                question: '😤 La co-estrella llegó 2 horas tarde al rodaje. ¿Qué haces?',
                correct: 'Lo reportas al productor profesionalmente',
                wrongPool: ['Le gritas en el set', 'Te vas tú también', 'Empiezas a grabar sin ella', 'Lo publicas en Instagram', 'Le cobras por tu tiempo perdido', 'Lo confrontas frente a todo el equipo'] }),
            this.buildSequence({ userId: u,
                instruction: '🎬 Ordena el proceso de un rodaje profesional:',
                steps: [{ label: '📋 Revisar el contrato y guión', order: 0 }, { label: '💆 Prepararte mentalmente', order: 1 }, { label: '🎥 Grabar la escena', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Un fan te reconoce en el supermercado y empieza a filmarte. ¿Qué haces?',
                correct: 'Pides amablemente que no te grabe',
                wrongPool: ['Poses para la cámara', 'Corres a esconderte', 'Le das un autógrafo', 'Le quitas el teléfono', 'Llamas a tu agente desde ahí', 'Finges no ser tú'] }),
            this.buildReaction({ userId: u, prompt: '🏆 ¡Ganaste el premio al mejor actor del año! ¡Da tu discurso!', buttonLabel: '🎤 ¡DISCURSO!', timeLimit: 5000 }),
            this.buildPoolChoice({ userId: u,
                question: '🎭 ¿Cuál es la regla más importante en un set de filmación?',
                correct: 'Respetar los límites acordados en el contrato',
                wrongPool: ['Hacer lo que el director pida sin importar qué', 'Nunca decir "no" en el set', 'Improvisar siempre para destacar', 'Llegar siempre primero que el director', 'No hablar con otros actores fuera del set'] }),
            this.buildPoolChoice({ userId: u,
                question: '💼 Alguien te ofrece un rol sin contrato escrito. ¿Qué haces?',
                correct: 'Exiges contrato antes de cualquier grabación',
                wrongPool: ['Aceptas por la oportunidad', 'Confías en la palabra', 'Pides la mitad del pago primero', 'Grabas una escena "de prueba"', 'Pides referencias de otros actores'] }),
            this.buildGuessNumber({ userId: u,
                question: '🎬 Filmaste 8 escenas a $200 c/u. Agente cobra 15%. ¿Cuánto ganas neto?',
                correct: '$1,360', wrongPool: ['$1,200', '$1,600', '$1,400', '$1,000', '$1,500', '$1,280'] }),
            this.buildReaction({ userId: u, prompt: '💡 ¡El foco principal se apagó y el director quiere seguir! ¡Improvisa!', buttonLabel: '🎭 ¡IMPROVISAR!', timeLimit: 4000 }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Un nuevo estudio quiere contratarte exclusivamente por 2 años. ¿Qué revisas?',
                correct: 'Cláusulas de exclusividad, pago, tipo de contenido y salida anticipada',
                wrongPool: ['Solo el salario', 'El nombre del director', 'Si otros actores famosos trabajan ahí', 'La ubicación del estudio', 'Si tienen buenas reseñas en Google'] }),
            this.buildPoolChoice({ userId: u,
                question: '😰 Sientes que una escena cruza tus límites personales. ¿Qué haces?',
                correct: 'Lo dices antes de empezar y negocias o rechazas',
                wrongPool: ['Lo aguantas porque ya firmaste', 'Te vas sin decir nada', 'Lo haces y luego demandas', 'Lloras en el baño y vuelves', 'Pides más dinero y lo haces'] }),
            this.buildSequence({ userId: u,
                instruction: '💰 Ordena cómo negociar tu caché:',
                steps: [{ label: '📊 Investigar tarifas del mercado', order: 0 }, { label: '💬 Negociar a través de tu agente', order: 1 }, { label: '✍️ Firmar contrato por escrito', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '🌟 Tu primera escena fue un éxito viral. El estudio quiere más contenido urgente. ¿Qué haces?',
                correct: 'Negocias nuevas condiciones antes de continuar',
                wrongPool: ['Aceptas todo igual', 'Subes tus precios al triple sin negociar', 'Desapareces para crear expectativa', 'Grabas gratis para mantener el momentum', 'Pides que paguen primero sin contrato'] }),
        ]).slice(0, 10);
    }

    // ─────────────────────────────────────────────
    //  SICARIO
    // ─────────────────────────────────────────────
    getSicarioGames(u) {
        return this.shuffle([
            this.buildPoolChoice({ userId: u,
                question: '🕶️ Tu contacto envió 3 fotos. Una no es el objetivo. ¿Cuál descartas?',
                correct: 'La foto borrosa de una mujer diferente',
                wrongPool: ['El hombre de traje gris con maletín', 'El tipo con guardaespaldas', 'El hombre en el restaurante descrito', 'La foto con el mismo auto del objetivo', 'La imagen con la misma ubicación'] }),
            this.buildReaction({ userId: u, prompt: '🚔 ¡DETECTARON TU POSICIÓN! ¡MUÉVETE AHORA!', buttonLabel: '🏃 ¡MOVERME!', timeLimit: 2500 }),
            this.buildSequence({ userId: u,
                instruction: '🎯 Ordena la operación de forma profesional:',
                steps: [{ label: '🔍 Reconocer el área', order: 0 }, { label: '⏰ Esperar el momento exacto', order: 1 }, { label: '🚗 Activar ruta de escape', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '📞 El cliente quiere cancelar el contrato a mitad. ¿Qué respondes?',
                correct: '"No hay devoluciones una vez iniciado"',
                wrongPool: ['"Entendido, te devuelvo todo"', '"Entonces eres el siguiente"', '"Me alegra, era muy riesgoso"', '"Puedo pausar por $500 extra"', '"Habla con mi abogado"'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Contrato $10,000. Intermediario cobra $2,500. ¿Cuánto queda?',
                correct: '$7,500', wrongPool: ['$6,500', '$8,000', '$5,000', '$7,000', '$8,500', '$6,000'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤔 Llegas al lugar y el objetivo está con un menor. ¿Qué haces?',
                correct: 'Abortas la misión y reprogramas',
                wrongPool: ['Procedes igual', 'Esperas pacientemente horas ahí mismo', 'Llamas al cliente para que decida', 'Cancelas el contrato permanentemente', 'Buscas otro ángulo para esa misma noche'] }),
            this.buildReaction({ userId: u, prompt: '🚨 ¡Alerta! ¡Hay un policía encubierto vigilándote! ¡Actúa normal!', buttonLabel: '😐 ¡CALMA!', timeLimit: 3000 }),
            this.buildPoolChoice({ userId: u,
                question: '💼 Un cliente nuevo quiere contratar un trabajo "urgente" sin verificación. ¿Qué haces?',
                correct: 'Rechazas — sin verificación previa no hay trato',
                wrongPool: ['Aceptas por el dinero extra', 'Pides el doble por la urgencia', 'Aceptas si paga 100% adelantado', 'Lo haces sin pensarlo', 'Le pides solo el nombre del objetivo'] }),
            this.buildPoolChoice({ userId: u,
                question: '🗺️ Tienes 3 rutas de escape posibles. ¿Cuál prefieres?',
                correct: 'La ruta secundaria menos obvia con transporte público disponible',
                wrongPool: ['La autopista más rápida', 'La ruta con menos cámaras pero un solo camino', 'Tu casa directamente', 'El aeropuerto inmediatamente', 'La misma ruta de entrada'] }),
            this.buildReaction({ userId: u, prompt: '🎯 ¡Ventana de oportunidad de 10 segundos! ¡Actúa!', buttonLabel: '⚡ ¡AHORA!', timeLimit: 2000 }),
            this.buildPoolChoice({ userId: u,
                question: '📱 Encuentras el teléfono del objetivo desbloqueado. ¿Qué haces?',
                correct: 'Lo ignoras — no estaba en el contrato y deja evidencia',
                wrongPool: ['Lo revisas por información valiosa', 'Te lo llevas', 'Lo usas para llamar al cliente', 'Borras los mensajes sospechosos', 'Lo dejas en otro lugar para confundir'] }),
            this.buildPoolChoice({ userId: u,
                question: '🤝 Un colega quiere asociarse contigo permanentemente. ¿Qué dices?',
                correct: '"Trabajo solo, es más seguro para ambos"',
                wrongPool: ['Aceptas de inmediato', 'Aceptas pero lo vigilas', 'Le preguntas su historial y aceptas', '"Solo en trabajos grandes"', '"Dame tiempo para investigarte"'] }),
            this.buildGuessNumber({ userId: u,
                question: '💰 Llevas 5 contratos este mes a $8,000 promedio. Gastos operativos: $12,000. ¿Ganancia?',
                correct: '$28,000', wrongPool: ['$40,000', '$20,000', '$32,000', '$25,000', '$35,000', '$18,000'] }),
            this.buildSequence({ userId: u,
                instruction: '🔒 Ordena cómo manejar información confidencial:',
                steps: [{ label: '🔐 Recibir info encriptada', order: 0 }, { label: '📋 Memorizar y destruir evidencia', order: 1 }, { label: '✅ Ejecutar sin dejar rastro', order: 2 }] }),
            this.buildPoolChoice({ userId: u,
                question: '😰 Sientes que llevan semanas siguiéndote. ¿Qué haces?',
                correct: 'Cambias completamente de rutina, apariencia y contactos',
                wrongPool: ['Sigues tu rutina para no parecer sospechoso', 'Confrontas a quien te sigue', 'Llamas a tu cliente para que te ayude', 'Te entregas a las autoridades', 'Huyes del país inmediatamente sin planear'] }),
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

        const timeLimit = game.type === 'reaction' ? game.timeLimit : this.TIMEOUT;

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('💼 Minijuego de Trabajo')
            .setDescription(`${game.question}\n\n⏰ Tienes **${timeLimit / 1000} segundos** para responder${streakText}`)
            .setFooter({ text: `Recompensa base: ${baseReward.toLocaleString()} π-b$` });

        if (game.type === 'sequence') {
            embed.addFields({ name: '📋 Pasos disponibles', value: game.shuffled.map(s => `• ${s.label}`).join('\n'), inline: false });
            embed.setDescription(`${game.question}\n\n📌 Presiona los botones **en el orden correcto**\n⏰ Tienes **${timeLimit / 1000} segundos**${streakText}`);
            this.activeGames.get(userId).sequenceProgress = [];
        }

        const sentMessage = await message.reply({ embeds: [embed], components: [game.row] });

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
        const embedColor = isCorrect ? '#00FF88' : '#FF4444';
        const title = isCorrect ? '✅ ¡Minijuego completado!' : '❌ Fallaste el minijuego';
        const description = isCorrect
            ? `¡Lo lograste! Recibirás tu sueldo completo.`
            : isIllegal
                ? `Algo salió muy mal...\n💸 **Perdiste ${Math.abs(reward).toLocaleString()} π-b$**`
                : `No era correcto.\n💰 **Recibirás ${reward.toLocaleString()} π-b$** (50% del sueldo)`;

        const resultEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: isCorrect ? '¡Sigue así para mantener la racha!' : 'La racha fue reseteada' });

        await interaction.update({ embeds: [resultEmbed], components: [] }).catch(async () => {
            await interaction.reply({ embeds: [resultEmbed] }).catch(() => {});
        });

        gameData.resolve?.({ success: isCorrect, isTimeout: false, reward, resetStreak: !isCorrect });
    }
}

module.exports = WorkMinigames;
