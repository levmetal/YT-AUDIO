const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const path = require('path');

// Ruta para obtener el audio
router.get('/:videoId', async (req, res) => { // ¡IMPORTANTE! Función ahora es async para usar await en delays
    const { videoId } = req.params;

    // --- DELAY ALEATORIO PARA REDUCIR TASA DE PETICIONES ---
    // Introduce un retraso aleatorio antes de llamar a yt-dlp
    // Esto ayuda a evitar ser detectado como bot y reduce errores 429
    const delayMs = Math.random() * (5000 - 2000) + 2000; // Retraso aleatorio entre 2 y 5 segundos
    console.log(`[Audio Route] Delaying request for ${videoId} by ${delayMs}ms`); // Log del delay
    await new Promise(resolve => setTimeout(resolve, delayMs));

    console.log(`[Audio Route] Processing videoId: ${videoId}`); // Log de inicio de procesamiento

    const ytdlp = spawn('yt-dlp', [
        '-x', // Extraer solo audio
        '--audio-format', 'mp3', // Convertir a MP3
        '--quiet', // Menos output de yt-dlp en consola
        '--cookies', path.join(__dirname, 'cookies.txt'), // Ruta al archivo de cookies
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.15 Safari/537.36', // **¡USER-AGENT AÑADIDO! -  REEMPLAZA '120.0.0.0' con la versión actual de Chrome si es necesario**
        '-o', '-', // Output a stdout (para streaming)
        `https://www.youtube.com/watch?v=${videoId}` // URL del video de YouTube
    ]);

    // Configurar headers para streaming de audio MP3
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

    // Pipe del output de yt-dlp (stdout) a la respuesta HTTP (res) para streaming
    ytdlp.stdout.pipe(res);

    // --- MANEJO DE ERRORES MEJORADO ---
    ytdlp.stderr.on('data', (data) => {
        const errorData = data.toString();
        console.error(`[yt-dlp Error]: ${errorData}`); // Log general de errores de yt-dlp

        if (errorData.includes('HTTP Error 429: Too Many Requests')) {
            console.warn(`[Warning] HTTP Error 429 detected for videoId: ${videoId}. Rate limiting by YouTube.`);
            // --- TODO:  IMPLEMENTAR LÓGICA DE REINTENTO CON EXPONENTIAL BACKOFF ---
            // Aquí podrías implementar la lógica de reintento:
            // 1. Incrementar un contador de reintentos para esta videoId.
            // 2. Esperar un tiempo (delay) creciente (exponential backoff).
            // 3. Volver a intentar ejecutar spawn(ytdlp, ... ) con la misma videoId.
            // 4. Si se alcanza un límite de reintentos, entonces responder con error 500 o similar.
            // --- POR AHORA:  Simplemente respondemos con error 500 tras detectar 429 ---
            if (!res.headersSent) {
                res.status(500).send('Error al procesar el audio: Demasiadas solicitudes (Error 429 - Rate Limiting de YouTube). Por favor, intenta de nuevo más tarde.');
            }
        } else if (errorData.includes('ERROR: \[youtube]')) { // Detectar otros errores específicos de YouTube (ejemplo: video no disponible)
            console.error(`[YouTube Error] Specific YouTube error for videoId: ${videoId}. Analyzing error message...`);
            if (errorData.includes('This video is unavailable')) {
                console.warn(`[YouTube Error] Video unavailable for videoId: ${videoId}.`);
                if (!res.headersSent) {
                    res.status(404).send('Video no disponible en YouTube.'); // Error 404 para video no encontrado
                }
            } else if (errorData.includes('Sign in to confirm you’re not a bot')) {
                console.warn(`[YouTube Error] Bot verification required for videoId: ${videoId}. Cookies might be needed or invalid.`);
                if (!res.headersSent) {
                    res.status(500).send('Error al procesar el audio: Verificación de bot de YouTube requerida. Asegúrate de tener cookies válidas.');
                }
            }
             else { // Otro error de YouTube no manejado específicamente
                console.error(`[YouTube Error] Unhandled YouTube error for videoId: ${videoId}.`);
                if (!res.headersSent) {
                    res.status(500).send('Error al procesar el audio: Error desconocido de YouTube. Verificar logs para más detalles.');
                }
            }
        }
        else { // Otros errores genéricos de yt-dlp (no relacionados con YouTube directamente)
            console.error(`[yt-dlp General Error] Unhandled yt-dlp error for videoId: ${videoId}.`);
            if (!res.headersSent) {
                res.status(500).send('Error al procesar el audio: Error interno del servidor al ejecutar yt-dlp. Verificar logs.');
            }
        }
    });

    ytdlp.on('close', (code) => {
        console.log(`[yt-dlp process closed] videoId: ${videoId}, code: ${code}`); // Log del cierre de proceso yt-dlp
        if (code !== 0 && !res.headersSent) { // Si hubo error (código != 0) y aún no se han enviado headers
            res.status(500).send('Error interno del servidor al procesar el audio.'); // Error genérico 500 si yt-dlp cierra con código de error no manejado
        }
        // Si el código es 0, se asume que el streaming se completó con éxito (stdout.pipe ya envió la respuesta)
    });

    // Manejo de cierre inesperado del stream (ejemplo: cliente cancela la petición)
    req.on('close', () => {
        console.log(`[Request Aborted] Request for videoId: ${videoId} aborted by client.`);
        if(ytdlp) { // Asegurar que el proceso ytdlp existe antes de intentar matarlo
            ytdlp.kill(); // Forzar la finalización del proceso yt-dlp si el cliente aborta la descarga
            console.log(`[yt-dlp process killed] Process for videoId: ${videoId} terminated due to client abort.`);
        }
    });

});

module.exports = router;