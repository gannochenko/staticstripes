import { AuthStrategy } from '../auth-strategy';
import { YouTubeUploader } from '../../youtube-uploader.js';
import open from 'open';
import http from 'http';
import { parse as parseUrl } from 'url';

/**
 * YouTube authentication strategy
 * Uses OAuth 2.0 flow with local callback server
 */
export class YouTubeAuthStrategy implements AuthStrategy {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET || '';
  }

  getTag(): string {
    return 'youtube';
  }

  async execute(uploadName: string, projectPath: string): Promise<void> {
    console.log(`🔐 Authenticating: ${uploadName}\n`);

    // Create uploader instance
    const uploader = new YouTubeUploader(this.clientId, this.clientSecret);

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
                  <h1>✅ Authorization Successful!</h1>
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

    // Complete authentication
    await uploader.authenticate(code, uploadName, projectPath);

    console.log(`✅ Authentication complete for ${uploadName}!\n`);
  }

  getSetupInstructions(): string {
    const platform = process.platform;
    let envInstructions = '';

    if (platform === 'win32') {
      envInstructions = `
   PowerShell (Recommended) - Run as Administrator:
     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_ID", "your-client-id.apps.googleusercontent.com", "User")
     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_SECRET", "your-client-secret", "User")
   Then restart your terminal

   Or Command Prompt - Run as Administrator:
     setx STATICSTRIPES_GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
     setx STATICSTRIPES_GOOGLE_CLIENT_SECRET "your-client-secret"
   Then restart your terminal
`;
    } else if (platform === 'darwin') {
      envInstructions = `
   Add to ~/.zshrc (or ~/.bash_profile for bash):
     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"

   Then reload your shell:
     source ~/.zshrc
`;
    } else {
      envInstructions = `
   Add to ~/.bashrc (or ~/.zshrc for zsh):
     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"

   Then reload your shell:
     source ~/.bashrc  # or source ~/.zshrc
`;
    }

    return `
YouTube Authentication Setup:

1. Go to Google Cloud Console:
   https://console.cloud.google.com/

2. Create or select a project

3. Enable YouTube Data API v3:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

4. Configure OAuth Consent Screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill in app name and contact emails
   - Add scope: https://www.googleapis.com/auth/youtube.upload
   - Add your email as a test user

5. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add redirect URI: http://localhost:3000/oauth2callback
   - Click "Create"

6. Copy your Client ID and Client Secret

7. Publish your OAuth app (IMPORTANT):
   - Go to "APIs & Services" > "OAuth consent screen"
   - Click "PUBLISH APP" button
   - This makes refresh tokens permanent (otherwise they expire in 7 days)
   - Note: For personal use, you don't need Google verification

8. Set environment variables:
${envInstructions}

9. Run authentication command:
   staticstripes auth --upload-name YOUR_UPLOAD_NAME
`;
  }
}
