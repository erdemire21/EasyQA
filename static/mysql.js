// MySQL Interface JavaScript
// Global state management for MySQL interface

let mysqlState = {
    selectedDatabase: null,
    selectedTable: null,
    connectionStatus: false,
    currentStep: 'databases' // 'databases', 'tables', 'questions'
};

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const connectionMessage = document.getElementById('connectionMessage');
const breadcrumb = document.getElementById('breadcrumb');
const databaseSelection = document.getElementById('databaseSelection');
const tableSelection = document.getElementById('tableSelection');
const questionInterface = document.getElementById('questionInterface');
const databaseGrid = document.getElementById('databaseGrid');
const tableGrid = document.getElementById('tableGrid');

// Navigation elements
const backToDatabases = document.getElementById('backToDatabases');
const backToTables = document.getElementById('backToTables');

// Question form elements
const mysqlQuestionForm = document.getElementById('mysqlQuestionForm');
const mysqlQuestion = document.getElementById('mysqlQuestion');
const mysqlSubmitBtn = document.querySelector('.mysql-submit-btn');
const mysqlBtnText = mysqlSubmitBtn.querySelector('.btn-text');
const mysqlBtnSpinner = mysqlSubmitBtn.querySelector('.btn-spinner');

// Results elements
const mysqlResultsCard = document.getElementById('mysqlResultsCard');
const mysqlErrorCard = document.getElementById('mysqlErrorCard');
const mysqlAnswerBox = document.getElementById('mysqlAnswerBox');
const mysqlCodeBox = document.getElementById('mysqlCodeBox');
const mysqlErrorContent = document.getElementById('mysqlErrorContent');
const mysqlToggleCode = document.getElementById('mysqlToggleCode');

// Schema elements
const schemaTableName = document.getElementById('schemaTableName');
const schemaRowCount = document.getElementById('schemaRowCount');
const schemaColumnCount = document.getElementById('schemaColumnCount');
const columnsTableBody = document.getElementById('columnsTableBody');
const contextInfo = document.getElementById('contextInfo');

// Initialize the MySQL interface
document.addEventListener('DOMContentLoaded', function() {
    initializeMySQLInterface();
    setupEventListeners();
});

async function initializeMySQLInterface() {
    try {
        // Test MySQL connection
        showConnectionStatus('Testing MySQL connection...', 'loading');
        
        const response = await fetch('/api/mysql/test-connection');
        const result = await response.json();
        
        if (result.success) {
            showConnectionStatus(result.message, 'success');
            mysqlState.connectionStatus = true;
            
            // Load databases
            await loadDatabases();
        } else {
            showConnectionStatus(result.message, 'error');
            mysqlState.connectionStatus = false;
        }
    } catch (error) {
        showConnectionStatus(`Connection failed: ${error.message}`, 'error');
        mysqlState.connectionStatus = false;
    }
}

function setupEventListeners() {
    // Navigation
    backToDatabases.addEventListener('click', () => navigateToStep('databases'));
    backToTables.addEventListener('click', () => navigateToStep('tables'));
    
    // Question form
    mysqlQuestionForm.addEventListener('submit', handleQuestionSubmit);
    mysqlQuestion.addEventListener('input', updateSubmitButton);
    
    // Code toggle
    mysqlToggleCode.addEventListener('click', toggleMySQLCode);
}

function showConnectionStatus(message, type) {
    connectionMessage.textContent = message;
    connectionStatus.className = 'connection-status';
    
    if (type === 'success') {
        connectionStatus.classList.add('connected');
    } else if (type === 'error') {
        // Default error styling already applied
    }
    
    connectionStatus.style.display = 'flex';
}

