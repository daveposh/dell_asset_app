/**
 * Dell TechDirect API Integration
 * Handles OAuth2 authentication and API requests for warranty and hardware information
 */

class DellAPI {
    constructor() {
        this.config = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isAuthenticating = false;
        this.requestQueue = [];
        this.rateLimitCounter = 0;
        this.rateLimitWindow = 60000; // 1 minute
        this.maxRequestsPerWindow = 50; // Default rate limit
        this.appReady = false;
        
        // Initialize when app is ready
        this.waitForAppReady()
            .then(() => this.initializeConfig())
            .catch(error => {
                console.error('Failed to initialize Dell API configuration:', error);
                // Store initialization error for later reference
                this.initializationError = error;
            });
    }

    /**
     * Wait for Freshworks app to be ready (FDK standard)
     */
    waitForAppReady() {
        return new Promise((resolve) => {
            // FDK standard: use global app object
            if (typeof app !== 'undefined' && app.initialized) {
                app.initialized()
                    .then(() => {
                        this.appReady = true;
                        resolve();
                    })
                    .catch(() => {
                        // Fallback for development
                        this.checkAppFallback(resolve);
                    });
            } else {
                // Fallback for development
                this.checkAppFallback(resolve);
            }
        });
    }

    /**
     * Fallback app ready check for development
     */
    checkAppFallback(resolve) {
        if (typeof window.app !== 'undefined') {
            this.appReady = true;
            resolve();
        } else {
            // Wait for app to be available
            const checkApp = () => {
                if (typeof window.app !== 'undefined' || typeof app !== 'undefined') {
                    this.appReady = true;
                    resolve();
                } else {
                    setTimeout(checkApp, 100);
                }
            };
            checkApp();
        }
    }

    /**
     * Initialize API configuration from installation parameters
     */
    async initializeConfig() {
        try {
            // Get configuration from Freshworks installation parameters
            this.config = await this.loadConfiguration();
            this.maxRequestsPerWindow = this.config.maxRequests;
            
            if (this.config.debugMode) {
                console.log('Dell API Configuration initialized:', {
                    baseUrl: this.config.baseUrl,
                    tokenUrl: this.config.tokenUrl,
                    maxRequests: this.config.maxRequests
                });
            }
        } catch (error) {
            console.error('Failed to initialize Dell API configuration:', error);
            throw new Error('Configuration initialization failed');
        }
    }

    /**
     * Load configuration from installation parameters
     */
    async loadConfiguration() {
        try {
            const config = await this.loadConfigParameters();
            this.validateConfiguration(config);
            return config;
        } catch (error) {
            console.error('Failed to load Dell API configuration:', error);
            throw error;
        }
    }

    /**
     * Load configuration parameters
     */
    async loadConfigParameters() {
        return {
            clientId: await this.getInstallationParam('dell_api_client_id'),
            clientSecret: await this.getInstallationParam('dell_api_client_secret'),
            baseUrl: await this.getInstallationParam('dell_api_base_url'),
            tokenUrl: await this.getInstallationParam('dell_oauth_token_url'),
            maxRequests: await this.getInstallationParam('rate_limit_requests') || 50,
            debugMode: await this.getInstallationParam('debug_mode') || false
        };
    }

    /**
     * Validate configuration parameters
     */
    validateConfiguration(config) {
        const requiredFields = ['clientId', 'clientSecret', 'baseUrl', 'tokenUrl'];
        const missingParams = requiredFields
            .filter(field => !config[field])
            .map(field => this.getFieldDisplayName(field));

        if (missingParams.length > 0) {
            const isDevMode = this.isRunningInDevelopmentMode();
            const errorMessage = this.buildConfigurationErrorMessage(missingParams, isDevMode);
            throw new Error(errorMessage);
        }
    }

