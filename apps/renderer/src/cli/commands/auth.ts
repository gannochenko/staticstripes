import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { YouTubeUploader } from '../../youtube-uploader.js';
import open from 'open';
import http from 'http';
import { parse as parseUrl } from 'url';

function getOAuthInstructions(): string {
  let instructions = '';
  instructions +=
    '❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set\n\n';
  instructions += '📋 Getting Google OAuth Credentials:\n\n';
  instructions += '1. Go to Google Cloud Console:\n';
  instructions += '   https://console.cloud.google.com/\n\n';
  instructions += '2. Create or select a project\n\n';
  instructions += '3. Enable YouTube Data API v3:\n';
  instructions += '   - Go to "APIs & Services" > "Library"\n';
  instructions += '   - Search for "YouTube Data API v3"\n';
  instructions += '   - Click "Enable"\n\n';
  instructions += '4. Configure OAuth Consent Screen:\n';
  instructions += '   - Go to "APIs & Services" > "OAuth consent screen"\n';
  instructions += '   - Choose "External" user type\n';
  instructions += '   - Fill in app name and contact emails\n';
  instructions +=
    '   - Add scope: https://www.googleapis.com/auth/youtube.upload\n';
  instructions += '   - Add your email as a test user\n\n';
  instructions += '5. Create OAuth 2.0 Credentials:\n';
  instructions += '   - Go to "APIs & Services" > "Credentials"\n';
  instructions += '   - Click "Create Credentials" > "OAuth client ID"\n';
  instructions += '   - Choose "Web application"\n';
  instructions +=
    '   - Add redirect URI: http://localhost:3000/oauth2callback\n';
  instructions += '   - Click "Create"\n\n';
  instructions += '6. Copy your Client ID and Client Secret\n\n';
  instructions += '7. Publish your OAuth app (IMPORTANT):\n';
  instructions +=
    '   - Go to "APIs & Services" > "OAuth consent screen"\n';
  instructions += '   - Click "PUBLISH APP" button\n';
  instructions +=
    '   - This makes refresh tokens permanent (otherwise they expire in 7 days)\n';
  instructions +=
    '   - Note: For personal use, you don\'t need Google verification\n\n';
  instructions += '8. Set environment variables:\n\n';

  // Platform-specific instructions
  const platform = process.platform;
  if (platform === 'win32') {
    instructions += '   PowerShell (Recommended) - Run as Administrator:\n';
    instructions +=
      '     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_ID", "your-client-id.apps.googleusercontent.com", "User")\n';
    instructions +=
      '     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_GOOGLE_CLIENT_SECRET", "your-client-secret", "User")\n';
    instructions += '   Then restart your terminal\n\n';
    instructions += '   Or Command Prompt - Run as Administrator:\n';
    instructions +=
      '     setx STATICSTRIPES_GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"\n';
    instructions +=
      '     setx STATICSTRIPES_GOOGLE_CLIENT_SECRET "your-client-secret"\n';
    instructions += '   Then restart your terminal\n\n';
  } else if (platform === 'darwin') {
    instructions += '   Add to ~/.zshrc (or ~/.bash_profile for bash):\n';
    instructions +=
      '     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"\n';
    instructions +=
      '     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"\n\n';
    instructions += '   Then reload your shell:\n';
    instructions += '     source ~/.zshrc\n\n';
  } else {
    // Linux and others
    instructions += '   Add to ~/.bashrc (or ~/.zshrc for zsh):\n';
    instructions +=
      '     export STATICSTRIPES_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"\n';
    instructions +=
      '     export STATICSTRIPES_GOOGLE_CLIENT_SECRET="your-client-secret"\n\n';
    instructions += '   Then reload your shell:\n';
    instructions += '     source ~/.bashrc  # or source ~/.zshrc\n\n';
  }

  return instructions;
}

export function registerAuthCommands(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with YouTube for uploading')
    .option('-p, --project <path>', 'Path to project directory', '.')
    .requiredOption('--upload-name <name>', 'Name of the upload configuration')
    .action(async (options) => {
      try {
        // Get OAuth credentials from environment variables
        const clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          console.error(getOAuthInstructions());
          process.exit(1);
        }

        // Resolve project path
        const projectPath = resolve(process.cwd(), options.project);
        const projectFilePath = resolve(projectPath, 'project.html');

        // Validate project.html exists
        if (!existsSync(projectFilePath)) {
          console.error(`Error: project.html not found in ${projectPath}`);
          process.exit(1);
        }

        console.log(`📁 Project: ${projectPath}`);
        console.log(`🔐 Authenticating: ${options.uploadName}\n`);

        // Create uploader instance
        const uploader = new YouTubeUploader(clientId, clientSecret);

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

        // Complete authentication
        await uploader.authenticate(code, options.uploadName, projectPath);

        console.log(`✅ Authentication complete for ${options.uploadName}!\n`);
      } catch (error: any) {
        console.error(`\n❌ Authentication failed\n`);
        if (error.message) {
          console.error(`Error: ${error.message}\n`);
        }
        process.exit(1);
      }
    });

  program
    .command('auth-complete')
    .description(
      '(Fallback) Complete authentication with authorization code manually',
    )
    .option('-p, --project <path>', 'Path to project directory', '.')
    .requiredOption('--upload-name <name>', 'Name of the upload configuration')
    .requiredOption('--code <code>', 'Authorization code from OAuth flow')
    .action(async (options) => {
      try {
        const clientId = process.env.STATICSTRIPES_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.STATICSTRIPES_GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          console.error(
            '❌ Error: STATICSTRIPES_GOOGLE_CLIENT_ID and STATICSTRIPES_GOOGLE_CLIENT_SECRET environment variables are not set',
          );
          console.error('\n💡 Run: staticstripes auth --help');
          console.error('   for complete setup instructions\n');
          process.exit(1);
        }

        const projectPath = resolve(process.cwd(), options.project);

        // Create uploader and complete authentication
        const uploader = new YouTubeUploader(clientId, clientSecret);
        await uploader.authenticate(
          options.code,
          options.uploadName,
          projectPath,
        );

        console.log(`✅ Authentication complete for ${options.uploadName}`);
      } catch (error: any) {
        console.error(`\n❌ Authentication completion failed\n`);
        if (error.message) {
          console.error(`Error: ${error.message}\n`);
        }

        // Provide helpful guidance for common OAuth errors
        if (error.message === 'invalid_grant' || error.code === 400) {
          console.error('💡 Common causes:\n');
          console.error(
            '   • Authorization code expired (codes expire in ~60 seconds)',
          );
          console.error('   • Code was already used');
          console.error('   • Code was copied incorrectly\n');
          console.error(
            '🔄 Solution: Run the auth command again and complete it quickly:\n',
          );
          console.error(
            `   1. staticstripes auth --upload-name ${options.uploadName}`,
          );
          console.error('   2. Authorize in browser immediately');
          console.error('   3. Copy the code from the URL');
          console.error(
            '   4. Run auth-complete right away with the fresh code\n',
          );
        }
        process.exit(1);
      }
    });
}
