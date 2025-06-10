/**
 * Freshservice API Integration
 * Handles interactions with Freshservice assets and data
 */

class FreshserviceAPI {
    constructor() {
        this.client = null;
        this.currentAsset = null;
        this.debugMode = false;
        this.initialized = false;
        
        this.initializeClient();
    }

    /**
     * Initialize Freshworks client
     */
    async initializeClient() {
        try {
            if (typeof window.app !== 'undefined') {
                await window.app.initialized();
                this.client = window.app;
                this.initialized = true;
                
                // Get debug mode setting
                try {
                    const debugParam = await this.getInstallationParam('debug_mode');
                    this.debugMode = debugParam || false;
                } catch (error) {
                    this.debugMode = false;
                }

                if (this.debugMode) {
                    console.log('Freshservice API client initialized');
                }
            }
        } catch (error) {
            console.error('Failed to initialize Freshworks client:', error);
        }
    }

    /**
     * Get installation parameter value
     */
    async getInstallationParam(key) {
        if (!this.client) await this.initializeClient();
        
        return new Promise((resolve, reject) => {
            this.client.get('installationParam', key).then(
                data => resolve(data.value),
                error => reject(error)
            );
        });
    }

    /**
     * Get current asset information
     */
    async getCurrentAsset() {
        if (!this.client) await this.initializeClient();

        try {
            const assetData = await this.client.get('asset');
            this.currentAsset = assetData.asset;
            
            if (this.debugMode) {
                console.log('Current asset:', this.currentAsset);
            }
            
            return this.currentAsset;
        } catch (error) {
            console.error('Failed to get current asset:', error);
            throw new Error('Unable to retrieve current asset information');
        }
    }

    /**
     * Update current asset with Dell warranty information
     */
    async updateAssetWithDellInfo(dellData, options = {}) {
        if (!this.client) await this.initializeClient();

        try {
            const asset = await this.getCurrentAsset();
            
            const updateData = this.mapDellDataToAsset(dellData, asset, options);
            
            if (Object.keys(updateData).length === 0) {
                return {
                    success: false,
                    message: 'No updates needed',
                    data: updateData
                };
            }

            const result = await this.updateAsset(asset.id, updateData);
            
            return {
                success: true,
                message: 'Asset updated successfully',
                data: result,
                updatedFields: Object.keys(updateData)
            };

        } catch (error) {
            console.error('Failed to update asset with Dell info:', error);
            throw error;
        }
    }

    /**
     * Map Dell API data to Freshservice asset fields
     */
    mapDellDataToAsset(dellData, currentAsset, options = {}) {
        const updateData = {};
        
        this.mapBasicAssetInfo(updateData, dellData, currentAsset, options);
        this.mapWarrantyInfo(updateData, dellData, currentAsset, options);
        this.mapDatesInfo(updateData, dellData, currentAsset, options);
        this.addCustomFieldMappings(updateData, dellData, currentAsset, options);

        if (this.debugMode) {
            console.log('Mapped update data:', updateData);
        }

        return updateData;
    }

    /**
     * Map basic asset information
     */
    mapBasicAssetInfo(updateData, dellData, currentAsset, options) {
        // Map basic asset information
        if (dellData.model && (!currentAsset.asset_type_id || options.overwriteModel)) {
            updateData.name = dellData.model;
        }

        if (dellData.systemDescription && (!currentAsset.description || options.overwriteDescription)) {
            updateData.description = `${dellData.systemDescription}`;
        }

        // Map service tag to serial number if not already set
        if (dellData.serviceTag && (!currentAsset.serial_number || options.overwriteSerial)) {
            updateData.serial_number = dellData.serviceTag;
        }
    }

    /**
     * Map warranty information
     */
    mapWarrantyInfo(updateData, dellData, currentAsset, options) {
        if (!dellData.warranty) return;

        if (dellData.warranty.endDate) {
            updateData.warranty_expiry_date = this.formatDateForFreshservice(dellData.warranty.endDate);
        }

        // Add warranty details to description or custom fields
        if (options.updateDescription !== false) {
            const warrantyInfo = this.buildWarrantyDescription(dellData.warranty, dellData.entitlements);
            const currentDesc = currentAsset.description || '';
            const newDesc = this.appendWarrantyToDescription(currentDesc, warrantyInfo);
            if (newDesc !== currentDesc) {
                updateData.description = newDesc;
            }
        }
    }

    /**
     * Map dates information
     */
    mapDatesInfo(updateData, dellData, currentAsset, options) {
        // Map ship date to purchase date if available and not set
        if (dellData.shipDate && (!currentAsset.purchase_date || options.overwritePurchaseDate)) {
            updateData.purchase_date = this.formatDateForFreshservice(dellData.shipDate);
        }
    }

