# Google Calendar Authentication Troubleshooting

## Current Issue
You're experiencing a Google Calendar authentication error:
```
Google Calendar connection failed: Failed to create Google Calendar event: Error: Google Calendar API error: Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.
```

## Root Cause
The error occurs because:

1. **Missing Environment Configuration**: The `VITE_GOOGLE_CLIENT_ID` environment variable is not set or is set to the placeholder value
2. **Invalid/Expired Access Token**: The stored access token may be invalid or expired
3. **Missing Google Cloud Project Setup**: The Google Calendar API may not be properly configured

## Solution Steps

### 1. Create Environment File
Create a `.env` file in the root directory with your Google Client ID:

```env
# Google Calendar API Configuration
VITE_GOOGLE_CLIENT_ID=your_actual_google_client_id_here

# Backend Configuration
PORT=5000
MONGODB_URI=mongodb://localhost:27017/notes-app
JWT_SECRET=your_jwt_secret_here
```

### 2. Set Up Google Cloud Project
Follow the steps in `GOOGLE_CALENDAR_SETUP.md`:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials (Web application type)
5. Add your domain to authorized origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
6. Copy the Client ID and add it to your `.env` file

### 3. Clear Invalid Tokens
If you have invalid tokens stored, clear them:

1. Open browser developer tools (F12)
2. Go to Application/Storage tab
3. Find Local Storage for your domain
4. Delete the `google_access_token` entry
5. Refresh the page and try connecting again

### 4. Restart Development Server
After setting up the environment variables:

```bash
npm run dev
```

### 5. Test Connection
1. Go to the Calendar page
2. Click "Connect Google Calendar"
3. Complete the OAuth flow
4. Check if events sync properly

## Error Prevention Improvements

The code has been updated with better error handling:

- **Configuration Validation**: Checks if credentials are properly configured
- **Token Validation**: Validates token format before making API calls
- **Better Error Messages**: More descriptive error messages with setup instructions
- **Graceful Degradation**: Shows helpful UI when Google Calendar is not configured

## Common Issues

### "Google Calendar credentials not configured"
- **Solution**: Set `VITE_GOOGLE_CLIENT_ID` in your `.env` file

### "Authentication failed. Please re-authenticate"
- **Solution**: Clear localStorage and reconnect

### "Google Calendar API error: Request had invalid authentication credentials"
- **Solution**: Check if your Google Cloud Project has the Calendar API enabled

### "One-tap login failed"
- **Solution**: This is normal, use the regular "Connect Google Calendar" button

## Debug Information

To debug issues, check the browser console for:
- Configuration status messages
- Token validation logs
- API request/response details
- Error stack traces

## Security Notes

- Never commit your `.env` file to version control
- Use different credentials for development and production
- Monitor API usage in Google Cloud Console
- Access tokens are stored locally and automatically refreshed

## Need Help?

If you continue to experience issues:
1. Check the browser console for detailed error messages
2. Verify your Google Cloud Project setup
3. Ensure your domain is in the authorized origins
4. Try clearing browser cache and localStorage 