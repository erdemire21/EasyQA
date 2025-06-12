// Global state
let selectedDataset = null;
let datasetInfoCache = {};

// DOM elements
const datasetItems = document.querySelectorAll('.dataset-item');
const selectedDatasetInput = document.getElementById('selectedDataset');
const questionTextarea = document.getElementById('question');
const submitBtn = document.querySelector('.question-submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const questionForm = document.getElementById('questionForm');
const resultsCard = document.getElementById('resultsCard');
const errorCard = document.getElementById('errorCard');
const answerBox = document.getElementById('answerBox');
const codeBox = document.getElementById('codeBox');
const errorContent = document.getElementById('errorContent');

// File upload elements
const uploadArea = document.getElementById('datasetUploadArea');
const fileInput = document.getElementById('fileUpload');

// Settings elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.querySelector('.close-settings');
const settingsForm = document.getElementById('settingsForm');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeDatasets();
    initializeForm();
    initializeSettings();
    initializeCodeToggle();
    initializeFileUpload();
});

// Initialize dataset functionality
function initializeDatasets() {
    datasetItems.forEach(item => {
        const datasetName = item.dataset.dataset;
        
        // Load dataset info
        loadDatasetInfo(datasetName, item);
        
        // Add click handler
        item.addEventListener('click', () => selectDataset(datasetName, item));
    });
}

// Load dataset information
async function loadDatasetInfo(datasetName, itemElement) {
    try {
        if (datasetInfoCache[datasetName]) {
            updateDatasetInfo(itemElement, datasetInfoCache[datasetName]);
            return;
        }

        const response = await fetch(`/api/dataset/${datasetName}/info`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const info = await response.json();
        datasetInfoCache[datasetName] = info;
        updateDatasetInfo(itemElement, info);
    } catch (error) {
        console.error(`Error loading info for ${datasetName}:`, error);
        const infoElement = itemElement.querySelector('.dataset-info');
        infoElement.innerHTML = '<span style="color: #ef4444;">Error loading info</span>';
    }
}

// Update dataset info display
function updateDatasetInfo(itemElement, info) {
    const infoElement = itemElement.querySelector('.dataset-info');
    infoElement.innerHTML = `
        <div style="margin-bottom: 5px;">
            <strong>${info.rows.toLocaleString()}</strong> rows, 
            <strong>${info.columns}</strong> columns
        </div>
        <div style="font-size: 0.8em; opacity: 0.9;">
            ${info.column_names.slice(0, 3).join(', ')}${info.column_names.length > 3 ? '...' : ''}
        </div>
    `;
    
    // Add delete button if not already present
    if (!itemElement.querySelector('.dataset-actions')) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'dataset-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dataset-delete';
        deleteBtn.title = 'Delete dataset';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        
        // Add click handler for delete button
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dataset selection when clicking delete
            showDeleteConfirmation(itemElement.dataset.dataset);
        });
        
        actionsDiv.appendChild(deleteBtn);
        itemElement.appendChild(actionsDiv);
    }
}

