import { spawn } from 'child_process';
import { YTDLP_OPTIONS } from '../routes/audio.js'; 

/**
 * Executes yt-dlp process and returns a Promise.
 * @param {string} videoId
 * @returns {Promise<ChildProcess>}
 */
export function runYtdlpProcess(videoId) {
    return new Promise((resolve, reject) => {
        const ytdlpProcess = spawn('yt-dlp', [...YTDLP_OPTIONS, `https://www.youtube.com/watch?v=${videoId}`]);

        ytdlpProcess.on('spawn', () => {
            resolve(ytdlpProcess);
        });

        ytdlpProcess.on('error', (err) => {
            reject(err); // Reject promise if spawn fails
        });
    });
}


/**
 * Handles yt-dlp stderr data and error conditions.
 * @param {ChildProcess} ytdlpProcess
 * @param {string} videoId
 * @param {number} retryCount
 * @param {number} currentRetryDelayMs
 * @param {object} res - Express response object
 * @returns {Promise<void>} - Resolves on successful retry, rejects if no retry or max retries reached.
 */
export async function handleYtdlpError(ytdlpProcess, videoId, retryCount, currentRetryDelayMs, res) {
    return new Promise((resolve, reject) => {
        ytdlpProcess.stderr.on('data', async (data) => {
            const errorData = data.toString();
            console.error(`[yt-dlp Error] videoId: ${videoId}, Attempt: ${retryCount + 1}, Error: ${errorData.trim()}`);

            if (errorData.includes('HTTP Error 429: Too Many Requests')) {
                await handleHttp429Error(videoId, retryCount, currentRetryDelayMs, res, resolve, reject);
            } else if (errorData.includes('ERROR: \\[youtube]')) {
                handleYouTubeSpecificError(errorData, videoId, res);
                reject(); // No retry for YouTube specific errors (for now)
            } else {
                handleGeneralYtdlpError(errorData, videoId, res);
                reject(); // No retry for general yt-dlp errors (for now)
            }
        });
    });
}

/**
 * Handles HTTP 429 "Too Many Requests" error and manages retry logic.
 * @param {string} videoId
 * @param {number} retryCount
 * @param {number} currentRetryDelayMs
 * @param {object} res - Express response object
 * @param {function} resolve - Promise resolve function for retry
 * @param {function} reject - Promise reject function for retry
 * @returns {Promise<void>}
 */
export async function handleHttp429Error(videoId, retryCount, currentRetryDelayMs, res, resolve, reject) {
    console.warn(`[Warning] HTTP Error 429 detected for videoId: ${videoId}, Attempt ${retryCount + 1}. Rate limiting by YouTube. Retrying in ${currentRetryDelayMs / 1000} seconds...`);
    const nextRetryCount = retryCount + 1;

    if (nextRetryCount <= MAX_RETRIES) {
        const delayMs = currentRetryDelayMs * 2;
        console.log(`[Retry] Re-attempting processing for videoId: ${videoId}, Attempt: ${nextRetryCount}, after delay of ${delayMs / 1000} seconds.`);
        setTimeout(resolve, delayMs); // Resolve to trigger retry in processAudioWithRetry
    } else {
        console.error(`[Error] Max retries reached (${MAX_RETRIES}) for videoId: ${videoId}. Giving up.`);
        if (!res.headersSent) {
            res.status(500).send('Error processing audio: Too many requests to YouTube. Please try again later.');
        }
        reject(); // Reject promise if max retries reached
    }
}


/**
 * Handles specific YouTube errors detected in yt-dlp stderr.
 * @param {string} errorData - The stderr data from yt-dlp
 * @param {string} videoId
 * @param {object} res - Express response object
 */
export function handleYouTubeSpecificError(errorData, videoId, res) {
    if (errorData.includes('This video is unavailable')) {
        console.warn(`[YouTube Error] Video unavailable for videoId: ${videoId}.`);
        if (!res.headersSent) {
            res.status(404).send('Video unavailable on YouTube.');
        }
    } else if (errorData.includes('Sign in to confirm you’re not a bot')) {
        console.warn(`[YouTube Error] Bot verification required for videoId: ${videoId}. Cookies might be needed or invalid.`);
        if (!res.headersSent) {
            res.status(500).send('Error processing audio: YouTube bot verification required. Ensure valid cookies.');
        }
    } else {
        console.error(`[YouTube Error] Unhandled YouTube error for videoId: ${videoId}. Error message: ${errorData.trim()}`);
        if (!res.headersSent) {
            res.status(500).send('Error processing audio: Unknown YouTube error. Check logs for details.');
        }
    }
}

/**
 * Handles general (unspecific) yt-dlp errors.
 * @param {string} errorData - The stderr data from yt-dlp
 * @param {string} videoId
 * @param {object} res - Express response object
 */
export function handleGeneralYtdlpError(errorData, videoId, res) {
    console.error(`[yt-dlp General Error] Unhandled yt-dlp error for videoId: ${videoId}. Error message: ${errorData.trim()}`);
    if (!res.headersSent) {
        res.status(500).send('Internal server error executing yt-dlp. Check logs.');
    }
}


/**
 * Handles yt-dlp process close event.
 * @param {number} code - Exit code of yt-dlp process
 * @param {string} videoId
 * @param {object} res - Express response object
 */
export function handleYtdlpClose(code, videoId, res) {
    console.log(`[yt-dlp Process Closed] videoId: ${videoId}, Exit Code: ${code}`);
    if (code !== 0 && !res.headersSent) {
        res.status(500).send('Internal server error processing audio.');
    }
}


/**
 * Handles client request abort event.
 * @param {ChildProcess | undefined} ytdlpProcess - yt-dlp process (if running)
 * @param {string} videoId
 */
export function handleClientAbort(ytdlpProcess, videoId) {
    console.log(`[Request Aborted] Request for videoId: ${videoId} aborted by client.`);
    if (ytdlpProcess) {
        ytdlpProcess.kill();
        console.log(`[yt-dlp Process Killed] Process for videoId: ${videoId} terminated due to client abort.`);
    }
}