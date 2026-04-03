// ============================================================
// ROB-MINIGAME-HANDLER.JS — Lógica de sesiones de minijuegos
// Gestiona sesiones activas, timeouts y resultados
// ============================================================

const RobMinigames = require('./rob-minigames');

class RobMinigameHandler {
    constructor() {
        this.pool = new RobMinigames();
        this.activeSessions = new Map(); // userId → session
    }

    // ─────────────────────────────────────────────
    // Crear sesión de minijuego para un robo
    // ─────────────────────────────────────────────
    async createSession(robberId, targetUsername, clickEfficiency) {
        const difficulty = this.pool.getDifficulty(clickEfficiency);
        if (!difficulty) return null;

        // Intentar IA 70% del tiempo, fallback al pool
        let minigame = null;
        const useAI = Math.random() < 0.7;
        console.log(`[RobMG] Intentando AI: ${useAI}`);
        if (useAI) {
            minigame = await this.pool.generateAIMinigame(targetUsername, difficulty);
            console.log(`[RobMG] AI resultado: ${minigame ? '✅ generó' : '❌ falló, usando pool'}`);
        }
        if (!minigame) {
            minigame = this.pool.getRandomMinigame(targetUsername, difficulty);
            console.log(`[RobMG] Usando pool predefinido: ${minigame.title || minigame.id}`);
        }

        const timing = this.pool.getTimeForDifficulty(difficulty);

        const session = {
            robberId,
            targetUsername,
            minigame,
            difficulty,
            timeLimit: timing.time,
            createdAt: Date.now(),
            answered: false,
            gameId: `${robberId}_${Date.now()}`,
        };

        this.activeSessions.set(robberId, session);
        return session;
    }

    // ─────────────────────────────────────────────
    // Obtener sesión activa
    // ─────────────────────────────────────────────
    getSession(robberId) {
        return this.activeSessions.get(robberId) || null;
    }

    // ─────────────────────────────────────────────
    // Procesar respuesta del usuario
    // ─────────────────────────────────────────────
    processAnswer(robberId, answeredValue) {
        const session = this.activeSessions.get(robberId);
        if (!session || session.answered) return { valid: false };

        const elapsed = Date.now() - session.createdAt;
        if (elapsed > session.timeLimit + 2000) {
            this.activeSessions.delete(robberId);
            return { valid: true, success: false, reason: 'timeout' };
        }

        session.answered = true;
        this.activeSessions.delete(robberId);

        const correct = answeredValue === session.minigame.correct;
        return {
            valid: true,
            success: correct,
            reason: correct ? 'correct' : 'wrong',
            difficulty: session.difficulty,
            minigameTitle: session.minigame.title,
            timeTaken: elapsed,
        };
    }

    // ─────────────────────────────────────────────
    // Marcar sesión como expirada (llamado por timeout del collector)
    // ─────────────────────────────────────────────
    expireSession(robberId) {
        this.activeSessions.delete(robberId);
        return { valid: true, success: false, reason: 'timeout' };
    }

    // ─────────────────────────────────────────────
    // Construir embed y botones del minijuego
    // ─────────────────────────────────────────────
    buildMinigameComponents(session) {
        const embed = this.pool.buildEmbed(
            session.minigame,
            session.targetUsername,
            session.difficulty
        );
        const rows = this.pool.buildButtons(session.minigame, session.gameId);
        return { embed, rows };
    }

    // ─────────────────────────────────────────────
    // Verificar si un customId pertenece a esta sesión
    // ─────────────────────────────────────────────
    isMinigameButton(customId, session) {
        return customId.startsWith(`robmg_${session.gameId}_`);
    }

    // ─────────────────────────────────────────────
    // Extraer valor de respuesta del customId
    // ─────────────────────────────────────────────
    extractAnswer(customId) {
        const parts = customId.split('_');
        // robmg_{robberId}_{timestamp}_{value}
        // El value puede tener guiones bajos, reconstruir desde índice 3
        return parts.slice(3).join('_');
    }
}

module.exports = RobMinigameHandler;