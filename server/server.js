/**
 * Dell Asset Management - Server Side Functions
 * Handles Freshservice app lifecycle events and server-side operations
 */

const axios = require('axios');

/**
 * App Installation Handler
 */
function onAppInstallHandler(args) {
    console.log('Dell Asset Management app installed');
    console.log('Installation args:', JSON.stringify(args, null, 2));

    // Validate required installation parameters
    const requiredParams = [
        'dell_api_client_id',
        'dell_api_client_secret',
        'dell_api_base_url',
        'dell_oauth_token_url'
    ];

    const missingParams = requiredParams.filter(param => !args.iparams[param]);
    
    if (missingParams.length > 0) {
        console.error('Missing required installation parameters:', missingParams);
        return {
            status: 'error',
            message: `Missing required parameters: ${missingParams.join(', ')}`
        };
    }

    // Test Dell API connection during installation
    testDellAPIConnection(args.iparams)
        .then(result => {
            if (result.success) {
                console.log('Dell API connection test successful during installation');
            } else {
                console.warn('Dell API connection test failed during installation:', result.message);
            }
        })
        .catch(error => {
            console.error('Dell API connection test error during installation:', error.message);
        });

    return {
        status: 'success',
        message: 'Dell Asset Management app installed successfully'
    };
}

/**
 * App Uninstallation Handler
 */
function onAppUninstallHandler(args) {
    console.log('Dell Asset Management app uninstalled');
    console.log('Uninstallation args:', JSON.stringify(args, null, 2));

    // Perform cleanup if needed
    // Note: This is where you would clean up any external resources,
    // webhooks, or data that should be removed when the app is uninstalled

    return {
        status: 'success',
        message: 'Dell Asset Management app uninstalled successfully'
    };
}

/**
 * Test Dell TechDirect API Connection
 */
async function testDellAPIConnection(iparams) {
    try {
        const { clientId, clientSecret, tokenUrl } = extractCredentials(iparams);
        const authResponse = await authenticateWithDell(clientId, clientSecret, tokenUrl);
        
        if (authResponse.status === 200 && authResponse.data.access_token) {
            return {
                success: true,
                message: 'Dell API connection successful',
                tokenReceived: true
            };
        } else {
            return {
                success: false,
                message: 'Failed to obtain access token from Dell API'
            };
        }

    } catch (error) {
        console.error('Dell API connection test failed:', error.message);
        return handleConnectionError(error);
    }
}

/**
 * Extract credentials from installation parameters
 */
function extractCredentials(iparams) {
    const clientId = iparams.dell_api_client_id;
    const clientSecret = iparams.dell_api_client_secret;
    const tokenUrl = iparams.dell_oauth_token_url;

    if (!clientId || !clientSecret || !tokenUrl) {
        throw new Error('Missing required Dell API credentials');
    }

    return { clientId, clientSecret, tokenUrl };
}

/**
 * Authenticate with Dell API
 */
async function authenticateWithDell(clientId, clientSecret, tokenUrl) {
    return await axios.post(tokenUrl, 
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'Freshservice-Dell-Asset-Management/1.0'
            },
            timeout: 10000 // 10 second timeout
        }
    );
}

/**
 * Handle connection errors
 */
function handleConnectionError(error) {
    let errorMessage = 'Unknown error occurred';
    
    if (error.response) {
        // The request was made and the server responded with a status code
        errorMessage = `API responded with status ${error.response.status}: ${error.response.statusText}`;
        if (error.response.data && error.response.data.error_description) {
            errorMessage += ` - ${error.response.data.error_description}`;
        }
    } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from Dell API. Check network connectivity and URL.';
    } else {
        // Something happened in setting up the request
        errorMessage = error.message;
    }

    return {
        success: false,
        message: errorMessage,
        error: error
    };
}

/**
 * Make API request to Dell endpoint
 */
async function makeApiRequest(baseUrl, endpoint, accessToken, method = 'GET', data = null) {
    const url = `${baseUrl}${endpoint}`;
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Freshservice-Dell-Asset-Management/1.0'
        },
        timeout: 15000 // 15 second timeout
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.headers['Content-Type'] = 'application/json';
        options.data = data;
    }

    return await axios(url, options);
}

/**
 * Server-side Dell API Proxy - Required for CORS compliance
 * Handles Dell API authentication and requests from server-side to avoid CORS issues
 */
async function getDellAssetInfo(args) {
    try {
        const { serviceTag } = args;
        
        if (!serviceTag) {
            throw new Error('Service tag is required');
        }

        console.log('Server-side Dell API request for service tag:', serviceTag);

        // Get installation parameters
        const iparams = args.iparams;
        const { clientId, clientSecret, tokenUrl } = extractCredentials(iparams);
        const baseUrl = iparams.dell_api_base_url;

        // Get access token
        const tokenResponse = await authenticateWithDell(clientId, clientSecret, tokenUrl);
        const accessToken = tokenResponse.data.access_token;

        // Make API request to Dell
        const endpoint = `/asset-entitlements?servicetags=${serviceTag}`;
        const apiResponse = await makeApiRequest(baseUrl, endpoint, accessToken, 'GET', null);

        return {
            status: 'success',
            data: apiResponse.data,
            statusCode: apiResponse.status,
            serviceTag: serviceTag
        };

    } catch (error) {
        console.error('Dell API request failed for service tag:', args.serviceTag, error.message);
        return handleProxyError(error);
    }
}