async function loadDatabases() {
    try {
        databaseGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span>Loading databases...</span>
            </div>
        `;
        
        const response = await fetch('/api/mysql/databases');
        const result = await response.json();
        
        if (result.success && result.databases.length > 0) {
            displayDatabases(result.databases);
        } else {
            databaseGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>No databases found or unable to retrieve databases.</span>
                </div>
            `;
        }
    } catch (error) {
        databaseGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Error loading databases: ${error.message}</span>
            </div>
        `;
    }
}

function displayDatabases(databases) {
    databaseGrid.innerHTML = '';
    
    databases.forEach(database => {
        const databaseItem = document.createElement('div');
        databaseItem.className = 'database-item';
        databaseItem.innerHTML = `
            <div class="database-name">
                <i class="fas fa-database database-icon"></i>
                ${database}
            </div>
            <div class="database-meta">
                Click to explore tables in this database
            </div>
        `;
        
        databaseItem.addEventListener('click', () => selectDatabase(database));
        databaseGrid.appendChild(databaseItem);
    });
}

async function selectDatabase(database) {
    mysqlState.selectedDatabase = database;
    mysqlState.selectedTable = null;
    
    // Update UI
    updateBreadcrumb('tables');
    await loadTables(database);
    navigateToStep('tables');
}

async function loadTables(database) {
    try {
        tableGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span>Loading tables...</span>
            </div>
        `;
        
        const response = await fetch(`/api/mysql/tables/${database}`);
        const result = await response.json();
        
        if (result.success && result.tables.length > 0) {
            displayTables(result.tables);
        } else {
            tableGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>No tables found in database "${database}".</span>
                </div>
            `;
        }
    } catch (error) {
        tableGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Error loading tables: ${error.message}</span>
            </div>
        `;
    }
}

function displayTables(tables) {
    tableGrid.innerHTML = '';
    
    tables.forEach(table => {
        const tableItem = document.createElement('div');
        tableItem.className = 'table-item';
        
        const columnPreview = table.column_names.slice(0, 3).join(', ') + 
                             (table.column_names.length > 3 ? '...' : '');
        
        tableItem.innerHTML = `
            <div class="table-name">
                <i class="fas fa-table table-icon"></i>
                ${table.name}
            </div>
            <div class="table-meta">
                <strong>${table.rows.toLocaleString()}</strong> rows, 
                <strong>${table.columns}</strong> columns
            </div>
            <div class="table-columns">
                Columns: ${columnPreview}
            </div>
        `;
        
        tableItem.addEventListener('click', () => selectTable(table));
        tableGrid.appendChild(tableItem);
    });
}

async function selectTable(table) {
    mysqlState.selectedTable = table.name;
    
    // Update UI
    updateBreadcrumb('questions');
    await loadTableSchema(mysqlState.selectedDatabase, table.name);
    navigateToStep('questions');
}

async function loadTableSchema(database, tableName) {
    try {
        const response = await fetch(`/api/mysql/schema/${database}/${tableName}`);
        const result = await response.json();
        
        if (result.success) {
            displaySchema(result.schema);
            updateContextInfo(database, tableName);
        } else {
            showError(`Error loading schema: ${result.message}`);
        }
    } catch (error) {
        showError(`Error loading schema: ${error.message}`);
    }
}

