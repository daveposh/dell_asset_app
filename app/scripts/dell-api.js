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
        this.waitForAppReady().then(() => {
            this.initializeConfig().catch(error => {
                console.error('Failed to initialize Dell API configuration:', error);
            });
        });
    }

    /**
     * Wait for Freshworks app to be ready
     */
    async waitForAppReady() {
        return new Promise((resolve) => {
            if (typeof window.app !== 'undefined') {
                this.appReady = true;
                resolve();
            } else {
                // Wait for app to be available
                const checkApp = () => {
                    if (typeof window.app !== 'undefined') {
                        this.appReady = true;
                        resolve();
                    } else {
                        setTimeout(checkApp, 100);
                    }
                };
                checkApp();
            }
        });
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
            const config = {
                clientId: await this.getInstallationParam('dell_api_client_id'),
                clientSecret: await this.getInstallationParam('dell_api_client_secret'),
                baseUrl: await this.getInstallationParam('dell_api_base_url'),
                tokenUrl: await this.getInstallationParam('dell_oauth_token_url'),
                maxRequests: await this.getInstallationParam('rate_limit_requests') || 50,
                debugMode: await this.getInstallationParam('debug_mode') || false
            };

            // Validate required parameters
            if (!config.clientId || !config.clientSecret || !config.baseUrl || !config.tokenUrl) {
                const missingParams = [];
                if (!config.clientId) missingParams.push('Client ID');
                if (!config.clientSecret) missingParams.push('Client Secret');
                if (!config.baseUrl) missingParams.push('Base URL');
                if (!config.tokenUrl) missingParams.push('Token URL');
                
                throw new Error(`Missing required Dell API configuration parameters: ${missingParams.join(', ')}. Please ensure the app is properly installed with valid Dell TechDirect API credentials.`);
            }

            return config;
        } catch (error) {
            console.error('Failed to load Dell API configuration:', error);
            throw error;
        }
    }

    /**
     * Get installation parameter value
     */
    getInstallationParam(key) {
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure app is ready
                if (!this.appReady) {
                    await this.waitForAppReady();
                }

                // Method 1: Try direct access from app.iparams
                if (window.app && window.app.iparams && window.app.iparams[key]) {
                    const value = window.app.iparams[key];
                    console.log(`Installation param ${key}:`, value ? 'loaded' : 'not found');
                    resolve(value);
                    return;
                }

                // Method 2: Try client.iparams.get() for newer FDK versions
                if (window.client && window.client.iparams && window.client.iparams.get) {
                    try {
                        const value = await window.client.iparams.get(key);
                        console.log(`Installation param ${key} (via client):`, value ? 'loaded' : 'not found');
                        resolve(value);
                        return;
                    } catch (clientError) {
                        console.debug(`Client method failed for ${key}:`, clientError.message);
                    }
                }

                // Method 3: Try app.iparams.get() if it exists
                if (window.app && window.app.iparams && window.app.iparams.get) {
                    try {
                        const value = await window.app.iparams.get(key);
                        console.log(`Installation param ${key} (via app.iparams.get):`, value ? 'loaded' : 'not found');
                        resolve(value);
                        return;
                    } catch (appError) {
                        console.debug(`App iparams.get method failed for ${key}:`, appError.message);
                    }
                }

                // Method 4: Try direct access from various locations
                this.tryDirectParamAccess(key, resolve, reject);

            } catch (error) {
                console.error('Error in getInstallationParam:', error);
                reject(error);
            }
        });
    }

    /**
     * Try direct parameter access
     */
    tryDirectParamAccess(key, resolve, reject) {
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
                    resolve(value);
                    return;
                }
            } catch (error) {
                console.debug(`Source check failed for ${key}:`, error.message);
            }
        }

        // Fallback for development/testing - use default values
        const defaultValues = this.getDefaultConfigValues();
        if (defaultValues[key]) {
            console.warn(`Using default value for ${key} - app may not be properly installed`);
            resolve(defaultValues[key]);
            return;
        }

        reject(new Error(`Unable to retrieve installation parameter: ${key}. App may not be properly installed.`));
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
            'dell_api_client_id': null, // These must be provided during installation
            'dell_api_client_secret': null
        };
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
     * Make HTTP request with rate limiting and error handling
     */
    async makeRequest(url, options = {}) {
        this.checkRateLimit();

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': 'Freshservice-Dell-Asset-Management/1.0',
                    ...options.headers
                }
            });

            this.updateRateLimit();
            return response;

        } catch (error) {
            console.error('HTTP request failed:', error);
            throw error;
        }
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
     * Get warranty and asset information for a service tag
     */
    async getAssetInfo(serviceTag) {
        try {
            this.validateServiceTag(serviceTag);
            const cleanTag = this.cleanServiceTag(serviceTag);
            const response = await this.fetchAssetData(cleanTag);
            const data = await this.processAssetResponse(response);
            
            return this.parseAssetData(data[0]);

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
            serviceTag: rawData.serviceTag || 'Unknown',
            model: rawData.productLineDescription || rawData.systemDescription || 'Unknown',
            productFamily: rawData.productFamily || 'Unknown',
            systemDescription: rawData.systemDescription || 'Unknown',
            shipDate: rawData.shipDate ? new Date(rawData.shipDate) : null,
            countryCode: rawData.countryCode || 'Unknown',
            duplicated: rawData.duplicated || false,
            invalid: rawData.invalid || false,
            entitlements: []
        };
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
     * Process multiple service tags in bulk
     */
    async processBulkServiceTags(serviceTags, progressCallback = null) {
        if (!Array.isArray(serviceTags) || serviceTags.length === 0) {
            throw new Error('No service tags provided');
        }

        const results = [];
        const batchSize = 5; // Process in batches to respect rate limits
        const batches = this.createBatches(serviceTags, batchSize);

        let processedCount = 0;

        for (const batch of batches) {
            const batchResults = await this.processBatch(batch);
            results.push(...batchResults);
            
            processedCount += batch.length;

            if (progressCallback) {
                progressCallback({
                    processed: processedCount,
                    total: serviceTags.length,
                    percentage: Math.round((processedCount / serviceTags.length) * 100),
                    currentBatch: results.slice(-batch.length)
                });
            }

            // Add delay between batches (except for the last batch)
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
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
     * Test API connection and credentials
     */
    async testConnection() {
        try {
            const token = await this.authenticate();
            return {
                success: true,
                message: 'Successfully connected to Dell TechDirect API',
                token: token ? 'Token acquired' : 'No token'
            };
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