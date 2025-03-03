import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; 
import {
    runYtdlpProcess,
    handleYtdlpError,
    handleHttp429Error,
    handleYouTubeSpecificError,
    handleGeneralYtdlpError,
    handleYtdlpClose,
    handleClientAbort
} from '../utils/audio-utils.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// --- Configuration ---
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;
const YTDLP_OPTIONS = [
    '-x',
    '--audio-format', 'mp3',
    '--quiet',
    '--cookies', path.join(__dirname, 'cookies.txt'), // <-- Ahora __dirname funciona correctamente
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--min-sleep-interval', '2',
    '--max-sleep-interval', '6',
    '-o', '-'
];

export { YTDLP_OPTIONS };

// --- Retry Configuration ---

/**
 * Processes audio extraction with retry logic.
 * @param {string} videoId
 * @param {object} res - Express response object
 * @param {number} retryCount - Current retry count
 * @param {number} currentRetryDelayMs - Current retry delay
 * @returns {Promise<void>}
 */
async function processAudioWithRetry(videoId, res, retryCount = 0, currentRetryDelayMs = INITIAL_RETRY_DELAY_MS) {
    console.log(`[Audio Route] Processing videoId: ${videoId}, Attempt: ${retryCount + 1}`);

    // --- Random Delay ---
    const delayMs = Math.random() * (5000 - 2000) + 2000;
    console.log(`[Audio Route] Delaying request for ${videoId} by ${delayMs}ms (Retry ${retryCount})`);
    await new Promise(resolve => setTimeout(resolve, delayMs));


    let ytdlpProcess;
    try {
        ytdlpProcess = await runYtdlpProcess(videoId); 
    } catch (spawnError) {
        console.error(`[yt-dlp Spawn Error]: Error spawning yt-dlp process:`, spawnError);
        if (!res.headersSent) {
            return res.status(500).send('Internal server error: Could not start yt-dlp process.');
        }
        return;
    }


    ytdlpProcess.stdout.pipe(res); // Pipe stdout to response


    await handleYtdlpError(ytdlpProcess, videoId, retryCount, currentRetryDelayMs, res).catch(() => {
        // handleYtdlpError rejects promise when no retry or max retries reached,
        // in this case, we stop retrying and exit processAudioWithRetry.
    });


    ytdlpProcess.on('close', (code) => {
        handleYtdlpClose(code, videoId, res); 
    });

    req.on('close', () => {
        handleClientAbort(ytdlpProcess, videoId); 
    });


    // --- Recursive Retry (if handleYtdlpError resolved) ---
    if (!res.writableFinished && !res.headersSent ) { 
        if (!res.headersSent && retryCount < MAX_RETRIES) {
            const nextRetryCount = retryCount + 1;
            const nextRetryDelayMs = currentRetryDelayMs * 2;
            console.log(`[Retry] Re-attempting processing for videoId: ${videoId}, Attempt: ${nextRetryCount}, after delay of ${nextRetryDelayMs / 1000} seconds.`);
            await processAudioWithRetry(videoId, res, nextRetryCount, nextRetryDelayMs); 
        }
    } else {
        console.warn("[Warning] Response finished or headers already sent, cannot reliably retry for videoId:", videoId);
    }
}


// Route to get audio
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;

    console.log(`[Audio Route] Request received for videoId: ${videoId}`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

    await processAudioWithRetry(videoId, res); // Start processing with retry logic
});


export default router;