import { AuthStrategy } from '../auth-strategy';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

/**
 * Instagram authentication strategy
 * Guides users through manual token generation process
 */
export class InstagramAuthStrategy implements AuthStrategy {
  getTag(): string {
    return 'instagram';
  }

  async execute(uploadName: string, projectPath: string): Promise<void> {
    console.log('🔐 Instagram Authentication Setup\n');
    console.log(
      '📝 Instagram uses Facebook Graph API, which requires manual token generation.',
    );
    console.log('   This wizard will guide you through the process.\n');
    console.log('💡 Tip: Run `staticstripes auth-help instagram` for detailed setup instructions\n');

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
      console.log('STEP 1: Get Long-Lived Access Token');
      console.log('━'.repeat(60));
      console.log('');
      console.log('1. Go to https://developers.facebook.com/tools/explorer/');
      console.log('2. Select your app');
      console.log('3. Click "Generate Access Token"');
      console.log('4. Exchange for long-lived token using cURL:\n');
      console.log('   curl -X GET "https://graph.instagram.com/access_token\\');
      console.log('     ?grant_type=ig_exchange_token\\');
      console.log('     &client_secret={APP_SECRET}\\');
      console.log('     &access_token={SHORT_LIVED_TOKEN}"\n');

      const accessToken = await question('Enter your long-lived access token: ');

      if (!accessToken || accessToken.trim().length < 10) {
        throw new Error('Invalid access token');
      }

      console.log('\n━'.repeat(60));
      console.log('STEP 2: Get Instagram User ID');
      console.log('━'.repeat(60));
      console.log('');
      console.log('Run this cURL command:\n');
      console.log(
        `   curl -X GET "https://graph.facebook.com/v21.0/me/accounts\\`,
      );
      console.log(`     ?fields=instagram_business_account{id}\\`);
      console.log(`     &access_token=${accessToken.substring(0, 20)}..."\n`);
      console.log(
        'Look for "instagram_business_account" → "id" in the response\n',
      );

      const igUserId = await question('Enter your Instagram User ID: ');

      if (!igUserId || igUserId.trim().length < 10) {
        throw new Error('Invalid Instagram User ID');
      }

      console.log('\n━'.repeat(60));
      console.log('STEP 3: Verify Configuration');
      console.log('━'.repeat(60));
      console.log('');
      console.log(`Upload Name:     ${uploadName}`);
      console.log(`Access Token:    ${accessToken.substring(0, 20)}...`);
      console.log(`IG User ID:      ${igUserId}`);
      console.log('');

      const confirm = await question(
        'Save these credentials? (yes/no): ',
      );

      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('\n❌ Authentication cancelled\n');
        rl.close();
        process.exit(0);
      }

      // Save credentials
      const authDir = resolve(projectPath, '.auth');
      if (!existsSync(authDir)) {
        mkdirSync(authDir, { recursive: true });
      }

      const credentialsPath = resolve(authDir, `${uploadName}.json`);
      const credentials = {
        accessToken: accessToken.trim(),
        igUserId: igUserId.trim(),
      };

      writeFileSync(
        credentialsPath,
        JSON.stringify(credentials, null, 2),
        'utf-8',
      );

      console.log('\n✅ Authentication complete!\n');
      console.log(`📁 Credentials saved to: ${credentialsPath}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Token expires in 60 days');
      console.log('   Refresh before expiry using:\n');
      console.log(
        '   curl -X GET "https://graph.instagram.com/refresh_access_token\\',
      );
      console.log('     ?grant_type=ig_refresh_token\\');
      console.log(`     &access_token=${accessToken.substring(0, 20)}..."\n`);
      console.log(`🎬 Ready to upload! Run: staticstripes upload --upload-name ${uploadName}\n`);

      rl.close();
    } catch (error) {
      rl.close();
      throw error;
    }
  }

  getSetupInstructions(): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instagram Authentication Setup Guide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  PREREQUISITES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST have:
  ✅ Instagram Business or Creator account (NOT personal account)
  ✅ Connected to a Facebook Page
  ✅ Admin/Editor role on that Facebook Page

