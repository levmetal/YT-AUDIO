# YT-AUDIO

YT Audio Downloader
This project is a Node.js application that allows users to download and stream audio from YouTube videos. The application uses yt-dlp to extract audio from YouTube videos and serves it through an Express server. The frontend provides a simple interface to input a YouTube video ID and play the extracted audio.

## Features
Download and Stream Audio: Extracts audio from YouTube videos and streams it to the client.
Rate Limiting: Limits the number of requests per IP to prevent abuse.
CORS Support: Allows cross-origin requests.
Dockerized: Easily deployable using Docker.

## Getting Started

<ins>Prerequisites</ins> 

**Node.js**
**Docker**

<ins>Docker</ins>

Build the Docker image: `docker build -t yt-audio .`
un the Docker container: `docker run -p 3000:3000 yt-audio`


Open your browser and navigate to http://localhost:3000.




**WARNING**:
Please be aware that this application, designed for ad-free YouTube audio access, is a technical demonstration and, as such, if you use  [Deployed version](playersound.vercel.app) may experience intermittent failures. Due to YouTube's platform policies and anti-automation measures, including rate limiting and bot detection, successful and immediate audio extraction cannot be guaranteed in every instance.  Functionality may also be impacted by YouTube platform updates.  While best efforts have been made to mitigate these limitations through techniques like retry mechanisms and session cookies, users should anticipate potential failures and may need to retry requests for successful audio extraction.