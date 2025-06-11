# CORS Resolution: Server-Side Dell API Processing

## 🚨 **The Problem: CORS Policy Blocking**

When developing Freshworks apps locally, you encounter CORS (Cross-Origin Resource Sharing) errors when making direct browser requests to external APIs:

```
Access to fetch at 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token' from origin 'http://localhost:10001' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### **Why This Happens:**

1. **Browser Security**: CORS prevents unauthorized cross-origin requests
2. **Dell API Security**: Dell's TechDirect API doesn't allow direct browser access from localhost
3. **Development vs Production**: Different behavior between FDK local development and production

## ✅ **The Solution: Server-Side Functions**

We resolved this by implementing **FDK Server-Side Functions** that handle Dell API requests:

### **Architecture:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   FDK Server     │    │   Dell API      │
│   (Browser)     │───▶│   Functions      │───▶│   TechDirect    │
│                 │    │   (server.js)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Key Changes:**

1. **Server-Side Functions** (`server/server.js`):
   - `getDellAssetInfo()` - Handle single service tag lookup
   - `bulkProcessAssets()` - Process multiple service tags
   - OAuth2 authentication handled server-side
   - Rate limiting and error handling

2. **Client-Side Updates** (`app/scripts/dell-api.js`):
   - `invokeServerFunction()` - Call FDK server functions
   - Updated `getAssetInfo()` to use server-side
   - Updated `processBulkServiceTags()` for bulk processing

## 🔧 **Technical Implementation**

### **Server-Side Function Example:**
```javascript
async function getDellAssetInfo(args) {
    const { serviceTag } = args;
    const iparams = args.iparams;
    
    // Server-side Dell API authentication
    const tokenResponse = await authenticateWithDell(clientId, clientSecret, tokenUrl);
    const accessToken = tokenResponse.data.access_token;
    
    // Make Dell API request (no CORS issues on server-side)
    const apiResponse = await makeApiRequest(baseUrl, endpoint, accessToken);
    
    return {
        status: 'success',
        data: apiResponse.data
    };
}
```

### **Client-Side Invocation:**
```javascript
// Call server-side function instead of direct API request
const result = await this.invokeServerFunction('getDellAssetInfo', {
    serviceTag: cleanTag
});
```

## 🛡️ **Security Benefits**

1. **API Credentials**: Kept secure on server-side
2. **Rate Limiting**: Controlled server-side
3. **Error Handling**: Centralized on server
4. **CORS Compliance**: No browser-based cross-origin requests

## 🚀 **Production Deployment**

In production, this architecture provides:
- **Better Security**: Credentials never exposed to browser
- **Improved Performance**: Server-side caching possibilities
- **Better Error Handling**: Centralized logging and monitoring
- **Rate Limit Management**: Server-side control

## 🔍 **Testing the Solution**

1. **Start FDK Development Server**:
   ```bash
   fdk run
   ```

2. **Check Console**: Should see "Server-side Dell API request" messages

3. **No CORS Errors**: Dell API requests now work without CORS issues

## 📋 **Migration Notes**

All existing functionality remains the same from the frontend perspective:
- `window.dellAPI.getAssetInfo(serviceTag)` - Still works
- `window.dellAPI.processBulkServiceTags(tags)` - Still works
- Error handling and rate limiting - Still works

The only difference is requests are now processed server-side for CORS compliance.

---

**✅ Result**: Zero CORS errors, secure API credential handling, full Dell TechDirect API functionality restored. 