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
}

// Select a dataset
function selectDataset(datasetName, itemElement) {
    // Remove previous selection
    datasetItems.forEach(item => item.classList.remove('selected'));
    
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

// Show success message
function showSuccess(message) {
    const successCard = document.createElement('div');
    successCard.className = 'card success-card';
    successCard.innerHTML = `
        <div class="success-content">
            <i class="fas fa-check-circle"></i>
            ${message}
        </div>
    `;
    
    document.querySelector('.container').appendChild(successCard);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successCard.remove();
    }, 3000);
} 