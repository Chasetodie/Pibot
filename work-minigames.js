const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ============================================================
//  WORK MINIGAMES SYSTEM
//  Cada trabajo tiene 6+ minijuegos aleatorios
//  Mecánicas: opción múltiple, reacción rápida, secuencia, adivinar número
// ============================================================

class WorkMinigames {
    constructor() {
        this.TIMEOUT = 20000; // 20 segundos por defecto
        this.REACTION_TIMEOUT = 4000; // 4 segundos para reacción rápida
        this.activeGames = new Map(); // userId -> gameData

        // Trabajos ilegales (penalización = pierden dinero)
        this.illegalJobs = ['criminal', 'vendedordelpunto', 'damadecomp', 'sicario', 'contador'];

        // Config de racha
        this.streakBonuses = [
            { streak: 10, bonus: 0.40, label: '🔥🔥🔥 ¡RACHA LEGENDARIA!' },
            { streak: 5,  bonus: 0.25, label: '🔥🔥 ¡Racha increíble!' },
            { streak: 3,  bonus: 0.15, label: '🔥 ¡En racha!' },
        ];
    }

    // ─────────────────────────────────────────────
    //  UTILIDADES
    // ─────────────────────────────────────────────

    getRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    getStreakBonus(streak) {
        for (const s of this.streakBonuses) {
            if (streak >= s.streak) return s;
        }
        return null;
    }

    isIllegal(jobType) {
        return this.illegalJobs.includes(jobType);
    }

    // Calcula la penalización según el trabajo y si hubo timeout
    getPenalty(jobType, baseReward, isTimeout = false) {
        if (this.isIllegal(jobType)) {
            return isTimeout ? -Math.floor(baseReward * 0.10) : -Math.floor(baseReward * 0.20);
        }
        return isTimeout ? Math.floor(baseReward * 0.25) : Math.floor(baseReward * 0.50);
    }

    // ─────────────────────────────────────────────
    //  BUILDERS DE MINIJUEGOS
    // ─────────────────────────────────────────────