// Select a dataset
function selectDataset(datasetName, itemElement) {
    // Remove previous selection from all dataset items (including dynamically added ones)
    document.querySelectorAll('.dataset-item').forEach(item => item.classList.remove('selected'));
    
    // Add selection to clicked item
    itemElement.classList.add('selected');
    
    // Update global state
    selectedDataset = datasetName;
    selectedDatasetInput.value = datasetName;
    
    // Enable form if question is also filled
    updateSubmitButton();
    
    // Smooth scroll to question form
    document.querySelector('.question-card').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Initialize form functionality
function initializeForm() {
    questionTextarea.addEventListener('input', updateSubmitButton);
    questionForm.addEventListener('submit', handleFormSubmit);
}

// Update submit button state
function updateSubmitButton() {
    const hasDataset = selectedDataset !== null;
    const hasQuestion = questionTextarea.value.trim() !== '';
    
    submitBtn.disabled = !(hasDataset && hasQuestion);
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const question = questionTextarea.value.trim();
    
    if (!selectedDataset || !question) {
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    hideResultsAndErrors();
    
    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                dataset: selectedDataset
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showResults(result);
        } else {
            showError(result.error_message || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('Error submitting question:', error);
        showError(`Failed to process question: ${error.message}`);
    } finally {
        setLoadingState(false);
    }
}

// Set loading state
function setLoadingState(isLoading) {
    if (isLoading) {
        btnText.style.display = 'none';
        btnSpinner.style.display = 'flex';
        submitBtn.disabled = true;
    } else {
        btnText.style.display = 'block';
        btnSpinner.style.display = 'none';
        updateSubmitButton(); // Restore normal disabled state logic
    }
}

// Show results
function showResults(result) {
    hideResultsAndErrors();
    
    answerBox.textContent = result.answer;
    codeBox.textContent = result.generated_code;
    
    resultsCard.style.display = 'block';
    
    // Smooth scroll to results
    setTimeout(() => {
        resultsCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// Show error
function showError(message) {
    hideResultsAndErrors();
    
    errorContent.textContent = message;
    errorCard.style.display = 'block';
    
    // Smooth scroll to error
    setTimeout(() => {
        errorCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// Hide results and errors
function hideResultsAndErrors() {
    resultsCard.style.display = 'none';
    errorCard.style.display = 'none';
}

// Example questions for different datasets
const exampleQuestions = {
    '050_ING': 'How many unique customers are there?',
    '051_Pokemon': 'What is the average attack value of all Pokemon?',
    '052_Professional': 'How many different job titles are there?',
    '053_Patents': 'What is the most common patent classification?',
    '054_Joe': 'What is the total number of entries?',
    '055_German': 'How many unique values are in the first column?'
};

// Add example question functionality
datasetItems.forEach(item => {
    const datasetName = item.dataset.dataset;
    if (exampleQuestions[datasetName]) {
        item.addEventListener('dblclick', () => {
            if (selectedDataset === datasetName) {
                questionTextarea.value = exampleQuestions[datasetName];
                updateSubmitButton();
                questionTextarea.focus();
            }
        });
        
        // Add tooltip for double-click
        item.title = `Double-click to add example question: "${exampleQuestions[datasetName]}"`;
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + Enter to submit form
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (!submitBtn.disabled) {
            questionForm.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        if (questionTextarea.value || selectedDataset) {
            if (confirm('Clear the form?')) {
                questionTextarea.value = '';
                selectedDatasetInput.value = '';
                selectedDataset = null;
                datasetItems.forEach(item => item.classList.remove('selected'));
                updateSubmitButton();
                hideResultsAndErrors();
            }
        }
    }
});

// Add visual feedback for loading datasets
let loadingDatasets = 0;
const totalDatasets = datasetItems.length;

datasetItems.forEach(item => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationDelay = `${loadingDatasets * 0.1}s`;
                loadingDatasets++;
                observer.unobserve(entry.target);
            }
        });
    });
    
    observer.observe(item);
});

// Initialize settings functionality
function initializeSettings() {
    // Load current settings
    loadSettings();
    
    // Toggle settings modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Handle settings form submission
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(settingsForm);
        const settings = {
            api_key: formData.get('apiKey'),
            api_base_url: formData.get('apiBaseUrl'),
            main_llm: formData.get('mainLlm'),
            error_llm: formData.get('errorLlm')
        };
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save settings');
            }
            
            // Close modal on success
            settingsModal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Show success message
            showSuccess('Settings saved successfully');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            showError('Failed to save settings: ' + error.message);
        }
    });
}

// Load current settings
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
            throw new Error('Failed to load settings');
        }
        
        const settings = await response.json();
        
        // Update form fields
        document.getElementById('apiKey').value = settings.api_key || '';
        document.getElementById('apiBaseUrl').value = settings.api_base_url || '';
        document.getElementById('mainLlm').value = settings.main_llm || '';
        document.getElementById('errorLlm').value = settings.error_llm || '';
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Failed to load settings: ' + error.message);
    }
}

