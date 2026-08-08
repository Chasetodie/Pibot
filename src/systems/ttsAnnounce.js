const { EdgeTTS } = require('edge-tts-universal');
const fs = require('fs/promises');
const path = require('path');

const TTS_OUTPUT_DIR = path.join(__dirname, '..', '..', 'tts_output');

const audioCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function limpiarTitulo(title) {
    return title
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function generateAnnouncementAudio(text) {
    const cached = audioCache.get(text);
    if (cached && cached.expira > Date.now()) {
        return cached.url;
    }

    try {
        const tts = new EdgeTTS(text, 'es-US-PalomaNeural');
        const result = await tts.synthesize();
        const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

        const fileName = `announce_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
        const filePath = path.join(TTS_OUTPUT_DIR, fileName);
        await fs.writeFile(filePath, audioBuffer);

        const domain = process.env.VITE_API_BASE_URL.startsWith('http')
            ? process.env.VITE_API_BASE_URL
            : `https://${process.env.VITE_API_BASE_URL}`;
        const url = `${domain}/tts/${fileName}`;

        console.log("Url generada:", url);

        audioCache.set(text, { url, expira: Date.now() + CACHE_TTL });
        setTimeout(() => fs.unlink(filePath).catch(() => {}), 120000);

        return url;
    } catch (err) {
        console.error('Error generando TTS (edge-tts):', err.message);
        return null;
    }
}

module.exports = { generateAnnouncementAudio, limpiarTitulo };