    /**
     * Check if running in development mode
     */
    isRunningInDevelopmentMode() {
        return !window.app || 
               !window.location.hostname.includes('freshservice') ||
               window.location.hostname === 'localhost' ||
               window.location.protocol === 'file:';
    }

    /**
     * Build configuration error message
     */
    buildConfigurationErrorMessage(missingParams, isDevMode) {
        let message = `Missing required Dell API configuration parameters: ${missingParams.join(', ')}.`;
        
        if (isDevMode) {
            message += '\n\n🔧 DEVELOPMENT MODE DETECTED:\n';
            message += '• For testing, you can set credentials in localStorage:\n';
            message += '  localStorage.setItem("DELL_CLIENT_ID", "your_client_id")\n';
            message += '  localStorage.setItem("DELL_CLIENT_SECRET", "your_client_secret")\n';
            message += '• Or install the app properly in Freshservice with valid Dell TechDirect API credentials.\n';
            message += '• Register for Dell TechDirect API at: https://tdm.dell.com';
        } else {
            message += '\n\nPlease ensure the app is properly installed with valid Dell TechDirect API credentials.';
            message += '\nTo obtain credentials, register at Dell TechDirect: https://tdm.dell.com';
        }
        
        return message;
    }

    /**
     * Get display name for configuration field
     */
    getFieldDisplayName(field) {
        const displayNames = {
            clientId: 'Client ID',
            clientSecret: 'Client Secret',
            baseUrl: 'Base URL',
            tokenUrl: 'Token URL'
        };
        return displayNames[field] || field;
    }

    /**
     * Get installation parameter value
     */
    async getInstallationParam(key) {
        try {
            await this.ensureAppReady();
            return await this.tryParamAccessMethods(key);
        } catch (error) {
            console.error('Error in getInstallationParam:', error);
            throw error;
        }
    }

    /**
     * Ensure app is ready
     */
    async ensureAppReady() {
        if (!this.appReady) {
            await this.waitForAppReady();
        }
    }

    /**
     * Try different parameter access methods
     */
    async tryParamAccessMethods(key) {
        // Method 1: Direct access from app.iparams
        const directValue = this.tryDirectAccess(key);
        if (directValue !== undefined) return directValue;

        // Method 2: Client SDK access
        const clientValue = await this.tryClientAccess(key);
        if (clientValue !== undefined) return clientValue;

        // Method 3: App SDK access
        const appValue = await this.tryAppAccess(key);
        if (appValue !== undefined) return appValue;

        // Method 4: Fallback access
        return this.tryDirectParamAccessAsync(key);
    }

    /**
     * Try direct access from app.iparams (FDK standard)
     */
    tryDirectAccess(key) {
        // Method 1: FDK standard global app.iparams
        const fdkValue = this.getFDKParam(key);
        if (fdkValue !== undefined) return fdkValue;

        // Method 2: Fallback to window.app.iparams
        const fallbackValue = this.getFallbackParam(key);
        if (fallbackValue !== undefined) return fallbackValue;

        return undefined;
    }

    /**
     * Get parameter from FDK standard app.iparams
     */
    getFDKParam(key) {
        if (typeof app !== 'undefined' && app.iparams && app.iparams[key]) {
            const value = app.iparams[key];
            console.log(`Installation param ${key}:`, value ? 'loaded' : 'not found');
            return value;
        }
        return undefined;
    }

    /**
     * Get parameter from fallback window.app.iparams
     */
    getFallbackParam(key) {
        if (window.app && window.app.iparams && window.app.iparams[key]) {
            const value = window.app.iparams[key];
            console.log(`Installation param ${key} (fallback):`, value ? 'loaded' : 'not found');
            return value;
        }
        return undefined;
    }

    /**
     * Try client SDK access
     */
    async tryClientAccess(key) {
        if (window.client && window.client.iparams && window.client.iparams.get) {
            try {
                const value = await window.client.iparams.get(key);
                console.log(`Installation param ${key} (via client):`, value ? 'loaded' : 'not found');
                return value;
            } catch (clientError) {
                console.debug(`Client method failed for ${key}:`, clientError.message);
            }
        }
        return undefined;
    }

