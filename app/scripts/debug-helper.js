/**
 * Debug Helper for FDK Environment
 * Shows available FDK objects and methods for troubleshooting
 */

class FDKDebugHelper {
    /**
     * Show comprehensive FDK environment information
     */
    static showEnvironmentInfo() {
        console.group('🔍 FDK Environment Debug Information');
        
        this.checkWindowObjects();
        this.checkFDKClients();
        this.checkRequestMethods(); 
        this.checkAppMethods();
        this.checkEventHandlers();
        
        console.groupEnd();
    }

    /**
     * Check basic window objects
     */
    static checkWindowObjects() {
        console.group('📋 Window Objects');
        
        const objects = {
            'window.app': window.app,
            'window.client': window.client,
            'window.parent': window.parent,
            'window.location': window.location.href,
            'window.navigator.userAgent': window.navigator.userAgent
        };

        for (const [key, value] of Object.entries(objects)) {
            console.log(`${key}:`, !!value ? '✅ Available' : '❌ Not Available', value);
        }
        
        console.groupEnd();
    }

    /**
     * Check FDK client objects and methods
     */
    static checkFDKClients() {
        console.group('🔌 FDK Client Objects');
        
        // Check window.client
        if (window.client) {
            console.log('✅ window.client available');
            console.log('Methods available:', Object.getOwnPropertyNames(window.client));
            
            if (window.client.request) {
                console.log('✅ client.request available');
                console.log('client.request methods:', Object.getOwnPropertyNames(window.client.request));
            } else {
                console.log('❌ client.request not available');
            }
        } else {
            console.log('❌ window.client not available');
        }

        // Check window.app
        if (window.app) {
            console.log('✅ window.app available');
            console.log('Methods available:', Object.getOwnPropertyNames(window.app));
            
            if (window.app.request) {
                console.log('✅ app.request available'); 
                console.log('app.request methods:', Object.getOwnPropertyNames(window.app.request));
            } else {
                console.log('❌ app.request not available');
            }
        } else {
            console.log('❌ window.app not available');
        }
        
        console.groupEnd();
    }

    /**
     * Check available request methods
     */
    static checkRequestMethods() {
        console.group('🌐 Request Methods');
        
        const methods = [
            { name: 'fetch', check: () => typeof fetch !== 'undefined' },
            { name: 'XMLHttpRequest', check: () => typeof XMLHttpRequest !== 'undefined' },
            { name: 'client.request', check: () => window.client && window.client.request },
            { name: 'app.request', check: () => window.app && window.app.request },
            { name: 'client.request.invoke', check: () => window.client && window.client.request && window.client.request.invoke },
            { name: 'app.request.invoke', check: () => window.app && window.app.request && window.app.request.invoke }
        ];

        methods.forEach(method => {
            const available = method.check();
            console.log(`${method.name}:`, available ? '✅ Available' : '❌ Not Available');
        });
        
        console.groupEnd();
    }

    /**
     * Check app-specific methods
     */
    static checkAppMethods() {
        console.group('📱 App Methods');
        
        if (window.app) {
            const methods = [
                'initialized',
                'isInstalled', 
                'iparams',
                'getContext',
                'trigger',
                'on'
            ];

            methods.forEach(method => {
                const available = typeof window.app[method] !== 'undefined';
                console.log(`app.${method}:`, available ? '✅ Available' : '❌ Not Available');
            });
        } else {
            console.log('❌ window.app not available - cannot check app methods');
        }
        
        console.groupEnd();
    }

    /**
     * Check event handlers
     */
    static checkEventHandlers() {
        console.group('⚡ Event Handlers');
        
        const events = [
            'app.initialized',
            'client.request',
            'postMessage support'
        ];

        console.log('Available event mechanisms:');
        console.log('- addEventListener:', typeof window.addEventListener !== 'undefined' ? '✅' : '❌');
        console.log('- postMessage:', typeof window.postMessage !== 'undefined' ? '✅' : '❌');
        console.log('- parent.postMessage:', window.parent && typeof window.parent.postMessage !== 'undefined' ? '✅' : '❌');
        
        console.groupEnd();
    }

    /**
     * Test FDK server function invocation methods
     */
    static async testServerFunctionMethods() {
        console.group('🧪 Testing Server Function Methods');

        const testFunction = 'healthCheck';
        const testData = { test: true };

        // Method 1: app.request.invoke
        if (window.app && window.app.request && window.app.request.invoke) {
            try {
                console.log('Testing app.request.invoke...');
                const result = await window.app.request.invoke(testFunction, testData);
                console.log('✅ app.request.invoke works:', result);
            } catch (error) {
                console.log('❌ app.request.invoke failed:', error.message);
            }
        }

        // Method 2: client.request.invoke
        if (window.client && window.client.request && window.client.request.invoke) {
            try {
                console.log('Testing client.request.invoke...');
                const result = await window.client.request.invoke(testFunction, testData);
                console.log('✅ client.request.invoke works:', result);
            } catch (error) {
                console.log('❌ client.request.invoke failed:', error.message);
            }
        }

        // Method 3: client.request with server function endpoint
        if (window.client && window.client.request) {
            try {
                console.log('Testing client.request with server function endpoint...');
                const result = await window.client.request({
                    url: `/api/v2/functions/${testFunction}`,
                    type: 'POST',
                    data: JSON.stringify(testData),
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log('✅ client.request endpoint works:', result);
            } catch (error) {
                console.log('❌ client.request endpoint failed:', error.message);
            }
        }

        console.groupEnd();
    }

    /**
     * Show complete troubleshooting guide
     */
    static showTroubleshootingGuide() {
        console.group('🛠️ Troubleshooting Guide');
        
        console.log(`
📋 Common Issues and Solutions:

1. ❌ "FDK server function invocation not available"
   Solutions:
   - Check if server/server.js exists and exports functions
   - Verify FDK version supports server functions
   - Try client.request as fallback

2. ❌ CORS errors
   Solutions:
   - Use FDK client.request instead of fetch
   - Implement server-side functions
   - Deploy to production (CORS restrictions are relaxed)

3. ❌ Configuration not loading
   Solutions:
   - Check config/iparams.json syntax
   - Verify app installation
   - Use fallback configuration values

4. ❌ Authentication failures
   Solutions:
   - Verify Dell TechDirect credentials
   - Check OAuth token URL
   - Ensure API endpoints are correct

🔧 Debug Commands:
- FDKDebugHelper.showEnvironmentInfo() - Show environment
- FDKDebugHelper.testServerFunctionMethods() - Test server functions
- window.dellAPI.getStatus() - Check API status
- window.dellAPI.testConnection() - Test connection
        `);
        
        console.groupEnd();
    }
}

// Make available globally for debugging
window.FDKDebugHelper = FDKDebugHelper;

// Auto-run on load for debugging
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 FDK Debug Helper loaded. Use FDKDebugHelper.showEnvironmentInfo() for diagnostics.');
}); 