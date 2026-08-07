// aiModels.js
module.exports = {
    GROQ_FAST: 'openai/gpt-oss-20b',      // tareas simples: acertijos, traducciones cortas
    GROQ_SMART: 'openai/gpt-oss-120b',    // tareas complejas: chat, traducción con contexto
    GROQ_BACKUP: 'llama-3.3-70b-versatile',
    GROQ_VISION: 'qwen/qwen3.6-27b',      // modelo de visión para Groq
    CEREBRAS_MAIN: 'gpt-oss-120b',      // modelo principal de Cerebras
    CEREBRAS_FAST: 'gemma-4-31b',
};