    // Crea un minijuego de opción múltiple
    buildMultipleChoice({ question, options, correctIndex, userId, jobType }) {
        const shuffledOptions = this.shuffle(
            options.map((opt, i) => ({ label: opt, correct: i === correctIndex }))
        );

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

    // Crea un minijuego de reacción rápida
    buildReaction({ prompt, buttonLabel, userId, timeLimit = 4000 }) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`work_react_${userId}`)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Danger)
        );

        return { question: prompt, row, type: 'reaction', timeLimit };
    }

    // Crea un minijuego de secuencia
    buildSequence({ instruction, steps, userId }) {
        // steps: [{ label, order }]
        const shuffled = this.shuffle([...steps]);
        const row = new ActionRowBuilder().addComponents(
            shuffled.map((step, i) =>
                new ButtonBuilder()
                    .setCustomId(`work_seq_${userId}_${step.order}`)
                    .setLabel(step.label)
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        return { question: instruction, row, shuffled, steps, type: 'sequence', currentStep: 0 };
    }

    // Crea un minijuego de adivinar número/precio
    buildGuessNumber({ question, options, correctIndex, userId }) {
        const row = new ActionRowBuilder().addComponents(
            options.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`work_num_${userId}_${i}_${i === correctIndex}`)
                    .setLabel(opt.toString())
                    .setStyle(ButtonStyle.Success)
            )
        );

        return { question, row, type: 'guess_number' };
    }

    // ─────────────────────────────────────────────
    //  DEFINICIÓN DE MINIJUEGOS POR TRABAJO
    // ─────────────────────────────────────────────

    getMinigamesForJob(jobType, userId) {
        const games = {
            delivery: this.getDeliveryGames(userId),
            barista_casino: this.getBaristaGames(userId),
            pizzero: this.getPizzeroGames(userId),
            programmer: this.getProgrammerGames(userId),
            abrepuertasoxxo: this.getOxxoGames(userId),
            doctor: this.getDoctorGames(userId),
            botargadrsimi: this.getSimiGames(userId),
            criminal: this.getCriminalGames(userId),
            vendedordelpunto: this.getVendedorGames(userId),
            ofseller: this.getOfsellerGames(userId),
            damadecomp: this.getDamaGames(userId),
            paranormalinv: this.getParanormalGames(userId),
            streamer: this.getStreamerGames(userId),
            limpiador: this.getLimpiadorGames(userId),
            paseador: this.getPaseadorGames(userId),
            croupier: this.getCroupierGames(userId),
            bartender: this.getBartenderGames(userId),
            uber: this.getUberGames(userId),
            mecanico: this.getMecanicoGames(userId),
            joyero: this.getJoyeroGames(userId),
            contador: this.getContadorGames(userId),
            actor_porno: this.getActorGames(userId),
            sicario: this.getSicarioGames(userId),
        };

        return games[jobType] || null;
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: DELIVERY
    // ─────────────────────────────────────────────
    getDeliveryGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🗺️ Tienes 4 rutas para entregar. ¿Cuál es la más corta?',
                options: ['Ruta Norte: 15 min', 'Ruta Sur: 8 min', 'Ruta Este: 22 min', 'Ruta Oeste: 11 min'],
                correctIndex: 1, userId, jobType: 'delivery'
            }),
            this.buildReaction({
                prompt: '🚦 ¡El semáforo está en VERDE! ¡Arranca YA!',
                buttonLabel: '🚗 ¡ARRANCAR!', userId, timeLimit: 4000
            }),
            this.buildMultipleChoice({
                question: '📦 El cliente dice que pidió una pizza de pepperoni, pero tú traes una hawaiana. ¿Qué haces?',
                options: ['Entregas igual y te vas rápido', 'Llamas a la tienda y corriges el pedido', 'Culpas al cliente', 'Tiras la pizza y te vas'],
                correctIndex: 1, userId, jobType: 'delivery'
            }),
            this.buildSequence({
                instruction: '📋 Ordena las entregas de forma lógica para no dar vueltas innecesarias:',
                steps: [
                    { label: '🏠 Calle A (2km)', order: 0 },
                    { label: '🏢 Calle B (5km)', order: 2 },
                    { label: '🏬 Calle C (3km)', order: 1 },
                ],
                userId
            }),
            this.buildGuessNumber({
                question: '💰 La orden fue $45, el cliente paga con $100. ¿Cuánto le das de cambio?',
                options: ['$45', '$55', '$65', '$35'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🌧️ Está lloviendo a cántaros. Tu moto está rota. ¿Qué haces?',
                options: ['Cancelas todas las entregas', 'Tomas el bus y sigues entregando', 'Esperas a que pare la lluvia', 'Lloras en la esquina'],
                correctIndex: 1, userId, jobType: 'delivery'
            }),
            this.buildReaction({
                prompt: '🐕 ¡Un perro está persiguiendo tu moto! ¡Acelera!',
                buttonLabel: '💨 ¡ACELERAR!', userId, timeLimit: 3500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: BARISTA CASINO
    // ─────────────────────────────────────────────
    getBaristaGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '☕ Un cliente VIP pide un "Espresso Romano". ¿Qué lleva?',
                options: ['Espresso + leche', 'Espresso + rodaja de limón', 'Espresso + caramelo', 'Espresso + crema batida'],
                correctIndex: 1, userId, jobType: 'barista_casino'
            }),
            this.buildReaction({
                prompt: '😱 ¡Derramaste café sobre la mesa de blackjack! ¡Limpia AHORA!',
                buttonLabel: '🧹 ¡LIMPIAR!', userId, timeLimit: 3500
            }),
            this.buildGuessNumber({
                question: '🎰 El jugador ganó $5,000 en la ruleta y quiere darte propina del 5%. ¿Cuánto recibes?',
                options: ['$150', '$250', '$500', '$200'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '🍹 Un cliente pide un Mojito. Ordena los pasos correctamente:',
                steps: [
                    { label: '🌿 Muele la menta', order: 0 },
                    { label: '🧊 Agrega hielo', order: 2 },
                    { label: '🍋 Exprime el limón', order: 1 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '😤 Un jugador perdió todo y está siendo agresivo contigo. ¿Qué haces?',
                options: ['Le gritas de vuelta', 'Llamas a seguridad con calma', 'Le ofreces un trago gratis para calmarlo', 'Te escondes en el baño'],
                correctIndex: 1, userId, jobType: 'barista_casino'
            }),
            this.buildMultipleChoice({
                question: '🃏 ¿Cuál de estas bebidas NO existe en un casino de lujo?',
                options: ['Dry Martini', 'Negroni', 'Agua con Milo', 'Old Fashioned'],
                correctIndex: 2, userId, jobType: 'barista_casino'
            }),
            this.buildReaction({
                prompt: '🔔 ¡El gerente te llama! ¡Responde rápido o te descuentan!',
                buttonLabel: '📞 ¡CONTESTAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: PIZZERO
    // ─────────────────────────────────────────────
    getPizzeroGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🍕 Un cliente alérgico al gluten pide pizza. ¿Qué haces?',
                options: ['Le das la normal igual', 'Le ofreces base sin gluten', 'Le dices que no tienes opciones', 'Ignoras la alergia'],
                correctIndex: 1, userId, jobType: 'pizzero'
            }),
            this.buildReaction({
                prompt: '🔥 ¡La pizza se está QUEMANDO en el horno! ¡Sácala AHORA!',
                buttonLabel: '🧤 ¡SACAR!', userId, timeLimit: 3000
            }),
            this.buildGuessNumber({
                question: '🌡️ ¿A qué temperatura debe estar el horno para una pizza perfecta?',
                options: ['150°C', '220°C', '280°C', '350°C'],
                correctIndex: 2, userId
            }),
            this.buildSequence({
                instruction: '👨‍🍳 Ordena los pasos para hacer una pizza perfecta:',
                steps: [
                    { label: '🫙 Agregar salsa', order: 1 },
                    { label: '🍞 Preparar la masa', order: 0 },
                    { label: '🧀 Poner el queso', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '📞 El cliente llama furioso porque le llegó una pizza fría. ¿Qué le dices?',
                options: ['"Es culpa del delivery"', '"Le enviamos otra sin costo"', '"Caliéntela en el micro"', '"No es mi problema"'],
                correctIndex: 1, userId, jobType: 'pizzero'
            }),
            this.buildMultipleChoice({
                question: '🍕 ¿Cuál es el ingrediente clásico de una pizza Margherita?',
                options: ['Pepperoni', 'Albahaca fresca', 'Champiñones', 'Pimiento'],
                correctIndex: 1, userId, jobType: 'pizzero'
            }),
            this.buildReaction({
                prompt: '😱 ¡Hora pico! ¡10 pedidos de golpe! ¡Empieza a trabajar!',
                buttonLabel: '👊 ¡A TRABAJAR!', userId, timeLimit: 4500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: PROGRAMADOR
    // ─────────────────────────────────────────────
    getProgrammerGames(userId) {
        const bugGames = [
            this.buildMultipleChoice({
                question: '🐛 ¿Cuál línea tiene el bug?\n```\nlet x = 5;\nlet y = "3";\nlet z = x + y;\nconsole.log(z);\n```',
                options: ['let x = 5', 'let y = "3"  ← concatena string', 'let z = x + y', 'console.log(z)'],
                correctIndex: 1, userId, jobType: 'programmer'
            }),
            this.buildMultipleChoice({
                question: '💻 El cliente quiere un botón que "haga cosas". ¿Cuál es tu mejor respuesta?',
                options: ['"Claro, ¿qué cosas específicamente?"', '"Eso no es posible"', '"Hecho, dame 2 minutos"', '"Eso cuesta extra"'],
                correctIndex: 0, userId, jobType: 'programmer'
            }),
        ];

        return [
            ...bugGames,
            this.buildReaction({
                prompt: '🚨 ¡EL SERVIDOR SE ESTÁ CAYENDO EN PRODUCCIÓN! ¡REINICIA YA!',
                buttonLabel: '🔄 ¡REINICIAR!', userId, timeLimit: 5000
            }),
            this.buildSequence({
                instruction: '🚀 Ordena los pasos correctos para hacer un deploy:',
                steps: [
                    { label: '🧪 Correr tests', order: 1 },
                    { label: '📦 Build del proyecto', order: 0 },
                    { label: '☁️ Deploy a producción', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '⚡ ¿Qué algoritmo de ordenamiento es más eficiente para grandes listas?',
                options: ['Bubble Sort O(n²)', 'Quick Sort O(n log n)', 'Insertion Sort O(n²)', 'Selection Sort O(n²)'],
                correctIndex: 1, userId, jobType: 'programmer'
            }),
            this.buildGuessNumber({
                question: '💰 El cliente quiere cambios "pequeños" en la app. ¿Cuántas horas cobras?',
                options: ['1 hora', '4 horas', '8 horas', '2 horas'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🎯 Un junior rompió la rama main en git. ¿Qué haces primero?',
                options: ['Renunciar', 'git revert al último commit estable', 'Culpar al junior', 'Apagar el servidor'],
                correctIndex: 1, userId, jobType: 'programmer'
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: ABRE PUERTAS OXXO
    // ─────────────────────────────────────────────
    getOxxoGames(userId) {
        return [
            this.buildReaction({
                prompt: '🚪 ¡Es tu turno de abrir! ¡Presiona ABRIR ahora!',
                buttonLabel: '🔑 ¡ABRIR!', userId, timeLimit: 3000
            }),
            this.buildMultipleChoice({
                question: '🕐 Tu turno de apertura es a las 6am. El reloj marca las 5:59. ¿Qué haces?',
                options: ['Abres un minuto antes', 'Esperas exactamente a las 6:00', 'Llegas a las 6:15', 'Mandas a alguien más'],
                correctIndex: 1, userId, jobType: 'abrepuertasoxxo'
            }),
            this.buildSequence({
                instruction: '🔐 Protocolo de apertura del Oxxo. Ordena los pasos:',
                steps: [
                    { label: '🔍 Verificar área', order: 0 },
                    { label: '🔑 Desactivar alarma', order: 1 },
                    { label: '🚪 Abrir puertas', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '👤 Un tipo sospechoso merodeó toda la noche afuera. ¿Qué haces al abrir?',
                options: ['Abres normal y rezas', 'Llamas a seguridad y esperas', 'Abres y le preguntas qué quiere', 'No abres ese día'],
                correctIndex: 1, userId, jobType: 'abrepuertasoxxo'
            }),
            this.buildGuessNumber({
                question: '⏰ La alarma tiene 30 segundos antes de activarse. ¿Cuántos segundos tienes para ingresar el código?',
                options: ['10 seg', '20 seg', '30 seg', '45 seg'],
                correctIndex: 2, userId
            }),
            this.buildReaction({
                prompt: '🚨 ¡La alarma se activó por accidente! ¡Desactívala RÁPIDO!',
                buttonLabel: '🔴 ¡DESACTIVAR!', userId, timeLimit: 3500
            }),
            this.buildMultipleChoice({
                question: '💡 Al abrir, notas que falta mercancía del mostrador. ¿Qué haces?',
                options: ['Ignoras y sigues', 'Reportas al encargado y documentas', 'Culpas al turno anterior', 'Llenas el faltante de tu bolsillo'],
                correctIndex: 1, userId, jobType: 'abrepuertasoxxo'
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: DOCTOR
    // ─────────────────────────────────────────────
    getDoctorGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🩺 Paciente con fiebre de 39°C, dolor de garganta y ganglios inflamados. ¿Diagnóstico más probable?',
                options: ['Gripe común', 'Amigdalitis bacteriana', 'COVID-19', 'Alergia estacional'],
                correctIndex: 1, userId, jobType: 'doctor'
            }),
            this.buildReaction({
                prompt: '💔 ¡PACIENTE EN PARO CARDÍACO! ¡USA EL DESFIBRILADOR!',
                buttonLabel: '⚡ ¡DESFIBRILA!', userId, timeLimit: 4000
            }),
            this.buildGuessNumber({
                question: '💊 Paciente de 70kg necesita 10mg/kg de medicamento. ¿Cuántos mg administras?',
                options: ['500mg', '700mg', '1000mg', '350mg'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '🏥 Ordena los pasos de una cirugía de emergencia:',
                steps: [
                    { label: '💉 Anestesia', order: 0 },
                    { label: '🔪 Incisión', order: 1 },
                    { label: '🩹 Sutura', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '⚠️ El paciente es alérgico a la penicilina y necesita antibiótico. ¿Qué usas?',
                options: ['Amoxicilina (derivado de penicilina)', 'Azitromicina', 'Ampicilina', 'Cloxacilina'],
                correctIndex: 1, userId, jobType: 'doctor'
            }),
            this.buildMultipleChoice({
                question: '🧠 Paciente con dolor de cabeza repentino "el peor de su vida". ¿Qué sospechas?',
                options: ['Migraña común', 'Hemorragia subaracnoidea', 'Tensión muscular', 'Deshidratación'],
                correctIndex: 1, userId, jobType: 'doctor'
            }),
            this.buildReaction({
                prompt: '🩸 ¡El paciente está sangrando! ¡Aplica presión AHORA!',
                buttonLabel: '🖐️ ¡PRESIONAR!', userId, timeLimit: 3500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: BOTARGA DR. SIMI
    // ─────────────────────────────────────────────
    getSimiGames(userId) {
        return [
            this.buildSequence({
                instruction: '🕺 ¡Ejecuta el baile icónico del Doctor Simi! Sigue la secuencia:',
                steps: [
                    { label: '🙌 Palmas arriba', order: 0 },
                    { label: '💃 Giro completo', order: 1 },
                    { label: '🎉 Salto final', order: 2 },
                ],
                userId
            }),
            this.buildReaction({
                prompt: '📸 ¡Un niño quiere foto con el Doctor Simi! ¡Posa AHORA!',
                buttonLabel: '😄 ¡POSAR!', userId, timeLimit: 3000
            }),
            this.buildMultipleChoice({
                question: '🌡️ Llevas 3 horas dentro de la botarga con 35°C. ¿Cuándo tomas descanso?',
                options: ['Aguantas hasta el final', 'Cada hora tomas 10 minutos', 'Cuando ya no puedas respirar', 'Nunca, eres profesional'],
                correctIndex: 1, userId, jobType: 'botargadrsimi'
            }),
            this.buildMultipleChoice({
                question: '🎵 ¿Cuál es el jingle correcto del Doctor Simi?',
                options: ['"Por tu salud, por tu bien"', '"Similares, los mismos"', '"Primero la salud"', '"Doctor Simi, tu amigo"'],
                correctIndex: 1, userId, jobType: 'botargadrsimi'
            }),
            this.buildMultipleChoice({
                question: '😤 Un adulto borracho quiere pelear con la botarga. ¿Qué haces?',
                options: ['Le pegas con el disfraz', 'Te alejas y llamas a seguridad', 'Te quitas la botarga y le hablas', 'Bailas más fuerte para ignorarlo'],
                correctIndex: 1, userId, jobType: 'botargadrsimi'
            }),
            this.buildReaction({
                prompt: '💃 ¡Están tocando tu canción en el evento! ¡Empieza a bailar!',
                buttonLabel: '🎶 ¡BAILAR!', userId, timeLimit: 3500
            }),
            this.buildGuessNumber({
                question: '💰 Trabajaste 8 horas como botarga. El pago es $15/hora. ¿Cuánto ganas?',
                options: ['$100', '$120', '$150', '$80'],
                correctIndex: 1, userId
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: CRIMINAL
    // ─────────────────────────────────────────────
    getCriminalGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🕵️ Necesitas escapar. ¿Qué ruta eliges?',
                options: ['Calle principal (hay patrullas)', 'Callejón trasero (despejado)', 'Plaza central (muchos testigos)', 'Metro (cámaras por todos lados)'],
                correctIndex: 1, userId, jobType: 'criminal'
            }),
            this.buildReaction({
                prompt: '🚔 ¡LLEGA LA POLICÍA! ¡ESCÓNDETE AHORA!',
                buttonLabel: '🏃 ¡ESCONDERSE!', userId, timeLimit: 3000
            }),
            this.buildMultipleChoice({
                question: '🤔 Uno de tus 3 "clientes" parece policía encubierto. ¿Cuál es?',
                options: ['El que lleva ropa de trabajo sucia', 'El que tiene auricular en la oreja', 'El que está nervioso', 'El que masca chicle'],
                correctIndex: 1, userId, jobType: 'criminal'
            }),
            this.buildSequence({
                instruction: '📦 Ordena el intercambio para no levantar sospechas:',
                steps: [
                    { label: '👀 Verificar el área', order: 0 },
                    { label: '🤝 Confirmar con el contacto', order: 1 },
                    { label: '💼 Hacer el intercambio', order: 2 },
                ],
                userId
            }),
            this.buildGuessNumber({
                question: '💸 El trato fue por $500, pero el comprador solo trae $350. ¿Cuánto le faltan?',
                options: ['$100', '$150', '$200', '$250'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🔐 La contraseña del punto de entrega es el nombre de un pez. ¿Cuál es más sospechoso decir en público?',
                options: ['"Tiburón"', '"Piraña"', '"Sardina"', '"Salmón"'],
                correctIndex: 0, userId, jobType: 'criminal'
            }),
            this.buildReaction({
                prompt: '🚨 ¡Alguien te reconoció! ¡Actúa normal RÁPIDO!',
                buttonLabel: '😐 ¡CARA POKER!', userId, timeLimit: 3500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: VENDEDOR DEL PUNTO
    // ─────────────────────────────────────────────
    getVendedorGames(userId) {
        return [
            this.buildGuessNumber({
                question: '💰 El producto te costó $200. ¿Qué precio maximiza ganancia sin ahuyentar al cliente?',
                options: ['$250', '$320', '$500', '$180'],
                correctIndex: 1, userId
            }),
            this.buildReaction({
                prompt: '👮 ¡PASÓ UNA PATRULLA! ¡ACTÚA NORMAL!',
                buttonLabel: '😇 ¡NORMAL!', userId, timeLimit: 3000
            }),
            this.buildMultipleChoice({
                question: '😒 El cliente desconfía de la calidad. ¿Cómo lo convences?',
                options: ['Le juras que es bueno', 'Le ofreces una pequeña muestra gratis', 'Le bajas el precio a la mitad', 'Le dices que es lo único disponible'],
                correctIndex: 1, userId, jobType: 'vendedordelpunto'
            }),
            this.buildGuessNumber({
                question: '💵 El cliente paga con 3 billetes de $100 y el precio era $280. ¿Cuánto de cambio?',
                options: ['$10', '$20', '$30', '$40'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '🤫 Ordena los pasos de una entrega segura:',
                steps: [
                    { label: '👀 Chequear el área', order: 0 },
                    { label: '📲 Confirmar con el cliente', order: 1 },
                    { label: '💼 Entregar y cobrar', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '🤝 El proveedor te ofrece más producto pero quiere el doble por adelantado. ¿Qué haces?',
                options: ['Pagas todo de inmediato', 'Negocias: mitad ahora, mitad al recibir', 'Rechazas la oferta', 'Pides fiado'],
                correctIndex: 1, userId, jobType: 'vendedordelpunto'
            }),
            this.buildReaction({
                prompt: '🔦 ¡Una linterna te apunta! ¡Corre!',
                buttonLabel: '🏃 ¡CORRER!', userId, timeLimit: 2500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: OF SELLER
    // ─────────────────────────────────────────────
    getOfsellerGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '📸 ¿Cuál es el mejor título para tu publicación?',
                options: ['"Foto mía"', '"Contenido exclusivo para mis fans más especiales 💋"', '"Nuevo post disponible"', '"Miren esto"'],
                correctIndex: 1, userId, jobType: 'ofseller'
            }),
            this.buildGuessNumber({
                question: '💰 Tu contenido básico cuesta $10, el VIP $25. Un fan quiere ambos. ¿Cuánto cobras?',
                options: ['$30', '$35', '$40', '$25'],
                correctIndex: 1, userId
            }),
            this.buildReaction({
                prompt: '✅ ¡El sitio pide verificación de identidad! ¡Complétala AHORA!',
                buttonLabel: '📋 ¡VERIFICAR!', userId, timeLimit: 4000
            }),
            this.buildMultipleChoice({
                question: '💬 Un suscriptor VIP pregunta si hay contenido nuevo. ¿Qué respondes?',
                options: ['"Sí, en un rato"', '"Claro mi amor, acabo de subir algo especial solo para ti 😘"', '"Revisa mi perfil"', '"No tengo tiempo ahora"'],
                correctIndex: 1, userId, jobType: 'ofseller'
            }),
            this.buildSequence({
                instruction: '📤 Ordena los pasos para publicar contenido exitosamente:',
                steps: [
                    { label: '📸 Tomar la foto', order: 0 },
                    { label: '🏷️ Agregar precio y tags', order: 2 },
                    { label: '✏️ Escribir descripción', order: 1 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '📉 Otra creadora bajó sus precios a la mitad. ¿Tu estrategia?',
                options: ['Bajas precios igual', 'Mejoras la calidad y subes precios', 'Atacas a la competencia en redes', 'Cierras la cuenta'],
                correctIndex: 1, userId, jobType: 'ofseller'
            }),
            this.buildReaction({
                prompt: '💰 ¡Llegó una donación enorme! ¡Agradécela RÁPIDO antes de que se arrepientan!',
                buttonLabel: '🙏 ¡AGRADECER!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: DAMA DE COMPAÑÍA
    // ─────────────────────────────────────────────
    getDamaGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '👥 Tres perfiles de clientes. ¿Cuál eliges?',
                options: ['El que ofrece más pero tiene reseñas malas', 'El regular de buen trato y pago puntual', 'El nuevo sin historial', 'El que negocia demasiado el precio'],
                correctIndex: 1, userId, jobType: 'damadecomp'
            }),
            this.buildReaction({
                prompt: '🚔 ¡LLEGÓ LA POLICÍA AL HOTEL! ¡SAL POR LA ESCALERA DE EMERGENCIA!',
                buttonLabel: '🚪 ¡ESCAPAR!', userId, timeLimit: 3000
            }),
            this.buildGuessNumber({
                question: '💰 El cliente quiere un descuento del 20% sobre $300. ¿Cuánto pagaría?',
                options: ['$220', '$240', '$260', '$280'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '📍 ¿Dónde propones el encuentro más discreto?',
                options: ['Tu casa', 'Hotel de paso conocido y seguro', 'Parque público', 'Bar del centro'],
                correctIndex: 1, userId, jobType: 'damadecomp'
            }),
            this.buildSequence({
                instruction: '💋 Para maximizar la propina, ordena la estrategia de la noche:',
                steps: [
                    { label: '😊 Generar confianza', order: 0 },
                    { label: '🥂 Cena agradable', order: 1 },
                    { label: '💰 Cobrar + propina', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '😠 El cliente está siendo irrespetuoso. ¿Qué haces?',
                options: ['Lo aguantas por el dinero', 'Pones límites y si no respeta, te vas', 'Le pides más dinero', 'Lo ignoras completamente'],
                correctIndex: 1, userId, jobType: 'damadecomp'
            }),
            this.buildReaction({
                prompt: '💸 ¡El cliente quiere pagar y se le está haciendo tarde! ¡Cobra AHORA!',
                buttonLabel: '💰 ¡COBRAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: INVESTIGADOR PARANORMAL
    // ─────────────────────────────────────────────
    getParanormalGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '👻 El EMF sube al nivel 5 en la cocina. ¿Qué instrumento usas para confirmar?',
                options: ['Termómetro infrarrojo', 'Grabadora de voz (EVP)', 'Cámara UV', 'Detector de humo'],
                correctIndex: 1, userId, jobType: 'paranormalinv'
            }),
            this.buildReaction({
                prompt: '😱 ¡ALGO SE MOVIÓ EN LA ESQUINA! ¡GRABA AHORA!',
                buttonLabel: '🎥 ¡GRABAR!', userId, timeLimit: 3000
            }),
            this.buildMultipleChoice({
                question: '🌡️ La temperatura bajó 10°C de golpe en una habitación. ¿Qué significa?',
                options: ['El aire acondicionado está roto', 'Presencia paranormal posible (punto frío)', 'La ventana está abierta', 'Es normal en casas viejas'],
                correctIndex: 1, userId, jobType: 'paranormalinv'
            }),
            this.buildSequence({
                instruction: '🔍 Ordena el protocolo de investigación paranormal:',
                steps: [
                    { label: '📊 Medir niveles base', order: 0 },
                    { label: '🚶 Recorrer el lugar', order: 1 },
                    { label: '📝 Documentar evidencias', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '🎭 El cliente claramente está actuando los "fenómenos". ¿Cómo lo descubres?',
                options: ['Le acusas directamente', 'Instalas cámaras ocultas sin decirle', 'Cambias el horario de investigación sin avisar', 'Ignoras las señales'],
                correctIndex: 2, userId, jobType: 'paranormalinv'
            }),
            this.buildMultipleChoice({
                question: '👤 ¿Qué tipo de entidad mueve objetos físicos pero no se comunica?',
                options: ['Fantasma consciente', 'Poltergeist', 'Demonio', 'Eco residual'],
                correctIndex: 1, userId, jobType: 'paranormalinv'
            }),
            this.buildReaction({
                prompt: '📡 ¡El detector de movimiento se activó solo! ¡Analiza la señal!',
                buttonLabel: '🔍 ¡ANALIZAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: STREAMER (NUEVO)
    // ─────────────────────────────────────────────
    getStreamerGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '💬 Tu chat está spameando "PogChamp" sin parar. ¿Qué haces?',
                options: ['Baneas a todos', 'Reaccionas con energía y agradeces el hype', 'Ignoras el chat', 'Apagas el stream'],
                correctIndex: 1, userId, jobType: 'streamer'
            }),
            this.buildReaction({
                prompt: '🔴 ¡Un suscriptor de 5 años acaba de subscribirse! ¡Agradécelo AHORA!',
                buttonLabel: '🎉 ¡HYPE!', userId, timeLimit: 4000
            }),
            this.buildGuessNumber({
                question: '💰 Tienes 1000 subs a $5/mes. Twitch se queda el 50%. ¿Cuánto ganas al mes?',
                options: ['$2,000', '$2,500', '$3,000', '$5,000'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '🎮 Ordena cómo manejar un raid de 500 personas en tu stream:',
                steps: [
                    { label: '👋 Dar bienvenida al raider', order: 0 },
                    { label: '📢 Presentarte al nuevo público', order: 1 },
                    { label: '🎮 Continuar con el contenido', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '😡 Un troll está siendo tóxico en el chat. ¿Qué haces?',
                options: ['Peleas con él en el stream', 'Timeout + sigues con el stream normal', 'Cierras el chat para todos', 'Lloras en cámara'],
                correctIndex: 1, userId, jobType: 'streamer'
            }),
            this.buildMultipleChoice({
                question: '🌐 Tu internet se cayó a mitad del stream. ¿Qué publicas en redes?',
                options: ['Nada, te escondes', '"Tuve problemas técnicos, vuelvo en X minutos 🔧"', '"El stream terminó para siempre"', '"Culpa del proveedor de internet"'],
                correctIndex: 1, userId, jobType: 'streamer'
            }),
            this.buildReaction({
                prompt: '💸 ¡Una donación de $100 en plena gameplay! ¡Reacciona antes de que el chat lo note!',
                buttonLabel: '😱 ¡REACCIONAR!', userId, timeLimit: 5000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: LIMPIADOR DE OFICINAS (NUEVO)
    // ─────────────────────────────────────────────
    getLimpiadorGames(userId) {
        return [
            this.buildSequence({
                instruction: '🧹 Ordena la rutina de limpieza correcta:',
                steps: [
                    { label: '🪣 Preparar materiales', order: 0 },
                    { label: '🧹 Barrer antes de trapear', order: 1 },
                    { label: '🧽 Limpiar superficies', order: 2 },
                ],
                userId
            }),
            this.buildReaction({
                prompt: '😱 ¡Volcaste el balde de agua sucia en la alfombra del jefe! ¡Limpia RÁPIDO!',
                buttonLabel: '🧻 ¡LIMPIAR!', userId, timeLimit: 3500
            }),
            this.buildMultipleChoice({
                question: '🔍 Al limpiar encuentras un sobre con $500 en el cajón del gerente. ¿Qué haces?',
                options: ['Te lo quedas', 'Lo dejas exactamente donde estaba', 'Lo reportas a recursos humanos', 'Lo escondes para devolverlo luego'],
                correctIndex: 1, userId, jobType: 'limpiador'
            }),
            this.buildMultipleChoice({
                question: '🚽 El baño de hombres está en un estado apocalíptico. ¿Por dónde empiezas?',
                options: ['Pisos primero', 'Inodoros con desinfectante primero', 'Llamas a un exorcista', 'Lavabos primero'],
                correctIndex: 1, userId, jobType: 'limpiador'
            }),
            this.buildGuessNumber({
                question: '⏰ Tienes 2 horas para limpiar 10 oficinas. ¿Cuántos minutos por oficina?',
                options: ['10 min', '12 min', '15 min', '8 min'],
                correctIndex: 1, userId
            }),
            this.buildReaction({
                prompt: '🔒 ¡La alarma del edificio se activó por accidente! ¡Desactívala!',
                buttonLabel: '🔴 ¡CÓDIGO!', userId, timeLimit: 4000
            }),
            this.buildMultipleChoice({
                question: '🎧 Son las 2am, estás limpiando solo y escuchas ruidos en el piso 13. ¿Qué haces?',
                options: ['Investigas solo', 'Llamas a seguridad del edificio', 'Sales corriendo', 'Ignoras y sigues trabajando'],
                correctIndex: 1, userId, jobType: 'limpiador'
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: PASEADOR DE PERROS (NUEVO)
    // ─────────────────────────────────────────────
    getPaseadorGames(userId) {
        return [
            this.buildReaction({
                prompt: '🐕 ¡El Golden Retriever vio una ardilla y salió disparado! ¡Aguanta la correa!',
                buttonLabel: '💪 ¡AGUANTAR!', userId, timeLimit: 3500
            }),
            this.buildMultipleChoice({
                question: '🐕🐕🐕 Tienes 5 perros. El Chihuahua y el Rottweiler están a punto de pelearse. ¿Qué haces?',
                options: ['Los dejas pelear', 'Los separas inmediatamente y cambias de ruta', 'Gritas fuerte para asustarlos', 'Sueltas las correas para que corran'],
                correctIndex: 1, userId, jobType: 'paseador'
            }),
            this.buildGuessNumber({
                question: '💰 Cobras $15 por perro y paseas 5 perros, 3 veces por semana. ¿Cuánto ganas en la semana?',
                options: ['$175', '$225', '$250', '$200'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '🎒 Ordena la preparación antes del paseo:',
                steps: [
                    { label: '🔍 Revisar las correas', order: 0 },
                    { label: '💧 Llevar agua y bolsas', order: 1 },
                    { label: '🐕 Recoger a los perros', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '🌧️ Empieza a llover fuerte. ¿Qué haces con los perros?',
                options: ['Los dejas mojarse', 'Buscas refugio y avisas a los dueños', 'Terminas el paseo de inmediato', 'Los atas a un árbol y esperas'],
                correctIndex: 1, userId, jobType: 'paseador'
            }),
            this.buildReaction({
                prompt: '🚗 ¡Un carro casi atropella a uno de los perros! ¡Jálalo!',
                buttonLabel: '🐕 ¡JALEAR!', userId, timeLimit: 2500
            }),
            this.buildMultipleChoice({
                question: '💩 El Labrador hizo sus necesidades y el dueño del parque te está mirando. ¿Qué haces?',
                options: ['Finges no ver nada', 'Recoges con la bolsa sin dudar', 'Culpas a otro perro', 'Sales corriendo del parque'],
                correctIndex: 1, userId, jobType: 'paseador'
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: CROUPIER (NUEVO)
    // ─────────────────────────────────────────────
    getCroupierGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🎰 En blackjack, el jugador tiene 16 y el croupier muestra un 7. ¿Qué hace el jugador correctamente?',
                options: ['Se planta con 16', 'Pide carta', 'Dobla la apuesta', 'Se rinde'],
                correctIndex: 1, userId, jobType: 'croupier'
            }),
            this.buildReaction({
                prompt: '🎴 ¡Es tu turno de repartir las cartas! ¡Hazlo RÁPIDO!',
                buttonLabel: '🃏 ¡REPARTIR!', userId, timeLimit: 3500
            }),
            this.buildGuessNumber({
                question: '🎲 En ruleta, el número 7 es rojo. Un jugador apuesta $200 al rojo. Si gana, ¿cuánto recibe?',
                options: ['$200', '$400', '$600', '$100'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '😤 Un jugador acusa al casino de hacer trampa. ¿Cómo respondes?',
                options: ['Te pones nervioso y te disculpas', 'Llamas al supervisor con calma', 'Le dices que tiene razón', 'Ignoras al jugador'],
                correctIndex: 1, userId, jobType: 'croupier'
            }),
            this.buildSequence({
                instruction: '🃏 Ordena el protocolo de inicio de una mesa de blackjack:',
                steps: [
                    { label: '🔀 Barajar el mazo', order: 0 },
                    { label: '💰 Recolectar apuestas', order: 1 },
                    { label: '🃏 Repartir las cartas', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '🎰 ¿Cuál es la ventaja de la casa en la ruleta americana?',
                options: ['2.7%', '5.26%', '1%', '10%'],
                correctIndex: 1, userId, jobType: 'croupier'
            }),
            this.buildReaction({
                prompt: '👁️ ¡Detectaste a alguien contando cartas! ¡Avisa a seguridad!',
                buttonLabel: '🚨 ¡AVISAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: BARTENDER (NUEVO)
    // ─────────────────────────────────────────────
    getBartenderGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🍸 ¿Qué lleva un Cosmopolitan clásico?',
                options: ['Vodka, jugo de arándano, triple sec, limón', 'Gin, vermut, aceituna', 'Tequila, sal, limón', 'Ron, coca-cola, limón'],
                correctIndex: 0, userId, jobType: 'bartender'
            }),
            this.buildReaction({
                prompt: '🔥 ¡El cliente quiere un trago flameado! ¡Enciéndelo AHORA antes de que se enfríe!',
                buttonLabel: '🔥 ¡ENCENDER!', userId, timeLimit: 3500
            }),
            this.buildSequence({
                instruction: '🍹 Prepara un Mojito en el orden correcto:',
                steps: [
                    { label: '🌿 Muele la menta con azúcar', order: 0 },
                    { label: '🥃 Agrega ron y hielo', order: 1 },
                    { label: '🫧 Completa con soda', order: 2 },
                ],
                userId
            }),
            this.buildGuessNumber({
                question: '🍺 La cuenta del cliente es $47.50. Paga con $60. ¿Cuánto de cambio?',
                options: ['$10.50', '$12.50', '$13.50', '$15'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🥴 Un cliente ya está muy borracho y pide otro trago. ¿Qué haces?',
                options: ['Le sirves igual', 'Le ofreces agua y le dices que es suficiente', 'Le cobras extra', 'Llamas a la policía'],
                correctIndex: 1, userId, jobType: 'bartender'
            }),
            this.buildMultipleChoice({
                question: '🎂 Un grupo pide shots para celebrar. Son 8 personas. ¿Cuántas botellas de tequila de 750ml necesitas para 2 shots cada uno?',
                options: ['1 botella (alcanza)', '2 botellas (seguro)', '3 botellas', 'Media botella'],
                correctIndex: 0, userId, jobType: 'bartender'
            }),
            this.buildReaction({
                prompt: '📞 ¡Te llaman desde la cocina que hay una emergencia! ¡Responde!',
                buttonLabel: '📞 ¡CONTESTAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: UBER (NUEVO)
    // ─────────────────────────────────────────────
    getUberGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🗺️ El GPS dice una ruta, pero sabes que hay obras en esa calle. ¿Qué haces?',
                options: ['Sigues el GPS ciegamente', 'Tomas la ruta alterna que conoces', 'Le preguntas al pasajero', 'Cancelas el viaje'],
                correctIndex: 1, userId, jobType: 'uber'
            }),
            this.buildReaction({
                prompt: '🟢 ¡Llegó una solicitud a 2 minutos de distancia! ¡Acéptala RÁPIDO!',
                buttonLabel: '✅ ¡ACEPTAR!', userId, timeLimit: 4000
            }),
            this.buildGuessNumber({
                question: '💰 El viaje fue de 15km a $1.20/km + $2 base. ¿Cuánto cobra el viaje?',
                options: ['$18', '$20', '$22', '$25'],
                correctIndex: 2, userId
            }),
            this.buildMultipleChoice({
                question: '🤔 El pasajero huele muy mal y el viaje dura 40 minutos. ¿Qué haces?',
                options: ['Le dices que baje del carro', 'Abres las ventanas discretamente y aguantas', 'Cancelas el viaje', 'Te pones mascarilla dramáticamente'],
                correctIndex: 1, userId, jobType: 'uber'
            }),
            this.buildSequence({
                instruction: '⭐ Para mantener 5 estrellas, ordena las prioridades:',
                steps: [
                    { label: '🚗 Auto limpio y con buen olor', order: 0 },
                    { label: '🗺️ Ruta eficiente', order: 1 },
                    { label: '😊 Actitud amable', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '😤 El pasajero te da una estrella injustamente. ¿Qué haces?',
                options: ['Le escribes insultos', 'Reportas el viaje a Uber Support', 'Te quedas callado y aceptas', 'Dejas de trabajar'],
                correctIndex: 1, userId, jobType: 'uber'
            }),
            this.buildReaction({
                prompt: '🚨 ¡Un policía te hace parar! ¡Baja la velocidad AHORA!',
                buttonLabel: '🛑 ¡FRENAR!', userId, timeLimit: 3000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: MECÁNICO (NUEVO)
    // ─────────────────────────────────────────────
    getMecanicoGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🔧 El cliente dice que el carro "hace un ruido raro al frenar". ¿Qué revisas primero?',
                options: ['El motor', 'Los discos y pastillas de freno', 'La batería', 'El aceite'],
                correctIndex: 1, userId, jobType: 'mecanico'
            }),
            this.buildReaction({
                prompt: '🔥 ¡El motor del carro está sobrecalentado! ¡Apágalo RÁPIDO!',
                buttonLabel: '🔑 ¡APAGAR!', userId, timeLimit: 3500
            }),
            this.buildSequence({
                instruction: '🛢️ Ordena el proceso correcto de un cambio de aceite:',
                steps: [
                    { label: '🔩 Drenar el aceite viejo', order: 0 },
                    { label: '🔧 Cambiar el filtro', order: 1 },
                    { label: '🛢️ Llenar con aceite nuevo', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '💡 El Check Engine está encendido. ¿Qué es lo primero que haces?',
                options: ['Lo ignoras', 'Conectas el escáner OBD para leer el código de falla', 'Cambias la batería', 'Cambias todo el motor'],
                correctIndex: 1, userId, jobType: 'mecanico'
            }),
            this.buildGuessNumber({
                question: '💰 La reparación cuesta $350 en piezas y 3 horas de trabajo a $50/hora. ¿Cuánto cobra el total?',
                options: ['$450', '$500', '$550', '$400'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🔋 El cliente regresa porque el carro que "reparaste" no enciende. ¿Qué haces?',
                options: ['Niegas haber tocado la batería', 'Revisas sin costo adicional hasta encontrar la falla', 'Le cobras otra consulta', 'Le dices que es otro problema'],
                correctIndex: 1, userId, jobType: 'mecanico'
            }),
            this.buildReaction({
                prompt: '⚠️ ¡La llave de impacto está atascada! ¡Aplica fuerza AHORA!',
                buttonLabel: '💪 ¡FUERZA!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: JOYERO (NUEVO)
    // ─────────────────────────────────────────────
    getJoyeroGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '💍 Un cliente trae un anillo diciendo que es oro de 24k. Lo pruebas con ácido nítrico y no reacciona. ¿Qué es?',
                options: ['Oro puro de 24k', 'Oro bañado o chapado (falso)', 'Platino', 'Plata con baño de oro'],
                correctIndex: 1, userId, jobType: 'joyero'
            }),
            this.buildReaction({
                prompt: '💎 ¡Un diamante se cayó de la mesa! ¡Atrápalo antes de que ruede!',
                buttonLabel: '✋ ¡ATRAPAR!', userId, timeLimit: 3000
            }),
            this.buildGuessNumber({
                question: '💰 Un collar de oro de 18k pesa 15 gramos. El oro está a $60/gramo. ¿Cuánto vale el oro?',
                options: ['$750', '$900', '$1,050', '$600'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🔬 ¿Cómo distingues un diamante real de uno de cristal?',
                options: ['Por el color', 'Con el probador de diamantes (conductividad térmica)', 'Por el peso', 'Raspándolo con las uñas'],
                correctIndex: 1, userId, jobType: 'joyero'
            }),
            this.buildSequence({
                instruction: '💍 Ordena el proceso de reparación de un anillo:',
                steps: [
                    { label: '🔍 Evaluar el daño', order: 0 },
                    { label: '🔥 Soldar la pieza', order: 1 },
                    { label: '✨ Pulir y limpiar', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '🤨 Un cliente quiere vender joyas de dudosa procedencia. ¿Qué haces?',
                options: ['Las compras sin preguntar', 'Pides documentación y si no tiene, rechazas', 'Llamas a la policía de inmediato', 'Las compras más baratas'],
                correctIndex: 1, userId, jobType: 'joyero'
            }),
            this.buildReaction({
                prompt: '🔭 ¡El cliente llega con el diamante más grande que has visto! ¡Evalúalo!',
                buttonLabel: '🔬 ¡EVALUAR!', userId, timeLimit: 4500
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: CONTADOR (NUEVO - ILEGAL)
    // ─────────────────────────────────────────────
    getContadorGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '📊 El cliente quiere "reducir impuestos creativamente". ¿Qué estrategia usas?',
                options: ['Reportas todo fielmente', 'Buscas deducciones legítimas al límite', 'Inventas gastos falsos', 'Le dices que no puedes ayudarlo'],
                correctIndex: 1, userId, jobType: 'contador'
            }),
            this.buildReaction({
                prompt: '🚨 ¡LLEGA UNA AUDITORÍA SORPRESA DEL SAT! ¡ORDENA LOS LIBROS!',
                buttonLabel: '📁 ¡ORDENAR!', userId, timeLimit: 3500
            }),
            this.buildGuessNumber({
                question: '💰 La empresa tuvo ingresos de $500,000 y gastos de $320,000. ¿Cuál es la utilidad?',
                options: ['$160,000', '$180,000', '$200,000', '$140,000'],
                correctIndex: 1, userId
            }),
            this.buildSequence({
                instruction: '📋 Ordena el proceso de cierre contable del mes:',
                steps: [
                    { label: '🔢 Cuadrar los libros', order: 0 },
                    { label: '📊 Generar estados financieros', order: 1 },
                    { label: '📤 Presentar declaración', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '😬 El auditor pregunta por una transferencia de $50,000 a una cuenta en las Islas Caimán. ¿Qué dices?',
                options: ['Confiesas todo', '"Es una inversión internacional legítima con todos sus documentos"', 'Te niegas a responder', 'Sales corriendo'],
                correctIndex: 1, userId, jobType: 'contador'
            }),
            this.buildMultipleChoice({
                question: '📉 El balance no cuadra por $0.01. El director dice que lo ignores. ¿Qué haces?',
                options: ['Lo ignoras como dice el director', 'Buscas el error hasta que cuadre', 'Inviertes el centavo de tu bolsillo', 'Presentas el reporte con error'],
                correctIndex: 1, userId, jobType: 'contador'
            }),
            this.buildReaction({
                prompt: '💻 ¡El sistema de contabilidad se cuelga a las 11:58pm con fecha límite a medianoche! ¡Reinicia!',
                buttonLabel: '🔄 ¡REINICIAR!', userId, timeLimit: 4000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: ACTOR PORNO (NUEVO)
    // ─────────────────────────────────────────────
    getActorGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🎬 El director quiere que improvises una escena "apasionada". ¿Qué haces?',
                options: ['Te quedas paralizado', 'Entras en personaje con total profesionalismo', 'Pides el guión completo', 'Llamas a tu agente'],
                correctIndex: 1, userId, jobType: 'actor_porno'
            }),
            this.buildReaction({
                prompt: '🎥 ¡EL DIRECTOR DICE "ACCIÓN"! ¡ES TU MOMENTO!',
                buttonLabel: '⭐ ¡ACTUAR!', userId, timeLimit: 4000
            }),
            this.buildGuessNumber({
                question: '💰 Tu caché por escena es $800, pero el agente cobra 20%. ¿Cuánto te llevas?',
                options: ['$560', '$640', '$720', '$800'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '😤 La co-estrella llegó tarde 2 horas al rodaje. ¿Qué haces?',
                options: ['Le gritas en el set', 'Lo reportas al productor profesionalmente', 'Te vas tú también', 'Empiezas a grabar solo'],
                correctIndex: 1, userId, jobType: 'actor_porno'
            }),
            this.buildSequence({
                instruction: '🎬 Ordena el proceso de un rodaje profesional:',
                steps: [
                    { label: '📋 Revisar el contrato', order: 0 },
                    { label: '💆 Prepararte mentalmente', order: 1 },
                    { label: '🎥 Grabar la escena', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '📱 Un fan te reconoce en el supermercado y empieza a filmarte. ¿Qué haces?',
                options: ['Poses para la cámara', 'Pides amablemente que no te grabe', 'Corres a esconderte', 'Le das un autógrafo'],
                correctIndex: 1, userId, jobType: 'actor_porno'
            }),
            this.buildReaction({
                prompt: '🏆 ¡Ganaste el premio al mejor actor del año! ¡Da tu discurso!',
                buttonLabel: '🎤 ¡DISCURSO!', userId, timeLimit: 5000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  MINIJUEGOS: SICARIO (NUEVO - ILEGAL)
    // ─────────────────────────────────────────────
    getSicarioGames(userId) {
        return [
            this.buildMultipleChoice({
                question: '🕶️ Tu contacto te envió 3 fotos. Una no es el objetivo. ¿Cuál descartas?',
                options: ['El hombre de traje gris con maletín', 'El tipo con guardaespaldas rodeándolo', 'La foto borrosa de una mujer', 'El hombre en el restaurante que describieron'],
                correctIndex: 2, userId, jobType: 'sicario'
            }),
            this.buildReaction({
                prompt: '🚔 ¡DETECTARON TU POSICIÓN! ¡MUÉVETE AHORA!',
                buttonLabel: '🏃 ¡MOVERME!', userId, timeLimit: 2500
            }),
            this.buildSequence({
                instruction: '🎯 Ordena la operación de forma profesional:',
                steps: [
                    { label: '🔍 Reconocer el área', order: 0 },
                    { label: '⏰ Esperar el momento exacto', order: 1 },
                    { label: '🚗 Tener ruta de escape lista', order: 2 },
                ],
                userId
            }),
            this.buildMultipleChoice({
                question: '📞 El cliente quiere cancelar el contrato a mitad de camino. ¿Qué respondes?',
                options: ['"No hay devoluciones"', '"Entendido, ¿qué pasó?"', '"Entonces eres el siguiente"', '"Me alegra, era muy riesgoso"'],
                correctIndex: 0, userId, jobType: 'sicario'
            }),
            this.buildGuessNumber({
                question: '💰 El contrato paga $10,000 pero tienes que pagar $2,500 al intermediario. ¿Cuánto te queda?',
                options: ['$6,500', '$7,500', '$8,000', '$5,000'],
                correctIndex: 1, userId
            }),
            this.buildMultipleChoice({
                question: '🤔 Llegas al lugar y el objetivo está con un niño. ¿Qué haces?',
                options: ['Procedes igual', 'Aborts la misión y reprogramas', 'Esperas a que el niño se vaya', 'Cancelas el contrato'],
                correctIndex: 1, userId, jobType: 'sicario'
            }),
            this.buildReaction({
                prompt: '🚨 ¡ALERTA! ¡Hay un policía encubierto vigilándote! ¡Actúa normal!',
                buttonLabel: '😐 ¡CALMA!', userId, timeLimit: 3000
            }),
        ];
    }

    // ─────────────────────────────────────────────
    //  LÓGICA PRINCIPAL: LANZAR MINIJUEGO
    // ─────────────────────────────────────────────

    async launch(message, jobType, baseReward, workStreak = 0) {
        const userId = message.author.id;

        if (this.activeGames.has(userId)) {
            await message.reply('⚠️ Ya tienes un minijuego de trabajo activo. Complétalo primero.');
            return null;
        }

        const games = this.getMinigamesForJob(jobType);
        if (!games) return null;

        const game = this.getRandom(games);
        const streakBonus = this.getStreakBonus(workStreak);

        // Guardar estado del juego
        this.activeGames.set(userId, {
            jobType,
            baseReward,
            game,
            startTime: Date.now(),
            resolved: false,
        });

        // Construir embed
        const streakText = streakBonus
            ? `\n${streakBonus.label} (+${streakBonus.bonus * 100}% bonus activo!)`
            : workStreak > 0 ? `\n🔥 Racha actual: **${workStreak}** éxitos` : '';

        const timeLimit = game.type === 'reaction' ? game.timeLimit : this.TIMEOUT;

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`💼 Minijuego de Trabajo`)
            .setDescription(
                `${game.question}\n\n` +
                `⏰ Tienes **${timeLimit / 1000} segundos** para responder${streakText}`
            )
            .setFooter({ text: `Recompensa base: ${baseReward.toLocaleString()} π-b$` });

        if (game.type === 'sequence') {
            embed.addFields({ name: '📋 Pasos disponibles', value: game.shuffled.map(s => `• ${s.label}`).join('\n'), inline: false });
            embed.setDescription(
                `${game.question}\n\n` +
                `📌 Presiona los botones **en el orden correcto**\n⏰ Tienes **${timeLimit / 1000} segundos**${streakText}`
            );
            // Para secuencia necesitamos guardar el estado de progreso
            this.activeGames.get(userId).sequenceProgress = [];
        }

        const sentMessage = await message.reply({ embeds: [embed], components: [game.row] });

        // Timeout automático
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
                .setDescription(
                    isIllegal
                        ? `Te distrajiste demasiado y algo salió mal...\n💸 **Perdiste ${Math.abs(penalty).toLocaleString()} π-b$**`
                        : `No respondiste a tiempo.\n💸 **Ganaste solo ${penalty.toLocaleString()} π-b$** (25% por timeout)`
                )
                .setFooter({ text: 'La racha fue reseteada' });

            await sentMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});

            // Devolver resultado para que all-commands lo procese
            gameData.resolve?.({ success: false, isTimeout: true, reward: penalty, resetStreak: true });
        }, timeLimit);

        // Devolvemos una Promise que se resuelve cuando el usuario interactúa
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
    //  HANDLER DE INTERACCIONES
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

        // Verificar que sea el usuario correcto
        if (!customId.includes(`_${userId}_`) && !customId.endsWith(`_${userId}`)) {
            await interaction.reply({ content: '❌ Este minijuego no es tuyo.', ephemeral: true });
            return true;
        }

        const { jobType, baseReward, game } = gameData;

        // ── OPCIÓN MÚLTIPLE ──
        if (customId.startsWith('work_mc_') || customId.startsWith('work_num_')) {
            const parts = customId.split('_');
            const isCorrect = parts[parts.length - 1] === 'true';
            await this.resolveGame(interaction, gameData, isCorrect, jobType, baseReward);
            return true;
        }

        // ── REACCIÓN RÁPIDA ──
        if (customId.startsWith('work_react_')) {
            await this.resolveGame(interaction, gameData, true, jobType, baseReward);
            return true;
        }

        // ── SECUENCIA ──
        if (customId.startsWith('work_seq_')) {
            const parts = customId.split('_');
            const pressedOrder = parseInt(parts[parts.length - 1]);
            const expectedOrder = gameData.sequenceProgress.length;

            if (pressedOrder === expectedOrder) {
                gameData.sequenceProgress.push(pressedOrder);

                if (gameData.sequenceProgress.length === game.steps.length) {
                    // Completó la secuencia correctamente
                    await this.resolveGame(interaction, gameData, true, jobType, baseReward);
                } else {
                    // Paso correcto, pero aún faltan
                    const nextStep = game.steps.find(s => s.order === expectedOrder + 1);
                    await interaction.reply({
                        content: `✅ ¡Correcto! Siguiente paso: **${nextStep?.label || '???'}**`,
                        ephemeral: true
                    });
                }
            } else {
                // Orden incorrecto
                await this.resolveGame(interaction, gameData, false, jobType, baseReward);
            }
            return true;
        }

        return false;
    }

    // ─────────────────────────────────────────────
    //  RESOLVER EL JUEGO
    // ─────────────────────────────────────────────

    async resolveGame(interaction, gameData, isCorrect, jobType, baseReward) {
        if (gameData.resolved) return;
        gameData.resolved = true;

        clearTimeout(gameData.timeout);
        this.activeGames.delete(interaction.user.id);

        const streakBonus = gameData.resolve ? null : null; // se calcula arriba en launch
        let reward;
        let embedColor;
        let title;
        let description;

        if (isCorrect) {
            reward = baseReward; // El bonus de racha se aplica en all-commands
            embedColor = '#00FF88';
            title = '✅ ¡Minijuego completado!';
            description = `¡Lo lograste! Recibirás tu sueldo completo.`;
        } else {
            reward = this.getPenalty(jobType, baseReward, false);
            const isIllegal = this.isIllegal(jobType);
            embedColor = '#FF4444';
            title = '❌ Fallaste el minijuego';
            description = isIllegal
                ? `Algo salió muy mal...\n💸 **Perdiste ${Math.abs(reward).toLocaleString()} π-b$**`
                : `No era correcto.\n💰 **Recibirás ${reward.toLocaleString()} π-b$** (50% del sueldo)`;
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: isCorrect ? '¡Sigue así para mantener la racha!' : 'La racha fue reseteada' });

        await interaction.update({ embeds: [resultEmbed], components: [] }).catch(async () => {
            await interaction.reply({ embeds: [resultEmbed] }).catch(() => {});
        });

        gameData.resolve?.({
            success: isCorrect,
            isTimeout: false,
            reward,
            resetStreak: !isCorrect
        });
    }
}

module.exports = WorkMinigames;