    /**
     * Add custom field mappings for Dell-specific data
     */
    addCustomFieldMappings(updateData, dellData, currentAsset, options) {
        // These would need to be configured based on your Freshservice custom fields
        const customFieldMappings = {
            'cf_dell_service_tag': dellData.serviceTag,
            'cf_dell_model': dellData.model,
            'cf_dell_product_family': dellData.productFamily,
            'cf_warranty_status': dellData.warranty?.status,
            'cf_warranty_service_level': dellData.warranty?.serviceLevel,
            'cf_warranty_days_remaining': dellData.warranty?.daysRemaining,
            'cf_country_code': dellData.countryCode
        };

        // Only add custom fields that exist and have values
        for (const [fieldName, value] of Object.entries(customFieldMappings)) {
            if (value !== null && value !== undefined && value !== '') {
                // Check if the field exists in the current asset
                if (Object.prototype.hasOwnProperty.call(currentAsset, fieldName) || options.forceCustomFields) {
                    updateData[fieldName] = value;
                }
            }
        }
    }

    /**
     * Build warranty description text
     */
    buildWarrantyDescription(warranty, entitlements) {
        const description = this.buildBaseWarrantyDescription(warranty);
        const entitlementInfo = this.buildEntitlementDescription(entitlements);
        const timestamp = `Last Updated: ${this.formatDate(new Date())}\n`;
        
        return description + entitlementInfo + timestamp;
    }

    /**
     * Build base warranty description
     */
    buildBaseWarrantyDescription(warranty) {
        let description = '\n\n--- Dell Warranty Information ---\n';
        
        description += `Status: ${warranty.status?.toUpperCase() || 'Unknown'}\n`;
        
        if (warranty.serviceLevel) {
            description += `Service Level: ${warranty.serviceLevel}\n`;
        }
        
        if (warranty.startDate) {
            description += `Warranty Start: ${this.formatDate(warranty.startDate)}\n`;
        }
        
        if (warranty.endDate) {
            description += `Warranty End: ${this.formatDate(warranty.endDate)}\n`;
        }
        
        if (warranty.daysRemaining !== null) {
            if (warranty.daysRemaining > 0) {
                description += `Days Remaining: ${warranty.daysRemaining}\n`;
            } else {
                description += `Expired ${Math.abs(warranty.daysRemaining)} days ago\n`;
            }
        }

        return description;
    }

    /**
     * Build entitlement description
     */
    buildEntitlementDescription(entitlements) {
        if (!entitlements || entitlements.length === 0) {
            return '';
        }

        let entitlementInfo = '\nWarranty Entitlements:\n';
        entitlements.slice(0, 3).forEach((entitlement, index) => {
            entitlementInfo += `${index + 1}. ${entitlement.serviceLevelDescription}`;
            if (entitlement.endDate) {
                entitlementInfo += ` (expires: ${this.formatDate(entitlement.endDate)})`;
            }
            entitlementInfo += '\n';
        });

        return entitlementInfo;
    }

    /**
     * Append warranty information to existing description
     */
    appendWarrantyToDescription(currentDescription, warrantyInfo) {
        // Remove any existing Dell warranty information
        const cleanDescription = currentDescription.replace(
            /\n\n--- Dell Warranty Information ---[\s\S]*?Last Updated: [^\n]+\n/g, 
            ''
        ).trim();
        
        return cleanDescription + warrantyInfo;
    }

