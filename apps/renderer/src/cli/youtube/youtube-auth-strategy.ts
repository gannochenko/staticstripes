import { AuthStrategy } from '../auth-strategy';
import { YouTubeUploader } from '../../youtube-uploader.js';
import open from 'open';
import http from 'http';
import { parse as parseUrl } from 'url';
import * as readline from 'readline';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * YouTube authentication strategy
 * Uses OAuth 2.0 flow with local callback server
 */
export class YouTubeAuthStrategy implements AuthStrategy {
  getTag(): string {
    return 'youtube';
  }

  async execute(uploadName: string, projectPath: string): Promise<void> {
    console.log(`🔐 YouTube Authentication Setup\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer);
        });
      });
    };

    try {
      console.log('━'.repeat(60));
      console.log('STEP 1: Enter YouTube API Credentials');
      console.log('━'.repeat(60));
      console.log('');
      console.log('💡 Run `staticstripes auth-help youtube` for setup instructions\n');

      const clientId = await question('Enter your OAuth Client ID: ');
      if (!clientId || clientId.trim().length < 10) {
        throw new Error('Invalid Client ID');
      }

      const clientSecret = await question('Enter your OAuth Client Secret: ');
      if (!clientSecret || clientSecret.trim().length < 10) {
        throw new Error('Invalid Client Secret');
      }

      console.log('\n━'.repeat(60));
      console.log('STEP 2: Authorize with Google');
      console.log('━'.repeat(60));
      console.log('');

      rl.close();

      // Create uploader instance
      const uploader = new YouTubeUploader(
        clientId.trim(),
        clientSecret.trim(),
      );

    // Get authorization URL
    const authUrl = uploader.getAuthUrl();

    console.log('🌐 Starting local server on http://localhost:3000...\n');

    // Create a promise that resolves when we get the OAuth callback
    const authPromise = new Promise<string>((resolve, reject) => {
      // Track all connections to force-close them
      const connections = new Set<any>();

      const server = http.createServer((req, res) => {
        const url = parseUrl(req.url || '', true);

        if (url.pathname === '/oauth2callback') {
          const code = url.query.code as string;
          const error = url.query.error as string;

          const closeServer = () => {
            // Destroy all connections
            connections.forEach((socket) => {
              socket.destroy();
            });
            connections.clear();
            server.close();
          };

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>❌ Authorization Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            res.on('finish', closeServer);
            reject(new Error(`Authorization failed: ${error}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>Authorization Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            res.on('finish', closeServer);
            resolve(code);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>❌ No Authorization Code</h1>
                  <p>No code was received from Google.</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            res.on('finish', closeServer);
            reject(new Error('No authorization code received'));
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      // Track connections
      server.on('connection', (socket) => {
        connections.add(socket);
        socket.on('close', () => {
          connections.delete(socket);
        });
      });

      server.listen(3000, () => {
        console.log('✅ Server started successfully\n');
      });

      // Set timeout to avoid hanging forever
      setTimeout(
        () => {
          connections.forEach((socket) => {
            socket.destroy();
          });
          connections.clear();
          server.close();
          reject(new Error('Authentication timeout (5 minutes)'));
        },
        5 * 60 * 1000,
      );
    });

    console.log('🌐 Opening browser for authorization...\n');

    // Open browser automatically
    try {
      await open(authUrl);
      console.log('✅ Browser opened successfully\n');
    } catch (err) {
      console.log('⚠️  Could not open browser automatically');
      console.log('🌐 Please visit this URL to authorize:\n');
      console.log(authUrl);
      console.log();
    }

    console.log('⏳ Waiting for authorization...\n');

    // Wait for the OAuth callback
    const code = await authPromise;

    console.log('🔑 Authorization code received\n');
    console.log('💾 Saving authentication tokens...\n');

      // Complete authentication - saves OAuth tokens to .auth file
      await uploader.authenticate(code, uploadName, projectPath);

      // Now add clientId and clientSecret to the saved file
      const authDir = resolve(projectPath, '.auth');
      const credentialsPath = resolve(authDir, `${uploadName}.json`);

      // Read the tokens that were just saved
      const { readFileSync } = await import('fs');
      const savedTokens = JSON.parse(readFileSync(credentialsPath, 'utf-8'));

      // Add clientId and clientSecret
      const fullCredentials = {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        ...savedTokens,
      };

      // Save back with all credentials
      writeFileSync(
        credentialsPath,
        JSON.stringify(fullCredentials, null, 2),
        'utf-8',
      );

      console.log(`✅ Authentication complete for ${uploadName}!\n`);
      console.log(`📁 Credentials saved to: ${credentialsPath}\n`);
    } catch (error) {
      throw error;
    }
  }

  getSetupInstructions(): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YouTube Authentication Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Interactive OAuth 2.0 flow - no environment variables needed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Go to Google Cloud Console
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: https://console.cloud.google.com/

1. Create or select a project

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Enable YouTube Data API v3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to "APIs & Services" > "Library"
2. Search for "YouTube Data API v3"
3. Click "Enable"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: Configure OAuth Consent Screen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in:
   • App name: "My YouTube Uploader"
   • User support email: your.email@example.com
   • Developer contact email: your.email@example.com
4. Click "Save and Continue"
5. Add scope: https://www.googleapis.com/auth/youtube.upload
6. Click "Save and Continue"
7. Add your email as a test user
8. Click "Save and Continue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: Create OAuth 2.0 Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Name: "YouTube Uploader"
5. Add redirect URI: http://localhost:3000/oauth2callback
   (Make sure it's exactly this - no trailing slash!)
6. Click "Create"
7. Copy your Client ID (looks like: xxx.apps.googleusercontent.com)
8. Copy your Client Secret

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: Publish Your OAuth App (IMPORTANT!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to "APIs & Services" > "OAuth consent screen"
2. Click "PUBLISH APP" button
3. This makes refresh tokens permanent (otherwise they expire in 7 days)
4. Note: For personal use, you don't need Google verification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6: Run Authentication Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run:
  staticstripes auth --upload-name YOUR_UPLOAD_NAME

The wizard will:
1. Ask you to enter your OAuth Client ID
2. Ask you to enter your OAuth Client Secret
3. Start local server on port 3000
4. Open browser automatically for Google authorization
5. Automatically exchange authorization code for tokens
6. Save ALL credentials to .auth/YOUR_UPLOAD_NAME.json

Done! Interactive and secure - no environment variables needed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ "redirect_uri_mismatch"
   → Make sure redirect URI is exactly: http://localhost:3000/oauth2callback
   → No trailing slash, no typos!

❌ "Invalid client" error
   → Double-check your Client ID and Client Secret
   → Make sure you copied them correctly

❌ Tokens expire after 7 days
   → Publish your OAuth app (Step 5)
   → This makes refresh tokens last indefinitely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Google Cloud Console:
  https://console.cloud.google.com/

• YouTube Data API docs:
  https://developers.google.com/youtube/v3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}