    /**
     * Try app SDK access
     */
    async tryAppAccess(key) {
        if (window.app && window.app.iparams && window.app.iparams.get) {
            try {
                const value = await window.app.iparams.get(key);
                console.log(`Installation param ${key} (via app.iparams.get):`, value ? 'loaded' : 'not found');
                return value;
            } catch (appError) {
                console.debug(`App iparams.get method failed for ${key}:`, appError.message);
            }
        }
        return undefined;
    }

    /**
     * Try direct parameter access (async version)
     */
    tryDirectParamAccessAsync(key) {
        // Try to access installation parameters from various possible locations
        const possibleSources = [
            () => window.iparams && window.iparams[key],
            () => window.installationParam && window.installationParam[key],
            () => window._fw_installation_params && window._fw_installation_params[key],
            () => window.installationParams && window.installationParams[key]
        ];

        for (const source of possibleSources) {
            try {
                const value = source();
                if (value !== undefined && value !== null) {
                    console.log(`Installation param ${key} (direct access):`, 'loaded');
                    return value;
                }
            } catch (error) {
                console.debug(`Source check failed for ${key}:`, error.message);
            }
        }

        // Fallback for development/testing - use default values
        const defaultValues = this.getDefaultConfigValues();
        if (defaultValues[key]) {
            console.warn(`Using default value for ${key} - app may not be properly installed`);
            return defaultValues[key];
        }

        throw new Error(`Unable to retrieve installation parameter: ${key}. App may not be properly installed.`);
    }

    /**
     * Get default configuration values for development/testing
     */
    getDefaultConfigValues() {
        return {
            'dell_api_base_url': 'https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5',
            'dell_oauth_token_url': 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token',
            'rate_limit_requests': 50,
            'debug_mode': true,
            'dell_api_client_id': this.getEnvironmentValue('DELL_CLIENT_ID'),
            'dell_api_client_secret': this.getEnvironmentValue('DELL_CLIENT_SECRET')
        };
    }

    /**
     * Try to get value from various environment sources
     */
    getEnvironmentValue(key) {
        // Try different possible sources for development
        const sources = [
            () => window.localStorage?.getItem(key),
            () => window.sessionStorage?.getItem(key),
            () => window[key]
            // Note: process.env not available in browser environment
        ];

        for (const source of sources) {
            try {
                const value = source();
                if (value && value.trim()) {
                    return value.trim();
                }
            } catch (error) {
                // Ignore errors from unavailable sources
            }
        }

        return null;
    }

    /**
     * Authenticate with Dell API using OAuth2 Client Credentials flow
     */
    async authenticate() {
        // Ensure app is ready and configuration is loaded
        if (!this.appReady) {
            await this.waitForAppReady();
        }
        
        if (!this.config) {
            await this.initializeConfig();
        }

        if (this.isAuthenticating) {
            return await this.waitForAuthentication();
        }

        if (this.isTokenValid()) {
            return this.accessToken;
        }

        return await this.performAuthentication();
    }

    /**
     * Wait for ongoing authentication to complete
     */
    waitForAuthentication() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (!this.isAuthenticating) {
                    resolve(this.accessToken);
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    /**
     * Perform OAuth2 authentication
     */
    async performAuthentication() {
        this.isAuthenticating = true;

        try {
            // Validate configuration is loaded
            if (!this.config || !this.config.clientId || !this.config.clientSecret) {
                throw new Error('Dell API configuration not loaded or missing credentials');
            }

            const authData = {
                grant_type: 'client_credentials',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret
            };

            const response = await this.makeTokenRequest(authData);
            const tokenData = await this.processTokenResponse(response);
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 minute early

            if (this.config.debugMode) {
                console.log('Dell API authentication successful. Token expires in:', tokenData.expires_in, 'seconds');
            }

            return this.accessToken;

        } catch (error) {
            console.error('Dell API authentication failed:', error);
            throw new Error(`Authentication failed: ${error.message}`);
        } finally {
            this.isAuthenticating = false;
        }
    }

    /**
     * Make token request
     */
    async makeTokenRequest(authData) {
        return await this.makeRequest(this.config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams(authData).toString()
        });
    }

