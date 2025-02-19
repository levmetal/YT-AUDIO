const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const path = require('path');

// --- CONFIGURACIÓN DE REINTENTOS ---
const MAX_RETRIES = 3; // Número máximo de reintentos antes de dar la petición por fallida
const INITIAL_RETRY_DELAY_MS = 2000; // Retraso inicial de 2 segundos (2000ms)

// Ruta para obtener el audio
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    let retryCount = 0; // Contador de reintentos para esta petición
    let currentRetryDelayMs = INITIAL_RETRY_DELAY_MS; // Retraso inicial para el primer reintento

    async function processAudioWithRetry() { // Función asíncrona para encapsular la lógica de reintento
        // --- DELAY ALEATORIO (se mantiene) ---
        const delayMs = Math.random() * (5000 - 2000) + 2000;
        console.log(`[Audio Route] Delaying request for ${videoId} by ${delayMs}ms (Retry ${retryCount})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        console.log(`[Audio Route] Processing videoId: ${videoId}, Attempt: ${retryCount + 1}`);

        const ytdlp = spawn('yt-dlp', [
            '-x',
            '--audio-format', 'mp3',
            '--quiet',
            '--cookies', path.join(__dirname, 'cookies.txt'),
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // USER-AGENT (¡RECUERDA ACTUALIZAR VERSION!)
            '-o', '-',
            `https://www.youtube.com/watch?v=${videoId}`
        ]);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

        ytdlp.stdout.pipe(res);


        ytdlp.stderr.on('data', (data) => {
            const errorData = data.toString();
            console.error(`[yt-dlp Error]: ${errorData} (Attempt ${retryCount + 1})`);

            if (errorData.includes('HTTP Error 429: Too Many Requests')) {
                console.warn(`[Warning] HTTP Error 429 detected for videoId: ${videoId}, Attempt ${retryCount + 1}. Rate limiting by YouTube. Retrying in ${currentRetryDelayMs / 1000} seconds...`);

                retryCount++; // Incrementar contador de reintentos

                if (retryCount <= MAX_RETRIES) { // Si no se ha alcanzado el límite de reintentos
                    setTimeout(async () => { // Usar setTimeout para el retraso antes del reintento
                        currentRetryDelayMs *= 2; // Exponential backoff: Duplicar el retraso para el siguiente reintento
                        console.log(`[Retry] Re-attempting processing for videoId: ${videoId}, Attempt: ${retryCount + 1}, after delay of ${currentRetryDelayMs / 1000} seconds.`);
                        await processAudioWithRetry(); // ¡RECURSIVIDAD! Volver a llamar a la función processAudioWithRetry() para reintentar
                    }, currentRetryDelayMs);
                } else { // Si se alcanzan el máximo de reintentos
                    console.error(`[Error] Max retries reached (${MAX_RETRIES}) for videoId: ${videoId}. Giving up.`);
                    if (!res.headersSent) {
                        res.status(500).send('Error al procesar el audio: Demasiadas solicitudes a YouTube. Por favor, intenta de nuevo más tarde.'); // Error 500 tras fallar todos los reintentos
                    }
                }
            }
            else if (errorData.includes('ERROR: \[youtube]')) { // Manejo de otros errores de YouTube (igual que antes)
                console.error(`[YouTube Error] Specific YouTube error for videoId: ${videoId}. Analyzing error message... (Attempt ${retryCount + 1})`);
                if (errorData.includes('This video is unavailable')) {
                    console.warn(`[YouTube Error] Video unavailable for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(404).send('Video no disponible en YouTube.');
                    }
                } else if (errorData.includes('Sign in to confirm you’re not a bot')) {
                    console.warn(`[YouTube Error] Bot verification required for videoId: ${videoId}. Cookies might be needed or invalid. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(500).send('Error al procesar el audio: Verificación de bot de YouTube requerida. Asegúrate de tener cookies válidas.');
                    }
                } else {
                    console.error(`[YouTube Error] Unhandled YouTube error for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(500).send('Error al procesar el audio: Error desconocido de YouTube. Verificar logs para más detalles.');
                    }
                }
            }
             else { // Otros errores genéricos de yt-dlp (igual que antes)
                console.error(`[yt-dlp General Error] Unhandled yt-dlp error for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                if (!res.headersSent) {
                    res.status(500).send('Error interno del servidor al ejecutar yt-dlp. Verificar logs.');
                }
            }
        });

        ytdlp.on('close', (code) => {
            console.log(`[yt-dlp process closed] videoId: ${videoId}, code: ${code}, Attempt ${retryCount + 1}`);
            if (code !== 0 && !res.headersSent) {
                res.status(500).send('Error interno del servidor al procesar el audio.');
            }
        });

        req.on('close', () => {
            console.log(`[Request Aborted] Request for videoId: ${videoId} aborted by client. (Attempt ${retryCount + 1})`);
            if(ytdlp) {
                ytdlp.kill();
                console.log(`[yt-dlp process killed] Process for videoId: ${videoId} terminated due to client abort. (Attempt ${retryCount + 1})`);
            }
        });
    } // Cierre de la función processAudioWithRetry()

    processAudioWithRetry(); // ¡INICIAR el procesamiento (con reintentos) llamando a la función!

});

module.exports = router;