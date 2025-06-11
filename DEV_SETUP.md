# Dell Asset Management App - Development Setup

## Quick Start for Development/Testing

If you're seeing configuration errors, this app needs Dell TechDirect API credentials to function.

### 🔧 Development Mode Setup

1. **Get Dell API Credentials:**
   - Register at [Dell TechDirect](https://tdm.dell.com)
   - Create an API application 
   - Note your Client ID and Client Secret

2. **Set Credentials for Local Testing:**
   ```javascript
   // Open browser console (F12) and run:
   DellDevSetup.setupCredentials("your_client_id", "your_client_secret")
   ```

3. **Reload the page** to apply the credentials

### 🛠️ Development Commands

```javascript
// Check current credential status
DellDevSetup.checkCredentials()

// Set new credentials  
DellDevSetup.setupCredentials("client_id", "client_secret")

// Clear stored credentials
DellDevSetup.clearCredentials()

// Show help
DellDevSetup.showHelp()
```

### 📋 Production Installation

For production use in Freshservice:

1. **Install the app** in your Freshservice instance
2. **Configure Dell API credentials** during installation:
   - Dell TechDirect Client ID
   - Dell TechDirect Client Secret
   - API URLs (pre-filled)
3. **Test the connection** using the app interface

### 🔑 Getting Dell API Access

1. Go to [Dell TechDirect](https://tdm.dell.com)
2. Register for an account (business email required)
3. Apply for API access (approval process may take 1-2 business days)
4. Create an API application to get credentials
5. Use OAuth 2.0 Client Credentials flow

⚠️ **IMPORTANT - No Test Environment:**
- **Warranty API has NO sandbox/test endpoint**
- **Must use Production endpoint even for testing**
- **Real Dell API credentials required for any testing**
- **Cannot test without valid Dell TechDirect account**

### 🚨 Troubleshooting

**"Configuration initialization failed" error:**
- App can't find Dell API credentials
- Use `DellDevSetup.setupCredentials()` for development (with real credentials)
- Or ensure proper Freshservice app installation

**"Unable to retrieve installation parameter" error:**
- Running outside Freshservice environment
- Missing credentials in localStorage (development)
- Incomplete app installation (production)

**"Authentication failed" errors:**
- Invalid Dell API credentials
- **No test credentials work** - must use real Dell TechDirect credentials
- Check credential validity at Dell TechDirect portal

**Development vs Production:**
- Development: Uses localStorage for credentials (**must be real Dell credentials**)
- Production: Uses Freshservice installation parameters
- App automatically detects the environment
- **Both environments use Dell Production API** (no sandbox available)

### 📁 File Structure

```
dell_asset_app/
├── app/
│   ├── index.html
│   ├── scripts/
│   │   ├── dev-setup.js      # Development utilities
│   │   ├── dell-api.js       # Dell API integration
│   │   ├── freshservice-api.js # Freshservice integration
│   │   └── app.js           # Main application
│   └── styles/              # CSS and assets
├── config/
│   └── iparams.json         # Installation parameters
├── server/
│   └── server.js           # Server-side functions
└── manifest.json           # App configuration
```

### 🔒 Security Notes

- Never commit real API credentials to version control
- Development credentials are stored in localStorage only
- Production credentials are managed by Freshservice
- All API calls use OAuth 2.0 authentication 