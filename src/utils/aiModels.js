const AI_CONFIG = {
    providers: [
        {
            name: 'Groq',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            apiKeyEnv: 'GROQ_API_KEY',
            models: [
                { id: 'openai/gpt-oss-120b', emoji: '🧠', desc: 'GPT-OSS 120B' },
                { id: 'qwen/qwen3.8-27b', emoji: '🌙', desc: 'Qwen 3.8 27B' },
                { id: 'openai/gpt-oss-20b', emoji: '⚡', desc: 'GPT-OSS 20B' },
                { id: 'qwen/qwen3.8-27b', emoji: '🖼️', desc: 'Qwen 3.8 27B' },
            ]
        },
        // ⬇️ EJEMPLO de cómo agregar otro proveedor (descomentar y configurar)
        // {
        //     name: 'Together AI',
        //     endpoint: 'https://api.together.xyz/v1/chat/completions',
        //     apiKeyEnv: 'TOGETHER_API_KEY',
        //     models: [
        //         { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', emoji: '🦙', desc: 'Llama 3.3 70B' },
        //     ]
        // },
    ]
};

module.exports = {
    GROQ_SMART: 'openai/gpt-oss-120b',
    GROQ_FAST: 'openai/gpt-oss-20b',
    GROQ_BACKUP: 'qwen/qwen3.8-27b',
    GROQ_VISION: 'qwen/qwen3.8-27b',
    AI_CONFIG,
};