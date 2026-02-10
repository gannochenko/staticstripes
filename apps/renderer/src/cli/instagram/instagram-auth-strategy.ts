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

    // Check if INSTAGRAM_SETUP.md exists
    const setupDocPath = resolve(__dirname, '../../../INSTAGRAM_SETUP.md');
    if (existsSync(setupDocPath)) {
      console.log(
        `📖 Detailed setup guide available at: ${setupDocPath}\n`,
      );
    }

    console.log('📋 Quick Steps:');
    console.log(
      '   1. Create a Facebook App at https://developers.facebook.com',
    );
    console.log('   2. Add Instagram product and configure API');
    console.log(
      '   3. Generate access token via Graph API Explorer',
    );
    console.log('   4. Exchange for long-lived token (60 days)');
    console.log('   5. Get your Instagram Business Account ID\n');

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
Instagram Authentication Setup:

1. Prerequisites:
   - Instagram Business/Creator account
   - Connected to a Facebook Page
   - Admin/Editor role on that page

2. Create Facebook App:
   https://developers.facebook.com → Create App → Business

3. Add Instagram Product:
   Dashboard → Add Product → Instagram → API Setup

4. Generate Token:
   https://developers.facebook.com/tools/explorer/
   → Generate Access Token → Exchange for long-lived

5. Get Instagram User ID:
   Query: me/accounts?fields=instagram_business_account{id}

6. Run authentication command:
   staticstripes auth --upload-name YOUR_UPLOAD_NAME

For detailed instructions, see: INSTAGRAM_SETUP.md
`;
  }
}
