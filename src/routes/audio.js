const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const path = require('path');

// --- Retry Configuration ---
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

// Route to get audio
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    let retryCount = 0;
    let currentRetryDelayMs = INITIAL_RETRY_DELAY_MS;

    console.log(`[Audio Route] Request received for videoId: ${videoId}`);

    res.setHeader('Content-Type', 'audio/mpeg'); // Set headers here, BEFORE calling processAudioWithRetry
    res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

    async function processAudioWithRetry() {
        // --- Random Delay ---
        const delayMs = Math.random() * (5000 - 2000) + 2000;
        console.log(`[Audio Route] Delaying request for ${videoId} by ${delayMs}ms (Retry ${retryCount})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        console.log(`[Audio Route] Processing videoId: ${videoId}, Attempt: ${retryCount + 1}`);

        let ytdlp;
        try {
            ytdlp = spawn('yt-dlp', [
                '-x',
                '--audio-format', 'mp3',
                '--quiet',
                '--cookies', path.join(__dirname, 'cookies.txt'), // <-- Re-enabled cookies for deployment
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--min-sleep-interval', '2',  // <-- Re-enabled sleep intervals for deployment
                '--max-sleep-interval', '6', // <-- Re-enabled sleep intervals for deployment
                '-o', '-',
                `https://www.youtube.com/watch?v=${videoId}`
            ]);
        } catch (spawnError) {
            console.error(`[yt-dlp Spawn Error]: Error spawning yt-dlp process:`, spawnError);
            if (!res.headersSent) {
                return res.status(500).send('Internal server error: Could not start yt-dlp process.');
            }
            return;
        }

        ytdlp.stdout.pipe(res);

        ytdlp.stderr.on('data', (data) => {
            const errorData = data.toString();
            console.error(`[yt-dlp Error]: ${errorData} (Attempt ${retryCount + 1})`);

            if (errorData.includes('HTTP Error 429: Too Many Requests')) {
                console.warn(`[Warning] HTTP Error 429 detected for videoId: ${videoId}, Attempt ${retryCount + 1}. Rate limiting by YouTube. Retrying in ${currentRetryDelayMs / 1000} seconds...`);
                retryCount++;

                if (retryCount <= MAX_RETRIES) {
                    setTimeout(async () => {
                        if (!res.headersSent) { // Check if headers are already sent before retrying
                            currentRetryDelayMs *= 2;
                            console.log(`[Retry] Re-attempting processing for videoId: ${videoId}, Attempt: ${retryCount + 1}, after delay of ${currentRetryDelayMs / 1000} seconds.`);
                            await processAudioWithRetry(); // Recursive retry
                        } else {
                            console.warn("[Warning] Headers already sent, cannot retry for videoId:", videoId, "(Headers Sent Error during Retry).");
                            if (!res.headersSent) { // Double check before sending error (should not be needed)
                                res.status(500).send('Error processing audio: Internal server error (Headers already sent, retry impossible).');
                            }
                        }
                    }, currentRetryDelayMs);
                } else {
                    console.error(`[Error] Max retries reached (${MAX_RETRIES}) for videoId: ${videoId}. Giving up.`);
                    if (!res.headersSent) {
                        res.status(500).send('Error processing audio: Too many requests to YouTube. Please try again later.');
                    }
                }
            } else if (errorData.includes('ERROR: \\[youtube]')) {
                console.error(`[YouTube Error] Specific YouTube error for videoId: ${videoId}. Analyzing error message... (Attempt ${retryCount + 1})`);
                if (errorData.includes('This video is unavailable')) {
                    console.warn(`[YouTube Error] Video unavailable for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(404).send('Video unavailable on YouTube.');
                    }
                } else if (errorData.includes('Sign in to confirm you’re not a bot')) {
                    console.warn(`[YouTube Error] Bot verification required for videoId: ${videoId}. Cookies might be needed or invalid. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(500).send('Error processing audio: YouTube bot verification required. Ensure valid cookies.');
                    }
                } else {
                    console.error(`[YouTube Error] Unhandled YouTube error for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                    if (!res.headersSent) {
                        res.status(500).send('Error processing audio: Unknown YouTube error. Check logs for details.');
                    }
                }
            } else {
                console.error(`[yt-dlp General Error] Unhandled yt-dlp error for videoId: ${videoId}. (Attempt ${retryCount + 1})`);
                if (!res.headersSent) {
                    res.status(500).send('Internal server error executing yt-dlp. Check logs.');
                }
            }
        });

        ytdlp.on('close', (code) => {
            console.log(`[yt-dlp process closed] videoId: ${videoId}, code: ${code}, Attempt ${retryCount + 1}, Exit Code: ${code}`);
            if (code !== 0 && !res.headersSent) {
                res.status(500).send('Internal server error processing audio.');
            }
        });

        req.on('close', () => {
            console.log(`[Request Aborted] Request for videoId: ${videoId} aborted by client. (Attempt ${retryCount + 1})`);
            if (ytdlp) {
                ytdlp.kill();
                console.log(`[yt-dlp process killed] Process for videoId: ${videoId} terminated due to client abort. (Attempt ${retryCount + 1})`);
            }
        });
    }

    processAudioWithRetry();
});

module.exports = router;