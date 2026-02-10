import { AuthStrategy } from '../auth-strategy';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

/**
 * Instagram authentication strategy
 * Semi-automatic flow: user provides short-lived token, we handle the rest
 */
export class InstagramAuthStrategy implements AuthStrategy {
  private appSecret: string;

  constructor() {
    this.appSecret = process.env.STATICSTRIPES_INSTAGRAM_APP_SECRET || '';
  }

  getTag(): string {
    return 'instagram';
  }

  async execute(uploadName: string, projectPath: string): Promise<void> {
    console.log('🔐 Instagram Authentication Setup\n');

    // Validate environment variables
    if (!this.appSecret) {
      throw new Error(
        '❌ Error: STATICSTRIPES_INSTAGRAM_APP_SECRET environment variable is not set\n\n' +
          '📖 View setup instructions:\n' +
          '   staticstripes auth-help instagram\n',
      );
    }

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
      console.log('STEP 1: Get Short-Lived Token');
      console.log('━'.repeat(60));
      console.log('');
      console.log('1. Go to: https://developers.facebook.com/tools/explorer/');
      console.log('2. Select your Instagram app from dropdown');
      console.log('3. Click "Generate Access Token"');
      console.log('4. Grant permissions when prompted');
      console.log('5. Copy the token (starts with IGAA...)');
      console.log('');

      const shortLivedToken = await question('Enter your short-lived token: ');

      if (!shortLivedToken || shortLivedToken.trim().length < 20) {
        throw new Error('Invalid token');
      }

      console.log('\n🔄 Exchanging for long-lived token (60 days)...\n');

      // Exchange for long-lived token
      const longLivedToken = await this.exchangeForLongLivedToken(
        shortLivedToken.trim(),
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
      console.log('🎬 Ready to upload! Run:\n');
      console.log(`   staticstripes upload --upload-name ${uploadName}\n`);

      rl.close();
    } catch (error) {
      rl.close();
      throw error;
    }
  }


  /**
   * Exchanges short-lived token for long-lived token (60 days)
   */
  private async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.appSecret,
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
    const platform = process.platform;
    let envInstructions = '';

    if (platform === 'win32') {
      envInstructions = `
   PowerShell (Recommended) - Run as Administrator:
     [System.Environment]::SetEnvironmentVariable("STATICSTRIPES_INSTAGRAM_APP_SECRET", "your-app-secret", "User")
   Then restart your terminal

   Or Command Prompt - Run as Administrator:
     setx STATICSTRIPES_INSTAGRAM_APP_SECRET "your-app-secret"
   Then restart your terminal
`;
    } else if (platform === 'darwin') {
      envInstructions = `
   Add to ~/.zshrc (or ~/.bash_profile for bash):
     export STATICSTRIPES_INSTAGRAM_APP_SECRET="your-app-secret"

   Then reload your shell:
     source ~/.zshrc
`;
    } else {
      envInstructions = `
   Add to ~/.bashrc (or ~/.zshrc for zsh):
     export STATICSTRIPES_INSTAGRAM_APP_SECRET="your-app-secret"

   Then reload your shell:
     source ~/.bashrc  # or source ~/.zshrc
`;
    }

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instagram Authentication Setup (Simplified Semi-Automatic Flow)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This method uses a semi-automatic approach: you get a token from Facebook's
Graph API Explorer, and our CLI handles the rest automatically!

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
   "Manage messaging & content on Instagram" (or similar)
5. Select app type: "Business"
6. Fill in:
   • App name: "My Instagram Uploader"
   • Contact email: your.email@example.com
7. Click "Create App"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Get Your App Secret
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. In app dashboard, click "Customize" on the Instagram use case
2. You'll see:
   • Instagram app ID
   • Instagram app secret (click "Show" to reveal)
3. Copy the Instagram app secret

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: Add Yourself as Tester
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
STEP 4: Set Environment Variable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${envInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: Run Authentication Command
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run:
  staticstripes auth --upload-name YOUR_UPLOAD_NAME

The wizard will:
1. Ask you to get a short-lived token from Graph API Explorer
2. Automatically exchange it for a long-lived token (60 days)
3. Automatically fetch your Instagram User ID
4. Save credentials to .auth/YOUR_UPLOAD_NAME.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN REFRESH (Every 60 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tokens expire after 60 days. To refresh:

  curl -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=YOUR_CURRENT_TOKEN"

💡 Set a calendar reminder for 50 days!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ "Insufficient Developer Role"
   → Make sure you added yourself as Instagram Tester (Step 3)
   → Accept the invitation in Instagram mobile app

❌ "Invalid OAuth access token"
   → Token expired (they expire in 1 hour, get a new one)
   → Make sure you're using your Instagram app (not Facebook app)

❌ "OAuthException"
   → Check that INSTAGRAM_APP_SECRET is correct
   → Verify you accepted the tester invitation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Facebook Apps Dashboard:
  https://developers.facebook.com/apps/

• Graph API Explorer (to get tokens):
  https://developers.facebook.com/tools/explorer/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}