    /**
     * Process token response
     */
    async processTokenResponse(response) {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Check if current access token is valid
     */
    isTokenValid() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    /**
     * Make HTTP request using FDK client.request (following FDK standards)
     */
    async makeRequest(url, options = {}) {
        this.checkRateLimit();

        try {
            // Try to use FDK client.request if available
            if (typeof client !== 'undefined' && client.request) {
                const response = await this.makeFDKRequest(url, options);
                this.updateRateLimit();
                return response;
            } else {
                // Fallback to fetch for development
                const response = await this.makeFetchRequest(url, options);
                this.updateRateLimit(); 
                return response;
            }
        } catch (error) {
            console.error('HTTP request failed:', error);
            throw error;
        }
    }

    /**
     * Make request using FDK client.request
     */
    async makeFDKRequest(url, options = {}) {
        // For FDK requests, we need to use the configured request templates
        // This is a simplified version - in production, use request templates
        console.log('Using FDK client.request for:', url);
        
        // Fallback to fetch for now until we implement full request templates
        return await this.makeFetchRequest(url, options);
    }

    /**
     * Make request using fetch (fallback for development)
     */
    async makeFetchRequest(url, options = {}) {
        return await fetch(url, {
            ...options,
            headers: {
                'User-Agent': 'Freshservice-Dell-Asset-Management/1.0',
                ...options.headers
            }
        });
    }

    /**
     * Check rate limiting
     */
    checkRateLimit() {
        if (this.rateLimitCounter >= this.maxRequestsPerWindow) {
            throw new Error('Rate limit exceeded. Please wait before making more requests.');
        }
    }

    /**
     * Update rate limit counter
     */
    updateRateLimit() {
        this.rateLimitCounter++;
        
        // Reset rate limit counter after window
        setTimeout(() => {
            this.rateLimitCounter = Math.max(0, this.rateLimitCounter - 1);
        }, this.rateLimitWindow);
    }

    /**
     * Make authenticated API request to Dell TechDirect
     */
    async makeAuthenticatedRequest(endpoint, options = {}) {
        const token = await this.authenticate();
        
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const requestOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (this.config.debugMode) {
            console.log('Making Dell API request:', url, requestOptions);
        }

        const response = await this.makeRequest(url, requestOptions);

        if (response.status === 401) {
            return this.retryWithNewToken(url, requestOptions);
        }

        return response;
    }

    /**
     * Retry request with new token after 401 error
     */
    async retryWithNewToken(url, requestOptions) {
        // Token might be expired, clear it and retry once
        this.accessToken = null;
        this.tokenExpiry = null;
        
        const newToken = await this.authenticate();
        requestOptions.headers['Authorization'] = `Bearer ${newToken}`;
        
        return await this.makeRequest(url, requestOptions);
    }

    /**
     * Get warranty and asset information for a service tag using server-side function
     */
    async getAssetInfo(serviceTag) {
        try {
            this.validateServiceTag(serviceTag);
            const cleanTag = this.cleanServiceTag(serviceTag);
            
            console.log('Calling server-side Dell API for service tag:', cleanTag);
            
            // Use server-side function to avoid CORS issues
            const result = await this.invokeServerFunction('getDellAssetInfo', {
                serviceTag: cleanTag
            });

            if (result.status !== 'success') {
                throw new Error(result.message || 'Server-side request failed');
            }

            if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
                throw new Error(`No data found for service tag: ${cleanTag}`);
            }

            return this.parseAssetData(result.data[0]);

        } catch (error) {
            console.error('Failed to get asset info:', error);
            throw error;
        }
    }

