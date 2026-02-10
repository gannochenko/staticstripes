import { AuthStrategy } from '../auth-strategy';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import open from 'open';
import http from 'http';
import { parse as parseUrl } from 'url';
import * as readline from 'readline';

/**
 * Instagram authentication strategy
 * Automatic OAuth flow with browser redirect (like YouTube)
 */
export class InstagramAuthStrategy implements AuthStrategy {
  private redirectUri: string = 'http://localhost:3000/oauth2callback';

  getTag(): string {
    return 'instagram';
  }

  async execute(uploadName: string, projectPath: string): Promise<void> {
    console.log(`🔐 Instagram Authentication Setup\n`);

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
      console.log('STEP 1: Enter Instagram App Credentials');
      console.log('━'.repeat(60));
      console.log('');
      console.log('💡 Run `staticstripes auth-help instagram` for setup instructions\n');

      const appId = await question('Enter your Instagram App ID: ');
      if (!appId || appId.trim().length < 5) {
        throw new Error('Invalid App ID');
      }

      const appSecret = await question('Enter your Instagram App Secret: ');
      if (!appSecret || appSecret.trim().length < 10) {
        throw new Error('Invalid App Secret');
      }

      console.log('\n━'.repeat(60));
      console.log('STEP 2: Authorize with Instagram');
      console.log('━'.repeat(60));
      console.log('');

      rl.close();

      console.log('🌐 Starting local server on http://localhost:3000...\n');

      // Wait for OAuth callback
      const authCode = await this.waitForAuthCode(appId.trim());

      console.log('🔑 Authorization code received\n');
      console.log('🔄 Exchanging for access token...\n');

      // Exchange code for short-lived token
      const shortLivedToken = await this.exchangeCodeForToken(
        authCode,
        appId.trim(),
        appSecret.trim(),
      );

      console.log('✅ Short-lived token received\n');
      console.log('🔄 Exchanging for long-lived token (60 days)...\n');

      // Exchange for long-lived token
      const longLivedToken = await this.exchangeForLongLivedToken(
        shortLivedToken,
        appSecret.trim(),
      );

      console.log('✅ Long-lived token received\n');
      console.log('🔍 Fetching Instagram account info...\n');

      // Get Instagram user ID
      const { id, username } = await this.getInstagramUserId(longLivedToken);

      console.log(`✅ Account: @${username}`);
      console.log(`✅ Instagram User ID: ${id}\n`);
      console.log('💾 Saving credentials...\n');

      // Save credentials
      const authDir = resolve(projectPath, '.auth');
      if (!existsSync(authDir)) {
        mkdirSync(authDir, { recursive: true });
      }

      const credentialsPath = resolve(authDir, `${uploadName}.json`);
      const credentials = {
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        accessToken: longLivedToken,
        igUserId: id,
      };

      writeFileSync(
        credentialsPath,
        JSON.stringify(credentials, null, 2),
        'utf-8',
      );

      console.log(`✅ Authentication complete for ${uploadName}!\n`);
      console.log(`📁 Credentials saved to: ${credentialsPath}\n`);
      console.log('⚠️  Token expires in 60 days - set a reminder to refresh!\n');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generates Instagram OAuth authorization URL
   */
  private getAuthUrl(appId: string): string {
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.redirectUri,
      scope: 'instagram_business_basic,instagram_business_content_publish',
      response_type: 'code',
      state: Math.random().toString(36).substring(7),
    });

    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Starts local HTTP server and waits for OAuth callback
   */
  private async waitForAuthCode(appId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const connections = new Set<any>();

      const server = http.createServer((req, res) => {
        const url = parseUrl(req.url || '', true);

        if (url.pathname === '/oauth2callback') {
          const code = url.query.code as string;
          const error = url.query.error as string;

          const closeServer = () => {
            connections.forEach((socket) => socket.destroy());
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
                  <p>${url.query.error_description || ''}</p>
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
                  <p>No code was received from Instagram.</p>
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

      server.on('connection', (socket) => {
        connections.add(socket);
        socket.on('close', () => connections.delete(socket));
      });

      server.listen(3000, async () => {
        console.log('✅ Server started successfully\n');
        console.log(
          `🌐 Opening browser for authorization, redirect url = ${this.redirectUri}\n`,
        );

        const authUrl = this.getAuthUrl(appId);
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
      });

      setTimeout(
        () => {
          connections.forEach((socket) => socket.destroy());
          connections.clear();
          server.close();
          reject(new Error('Authentication timeout (5 minutes)'));
        },
        5 * 60 * 1000,
      );
    });
  }

  /**
   * Exchanges authorization code for short-lived access token
   */
  private async exchangeCodeForToken(
    code: string,
    appId: string,
    appSecret: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code: code,
    });

    const response = await fetch(
      'https://api.instagram.com/oauth/access_token',
      {
        method: 'POST',
        body: params,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to exchange code for token: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  /**
   * Exchanges short-lived token for long-lived token (60 days)
   */
  private async exchangeForLongLivedToken(
    shortLivedToken: string,
    appSecret: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortLivedToken,
    });

    const response = await fetch(
      `https://graph.instagram.com/access_token?${params.toString()}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to exchange for long-lived token: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new Error('No long-lived access token in response');
    }

    return data.access_token;
  }

  /**
   * Gets the Instagram user ID and username from the /me endpoint
   */
  private async getInstagramUserId(
    accessToken: string,
  ): Promise<{ id: string; username: string }> {
    const params = new URLSearchParams({
      fields: 'id,username',
      access_token: accessToken,
    });

    const response = await fetch(
      `https://graph.instagram.com/me?${params.toString()}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get Instagram user info: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as { id?: string; username?: string };

    if (!data.id || !data.username) {
      throw new Error('No user ID or username in response');
    }

    return { id: data.id, username: data.username };
  }

  getSetupInstructions(): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instagram Authentication Setup (Automatic OAuth Flow)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Automatic browser-based authentication - just like YouTube!

⚠️  PREREQUISITES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Instagram Business or Creator account (NOT personal)
  ✅ Facebook account (for creating the app)

Convert to Business/Creator if needed:
  Instagram app → Profile → Menu → Settings → Account
  → "Switch to Professional Account" → Choose Business or Creator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Create Facebook Developer App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://developers.facebook.com
2. Click "Get Started" → Log in → Complete registration
3. Click "My Apps" → "Create App"
4. When asked about use case, select:
   "Manage messaging & content on Instagram"
5. Select app type: "Business"
6. Fill in:
   • App name: "My Instagram Uploader"
   • Contact email: your.email@example.com
7. Click "Create App"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Get Your App Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. In app dashboard, click "Customize" on the Instagram use case
2. You'll see:
   • Instagram app ID (copy this!)
   • Instagram app secret (click "Show" to reveal, copy this!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: Configure OAuth Redirect URI (IMPORTANT!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is the tricky part - finding where to add the redirect URI.

Try these locations (interface keeps changing):

Option A - In "Customize" screen:
  1. Scroll down in the "Customize" screen
  2. Look for "OAuth Redirect URIs" or "Valid OAuth Redirect URIs"
  3. Add: http://localhost:3000/oauth2callback
  4. Click "Save"

Option B - Under Use Cases:
  1. Left sidebar → "Use cases"
  2. Click on "Manage messaging & content on Instagram"
  3. Look for "Settings" or "Configure" button
  4. Find "OAuth Redirect URIs" section
  5. Add: http://localhost:3000/oauth2callback
  6. Click "Save"

Option C - In Products:
  1. Left sidebar → Look for "Instagram" under Products
  2. Click "Settings" or gear icon next to Instagram
  3. Find "OAuth Redirect URIs"
  4. Add: http://localhost:3000/oauth2callback
  5. Click "Save"

If you can't find it anywhere, take a screenshot and we'll figure it out!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: Add Yourself as Tester
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. In app dashboard → "Roles" (left sidebar)
2. Scroll to "Instagram Testers" section
3. Click "Add Instagram Testers"
4. Enter your Instagram username (without @)
5. Click "Submit"

Accept the invitation on Instagram:
6. Instagram mobile app → Settings → Business → Apps and websites
   (or Settings → For Professionals → Invitations)
7. Accept the tester invitation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: Run Authentication Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run:
  staticstripes auth --upload-name YOUR_UPLOAD_NAME

The wizard will:
1. Ask you to enter your App ID and App Secret
2. Start local server on port 3000
3. Open browser automatically
4. Ask you to authorize the app
5. Automatically exchange tokens
6. Save ALL credentials to .auth/YOUR_UPLOAD_NAME.json

Done! Just like YouTube auth - interactive and easy!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN REFRESH (Every 60 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tokens expire after 60 days. To refresh:

  curl -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=YOUR_CURRENT_TOKEN"

💡 Set a calendar reminder for 50 days!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ "redirect_uri_mismatch"
   → Make sure you added http://localhost:3000/oauth2callback in Step 3
   → Check for typos (no trailing slash!)
   → Make sure you clicked "Save" after adding it

❌ "Insufficient Developer Role"
   → Add yourself as Instagram Tester (Step 4)
   → Accept invitation in Instagram mobile app

❌ "Can't find OAuth Redirect URI settings"
   → Facebook keeps moving this around (fuck them)
   → Look in: Customize, Use cases, Products → Instagram
   → Or just send me a screenshot, I'll tell you where it is

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Facebook Apps Dashboard:
  https://developers.facebook.com/apps/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}
