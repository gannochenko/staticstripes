# Instagram Upload Setup Guide

This guide will walk you through getting the credentials needed for Instagram Reels uploads.

## Prerequisites

**IMPORTANT**: You must have:
- ✅ **Instagram Business or Creator account** (Personal accounts no longer work as of 2024)
- ✅ **Facebook Page** connected to your Instagram account
- ✅ **Admin/Editor role** on that Facebook Page

### Converting to Business Account

If you have a personal Instagram account:
1. Go to Settings > Account
2. Tap "Switch to Professional Account"
3. Choose "Business" or "Creator"
4. Connect to a Facebook Page (create one if needed)

---

## Step 1: Create Facebook App

1. Go to **https://developers.facebook.com**
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** as app type
4. Fill in:
   - **App Name**: e.g., "My Video Uploader"
   - **App Contact Email**: Your email
5. Click **"Create App"**

---

## Step 2: Add Instagram Product

1. In your app dashboard, find **"Instagram"** under Products
2. Click **"Set Up"**
3. Choose **"API Setup with Instagram Login"** (NOT Facebook Login)

---

## Step 3: Get Access Token

### Option A: Quick Method (Graph API Explorer)

1. Go to **https://developers.facebook.com/tools/explorer/**
2. Select your app from the dropdown
3. Click **"Generate Access Token"**
4. Click **"Add account"**
5. Log in to Instagram and authorize
6. **Copy the short-lived token** (valid 1 hour)

### Option B: Manual Method

Build this URL (replace `{APP_ID}` and `{REDIRECT_URI}`):
```
https://api.instagram.com/oauth/authorize
  ?client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &scope=instagram_basic,instagram_content_publish
  &response_type=code
```

Load it in your browser → Authorize → Get code from redirect URL

---

## Step 4: Exchange for Long-Lived Token

Short-lived tokens expire in 1 hour. Convert to 60-day token:

```bash
curl -X GET "https://graph.instagram.com/access_token\
  ?grant_type=ig_exchange_token\
  &client_secret={APP_SECRET}\
  &access_token={SHORT_LIVED_TOKEN}"
```

**Where to find APP_SECRET**:
- Go to your app dashboard
- Settings → Basic
- Click "Show" next to App Secret

**Response:**
```json
{
  "access_token": "LONG_LIVED_TOKEN_HERE",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

Save this `access_token` - it's valid for 60 days!

---

## Step 5: Get Instagram User ID

### Method 1: Graph API Explorer

1. Go to **https://developers.facebook.com/tools/explorer/**
2. Paste your long-lived token
3. Enter endpoint: `me/accounts?fields=instagram_business_account`
4. Click **"Submit"**
5. Look for `instagram_business_account.id` in the response

### Method 2: cURL

```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts\
  ?fields=instagram_business_account{id,username}\
  &access_token={LONG_LIVED_TOKEN}"
```

**Response:**
```json
{
  "data": [
    {
      "instagram_business_account": {
        "id": "17841401234567890",  ← This is your IG User ID
        "username": "your_username"
      },
      "id": "123456789"
    }
  ]
}
```

---

## Step 6: Create Credentials File

Create `.auth/ig_primary.json` in your project:

```json
{
  "accessToken": "YOUR_LONG_LIVED_TOKEN_HERE",
  "igUserId": "17841401234567890"
}
```

⚠️ **Security**: Make sure `.auth/` is in your `.gitignore`!

---

## Step 7: Test Upload

```bash
# First, upload video to S3 (to get public URL)
staticstripes upload --upload-name s3_instagram

# Then upload to Instagram
staticstripes upload --upload-name ig_primary
```

---

## Token Refresh (Every 60 Days)

Long-lived tokens expire after 60 days. Refresh them:

```bash
curl -X GET "https://graph.instagram.com/refresh_access_token\
  ?grant_type=ig_refresh_token\
  &access_token={CURRENT_LONG_LIVED_TOKEN}"
```

**Requirements:**
- Token must be at least 24 hours old
- Token must not be expired
- Refreshed token is valid for another 60 days

**Pro Tip**: Set a calendar reminder for 50 days to refresh your token!

---

## Troubleshooting

### "Invalid OAuth access token"
- Token expired (refresh it)
- Wrong token format
- App permissions not granted

### "Invalid Instagram User ID"
- Make sure it's the **Business Account ID**, not the Facebook Page ID
- Must start with `17841...` (Instagram IDs are typically 17 digits)

### "Video URL not accessible"
- Ensure S3 ACL is set to `public-read`
- Test the S3 URL in your browser first
- URL must use HTTPS

### "Unsupported video format"
- Must be MP4 format
- Max 100MB file size
- Must meet Instagram's encoding requirements

---

## Reference Links

- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **Instagram Graph API Docs**: https://developers.facebook.com/docs/instagram-api/
- **Facebook Apps Dashboard**: https://developers.facebook.com/apps/

---

## Quick Reference

| Item | Where to Find |
|------|--------------|
| App ID | App Dashboard → Settings → Basic |
| App Secret | App Dashboard → Settings → Basic |
| Access Token | Graph API Explorer (generate & exchange) |
| IG User ID | `me/accounts?fields=instagram_business_account` |
| Token Expiry | 60 days (refresh after 24h, before 60d) |