// Initialize code toggle functionality
function initializeCodeToggle() {
    const toggleCodeBtn = document.querySelector('.toggle-code');
    const copyCodeBtn = document.querySelector('.copy-code');
    
    if (toggleCodeBtn) {
        toggleCodeBtn.addEventListener('click', () => {
            const codeBox = document.getElementById('codeBox');
            codeBox.classList.toggle('collapsed');
            
            // Update icon
            const icon = toggleCodeBtn.querySelector('i');
            if (codeBox.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-down';
            } else {
                icon.className = 'fas fa-chevron-up';
            }
        });
    }
    
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async () => {
            const codeBox = document.getElementById('codeBox');
            const code = codeBox.textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                
                // Show success feedback
                const originalIcon = copyCodeBtn.querySelector('i');
                const originalClass = originalIcon.className;
                
                originalIcon.className = 'fas fa-check';
                copyCodeBtn.style.background = 'rgba(34, 197, 94, 0.2)';
                
                setTimeout(() => {
                    originalIcon.className = originalClass;
                    copyCodeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy code:', err);
                showError('Failed to copy code to clipboard');
            }
        });
    }
}

// Show success
function showSuccess(message) {
    hideResultsAndErrors();
    
    // Create success card if it doesn't exist
    let successCard = document.getElementById('successCard');
    if (!successCard) {
        successCard = document.createElement('div');
        successCard.id = 'successCard';
        successCard.className = 'card success-card';
        successCard.innerHTML = `
            <h2 class="card-title">
                <span class="card-icon">✅</span>
                Success
            </h2>
            <div class="success-content" id="successContent"></div>
        `;
        document.querySelector('.main-content').appendChild(successCard);
    }
    
    // Update success content
    const successContent = document.getElementById('successContent');
    successContent.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    // Show success card
    successCard.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successCard.style.display = 'none';
    }, 3000);
}

// Initialize file upload functionality
function initializeFileUpload() {
    if (!uploadArea || !fileInput) return;
    
    // Handle file selection via button
    fileInput.addEventListener('change', handleFileSelect);
    
    // Handle drag and drop events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    // Handle click on the Browse Files button only, not the entire upload area
    const uploadBtn = uploadArea.querySelector('.upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
    }
}

// Handle file selection
function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFiles(e.target.files);
    }
}

// Process selected files
function handleFiles(files) {
    const file = files[0]; // Only process the first file
    
    // Check file extension
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const supportedExtensions = ['parquet', 'csv', 'json', 'xlsx'];
    
    if (!supportedExtensions.includes(fileExtension)) {
        showError(`Unsupported file format: .${fileExtension}. Supported formats: ${supportedExtensions.join(', ')}`);
        return;
    }
    
    // Get dataset name (without extension)
    let datasetName = fileName.split('.')[0];
    
    // Check for existing datasets with the same name
    const existingDatasets = Array.from(document.querySelectorAll('.dataset-item')).map(
        item => item.dataset.dataset
    );
    
    if (existingDatasets.includes(datasetName)) {
        promptForDatasetName(file, datasetName, existingDatasets);
        return;
    }
    
    // Proceed with upload
    uploadFileWithName(file, datasetName);
}

