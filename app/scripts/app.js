/**
 * Dell Asset Management App - Main Application Logic
 * Coordinates UI interactions, Dell API calls, and Freshservice integration
 */

class DellAssetApp {
    constructor() {
        this.currentAssetData = null;
        this.bulkResults = [];
        this.processingBulk = false;
        this.lookupHistory = [];
        this.activeTab = 'single';
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize DOM event listeners
            this.initializeEventListeners();
            
            // Load lookup history from session storage
            this.loadHistoryFromStorage();
            
            // Initialize tab navigation
            this.initializeTabNavigation();
            
            // Test connections
            await this.testConnections();

            console.log('Dell Asset Management App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application', error.message);
        }
    }

    /**
     * Initialize DOM event listeners
     */
    initializeEventListeners() {
        this.initializeSingleLookupListeners();
        this.initializeBulkProcessingListeners();
        this.initializeHistoryListeners();
    }

    /**
     * Initialize single lookup event listeners
     */
    initializeSingleLookupListeners() {
        const serviceTagInput = document.getElementById('service-tag-input');
        const lookupButton = document.getElementById('lookup-button');
        const updateAssetButton = document.getElementById('update-asset-button');
        const copyInfoButton = document.getElementById('copy-info-button');
        const retryButton = document.getElementById('retry-button');

        if (serviceTagInput) {
            serviceTagInput.addEventListener('input', this.validateServiceTagInput.bind(this));
            serviceTagInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' && !lookupButton.disabled) {
                    this.performSingleLookup();
                }
            });
        }

        if (lookupButton) {
            lookupButton.addEventListener('click', this.performSingleLookup.bind(this));
        }

        if (updateAssetButton) {
            updateAssetButton.addEventListener('click', this.updateCurrentAsset.bind(this));
        }

        if (copyInfoButton) {
            copyInfoButton.addEventListener('click', this.copyAssetInfo.bind(this));
        }

        if (retryButton) {
            retryButton.addEventListener('click', this.performSingleLookup.bind(this));
        }
    }

    /**
     * Initialize bulk processing event listeners
     */
    initializeBulkProcessingListeners() {
        const fileUploadArea = document.getElementById('file-upload-area');
        const csvFileInput = document.getElementById('csv-file-input');
        const manualTagsInput = document.getElementById('manual-tags-input');
        const processBulkButton = document.getElementById('process-bulk-button');
        const clearBulkButton = document.getElementById('clear-bulk-button');
        const exportResultsButton = document.getElementById('export-results-button');
        const updateAllAssetsButton = document.getElementById('update-all-assets-button');

        if (fileUploadArea) {
            fileUploadArea.addEventListener('click', () => csvFileInput?.click());
            fileUploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            fileUploadArea.addEventListener('drop', this.handleFileDrop.bind(this));
        }

        if (csvFileInput) {
            csvFileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        if (manualTagsInput) {
            manualTagsInput.addEventListener('input', this.validateBulkInput.bind(this));
        }

        if (processBulkButton) {
            processBulkButton.addEventListener('click', this.processBulkTags.bind(this));
        }

        if (clearBulkButton) {
            clearBulkButton.addEventListener('click', this.clearBulkInput.bind(this));
        }

        if (exportResultsButton) {
            exportResultsButton.addEventListener('click', this.exportBulkResults.bind(this));
        }

        if (updateAllAssetsButton) {
            updateAllAssetsButton.addEventListener('click', this.updateAllAssets.bind(this));
        }
    }

    /**
     * Initialize history event listeners
     */
    initializeHistoryListeners() {
        const refreshHistoryButton = document.getElementById('refresh-history-button');
        const clearHistoryButton = document.getElementById('clear-history-button');

        if (refreshHistoryButton) {
            refreshHistoryButton.addEventListener('click', this.refreshHistory.bind(this));
        }

        if (clearHistoryButton) {
            clearHistoryButton.addEventListener('click', this.clearHistory.bind(this));
        }
    }

    /**
     * Initialize tab navigation
     */
    initializeTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const tabName = event.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Update button states
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content visibility
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.activeTab = tabName;

        // Perform tab-specific actions
        if (tabName === 'history') {
            this.refreshHistory();
        }
    }

    /**
     * Test API connections
     */
    async testConnections() {
        try {
            // Test Dell API connection
            const dellConnection = await window.dellAPI.testConnection();
            if (!dellConnection.success) {
                console.warn('Dell API connection test failed:', dellConnection.message);
            }

            // Test Freshservice API
            if (window.freshserviceAPI.initialized) {
                console.log('Freshservice API connection successful');
            }

        } catch (error) {
            console.warn('Connection test failed:', error);
        }
    }

    /**
     * Validate service tag input
     */
    validateServiceTagInput() {
        const input = document.getElementById('service-tag-input');
        const button = document.getElementById('lookup-button');
        
        if (!input || !button) return;

        const value = input.value.trim().toUpperCase();
        input.value = value;

        const isValid = /^[A-Z0-9]{0,7}$/.test(value) && value.length > 0;
        button.disabled = !isValid;
        
        if (value.length > 0 && value.length !== 7) {
            input.style.borderColor = '#ef4444';
        } else {
            input.style.borderColor = '';
        }
    }

    /**
     * Perform single service tag lookup
     */
    async performSingleLookup() {
        const serviceTagInput = document.getElementById('service-tag-input');
        const lookupButton = document.getElementById('lookup-button');
        const resultsSection = document.getElementById('results-section');
        const errorSection = document.getElementById('error-section');

        if (!serviceTagInput) return;

        const serviceTag = serviceTagInput.value.trim().toUpperCase();
        
        if (!serviceTag || serviceTag.length !== 7) {
            this.showError('Invalid service tag', 'Please enter a 7-character service tag');
            return;
        }

        try {
            // Show loading state
            this.setLoadingState(lookupButton, true);
            this.hideElement(resultsSection);
            this.hideElement(errorSection);

            // Call Dell API
            const assetData = await window.dellAPI.getAssetInfo(serviceTag);
            
            // Display results
            this.displayAssetData(assetData);
            this.showElement(resultsSection);
            
            // Add to history
            this.addToHistory({
                serviceTag: serviceTag,
                timestamp: new Date(),
                success: true,
                data: assetData
            });

            this.currentAssetData = assetData;

        } catch (error) {
            console.error('Lookup failed:', error);
            this.showError('Lookup Failed', error.message);
            
            // Add failed lookup to history
            this.addToHistory({
                serviceTag: serviceTag,
                timestamp: new Date(),
                success: false,
                error: error.message
            });

        } finally {
            this.setLoadingState(lookupButton, false);
        }
    }

    /**
     * Display asset data in the UI
     */
    displayAssetData(data) {
        this.displayBasicInfo(data);
        this.displayWarrantyInfo(data.warranty);
    }

    /**
     * Display basic asset information
     */
    displayBasicInfo(data) {
        this.setElementText('result-service-tag', data.serviceTag);
        this.setElementText('result-model', data.model);
        this.setElementText('result-product-line', data.productFamily);
        this.setElementText('result-ship-date', 
            data.shipDate ? window.freshserviceAPI.formatDate(data.shipDate) : 'Unknown');
    }

    /**
     * Display warranty information
     */
    displayWarrantyInfo(warranty) {
        this.setElementText('result-warranty-start', 
            warranty.startDate ? window.freshserviceAPI.formatDate(warranty.startDate) : 'Unknown');
        this.setElementText('result-warranty-end', 
            warranty.endDate ? window.freshserviceAPI.formatDate(warranty.endDate) : 'Unknown');
        this.setElementText('result-service-level', warranty.serviceLevel || 'Unknown');
        
        const daysText = this.formatDaysRemaining(warranty.daysRemaining);
        this.setElementText('result-days-remaining', daysText);

        // Warranty status badge
        this.updateWarrantyStatusBadge(warranty);
    }

    /**
     * Format days remaining text
     */
    formatDaysRemaining(daysRemaining) {
        if (daysRemaining === null) return 'Unknown';
        if (daysRemaining > 0) return `${daysRemaining} days`;
        return `Expired ${Math.abs(daysRemaining)} days ago`;
    }

    /**
     * Update warranty status badge
     */
    updateWarrantyStatusBadge(warranty) {
        const statusBadge = document.getElementById('warranty-status-badge');
        if (statusBadge) {
            statusBadge.textContent = warranty.status?.toUpperCase() || 'UNKNOWN';
            statusBadge.className = `status-badge ${warranty.status || 'unknown'}`;
        }
    }

    /**
     * Update current asset with Dell information
     */
    async updateCurrentAsset() {
        if (!this.currentAssetData) {
            this.showToast('No data available to update', 'error');
            return;
        }

        const updateButton = document.getElementById('update-asset-button');

        try {
            this.setLoadingState(updateButton, true);

            const result = await window.freshserviceAPI.updateAssetWithDellInfo(this.currentAssetData);
            
            if (result.success) {
                this.showToast(`Asset updated successfully. Updated fields: ${result.updatedFields.join(', ')}`, 'success');
            } else {
                this.showToast(result.message || 'No updates were needed', 'warning');
            }

        } catch (error) {
            console.error('Failed to update asset:', error);
            this.showToast(`Failed to update asset: ${error.message}`, 'error');
        } finally {
            this.setLoadingState(updateButton, false);
        }
    }

    /**
     * Copy asset information to clipboard
     */
    async copyAssetInfo() {
        if (!this.currentAssetData) {
            this.showToast('No data available to copy', 'error');
            return;
        }

        try {
            const info = this.buildAssetInfoText(this.currentAssetData);
            const success = await window.freshserviceAPI.copyToClipboard(info);
            
            if (success) {
                this.showToast('Asset information copied to clipboard', 'success');
            } else {
                this.showToast('Failed to copy to clipboard', 'error');
            }

        } catch (error) {
            console.error('Failed to copy asset info:', error);
            this.showToast('Failed to copy asset information', 'error');
        }
    }

    /**
     * Build asset information text for copying
     */
    buildAssetInfoText(data) {
        const warranty = data.warranty;
        
        return [
            `Dell Asset Information`,
            `Service Tag: ${data.serviceTag}`,
            `Model: ${data.model}`,
            `Product Family: ${data.productFamily}`,
            `Ship Date: ${data.shipDate ? window.freshserviceAPI.formatDate(data.shipDate) : 'Unknown'}`,
            ``,
            `Warranty Information:`,
            `Status: ${warranty.status?.toUpperCase() || 'Unknown'}`,
            `Service Level: ${warranty.serviceLevel || 'Unknown'}`,
            `Start Date: ${warranty.startDate ? window.freshserviceAPI.formatDate(warranty.startDate) : 'Unknown'}`,
            `End Date: ${warranty.endDate ? window.freshserviceAPI.formatDate(warranty.endDate) : 'Unknown'}`,
            `Days Remaining: ${warranty.daysRemaining !== null ? warranty.daysRemaining : 'Unknown'}`,
            ``,
            `Generated: ${new Date().toLocaleString()}`
        ].join('\n');
    }

    /**
     * Handle file drag over
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add('dragover');
    }

    /**
     * Handle file drop
     */
    handleFileDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('dragover');
        
        const files = Array.from(event.dataTransfer.files);
        const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
        
        if (csvFile) {
            this.processCSVFile(csvFile);
        } else {
            this.showToast('Please drop a CSV file', 'error');
        }
    }

    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    }

    /**
     * Process CSV file
     */
    async processCSVFile(file) {
        try {
            const text = await this.readFileAsText(file);
            const serviceTags = this.extractServiceTagsFromCSV(text);

            if (serviceTags.length === 0) {
                throw new Error('No valid service tags found in CSV file');
            }

            this.updateManualInputWithTags(serviceTags);
            this.showToast(`Loaded ${serviceTags.length} service tags from CSV`, 'success');

        } catch (error) {
            console.error('Failed to process CSV file:', error);
            this.showToast(`Failed to process CSV file: ${error.message}`, 'error');
        }
    }

    /**
     * Extract service tags from CSV text
     */
    extractServiceTagsFromCSV(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        return lines.map(line => {
            const columns = line.split(',');
            return columns[0].replace(/['"]/g, '').trim().toUpperCase();
        }).filter(tag => /^[A-Z0-9]{7}$/.test(tag));
    }

    /**
     * Update manual input with extracted tags
     */
    updateManualInputWithTags(serviceTags) {
        const manualInput = document.getElementById('manual-tags-input');
        if (manualInput) {
            manualInput.value = serviceTags.join('\n');
            this.validateBulkInput();
        }
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Validate bulk input
     */
    validateBulkInput() {
        const manualInput = document.getElementById('manual-tags-input');
        const processButton = document.getElementById('process-bulk-button');
        
        if (!manualInput || !processButton) return;

        const text = manualInput.value.trim();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const validTags = lines.filter(tag => /^[A-Z0-9]{7}$/.test(tag.toUpperCase()));

        processButton.disabled = validTags.length === 0;
        
        // Update button text with count
        const buttonText = processButton.querySelector('.btn-text');
        if (buttonText) {
            if (validTags.length > 0) {
                buttonText.textContent = `Process ${validTags.length} Tags`;
            } else {
                buttonText.textContent = 'Process All';
            }
        }
    }

    /**
     * Process bulk service tags
     */
    async processBulkTags() {
        const manualInput = document.getElementById('manual-tags-input');
        const processButton = document.getElementById('process-bulk-button');
        const progressSection = document.getElementById('bulk-progress-section');
        const resultsSection = document.getElementById('bulk-results-section');

        if (!manualInput) return;

        const serviceTags = this.extractValidServiceTags(manualInput.value);

        if (serviceTags.length === 0) {
            this.showToast('No valid service tags to process', 'error');
            return;
        }

        try {
            this.processingBulk = true;
            this.setLoadingState(processButton, true);
            this.showElement(progressSection);
            this.hideElement(resultsSection);

            // Process tags
            const results = await window.dellAPI.processBulkServiceTags(serviceTags, (progress) => {
                this.updateBulkProgress(progress);
            });

            this.bulkResults = results;
            this.displayBulkResults();
            this.showElement(resultsSection);

            // Add to history
            this.addToHistory({
                type: 'bulk',
                serviceTags: serviceTags,
                timestamp: new Date(),
                success: true,
                results: results
            });

        } catch (error) {
            console.error('Bulk processing failed:', error);
            this.showToast(`Bulk processing failed: ${error.message}`, 'error');
        } finally {
            this.processingBulk = false;
            this.setLoadingState(processButton, false);
        }
    }

    /**
     * Extract valid service tags from input text
     */
    extractValidServiceTags(text) {
        const lines = text.split('\n').map(line => line.trim().toUpperCase()).filter(line => line);
        return [...new Set(lines.filter(tag => /^[A-Z0-9]{7}$/.test(tag)))]; // Remove duplicates
    }

    /**
     * Update bulk processing progress
     */
    updateBulkProgress(progress) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressStatus = document.getElementById('progress-status');

        if (progressFill) {
            progressFill.style.width = `${progress.percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${progress.processed} of ${progress.total} processed`;
        }

        if (progressStatus) {
            progressStatus.textContent = `Processing batch...`;
        }
    }

    /**
     * Display bulk processing results
     */
    displayBulkResults() {
        const successCount = this.bulkResults.filter(r => r.success).length;
        const errorCount = this.bulkResults.filter(r => !r.success).length;

        // Update summary
        this.setElementText('success-count', successCount);
        this.setElementText('error-count', errorCount);
        this.setElementText('warning-count', 0); // Could add warnings for expired warranties

        // Update results table
        this.updateResultsTable();
    }

    /**
     * Update results table
     */
    updateResultsTable() {
        const tableBody = document.getElementById('results-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';

            this.bulkResults.forEach((result, index) => {
                const row = this.createResultRow(result, index);
                tableBody.appendChild(row);
            });
        }
    }

    /**
     * Create result table row
     */
    createResultRow(result, index) {
        const row = document.createElement('tr');
        
        const statusClass = result.success ? 'success' : 'error';
        const warrantyStatus = result.success ? result.data.warranty.status : 'error';
        const model = result.success ? result.data.model : 'N/A';
        const endDate = this.getWarrantyEndDate(result);
        const status = result.success ? 'Success' : result.error;

        row.innerHTML = `
            <td>${result.serviceTag}</td>
            <td>${model}</td>
            <td><span class="status-badge ${warrantyStatus}">${warrantyStatus.toUpperCase()}</span></td>
            <td>${endDate}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>
                ${this.createActionButton(result, index)}
            </td>
        `;

        return row;
    }

    /**
     * Get warranty end date for display
     */
    getWarrantyEndDate(result) {
        if (result.success && result.data.warranty.endDate) {
            return window.freshserviceAPI.formatDate(result.data.warranty.endDate);
        }
        return 'N/A';
    }

    /**
     * Create action button for result row
     */
    createActionButton(result, index) {
        if (result.success) {
            return `<button class="btn btn-sm btn-success" onclick="app.updateSingleAsset(${index})">Update Asset</button>`;
        } else {
            return `<button class="btn btn-sm btn-outline" onclick="app.retryLookup('${result.serviceTag}')">Retry</button>`;
        }
    }

    /**
     * Update single asset from bulk results
     */
    async updateSingleAsset(index) {
        const result = this.bulkResults[index];
        if (!result || !result.success) return;

        try {
            const updateResult = await window.freshserviceAPI.updateAssetWithDellInfo(result.data);
            
            if (updateResult.success) {
                this.showToast(`Asset ${result.serviceTag} updated successfully`, 'success');
            } else {
                this.showToast(`Asset ${result.serviceTag}: ${updateResult.message}`, 'warning');
            }

        } catch (error) {
            this.showToast(`Failed to update asset ${result.serviceTag}: ${error.message}`, 'error');
        }
    }

    /**
     * Retry single lookup from bulk results
     */
    async retryLookup(serviceTag) {
        try {
            const assetData = await window.dellAPI.getAssetInfo(serviceTag);
            
            // Update the result in bulkResults
            const resultIndex = this.bulkResults.findIndex(r => r.serviceTag === serviceTag);
            if (resultIndex !== -1) {
                this.bulkResults[resultIndex] = {
                    serviceTag: serviceTag,
                    success: true,
                    data: assetData,
                    error: null
                };
                
                this.displayBulkResults();
                this.showToast(`Retry successful for ${serviceTag}`, 'success');
            }

        } catch (error) {
            this.showToast(`Retry failed for ${serviceTag}: ${error.message}`, 'error');
        }
    }

    /**
     * Clear bulk input
     */
    clearBulkInput() {
        const manualInput = document.getElementById('manual-tags-input');
        const csvInput = document.getElementById('csv-file-input');
        const progressSection = document.getElementById('bulk-progress-section');
        const resultsSection = document.getElementById('bulk-results-section');

        if (manualInput) manualInput.value = '';
        if (csvInput) csvInput.value = '';
        
        this.hideElement(progressSection);
        this.hideElement(resultsSection);
        
        this.bulkResults = [];
        this.validateBulkInput();
    }

    /**
     * Export bulk results to CSV
     */
    exportBulkResults() {
        if (this.bulkResults.length === 0) {
            this.showToast('No results to export', 'error');
            return;
        }

        try {
            const exportData = this.prepareExportData();
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `dell_assets_${timestamp}.csv`;
            
            const success = window.freshserviceAPI.exportToCsv(exportData, filename);
            
            if (success) {
                this.showToast('Results exported successfully', 'success');
            } else {
                this.showToast('Failed to export results', 'error');
            }

        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed', 'error');
        }
    }

    /**
     * Prepare data for CSV export
     */
    prepareExportData() {
        return this.bulkResults.map(result => ({
            'Service Tag': result.serviceTag,
            'Status': result.success ? 'Success' : 'Error',
            'Model': result.success ? result.data.model : 'N/A',
            'Product Family': result.success ? result.data.productFamily : 'N/A',
            'Warranty Status': result.success ? result.data.warranty.status : 'N/A',
            'Warranty End Date': this.getExportEndDate(result),
            'Days Remaining': result.success ? result.data.warranty.daysRemaining : 'N/A',
            'Service Level': result.success ? result.data.warranty.serviceLevel : 'N/A',
            'Ship Date': this.getExportShipDate(result),
            'Error': result.success ? '' : result.error
        }));
    }

    /**
     * Get warranty end date for export
     */
    getExportEndDate(result) {
        if (result.success && result.data.warranty.endDate) {
            return window.freshserviceAPI.formatDateForFreshservice(result.data.warranty.endDate);
        }
        return 'N/A';
    }

    /**
     * Get ship date for export
     */
    getExportShipDate(result) {
        if (result.success && result.data.shipDate) {
            return window.freshserviceAPI.formatDateForFreshservice(result.data.shipDate);
        }
        return 'N/A';
    }

    /**
     * Update all assets from bulk results
     */
    async updateAllAssets() {
        const successfulResults = this.bulkResults.filter(r => r.success);
        
        if (successfulResults.length === 0) {
            this.showToast('No successful results to update', 'error');
            return;
        }

        const confirmed = await this.showConfirmDialog(`This will update ${successfulResults.length} assets with Dell warranty information. Continue?`);
        if (!confirmed) return;

        try {
            let updated = 0;
            let errors = 0;

            for (const result of successfulResults) {
                try {
                    const updateResult = await window.freshserviceAPI.updateAssetWithDellInfo(result.data);
                    if (updateResult.success) {
                        updated++;
                    }
                } catch (error) {
                    errors++;
                    console.error(`Failed to update ${result.serviceTag}:`, error);
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.showToast(`Bulk update completed. Updated: ${updated}, Errors: ${errors}`, 'success');

        } catch (error) {
            console.error('Bulk update failed:', error);
            this.showToast('Bulk update failed', 'error');
        }
    }

    /**
     * Show confirmation dialog
     */
    showConfirmDialog(message) {
        // Use a proper modal instead of confirm() for better UX
        return new Promise((resolve) => {
            const modal = this.createConfirmModal(message, resolve);
            document.body.appendChild(modal);
        });
    }

    /**
     * Create confirmation modal
     */
    createConfirmModal(message, callback) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <h3>Confirm Action</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="this.closest('.confirm-modal').remove(); arguments[0](false);">Cancel</button>
                    <button class="btn btn-primary" onclick="this.closest('.confirm-modal').remove(); arguments[0](true);">Confirm</button>
                </div>
            </div>
        `;

        // Add event listeners
        const cancelBtn = modal.querySelector('.btn-outline');
        const confirmBtn = modal.querySelector('.btn-primary');
        
        cancelBtn.onclick = () => {
            modal.remove();
            callback(false);
        };
        
        confirmBtn.onclick = () => {
            modal.remove();
            callback(true);
        };

        return modal;
    }

    /**
     * Refresh lookup history
     */
    refreshHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        if (this.lookupHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state"><p>No lookup history available</p></div>';
            return;
        }

        historyList.innerHTML = '';

        // Sort history by timestamp (newest first)
        const sortedHistory = [...this.lookupHistory].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        sortedHistory.forEach(entry => {
            const historyItem = this.createHistoryItem(entry);
            historyList.appendChild(historyItem);
        });
    }

    /**
     * Create history item element
     */
    createHistoryItem(entry) {
        const item = document.createElement('div');
        item.className = 'history-item card';

        const timestamp = window.freshserviceAPI.formatDateTime(entry.timestamp);
        const status = entry.success ? 'success' : 'error';
        const statusText = entry.success ? 'Success' : 'Failed';

        if (entry.type === 'bulk') {
            item.innerHTML = this.createBulkHistoryContent(entry, status, statusText, timestamp);
        } else {
            item.innerHTML = this.createSingleHistoryContent(entry, status, statusText, timestamp);
        }

        return item;
    }

    /**
     * Create bulk history content
     */
    createBulkHistoryContent(entry, status, statusText, timestamp) {
        const successCount = entry.results?.filter(r => r.success).length || 0;
        const totalCount = entry.serviceTags?.length || 0;
        
        return `
            <div class="history-header">
                <h4>Bulk Processing</h4>
                <span class="status-badge ${status}">${statusText}</span>
            </div>
            <div class="history-details">
                <p><strong>Processed:</strong> ${totalCount} service tags</p>
                <p><strong>Successful:</strong> ${successCount}</p>
                <p><strong>Timestamp:</strong> ${timestamp}</p>
            </div>
        `;
    }

    /**
     * Create single history content
     */
    createSingleHistoryContent(entry, status, statusText, timestamp) {
        const model = entry.success ? entry.data?.model || 'Unknown' : 'N/A';
        const warrantyStatus = entry.success ? entry.data?.warranty?.status || 'Unknown' : 'N/A';
        
        return `
            <div class="history-header">
                <h4>${entry.serviceTag}</h4>
                <span class="status-badge ${status}">${statusText}</span>
            </div>
            <div class="history-details">
                <p><strong>Model:</strong> ${model}</p>
                <p><strong>Warranty:</strong> ${warrantyStatus}</p>
                <p><strong>Timestamp:</strong> ${timestamp}</p>
                ${!entry.success ? `<p class="error-text"><strong>Error:</strong> ${entry.error}</p>` : ''}
            </div>
        `;
    }

    /**
     * Clear lookup history
     */
    async clearHistory() {
        const confirmed = await this.showConfirmDialog('Are you sure you want to clear all lookup history?');
        if (!confirmed) return;

        this.lookupHistory = [];
        window.freshserviceAPI.clearSessionData('history');
        this.refreshHistory();
        this.showToast('History cleared', 'success');
    }

    /**
     * Add entry to lookup history
     */
    addToHistory(entry) {
        this.lookupHistory.unshift(entry);
        
        // Keep only last 50 entries
        if (this.lookupHistory.length > 50) {
            this.lookupHistory = this.lookupHistory.slice(0, 50);
        }

        // Save to session storage
        window.freshserviceAPI.setSessionData('history', this.lookupHistory);
    }

    /**
     * Load history from session storage
     */
    loadHistoryFromStorage() {
        const storedHistory = window.freshserviceAPI.getSessionData('history');
        if (storedHistory && Array.isArray(storedHistory)) {
            this.lookupHistory = storedHistory;
        }
    }

    /**
     * Show error message
     */
    showError(title, message) {
        const errorSection = document.getElementById('error-section');
        const errorMessage = document.getElementById('error-message');
        const resultsSection = document.getElementById('results-section');

        if (errorMessage) {
            errorMessage.textContent = message;
        }

        this.hideElement(resultsSection);
        this.showElement(errorSection);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    /**
     * Set loading state for button
     */
    setLoadingState(button, loading) {
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.spinner');

        if (loading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.classList.remove('hidden');
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (spinner) spinner.classList.add('hidden');
        }
    }

    /**
     * Set element text content
     */
    setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text || '-';
        }
    }

    /**
     * Show element
     */
    showElement(element) {
        if (element) {
            element.classList.remove('hidden');
        }
    }

    /**
     * Hide element
     */
    hideElement(element) {
        if (element) {
            element.classList.add('hidden');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DellAssetApp();
}); 