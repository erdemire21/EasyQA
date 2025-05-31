// Global state
let selectedDataset = null;
let datasetInfoCache = {};

// DOM elements
const datasetItems = document.querySelectorAll('.dataset-item');
const selectedDatasetInput = document.getElementById('selectedDataset');
const questionTextarea = document.getElementById('question');
const submitBtn = document.querySelector('.submit-btn');
const btnText = document.querySelector('.btn-text');
const btnSpinner = document.querySelector('.btn-spinner');
const questionForm = document.getElementById('questionForm');
const resultsCard = document.getElementById('resultsCard');
const errorCard = document.getElementById('errorCard');
const answerBox = document.getElementById('answerBox');
const codeBox = document.getElementById('codeBox');
const errorContent = document.getElementById('errorContent');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeDatasets();
    initializeForm();
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

// Add copy to clipboard functionality for code
if (navigator.clipboard) {
    const copyButton = document.createElement('button');
    copyButton.innerHTML = '📋 Copy Code';
    copyButton.className = 'copy-button';
    
    // Add copy functionality when results are shown
    const originalShowResults = showResults;
    showResults = function(result) {
        originalShowResults(result);
        
        // Add copy button to code box
        const codeSection = document.querySelector('.code-section');
        codeSection.style.position = 'relative';
        codeSection.appendChild(copyButton);
        copyButton.style.display = 'block';
        
        copyButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(result.generated_code);
                copyButton.innerHTML = '✅ Copied!';
                setTimeout(() => {
                    copyButton.innerHTML = '📋 Copy Code';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
                copyButton.innerHTML = '❌ Failed';
                setTimeout(() => {
                    copyButton.innerHTML = '📋 Copy Code';
                }, 2000);
            }
        };
    };
} 