To convert personal to business:
  1. Instagram → Settings → Account
  2. Switch to Professional Account → Business/Creator
  3. Connect to Facebook Page (create one if needed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Create Facebook App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://developers.facebook.com
2. Click "My Apps" → "Create App"
3. Choose "Business" as app type
4. Fill in:
   • App Name: (e.g., "My Video Uploader")
   • App Contact Email: Your email
5. Click "Create App"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Add Instagram Product
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. In your app dashboard, find "Instagram" under Products
2. Click "Set Up"
3. Choose "API Setup with Instagram Login"
   ⚠️  NOT "API Setup with Facebook Login"!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: Generate Short-Lived Token
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app from the dropdown (top right)
3. Click "Generate Access Token"
4. Click "Add account"
5. Log in to Instagram and authorize
6. Copy the token (valid for 1 hour)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: Exchange for Long-Lived Token (60 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Get your App Secret:
  • Go to your app dashboard
  • Settings → Basic
  • Click "Show" next to App Secret

Run this cURL command:

  curl -X GET "https://graph.instagram.com/access_token\\
    ?grant_type=ig_exchange_token\\
    &client_secret={YOUR_APP_SECRET}\\
    &access_token={SHORT_LIVED_TOKEN}"

Response:
  {
    "access_token": "LONG_LIVED_TOKEN_HERE",
    "token_type": "bearer",
    "expires_in": 5183944
  }

📋 Save this access_token - it's valid for 60 days!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: Get Instagram User ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Method 1 - Graph API Explorer:
  1. Go to: https://developers.facebook.com/tools/explorer/
  2. Paste your long-lived token
  3. Enter endpoint: me/accounts?fields=instagram_business_account
  4. Click "Submit"
  5. Look for "instagram_business_account" → "id"

Method 2 - cURL:

  curl -X GET "https://graph.facebook.com/v21.0/me/accounts\\
    ?fields=instagram_business_account{id,username}\\
    &access_token={LONG_LIVED_TOKEN}"

Response:
  {
    "data": [
      {
        "instagram_business_account": {
          "id": "17841401234567890",  ← This is your IG User ID
          "username": "your_username"
        }
      }
    ]
  }

⚠️  Make sure you get the Instagram Business Account ID
    (typically starts with "17841...")
    NOT the Facebook Page ID!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6: Run Authentication Command
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  staticstripes auth --upload-name ig_primary

The wizard will prompt you to enter:
  • Long-lived access token
  • Instagram User ID

Credentials will be saved to: .auth/ig_primary.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN REFRESH (Every 60 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tokens expire after 60 days. Refresh before expiry:

  curl -X GET "https://graph.instagram.com/refresh_access_token\\
    ?grant_type=ig_refresh_token\\
    &access_token={CURRENT_LONG_LIVED_TOKEN}"

Requirements:
  • Token must be at least 24 hours old
  • Token must not be expired
  • Refreshed token is valid for another 60 days

💡 Set a calendar reminder for 50 days!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ "Invalid OAuth access token"
   → Token expired (refresh it)
   → Wrong token format
   → App permissions not granted

❌ "Invalid Instagram User ID"
   → Make sure it's the Business Account ID, not Page ID
   → IDs typically start with "17841..."

❌ "Video URL not accessible"
   → Ensure S3 ACL is set to "public-read"
   → Test the S3 URL in your browser first

❌ "Unsupported video format"
   → Must be MP4 format
   → Max 100MB file size
   → Must meet Instagram's encoding requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Graph API Explorer:
  https://developers.facebook.com/tools/explorer/

• Instagram Graph API Docs:
  https://developers.facebook.com/docs/instagram-api/

• Facebook Apps Dashboard:
  https://developers.facebook.com/apps/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}