    /**
     * Update asset via Freshservice API
     */
    async updateAsset(assetId, updateData) {
        if (!this.client) await this.initializeClient();

        try {
            const options = {
                headers: {
                    'Authorization': '<%= access_token %>',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            };

            const result = await this.client.request.put(`/api/v2/assets/${assetId}`, options);
            
            if (this.debugMode) {
                console.log('Asset update result:', result);
            }

            return result;

        } catch (error) {
            console.error('Failed to update asset:', error);
            throw new Error(`Asset update failed: ${error.message}`);
        }
    }

    /**
     * Search for assets by criteria
     */
    async searchAssets(criteria = {}) {
        if (!this.client) await this.initializeClient();

        try {
            const query = this.buildSearchQuery(criteria);
            const options = {
                headers: {
                    'Authorization': '<%= access_token %>',
                    'Content-Type': 'application/json'
                }
            };

            const result = await this.client.request.get(query, options);
            
            if (this.debugMode) {
                console.log('Asset search result:', result);
            }

            return result.assets || [];

        } catch (error) {
            console.error('Asset search failed:', error);
            throw new Error(`Asset search failed: ${error.message}`);
        }
    }

    /**
     * Build search query from criteria
     */
    buildSearchQuery(criteria) {
        let query = '/api/v2/assets';
        const params = new URLSearchParams();

        if (criteria.serialNumber) {
            params.append('filter', `serial_number:'${criteria.serialNumber}'`);
        }

        if (criteria.name) {
            params.append('filter', `name:'${criteria.name}'`);
        }

        if (criteria.assetTypeId) {
            params.append('filter', `asset_type_id:${criteria.assetTypeId}`);
        }

        if (params.toString()) {
            query += `?${params.toString()}`;
        }

        return query;
    }

    /**
     * Get asset by ID
     */
    async getAssetById(assetId) {
        if (!this.client) await this.initializeClient();

        try {
            const options = {
                headers: {
                    'Authorization': '<%= access_token %>',
                    'Content-Type': 'application/json'
                }
            };

            const result = await this.client.request.get(`/api/v2/assets/${assetId}`, options);
            
            return result.asset;

        } catch (error) {
            console.error('Failed to get asset by ID:', error);
            throw new Error(`Failed to get asset: ${error.message}`);
        }
    }

    /**
     * Create new asset with Dell information
     */
    async createAssetWithDellInfo(dellData, assetTypeId, additionalData = {}) {
        if (!this.client) await this.initializeClient();

        try {
            const assetData = this.buildNewAssetData(dellData, assetTypeId, additionalData);
            const result = await this.createAsset(assetData);
            
            return {
                success: true,
                message: 'Asset created successfully',
                data: result.asset
            };

        } catch (error) {
            console.error('Failed to create asset:', error);
            throw error;
        }
    }

    /**
     * Build new asset data structure
     */
    buildNewAssetData(dellData, assetTypeId, additionalData) {
        const assetData = {
            name: dellData.model || 'Dell Asset',
            asset_type_id: assetTypeId,
            serial_number: dellData.serviceTag,
            description: this.buildWarrantyDescription(dellData.warranty, dellData.entitlements),
            ...additionalData
        };

        if (dellData.warranty?.endDate) {
            assetData.warranty_expiry_date = this.formatDateForFreshservice(dellData.warranty.endDate);
        }

        if (dellData.shipDate) {
            assetData.purchase_date = this.formatDateForFreshservice(dellData.shipDate);
        }

        // Add custom fields
        this.addCustomFieldMappings(assetData, dellData, {}, { forceCustomFields: true });

        return assetData;
    }

    /**
     * Create asset via API
     */
    async createAsset(assetData) {
        const options = {
            headers: {
                'Authorization': '<%= access_token %>',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assetData)
        };

        return await this.client.request.post('/api/v2/assets', options);
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'success') {
        if (!this.client) return;

        try {
            this.client.interface.trigger('showNotify', {
                type: type, // success, error, warning, info
                message: message
            });
        } catch (error) {
            console.warn('Failed to show notification:', error);
            // Fallback to console
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Open modal dialog
     */
    openModal(title, template, data = {}) {
        if (!this.client) return;

        try {
            return this.client.interface.trigger('showModal', {
                title: title,
                template: template,
                data: data
            });
        } catch (error) {
            console.error('Failed to open modal:', error);
        }
    }

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                return this.fallbackCopyToClipboard(text);
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    /**
     * Fallback clipboard copy for older browsers
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            return successful;
        } catch (error) {
            console.error('Fallback copy failed:', error);
            return false;
        }
    }

    /**
     * Format date for Freshservice API (YYYY-MM-DD)
     */
    formatDateForFreshservice(date) {
        if (!date) return null;
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        
        return d.toISOString().split('T')[0];
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return 'Unknown';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Unknown';
        
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Format date and time for display
     */
    formatDateTime(date) {
        if (!date) return 'Unknown';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Unknown';
        
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Export data as CSV
     */
    exportToCsv(data, filename = 'dell_asset_export.csv') {
        try {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No data to export');
            }

            const csvContent = this.buildCsvContent(data);
            return this.downloadCsvFile(csvContent, filename);

        } catch (error) {
            console.error('Failed to export CSV:', error);
            return false;
        }
    }

    /**
     * Build CSV content from data
     */
    buildCsvContent(data) {
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value || '';
                }).join(',')
            )
        ];

        return csvRows.join('\n');
    }

    /**
     * Download CSV file
     */
    downloadCsvFile(csvContent, filename) {
        try {
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Failed to download CSV file:', error);
            return false;
        }
    }

    /**
     * Get application context and location
     */
    async getContext() {
        if (!this.client) await this.initializeClient();

        try {
            const context = await this.client.get('context');
            return context;
        } catch (error) {
            console.error('Failed to get context:', error);
            return null;
        }
    }

    /**
     * Store data locally for the session
     */
    setSessionData(key, data) {
        try {
            sessionStorage.setItem(`dell_asset_app_${key}`, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to store session data:', error);
        }
    }

    /**
     * Retrieve data from local session storage
     */
    getSessionData(key) {
        try {
            const data = sessionStorage.getItem(`dell_asset_app_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to retrieve session data:', error);
            return null;
        }
    }

    /**
     * Clear session data
     */
    clearSessionData(key = null) {
        try {
            if (key) {
                sessionStorage.removeItem(`dell_asset_app_${key}`);
            } else {
                this.clearAllSessionData();
            }
        } catch (error) {
            console.warn('Failed to clear session data:', error);
        }
    }

    /**
     * Clear all app session data
     */
    clearAllSessionData() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(k => {
            if (k.startsWith('dell_asset_app_')) {
                sessionStorage.removeItem(k);
            }
        });
    }
}

// Create global instance
window.freshserviceAPI = new FreshserviceAPI(); 