function displaySchema(schema) {
    // Update header info
    schemaTableName.textContent = `${schema.database_name}.${schema.table_name}`;
    schemaRowCount.textContent = `${schema.row_count.toLocaleString()} rows`;
    schemaColumnCount.textContent = `${schema.columns.length} columns`;
    
    // Update columns table
    columnsTableBody.innerHTML = '';
    
    schema.columns.forEach(column => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${column.primary_key ? '<i class="fas fa-key primary-key" title="Primary Key"></i>' : ''}
                <strong>${column.name}</strong>
            </td>
            <td><span class="column-type">${column.type}</span></td>
            <td>
                <span class="${column.nullable ? 'nullable' : 'not-nullable'}">
                    ${column.nullable ? '✓ Yes' : '✗ No'}
                </span>
            </td>
            <td>${column.primary_key ? '<span class="primary-key">PRIMARY</span>' : ''}</td>
            <td>${column.default || '-'}</td>
        `;
        columnsTableBody.appendChild(row);
    });
}

function updateContextInfo(database, table) {
    contextInfo.innerHTML = `<strong>${database}</strong>.<strong>${table}</strong>`;
}

function navigateToStep(step) {
    // Hide all sections
    databaseSelection.classList.add('hidden');
    tableSelection.classList.add('hidden');
    questionInterface.classList.add('hidden');
    
    // Show appropriate section
    switch (step) {
        case 'databases':
            databaseSelection.classList.remove('hidden');
            mysqlState.currentStep = 'databases';
            break;
        case 'tables':
            tableSelection.classList.remove('hidden');
            mysqlState.currentStep = 'tables';
            break;
        case 'questions':
            questionInterface.classList.remove('hidden');
            mysqlState.currentStep = 'questions';
            break;
    }
    
    updateBreadcrumb(step);
}

function updateBreadcrumb(step) {
    const breadcrumbItems = {
        'databases': '<div class="breadcrumb-item active"><i class="fas fa-database"></i><span>Select Database</span></div>',
        'tables': `<div class="breadcrumb-item"><i class="fas fa-database"></i><span>Database</span></div>
                   <span class="breadcrumb-separator">→</span>
                   <div class="breadcrumb-item active"><i class="fas fa-table"></i><span>Select Table</span></div>`,
        'questions': `<div class="breadcrumb-item"><i class="fas fa-database"></i><span>${mysqlState.selectedDatabase}</span></div>
                      <span class="breadcrumb-separator">→</span>
                      <div class="breadcrumb-item"><i class="fas fa-table"></i><span>${mysqlState.selectedTable}</span></div>
                      <span class="breadcrumb-separator">→</span>
                      <div class="breadcrumb-item active"><i class="fas fa-question"></i><span>Ask Questions</span></div>`
    };
    
    breadcrumb.innerHTML = breadcrumbItems[step] || breadcrumbItems['databases'];
}

async function handleQuestionSubmit(e) {
    e.preventDefault();
    
    const question = mysqlQuestion.value.trim();
    if (!question) return;
    
    if (!mysqlState.selectedDatabase || !mysqlState.selectedTable) {
        showError('Please select a database and table first.');
        return;
    }
    
    setMySQLLoadingState(true);
    hideResults();
    
    try {
        const response = await fetch('/api/mysql/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                database: mysqlState.selectedDatabase,
                table: mysqlState.selectedTable
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMySQLResults(result);
        } else {
            showError(result.message || 'Unknown error occurred');
        }
    } catch (error) {
        showError(`Request failed: ${error.message}`);
    } finally {
        setMySQLLoadingState(false);
    }
}

function setMySQLLoadingState(isLoading) {
    if (isLoading) {
        mysqlBtnText.style.display = 'none';
        mysqlBtnSpinner.style.display = 'flex';
        mysqlSubmitBtn.disabled = true;
    } else {
        mysqlBtnText.style.display = 'block';
        mysqlBtnSpinner.style.display = 'none';
        updateSubmitButton();
    }
}

function updateSubmitButton() {
    const question = mysqlQuestion.value.trim();
    const hasData = mysqlState.selectedDatabase && mysqlState.selectedTable;
    mysqlSubmitBtn.disabled = !question || !hasData;
}

function showMySQLResults(result) {
    mysqlAnswerBox.innerHTML = result.answer;
    mysqlCodeBox.textContent = result.code;
    
    mysqlResultsCard.style.display = 'block';
    mysqlErrorCard.style.display = 'none';
}

function showError(message) {
    mysqlErrorContent.textContent = message;
    mysqlErrorCard.style.display = 'block';
    mysqlResultsCard.style.display = 'none';
}

function hideResults() {
    mysqlResultsCard.style.display = 'none';
    mysqlErrorCard.style.display = 'none';
}

function toggleMySQLCode() {
    const codeBox = mysqlCodeBox;
    const toggleBtn = mysqlToggleCode;
    const toggleText = toggleBtn.querySelector('span');
    
    if (codeBox.style.display === 'none') {
        codeBox.style.display = 'block';
        toggleText.textContent = 'Hide Code';
    } else {
        codeBox.style.display = 'none';
        toggleText.textContent = 'Show Code';
    }
} 