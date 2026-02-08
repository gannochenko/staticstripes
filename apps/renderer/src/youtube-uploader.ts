import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { YouTubeUpload } from './type';

const execAsync = promisify(exec);

// OAuth2 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_DIR = '.youtube-tokens'; // Directory to store tokens (excluded from git)

export class YouTubeUploader {
  private oauth2Client: OAuth2Client;
  private youtube: youtube_v3.Youtube;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string = 'http://localhost:3000/oauth2callback',
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Gets the authorization URL for OAuth flow
   */
  public getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent screen to ensure refresh token is issued
      scope: SCOPES,
    });
  }

  /**
   * Exchanges authorization code for tokens and saves them
   */
  public async authenticate(
    code: string,
    uploadName: string,
    projectDir: string,
  ): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Save tokens to file
    const tokenPath = this.getTokenPath(projectDir, uploadName);

    // Ensure the token directory exists
    const tokenDir = dirname(tokenPath);
    if (!existsSync(tokenDir)) {
      mkdirSync(tokenDir, { recursive: true });
    }

    writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    console.log(`✅ Tokens saved to ${tokenPath}`);
  }

  /**
   * Loads saved tokens for an upload
   */
  public loadTokens(uploadName: string, projectDir: string): boolean {
    const tokenPath = this.getTokenPath(projectDir, uploadName);

    if (!existsSync(tokenPath)) {
      return false;
    }

    const tokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));
    this.oauth2Client.setCredentials(tokens);

    // Set up auto-refresh: save updated tokens when they're refreshed
    this.oauth2Client.on('tokens', (refreshedTokens) => {
      // Merge with existing tokens (preserve refresh_token if not returned)
      const currentTokens = this.oauth2Client.credentials;
      const updatedTokens = { ...currentTokens, ...refreshedTokens };

      // Ensure token directory exists
      const tokenDir = dirname(tokenPath);
      if (!existsSync(tokenDir)) {
        mkdirSync(tokenDir, { recursive: true });
      }

      writeFileSync(tokenPath, JSON.stringify(updatedTokens, null, 2));
      console.log('🔄 Access token refreshed automatically');
    });

    return true;
  }

  /**
   * Uploads a video to YouTube
   */
  public async uploadVideo(
    videoPath: string,
    upload: YouTubeUpload,
    title: string,
  ): Promise<string> {
    console.log(`📤 Uploading video to YouTube...`);

    // Map category name to YouTube category ID
    const categoryId = this.getCategoryId(upload.category);

    const requestBody: youtube_v3.Schema$Video = {
      snippet: {
        title,
        description: upload.description,
        tags: upload.tags,
        categoryId,
        defaultLanguage: upload.language,
      },
      status: {
        privacyStatus: upload.privacy,
        selfDeclaredMadeForKids: upload.madeForKids,
      },
    };

    const media = {
      body: createReadStream(videoPath),
    };

    const response = await this.youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody,
      media,
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('Failed to get video ID from YouTube response');
    }

    console.log(`✅ Video uploaded successfully!`);
    console.log(`📹 Video ID: ${videoId}`);
    console.log(`🔗 URL: https://www.youtube.com/watch?v=${videoId}`);

    return videoId;
  }

  /**
   * Uploads a custom thumbnail to YouTube video
   */
  public async uploadThumbnail(
    videoId: string,
    thumbnailPath: string,
  ): Promise<void> {
    console.log(`🖼️  Uploading custom thumbnail...`);

    const media = {
      mimeType: 'image/png',
      body: createReadStream(thumbnailPath),
    };

    await this.youtube.thumbnails.set({
      videoId,
      media,
    });

    console.log(`✅ Thumbnail uploaded successfully!`);
  }

  /**
   * Extracts a frame from video at specific timecode using ffmpeg
   */
  public async extractThumbnail(
    videoPath: string,
    timecode: number,
    outputPath: string,
  ): Promise<void> {
    // Ensure the output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timeInSeconds = timecode / 1000;
    const command = `ffmpeg -y -ss ${timeInSeconds} -i "${videoPath}" -frames:v 1 -q:v 2 "${outputPath}"`;

    await execAsync(command);
  }

  /**
   * Gets the token file path for an upload
   */
  private getTokenPath(projectDir: string, uploadName: string): string {
    return resolve(projectDir, TOKEN_DIR, `${uploadName}.json`);
  }

  /**
   * Maps category name to YouTube category ID
   * Full list: https://developers.google.com/youtube/v3/docs/videoCategories/list
   */
  private getCategoryId(category: string): string {
    const categoryMap: Record<string, string> = {
      // Main categories
      'film & animation': '1',
      'film-animation': '1',
      'film': '1',
      'animation': '1',
      'autos & vehicles': '2',
      'autos-vehicles': '2',
      'autos': '2',
      'vehicles': '2',
      'music': '10',
      'pets & animals': '15',
      'pets-animals': '15',
      'pets': '15',
      'animals': '15',
      'sports': '17',
      'short movies': '18',
      'short-movies': '18',
      'travel & events': '19',
      'travel-events': '19',
      'travel': '19',
      'events': '19',
      'gaming': '20',
      'videoblogging': '21',
      'vlogging': '21',
      'vlog': '21',
      'people & blogs': '22',
      'people-blogs': '22',
      'people': '22',
      'blogs': '22',
      'comedy': '23',
      'entertainment': '24',
      'news & politics': '25',
      'news-politics': '25',
      'news': '25',
      'politics': '25',
      'howto & style': '26',
      'howto-style': '26',
      'howto': '26',
      'how to': '26',
      'how-to': '26',
      'style': '26',
      'education': '27',
      'science & technology': '28',
      'science-technology': '28',
      'science': '28',
      'technology': '28',
      'tech': '28',
      'nonprofits & activism': '29',
      'nonprofits-activism': '29',
      'nonprofits': '29',
      'activism': '29',
      'nonprofit': '29',

      // Movie-related categories
      'movies': '30',
      'anime/animation': '31',
      'anime': '31',
      'action/adventure': '32',
      'action-adventure': '32',
      'action': '32',
      'adventure': '32',
      'classics': '33',
      'documentary': '35',
      'drama': '36',
      'family': '37',
      'foreign': '38',
      'horror': '39',
      'sci-fi/fantasy': '40',
      'sci-fi': '40',
      'scifi': '40',
      'fantasy': '40',
      'thriller': '41',
      'shorts': '42',
      'shows': '43',
      'trailers': '44',
    };

    return categoryMap[category.toLowerCase()] || '24'; // Default to Entertainment
  }
}