    /**
     * Validate service tag format
     */
    validateServiceTag(serviceTag) {
        if (!serviceTag || typeof serviceTag !== 'string') {
            throw new Error('Invalid service tag provided');
        }
    }

    /**
     * Clean and validate service tag
     */
    cleanServiceTag(serviceTag) {
        const cleanTag = serviceTag.trim().toUpperCase();
        if (!/^[A-Z0-9]{7}$/.test(cleanTag)) {
            throw new Error('Service tag must be 7 alphanumeric characters');
        }
        return cleanTag;
    }

    /**
     * Fetch asset data from Dell API
     */
    async fetchAssetData(serviceTag) {
        const endpoint = `/asset-entitlements?servicetags=${serviceTag}`;
        return await this.makeAuthenticatedRequest(endpoint);
    }

    /**
     * Process asset API response
     */
    async processAssetResponse(response) {
        if (!response.ok) {
            await this.handleAssetResponseError(response);
        }

        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('No data found for this service tag');
        }

        return data;
    }

    /**
     * Handle asset response errors
     */
    async handleAssetResponseError(response) {
        const errorText = await response.text();
        if (response.status === 404) {
            throw new Error('Service tag not found in Dell database');
        } else if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else {
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
    }

    /**
     * Parse and normalize asset data from Dell API response
     */
    parseAssetData(rawData) {
        try {
            const parsed = this.buildBasicAssetData(rawData);
            parsed.entitlements = this.parseEntitlements(rawData.entitlements);
            
            // Determine primary warranty information
            const primaryWarranty = this.getPrimaryWarranty(parsed.entitlements);
            parsed.warranty = this.buildWarrantyInfo(primaryWarranty);

            if (this.config?.debugMode) {
                console.log('Parsed asset data:', parsed);
            }

            return parsed;

        } catch (error) {
            console.error('Failed to parse asset data:', error);
            throw new Error('Failed to parse Dell API response');
        }
    }

    /**
     * Build basic asset data structure
     */
    buildBasicAssetData(rawData) {
        return {
            serviceTag: this.getStringValue(rawData.serviceTag),
            model: this.getModelName(rawData),
            productFamily: this.getStringValue(rawData.productFamily),
            systemDescription: this.getStringValue(rawData.systemDescription),
            shipDate: this.parseDate(rawData.shipDate),
            countryCode: this.getStringValue(rawData.countryCode),
            duplicated: Boolean(rawData.duplicated),
            invalid: Boolean(rawData.invalid),
            entitlements: []
        };
    }

    /**
     * Get string value with fallback
     */
    getStringValue(value) {
        return value || 'Unknown';
    }

    /**
     * Get model name from raw data
     */
    getModelName(rawData) {
        return rawData.productLineDescription || rawData.systemDescription || 'Unknown';
    }

    /**
     * Parse date string to Date object
     */
    parseDate(dateString) {
        return dateString ? new Date(dateString) : null;
    }

    /**
     * Parse warranty entitlements
     */
    parseEntitlements(entitlements) {
        if (!entitlements || !Array.isArray(entitlements)) {
            return [];
        }

        const parsed = entitlements.map(entitlement => ({
            itemNumber: entitlement.itemNumber || '',
            startDate: entitlement.startDate ? new Date(entitlement.startDate) : null,
            endDate: entitlement.endDate ? new Date(entitlement.endDate) : null,
            entitlementType: entitlement.entitlementType || 'Unknown',
            serviceLevelCode: entitlement.serviceLevelCode || '',
            serviceLevelDescription: entitlement.serviceLevelDescription || '',
            serviceLevelGroup: entitlement.serviceLevelGroup || null
        }));

        // Sort entitlements by end date (latest first)
        return parsed.sort((a, b) => {
            if (!a.endDate) return 1;
            if (!b.endDate) return -1;
            return b.endDate.getTime() - a.endDate.getTime();
        });
    }

    /**
     * Build warranty information object
     */
    buildWarrantyInfo(primaryWarranty) {
        return {
            status: this.determineWarrantyStatus(primaryWarranty),
            startDate: primaryWarranty?.startDate || null,
            endDate: primaryWarranty?.endDate || null,
            serviceLevel: primaryWarranty?.serviceLevelDescription || 'Unknown',
            serviceLevelCode: primaryWarranty?.serviceLevelCode || '',
            daysRemaining: primaryWarranty?.endDate ? this.calculateDaysRemaining(primaryWarranty.endDate) : null
        };
    }

    /**
     * Invoke server-side function to avoid CORS issues
     */
    async invokeServerFunction(functionName, data = {}) {
        try {
            // Wait for app to be ready
            await this.ensureAppReady();

            // Use FDK's server-side function invocation
            if (window.app && window.app.request && window.app.request.invoke) {
                console.log(`Invoking server function: ${functionName}`);
                const result = await window.app.request.invoke(functionName, data);
                return result.response || result;
            }

            // Fallback for development or alternative FDK versions
            if (window.client && window.client.request) {
                console.log(`Invoking server function via client: ${functionName}`);
                const result = await window.client.request.invoke(functionName, data);
                return result.response || result;
            }

            throw new Error('FDK server function invocation not available');

        } catch (error) {
            console.error(`Server function ${functionName} failed:`, error);
            throw new Error(`Server-side request failed: ${error.message}`);
        }
    }

    /**
     * Get the primary warranty entitlement (usually ProSupport or the latest active warranty)
     */
    getPrimaryWarranty(entitlements) {
        if (!entitlements || entitlements.length === 0) return null;

        // Priority order for warranty types
        const priorityOrder = [
            'PROSUPIT', 'PROSUP', 'PROPLUS', 'PRO', // ProSupport variants
            'NBD', 'ND', // Next Business Day
            'PY', 'PQ', // Premium warranties
            'CC', // Complete Care
            'POW' // Parts Only Warranty
        ];

        const activeWarranties = this.getActiveWarranties(entitlements);
        const priorityWarranty = this.findPriorityWarranty(activeWarranties, priorityOrder);
        
        if (priorityWarranty) return priorityWarranty;
        if (activeWarranties.length > 0) return activeWarranties[0];
        
        const expiredWarranties = this.getExpiredWarranties(entitlements);
        return expiredWarranties.length > 0 ? expiredWarranties[0] : entitlements[0];
    }

    /**
     * Get active warranties
     */
    getActiveWarranties(entitlements) {
        return entitlements.filter(e => 
            e.endDate && e.endDate > new Date() && 
            e.serviceLevelCode && 
            e.serviceLevelCode !== 'PHONESUPP' && // Exclude phone support only
            !e.serviceLevelDescription?.toLowerCase().includes('digital delivery')
        );
    }

    /**
     * Find warranty by priority order
     */
    findPriorityWarranty(warranties, priorityOrder) {
        for (const code of priorityOrder) {
            const warranty = warranties.find(e => 
                e.serviceLevelCode?.toUpperCase().includes(code)
            );
            if (warranty) return warranty;
        }
        return null;
    }

    /**
     * Get expired warranties
     */
    getExpiredWarranties(entitlements) {
        return entitlements.filter(e => 
            e.endDate && e.serviceLevelCode && 
            e.serviceLevelCode !== 'PHONESUPP' &&
            !e.serviceLevelDescription?.toLowerCase().includes('digital delivery')
        );
    }

    /**
     * Determine warranty status based on warranty information
     */
    determineWarrantyStatus(warranty) {
        if (!warranty || !warranty.endDate) return 'unknown';

        const now = new Date();
        const endDate = warranty.endDate;
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) return 'expired';
        if (daysRemaining <= 30) return 'expiring'; // Expiring within 30 days
        return 'active';
    }

    /**
     * Calculate days remaining until warranty expiration
     */
    calculateDaysRemaining(endDate) {
        if (!endDate) return null;
        
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * Process multiple service tags in bulk using server-side function
     */
    async processBulkServiceTags(serviceTags, progressCallback = null) {
        try {
            if (!Array.isArray(serviceTags) || serviceTags.length === 0) {
                throw new Error('No service tags provided');
            }

            console.log(`Processing ${serviceTags.length} service tags in bulk via server-side`);

            // Clean and validate service tags
            const cleanTags = serviceTags.map(tag => {
                this.validateServiceTag(tag);
                return this.cleanServiceTag(tag);
            });

            // Use server-side bulk processing function
            const result = await this.invokeServerFunction('bulkProcessAssets', {
                serviceTags: cleanTags
            });

            if (result.status !== 'success') {
                throw new Error(result.message || 'Server-side bulk processing failed');
            }

            // Process results and add parsed data
            const processedResults = result.results.map(item => {
                if (item.success && item.data && item.data.length > 0) {
                    return {
                        serviceTag: item.serviceTag,
                        success: true,
                        data: this.parseAssetData(item.data[0]),
                        error: null
                    };
                } else {
                    return {
                        serviceTag: item.serviceTag,
                        success: false,
                        data: null,
                        error: item.error || 'No data returned'
                    };
                }
            });

            // Update progress to 100% when complete
            if (progressCallback) {
                progressCallback({
                    processed: processedResults.length,
                    total: serviceTags.length,
                    percentage: 100,
                    currentBatch: processedResults
                });
            }

            console.log(`Bulk processing completed: ${processedResults.length} processed`);
            return processedResults;

        } catch (error) {
            console.error('Bulk processing failed:', error);
            throw error;
        }
    }

    /**
     * Create batches from service tags array
     */
    createBatches(serviceTags, batchSize) {
        const batches = [];
        for (let i = 0; i < serviceTags.length; i += batchSize) {
            batches.push(serviceTags.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Process a single batch of service tags
     */
    async processBatch(batch) {
        const batchPromises = batch.map(async (serviceTag) => {
            try {
                const result = await this.getAssetInfo(serviceTag);
                return { serviceTag, success: true, data: result, error: null };
            } catch (error) {
                return { serviceTag, success: false, data: null, error: error.message };
            }
        });

        return await Promise.all(batchPromises);
    }

    /**
     * Test API connection using server-side function
     */
    async testConnection() {
        try {
            console.log('Testing Dell API connection via server-side');
            
            // Use a test service tag to verify connection
            const testServiceTag = 'ABCDEFG'; // This will fail but confirms server-side connectivity
            
            try {
                await this.invokeServerFunction('getDellAssetInfo', {
                    serviceTag: testServiceTag
                });
                // If we get here, the connection works (even if service tag is invalid)
                return {
                    success: true,
                    message: 'Successfully connected to Dell TechDirect API via server-side'
                };
            } catch (error) {
                // Check if error indicates authentication success but invalid service tag
                if (error.message.includes('Service tag not found') || 
                    error.message.includes('No data found') ||
                    error.message.includes('Invalid service tag')) {
                    return {
                        success: true,
                        message: 'Dell API connection successful (authentication working)'
                    };
                }
                // Authentication or connection failed
                throw error;
            }
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * Get API status and rate limit information
     */
    getStatus() {
        return {
            authenticated: this.isTokenValid(),
            tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry) : null,
            rateLimitRemaining: Math.max(0, this.maxRequestsPerWindow - this.rateLimitCounter),
            maxRequestsPerWindow: this.maxRequestsPerWindow,
            configuration: {
                baseUrl: this.config?.baseUrl,
                debugMode: this.config?.debugMode
            }
        };
    }
}

// Create global instance
window.dellAPI = new DellAPI(); 