// Prompt user for a custom dataset name
function promptForDatasetName(file, suggestedName, existingDatasets) {
    // Reset upload area first
    resetUploadArea();
    
    // Create a modal for dataset name input
    const modal = document.createElement('div');
    modal.className = 'settings-modal active';
    modal.id = 'nameModal';
    
    modal.innerHTML = `
        <div class="settings-content">
            <div class="settings-header">
                <h2><i class="fas fa-edit"></i> Rename Dataset</h2>
                <button class="close-settings" id="closeNameModal"><i class="fas fa-times"></i></button>
            </div>
            <form id="nameForm" class="settings-form">
                <p>A dataset with the name "${suggestedName}" already exists.</p>
                <div class="input-group">
                    <label for="customName">Enter a new name for your dataset:</label>
                    <input type="text" id="customName" class="input-field" value="${suggestedName}_new" required>
                    <div id="nameError" class="error-message" style="display: none; color: #ef4444; font-size: 0.85rem; margin-top: 5px;"></div>
                </div>
                <button type="submit" class="submit-btn">
                    <span class="btn-text">Upload Dataset</span>
                </button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const nameForm = document.getElementById('nameForm');
    const customNameInput = document.getElementById('customName');
    const nameError = document.getElementById('nameError');
    const closeBtn = document.getElementById('closeNameModal');
    
    // Focus on input
    customNameInput.focus();
    customNameInput.select();
    
    // Close modal handler
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Form submit handler
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const newName = customNameInput.value.trim();
        
        // Validate name
        if (!newName) {
            nameError.textContent = 'Please enter a dataset name.';
            nameError.style.display = 'block';
            return;
        }
        
        // Check if the new name also exists
        if (existingDatasets.includes(newName)) {
            nameError.textContent = `A dataset with the name "${newName}" already exists. Please choose a different name.`;
            nameError.style.display = 'block';
            return;
        }
        
        // Remove modal
        document.body.removeChild(modal);
        
        // Proceed with upload using the custom name
        uploadFileWithName(file, newName);
    });
}

// Upload file with the specified name
function uploadFileWithName(file, datasetName) {
    // Show loading state
    uploadArea.innerHTML = `
        <div class="upload-icon">
            <div class="spinner" style="margin: 0 auto;"></div>
        </div>
        <p class="upload-text">Uploading and preprocessing ${file.name}...</p>
    `;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataset_name', datasetName);
    
    // Upload file
    uploadDataset(formData);
}

// Upload dataset to server
async function uploadDataset(formData) {
    try {
        const response = await fetch('/api/upload-dataset', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            
            // Handle specific error cases
            if (response.status === 409) {
                // This shouldn't happen with client-side validation, but just in case
                const datasetName = formData.get('dataset_name');
                const file = formData.get('file');
                
                // Get existing datasets
                const existingDatasets = Array.from(document.querySelectorAll('.dataset-item')).map(
                    item => item.dataset.dataset
                );
                
                // Show rename dialog
                promptForDatasetName(file, datasetName, existingDatasets);
                return;
            } else {
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            showSuccess(`Dataset '${result.dataset_name}' uploaded successfully!`);
            
            // Reset upload area
            resetUploadArea();
            
            // Update datasets list dynamically instead of refreshing the page
            updateDatasetsList(result);
        } else {
            throw new Error(result.message || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('Error uploading dataset:', error);
        showError(`Failed to upload dataset: ${error.message}`);
        resetUploadArea();
    }
}

// Update datasets list with the newly uploaded dataset
async function updateDatasetsList(datasetInfo) {
    try {
        // Get the dataset grid
        const datasetGrid = document.querySelector('.dataset-grid');
        if (!datasetGrid) return;
        
        // Create a new dataset item
        const newDatasetItem = document.createElement('div');
        newDatasetItem.className = 'dataset-item';
        newDatasetItem.dataset.dataset = datasetInfo.dataset_name;
        
        // Create the dataset item content
        newDatasetItem.innerHTML = `
            <div class="dataset-name">${datasetInfo.dataset_name}</div>
            <div class="dataset-info">
                <div style="margin-bottom: 5px;">
                    <strong>${datasetInfo.rows.toLocaleString()}</strong> rows, 
                    <strong>${datasetInfo.columns}</strong> columns
                </div>
                <div style="font-size: 0.8em; opacity: 0.9;">
                    ${datasetInfo.column_names.slice(0, 3).join(', ')}${datasetInfo.column_names.length > 3 ? '...' : ''}
                </div>
            </div>
            <div class="dataset-actions">
                <button class="dataset-delete" title="Delete dataset">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        // Add click handler to the new dataset item
        newDatasetItem.addEventListener('click', () => selectDataset(datasetInfo.dataset_name, newDatasetItem));
        
        // Add delete button click handler
        const deleteBtn = newDatasetItem.querySelector('.dataset-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dataset selection when clicking delete
            showDeleteConfirmation(datasetInfo.dataset_name);
        });
        
        // Add the new dataset item to the grid
        datasetGrid.prepend(newDatasetItem);
        
        // Cache the dataset info
        datasetInfoCache[datasetInfo.dataset_name] = {
            name: datasetInfo.dataset_name,
            rows: datasetInfo.rows,
            columns: datasetInfo.columns,
            column_names: datasetInfo.column_names
        };
        
        // Automatically select the new dataset
        selectDataset(datasetInfo.dataset_name, newDatasetItem);
    } catch (error) {
        console.error('Error updating datasets list:', error);
    }
}

