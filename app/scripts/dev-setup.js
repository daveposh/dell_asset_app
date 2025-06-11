/**
 * Development Setup Utility for Dell Asset Management App
 * Use this to configure Dell API credentials for local testing
 */

window.DellDevSetup = {
    /**
     * Set up Dell API credentials for development
     */
    setupCredentials: function(clientId, clientSecret) {
        if (!clientId || !clientSecret) {
            console.error('Both clientId and clientSecret are required');
            return false;
        }

        try {
            localStorage.setItem('DELL_CLIENT_ID', clientId);
            localStorage.setItem('DELL_CLIENT_SECRET', clientSecret);
            
            console.log('✅ Dell API credentials set successfully!');
            console.log('Reload the page to use the new credentials.');
            
            return true;
        } catch (error) {
            console.error('Failed to set credentials:', error);
            return false;
        }
    },

    /**
     * Clear stored credentials
     */
    clearCredentials: function() {
        localStorage.removeItem('DELL_CLIENT_ID');
        localStorage.removeItem('DELL_CLIENT_SECRET');
        console.log('🗑️ Credentials cleared. Reload the page.');
    },

    /**
     * Check current credential status
     */
    checkCredentials: function() {
        const clientId = localStorage.getItem('DELL_CLIENT_ID');
        const clientSecret = localStorage.getItem('DELL_CLIENT_SECRET');
        
        console.log('📋 Current credential status:');
        console.log('Client ID:', clientId ? '✅ Set' : '❌ Not set');
        console.log('Client Secret:', clientSecret ? '✅ Set' : '❌ Not set');
        
        if (!clientId || !clientSecret) {
            console.log('\n💡 To set credentials, use:');
            console.log('DellDevSetup.setupCredentials("your_client_id", "your_client_secret")');
        }
        
        return { clientId: !!clientId, clientSecret: !!clientSecret };
    },

    /**
     * Show help information
     */
    showHelp: function() {
        console.log(`
🔧 Dell Asset Management - Development Setup

Available commands:
• DellDevSetup.setupCredentials(clientId, clientSecret) - Set Dell API credentials
• DellDevSetup.clearCredentials() - Clear stored credentials  
• DellDevSetup.checkCredentials() - Check credential status
• DellDevSetup.showHelp() - Show this help

📋 Steps to get Dell API credentials:
1. Register at Dell TechDirect: https://tdm.dell.com
2. Apply for API access (approval required, 1-2 business days)
3. Create an API application to get Client ID and Secret
4. Use setupCredentials() to store them locally
5. Reload the page to apply changes

⚠️  IMPORTANT CONSTRAINTS:
• Dell Warranty API has NO sandbox/test environment
• REAL Dell TechDirect credentials required even for testing
• Cannot test without approved Dell API access
• Production endpoint used for all environments

Note: This is for development only. In production, use proper Freshservice app installation.
        `);
    }
};

// Auto-check credentials on load in development mode
if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    console.log('🔧 Development mode detected. Type DellDevSetup.showHelp() for setup instructions.');
} 