/**
 * Server-side Dell API Bulk Processing
 */
async function bulkProcessAssets(args) {
    try {
        const { serviceTags } = args;
        
        if (!serviceTags || !Array.isArray(serviceTags)) {
            throw new Error('Service tags array is required');
        }

        console.log('Server-side Dell API bulk request for', serviceTags.length, 'service tags');

        const results = [];
        const iparams = args.iparams;
        const { clientId, clientSecret, tokenUrl } = extractCredentials(iparams);
        const baseUrl = iparams.dell_api_base_url;

        // Get access token once for all requests
        const tokenResponse = await authenticateWithDell(clientId, clientSecret, tokenUrl);
        const accessToken = tokenResponse.data.access_token;

        // Process in batches to respect rate limits
        for (const serviceTag of serviceTags) {
            try {
                const endpoint = `/asset-entitlements?servicetags=${serviceTag}`;
                const apiResponse = await makeApiRequest(baseUrl, endpoint, accessToken, 'GET', null);
                
                results.push({
                    serviceTag: serviceTag,
                    success: true,
                    data: apiResponse.data
                });

                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                results.push({
                    serviceTag: serviceTag,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            status: 'success',
            results: results,
            processed: results.length
        };

    } catch (error) {
        console.error('Dell API bulk processing failed:', error.message);
        return handleProxyError(error);
    }
}

/**
 * Handle proxy errors from Dell API requests
 */
function handleProxyError(error) {
    let errorMessage = 'Dell API request failed';
    let statusCode = 500;
    
    if (error.response) {
        statusCode = error.response.status;
        errorMessage = `Dell API responded with status ${error.response.status}`;
        
        if (error.response.data) {
            if (error.response.data.error_description) {
                errorMessage += `: ${error.response.data.error_description}`;
            } else if (error.response.data.message) {
                errorMessage += `: ${error.response.data.message}`;
            }
        }
        
        // Handle specific Dell API error codes
        if (statusCode === 401) {
            errorMessage = 'Authentication failed: Invalid Dell API credentials';
        } else if (statusCode === 403) {
            errorMessage = 'Access denied: Check Dell API permissions';
        } else if (statusCode === 404) {
            errorMessage = 'Service tag not found in Dell database';
        } else if (statusCode === 429) {
            errorMessage = 'Rate limit exceeded: Too many requests';
        }
        
    } else if (error.request) {
        errorMessage = 'No response from Dell API: Check network connectivity';
    } else {
        errorMessage = error.message || 'Unknown error occurred';
    }

    console.error('Dell API error:', errorMessage);
    
    return {
        status: 'error',
        message: errorMessage,
        statusCode: statusCode,
        error: error.message
    };
}

/**
 * Bulk Asset Processing Handler
 * Process multiple service tags server-side for better performance and rate limiting
 */
async function processBulkAssets(args) {
    try {
        const { serviceTags } = args;
        
        if (!Array.isArray(serviceTags) || serviceTags.length === 0) {
            throw new Error('Service tags array is required');
        }

        const results = await processServiceTagsInBatches(args, serviceTags);
        const summary = calculateProcessingSummary(results, serviceTags.length);

        console.log(`Bulk processing completed: ${summary.successful} successful, ${summary.errors} errors`);

        return {
            status: 'success',
            results: results,
            summary: summary
        };

    } catch (error) {
        console.error('Bulk processing failed:', error.message);
        return {
            status: 'error',
            message: error.message,
            results: []
        };
    }
}

/**
 * Process service tags in batches
 */
async function processServiceTagsInBatches(args, serviceTags) {
    const results = [];
    const batchSize = 5; // Process in batches
    const delay = 1000; // 1 second delay between batches

    // Split into batches
    const batches = [];
    for (let i = 0; i < serviceTags.length; i += batchSize) {
        batches.push(serviceTags.slice(i, i + batchSize));
    }

    console.log(`Processing ${serviceTags.length} service tags in ${batches.length} batches`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} service tags`);

        const batchResults = await processSingleBatch(args, batch);
        results.push(...batchResults);

        // Add delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return results;
}

/**
 * Process a single batch of service tags
 */
async function processSingleBatch(args, batch) {
    const batchPromises = batch.map(async (serviceTag) => {
        try {
            const result = await proxyDellAPIRequest({
                ...args,
                endpoint: `/asset-entitlements?servicetags=${serviceTag}`
            });

            if (result.status === 'success' && result.data && result.data.length > 0) {
                return {
                    serviceTag,
                    success: true,
                    data: result.data[0],
                    error: null
                };
            } else {
                return {
                    serviceTag,
                    success: false,
                    data: null,
                    error: 'No data found for service tag'
                };
            }
        } catch (error) {
            return {
                serviceTag,
                success: false,
                data: null,
                error: error.message
            };
        }
    });

    return await Promise.all(batchPromises);
}

/**
 * Calculate processing summary
 */
function calculateProcessingSummary(results, totalCount) {
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return {
        total: totalCount,
        successful: successCount,
        errors: errorCount
    };
}

/**
 * Asset Update Helper
 * Helper function to update Freshservice assets with Dell information
 */
async function updateAssetWithDellInfo(args) {
    try {
        const { assetId, dellData } = args;
        
        if (!assetId || !dellData) {
            throw new Error('Asset ID and Dell data are required');
        }

        // Map Dell data to Freshservice asset fields
        const updateData = mapDellDataToAssetFields(dellData);

        if (Object.keys(updateData).length === 0) {
            return {
                status: 'success',
                message: 'No updates needed',
                updatedFields: []
            };
        }

        // Make API request to update asset using modern approach
        const updateResult = await $request.invoke('PUT', `/api/v2/assets/${assetId}`, {
            headers: {
                'Authorization': '<%= access_token %>',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (updateResult.status === 200) {
            return {
                status: 'success',
                message: 'Asset updated successfully',
                updatedFields: Object.keys(updateData),
                data: updateResult.response
            };
        } else {
            throw new Error(`Update failed with status: ${updateResult.status}`);
        }

    } catch (error) {
        console.error('Asset update failed:', error.message);
        return {
            status: 'error',
            message: error.message
        };
    }
}

/**
 * Map Dell API data to Freshservice asset fields
 */
function mapDellDataToAssetFields(dellData) {
    const updateData = {};

    // Basic asset information
    if (dellData.productLineDescription || dellData.systemDescription) {
        updateData.name = dellData.productLineDescription || dellData.systemDescription;
    }

    // Service tag as serial number
    if (dellData.serviceTag) {
        updateData.serial_number = dellData.serviceTag;
    }

    // Warranty information
    if (dellData.entitlements && dellData.entitlements.length > 0) {
        const primaryWarranty = getPrimaryWarranty(dellData.entitlements);
        
        if (primaryWarranty && primaryWarranty.endDate) {
            updateData.warranty_expiry_date = formatDateForAPI(primaryWarranty.endDate);
        }

        // Add warranty description
        const warrantyInfo = buildWarrantyDescription(dellData);
        if (warrantyInfo) {
            updateData.description = warrantyInfo;
        }
    }

    // Ship date as purchase date
    if (dellData.shipDate) {
        updateData.purchase_date = formatDateForAPI(dellData.shipDate);
    }

    return updateData;
}

/**
 * Get primary warranty from entitlements
 */
function getPrimaryWarranty(entitlements) {
    if (!entitlements || entitlements.length === 0) return null;

    // Sort by end date (latest first) and prioritize active warranties
    const sortedEntitlements = entitlements
        .filter(e => e.endDate && e.serviceLevelCode !== 'PHONESUPP')
        .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

    return sortedEntitlements[0] || entitlements[0];
}

/**
 * Build warranty description
 */
function buildWarrantyDescription(dellData) {
    const warranty = getPrimaryWarranty(dellData.entitlements);
    if (!warranty) return null;

    const endDate = warranty.endDate ? formatDate(warranty.endDate) : 'Unknown';
    const serviceLevel = warranty.serviceLevelDescription || 'Unknown';
    const status = determineWarrantyStatus(warranty);

    return `Dell Warranty Information:
Model: ${dellData.productLineDescription || 'Unknown'}
Service Tag: ${dellData.serviceTag || 'Unknown'}
Warranty Status: ${status.toUpperCase()}
Service Level: ${serviceLevel}
Warranty End Date: ${endDate}
Last Updated: ${formatDate(new Date())}`;
}

/**
 * Determine warranty status
 */
function determineWarrantyStatus(warranty) {
    if (!warranty || !warranty.endDate) return 'unknown';

    const now = new Date();
    const endDate = new Date(warranty.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= 30) return 'expiring';
    return 'active';
}

/**
 * Format date for API (YYYY-MM-DD)
 */
function formatDateForAPI(date) {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0];
}

/**
 * Format date for display
 */
function formatDate(date) {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Health Check Endpoint
 */
function healthCheck() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'Dell Asset Management'
    };
}

// Export all functions using the proper exports format required by FDK
exports = {
    onAppInstallHandler,
    onAppUninstallHandler,
    getDellAssetInfo,
    bulkProcessAssets,
    processBulkAssets,
    updateAssetWithDellInfo,
    healthCheck
}; 