// Reset upload area to initial state
function resetUploadArea() {
    uploadArea.innerHTML = `
        <div class="upload-icon">
            <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <p class="upload-text">Drag & drop a dataset file here or</p>
        <label for="fileUpload" class="upload-btn">Browse Files</label>
        <input type="file" id="fileUpload" class="file-input" accept=".parquet,.csv,.json,.xlsx" hidden>
        <p class="upload-formats">Supported formats: .parquet, .csv, .json, .xlsx</p>
    `;
    
    // Re-attach event listener to new file input
    document.getElementById('fileUpload').addEventListener('change', handleFileSelect);
}

// Show delete confirmation modal
function showDeleteConfirmation(datasetName) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.id = 'confirmModal';
    
    modal.innerHTML = `
        <div class="confirm-content">
            <div class="confirm-header">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Delete Dataset</h3>
            </div>
            <div class="confirm-message">
                Are you sure you want to delete the dataset <strong>${datasetName}</strong>? This action cannot be undone.
            </div>
            <div class="confirm-actions">
                <button class="confirm-cancel" id="cancelDelete">Cancel</button>
                <button class="confirm-delete" id="confirmDelete">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show the modal with animation
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Add event listeners
    const cancelBtn = document.getElementById('cancelDelete');
    const confirmBtn = document.getElementById('confirmDelete');
    
    cancelBtn.addEventListener('click', () => {
        closeConfirmModal(modal);
    });
    
    confirmBtn.addEventListener('click', () => {
        closeConfirmModal(modal);
        deleteDataset(datasetName);
    });
}

// Close confirmation modal
function closeConfirmModal(modal) {
    modal.classList.remove('active');
    
    // Remove modal after animation
    setTimeout(() => {
        document.body.removeChild(modal);
    }, 300);
}

// Delete dataset
async function deleteDataset(datasetName) {
    try {
        // Show loading state
        const datasetItem = Array.from(document.querySelectorAll('.dataset-item')).find(
            item => item.dataset.dataset === datasetName
        );
        
        if (datasetItem) {
            datasetItem.style.opacity = '0.5';
            datasetItem.style.pointerEvents = 'none';
        }
        
        // Call API to delete the dataset
        const response = await fetch(`/api/delete-dataset/${datasetName}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        // Remove dataset from UI
        if (datasetItem) {
            datasetItem.addEventListener('transitionend', () => {
                datasetItem.remove();
                
                // Clear selection if this was the selected dataset
                if (selectedDataset === datasetName) {
                    selectedDataset = null;
                    selectedDatasetInput.value = '';
                    updateSubmitButton();
                }
            });
            
            datasetItem.style.transform = 'scale(0.8)';
            datasetItem.style.opacity = '0';
        }
        
        // Show success message
        showSuccess(`Dataset '${datasetName}' deleted successfully!`);
        
    } catch (error) {
        console.error('Error deleting dataset:', error);
        showError(`Failed to delete dataset: ${error.message}`);
        
        // Reset the dataset item if it exists
        const datasetItem = Array.from(document.querySelectorAll('.dataset-item')).find(
            item => item.dataset.dataset === datasetName
        );
        
        if (datasetItem) {
            datasetItem.style.opacity = '';
            datasetItem.style.pointerEvents = '';
        }
    }
} 