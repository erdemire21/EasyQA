// MySQL Interface JavaScript
// Global state management for MySQL interface

let mysqlState = {
    selectedDatabase: null,
    selectedTable: null,
    selectedTables: [], // Array for multi-table selection
    multiTableMode: false, // Flag for multi-table mode
    connectionStatus: false,
    currentStep: 'databases', // 'databases', 'tables', 'questions'
    currentSchema: null,
    multiTableSchema: null, // Schema for multiple tables
    tableRelationships: {}, // Store table relationships for highlighting
    availableTables: [], // Store all available tables
    currentApproach: 'sql', // 'sql' or 'pandas'
    tableViewState: {
        currentPage: 1,
        perPage: 10,
        totalPages: 1,
        totalRows: 0,
        data: null
    }
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

// Approach selection elements
const sqlApproach = document.getElementById('sqlApproach');
const pandasApproach = document.getElementById('pandasApproach');
const approachDescription = document.getElementById('approachDescription');

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

// Multi-table elements
const singleTableMode = document.getElementById('singleTableMode');
const multiTableModeBtn = document.getElementById('multiTableMode');
const selectedTablesInfo = document.getElementById('selectedTablesInfo');
const selectedTablesList = document.getElementById('selectedTablesList');
const selectedTablesCount = document.getElementById('selectedTablesCount');
const continueMultiTable = document.getElementById('continueMultiTable');

// Initialize the MySQL interface
document.addEventListener('DOMContentLoaded', function() {
    initializeMySQLInterface();
    setupEventListeners();
    loadCurrentApproach();
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
    mysqlQuestionForm.addEventListener('submit', handleQuestionSubmitMultiTable);
    mysqlQuestion.addEventListener('input', () => {
        if (mysqlState.multiTableMode && mysqlState.selectedTables.length > 1) {
            updateSubmitButtonMultiTable();
        } else {
            updateSubmitButton();
        }
    });
    
    // Code toggle
    mysqlToggleCode.addEventListener('click', toggleMySQLCode);
    
    // Table viewer buttons
    document.getElementById('viewTableBtn').addEventListener('click', showTableData);
    document.getElementById('viewSchemaBtn').addEventListener('click', showSchemaData);
    
    // Table pagination
    document.getElementById('tablePerPageSelect').addEventListener('change', (e) => {
        mysqlState.tableViewState.currentPage = 1;
        mysqlState.tableViewState.perPage = parseInt(e.target.value);
        loadTableData();
    });
    
    document.getElementById('tableFirstPageBtn').addEventListener('click', () => {
        mysqlState.tableViewState.currentPage = 1;
        loadTableData();
    });
    
    document.getElementById('tablePrevPageBtn').addEventListener('click', () => {
        if (mysqlState.tableViewState.currentPage > 1) {
            mysqlState.tableViewState.currentPage--;
            loadTableData();
        }
    });
    
    document.getElementById('tableNextPageBtn').addEventListener('click', () => {
        if (mysqlState.tableViewState.currentPage < mysqlState.tableViewState.totalPages) {
            mysqlState.tableViewState.currentPage++;
            loadTableData();
        }
    });
    
    document.getElementById('tableLastPageBtn').addEventListener('click', () => {
        mysqlState.tableViewState.currentPage = mysqlState.tableViewState.totalPages;
        loadTableData();
    });
    
    // Multi-table mode listeners
    singleTableMode.addEventListener('click', () => setTableMode(false));
    multiTableModeBtn.addEventListener('click', () => setTableMode(true));
    continueMultiTable.addEventListener('click', proceedWithMultipleTables);
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
            // Store available tables for relationship analysis
            mysqlState.availableTables = result.tables;
            
            // Load relationship information for all tables if in multi-table mode
            if (mysqlState.multiTableMode) {
                await loadTableRelationships(database, result.tables.map(t => t.name));
            }
            
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
        tableItem.dataset.tableName = table.name;
        
        const columnPreview = table.column_names.slice(0, 3).join(', ') + 
                             (table.column_names.length > 3 ? '...' : '');
        
        // Add checkbox for multi-table mode
        const checkboxHtml = mysqlState.multiTableMode ? 
            `<input type="checkbox" class="table-item-checkbox" data-table="${table.name}">` : '';
        
        tableItem.innerHTML = `
            ${checkboxHtml}
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
        
        if (mysqlState.multiTableMode) {
            tableItem.classList.add('multi-mode');
            // Handle checkbox selection
            const checkbox = tableItem.querySelector('.table-item-checkbox');
            checkbox.addEventListener('change', (e) => handleTableSelection(e, table));
            
            // Still allow clicking on the item itself to toggle
            tableItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('table-item-checkbox')) {
                    checkbox.checked = !checkbox.checked;
                    handleTableSelection({ target: checkbox }, table);
                }
            });
        } else {
            tableItem.addEventListener('click', () => selectTable(table));
        }
        
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
    
    // Show view schema button and hide view table button (reversed default)
    document.getElementById('viewTableBtn').style.display = 'none';
    document.getElementById('viewSchemaBtn').style.display = 'flex';
    
    // Show table data view and hide schema view (reversed default)
    document.getElementById('schemaView').style.display = 'none';
    document.getElementById('tableDataView').style.display = 'block';
    
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
    
    // Store schema for table viewer
    mysqlState.currentSchema = schema;
    
    // Load table data by default
    loadTableData();
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
    // Use answer_display for UI if available, otherwise fall back to answer
    const displayAnswer = result.answer_display || result.answer;
    
    // Format the display answer for better presentation
    if (typeof result.answer === 'object' && result.answer !== null) {
        // For structured data (arrays, objects), display in a more readable format
        if (Array.isArray(result.answer)) {
            if (result.answer.length > 0 && typeof result.answer[0] === 'object') {
                // Array of objects - display as a table
                mysqlAnswerBox.innerHTML = formatArrayOfObjects(result.answer);
            } else {
                // Simple array - display as list
                mysqlAnswerBox.innerHTML = formatSimpleArray(result.answer);
            }
        } else {
            // Single object
            mysqlAnswerBox.innerHTML = `<pre>${JSON.stringify(result.answer, null, 2)}</pre>`;
        }
    } else {
        // Simple values (strings, numbers, booleans)
        mysqlAnswerBox.innerHTML = String(displayAnswer);
    }
    
    mysqlCodeBox.textContent = result.code;
    
    // Update approach indicator
    updateResultsForApproach(result);
    
    mysqlResultsCard.style.display = 'block';
    mysqlErrorCard.style.display = 'none';
}

function formatArrayOfObjects(data) {
    if (!data || data.length === 0) return 'No data';
    
    const columns = Object.keys(data[0]);
    let html = '<table class="result-table"><thead><tr>';
    
    // Create header
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Create rows
    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const value = row[col];
            html += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

function formatSimpleArray(data) {
    if (!data || data.length === 0) return 'No data';
    
    return '<ul class="result-list">' + 
           data.map(item => `<li>${item !== null && item !== undefined ? item : 'null'}</li>`).join('') + 
           '</ul>';
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

// Table Viewer Functions
async function showTableData() {
    if (!mysqlState.selectedDatabase || !mysqlState.selectedTable) {
        showError('No table selected');
        return;
    }
    
    // Update buttons
    document.getElementById('viewTableBtn').style.display = 'none';
    document.getElementById('viewSchemaBtn').style.display = 'flex';
    
    // Update views
    document.getElementById('schemaView').style.display = 'none';
    document.getElementById('tableDataView').style.display = 'block';
    
    // Load table data
    await loadTableData();
}

function showSchemaData() {
    // Update buttons
    document.getElementById('viewTableBtn').style.display = 'flex';
    document.getElementById('viewSchemaBtn').style.display = 'none';
    
    // Update views
    document.getElementById('schemaView').style.display = 'block';
    document.getElementById('tableDataView').style.display = 'none';
}

async function loadTableData() {
    try {
        const tableBody = document.getElementById('mysqlDataTableBody');
        tableBody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px;">Loading data...</td></tr>';
        
        const response = await fetch(
            `/api/mysql/table-data/${mysqlState.selectedDatabase}/${mysqlState.selectedTable}` +
            `?page=${mysqlState.tableViewState.currentPage}&per_page=${mysqlState.tableViewState.perPage}`
        );
        
        const result = await response.json();
        
        if (result.success && result.data) {
            displayTableData(result.data);
        } else {
            tableBody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 20px; color: #ef4444;">Error loading data: ${result.message || 'Unknown error'}</td></tr>`;
        }
    } catch (error) {
        const tableBody = document.getElementById('mysqlDataTableBody');
        tableBody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 20px; color: #ef4444;">Error: ${error.message}</td></tr>`;
    }
}

function displayTableData(data) {
    const tableHead = document.getElementById('mysqlDataTableHead');
    const tableBody = document.getElementById('mysqlDataTableBody');
    
    // Update pagination state
    mysqlState.tableViewState.totalPages = data.pagination.total_pages;
    mysqlState.tableViewState.totalRows = data.pagination.total_rows;
    mysqlState.tableViewState.currentPage = data.pagination.current_page;
    
    // Clear existing content
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Create table header
    const headerRow = document.createElement('tr');
    data.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);
    
    // Create table rows
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '';
            td.title = cell || '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
    
    // Update pagination controls
    updatePaginationControls(data.pagination);
    
    // Update per-page selector
    document.getElementById('tablePerPageSelect').value = data.pagination.per_page;
    
    // Update entries info
    const startEntry = (data.pagination.current_page - 1) * data.pagination.per_page + 1;
    const endEntry = Math.min(startEntry + data.rows.length - 1, data.pagination.total_rows);
    document.getElementById('tableEntriesInfo').textContent = 
        `Showing ${startEntry} to ${endEntry} of ${data.pagination.total_rows.toLocaleString()} entries`;
}

function updatePaginationControls(pagination) {
    const firstBtn = document.getElementById('tableFirstPageBtn');
    const prevBtn = document.getElementById('tablePrevPageBtn');
    const nextBtn = document.getElementById('tableNextPageBtn');
    const lastBtn = document.getElementById('tableLastPageBtn');
    const pageInfo = document.getElementById('tablePageInfo');
    
    // Update page info
    pageInfo.textContent = `Page ${pagination.current_page} of ${pagination.total_pages}`;
    
    // Update button states
    const isFirstPage = pagination.current_page === 1;
    const isLastPage = pagination.current_page === pagination.total_pages;
    
    firstBtn.disabled = isFirstPage;
    prevBtn.disabled = isFirstPage;
    nextBtn.disabled = isLastPage;
    lastBtn.disabled = isLastPage;
}

// Multi-table Functions

function handleTableSelection(event, table) {
    const checkbox = event.target;
    const tableItem = checkbox.closest('.table-item');
    
    if (checkbox.checked) {
        // Add table to selection
        if (!mysqlState.selectedTables.includes(table.name)) {
            mysqlState.selectedTables.push(table.name);
            tableItem.classList.add('multi-selected');
        }
    } else {
        // Remove table from selection
        const index = mysqlState.selectedTables.indexOf(table.name);
        if (index > -1) {
            mysqlState.selectedTables.splice(index, 1);
            tableItem.classList.remove('multi-selected');
        }
    }
    
    // Update relationship highlighting
    updateRelationshipHighlighting();
    updateSelectedTablesDisplay();
}

function updateSelectedTablesDisplay() {
    const count = mysqlState.selectedTables.length;
    
    if (count === 0) {
        selectedTablesInfo.style.display = 'none';
        continueMultiTable.style.display = 'none';
    } else {
        selectedTablesInfo.style.display = 'block';
        selectedTablesList.textContent = mysqlState.selectedTables.join(', ');
        selectedTablesCount.textContent = `${count} table${count !== 1 ? 's' : ''} selected`;
        continueMultiTable.style.display = count > 1 ? 'inline-flex' : 'none';
    }
}

async function proceedWithMultipleTables() {
    if (mysqlState.selectedTables.length < 2) {
        showError('Please select at least 2 tables for multi-table queries.');
        return;
    }
    
    try {
        // Load multi-table schema
        await loadMultiTableSchema(mysqlState.selectedDatabase, mysqlState.selectedTables);
        
        // Update UI for multi-table mode
        updateBreadcrumbMultiTable('questions');
        navigateToStep('questions');
        
        // Update context info
        updateContextInfoMultiTable(mysqlState.selectedDatabase, mysqlState.selectedTables);
        
        // Update submit button validation
        updateSubmitButtonMultiTable();
        
    } catch (error) {
        showError(`Error loading multi-table schema: ${error.message}`);
    }
}

async function loadMultiTableSchema(database, tableNames) {
    try {
        const tablesParam = tableNames.join(',');
        const response = await fetch(`/api/mysql/multi-schema/${database}?tables=${tablesParam}`);
        const result = await response.json();
        
        if (result.success) {
            displayMultiTableSchema(result.schema);
            mysqlState.multiTableSchema = result.schema;
        } else {
            throw new Error(result.message || 'Failed to load multi-table schema');
        }
    } catch (error) {
        throw new Error(`Failed to load multi-table schema: ${error.message}`);
    }
}

function displayMultiTableSchema(schema) {
    // Update header info for multi-table
    schemaTableName.textContent = `${schema.database_name} (${schema.table_count} tables)`;
    
    let totalRows = 0;
    let totalColumns = 0;
    
    Object.values(schema.tables).forEach(table => {
        totalRows += table.row_count || 0;
        totalColumns += table.columns ? table.columns.length : 0;
    });
    
    schemaRowCount.textContent = `${totalRows.toLocaleString()} total rows`;
    schemaColumnCount.textContent = `${totalColumns} total columns`;
    
    // Hide table view buttons for multi-table mode
    document.getElementById('viewTableBtn').style.display = 'none';
    document.getElementById('viewSchemaBtn').style.display = 'none';
    
    // Always show schema view for multi-table
    document.getElementById('schemaView').style.display = 'block';
    document.getElementById('tableDataView').style.display = 'none';
    
    // Build multi-table schema display
    columnsTableBody.innerHTML = '';
    
    Object.entries(schema.tables).forEach(([tableName, tableSchema]) => {
        // Add table header row
        const tableHeaderRow = document.createElement('tr');
        tableHeaderRow.style.backgroundColor = '#f8fafc';
        tableHeaderRow.innerHTML = `
            <td colspan="5" style="font-weight: bold; color: #374151; padding: 15px 12px;">
                <i class="fas fa-table" style="color: #667eea; margin-right: 8px;"></i>
                ${tableName} (${tableSchema.row_count?.toLocaleString() || 0} rows, ${tableSchema.columns?.length || 0} columns)
            </td>
        `;
        columnsTableBody.appendChild(tableHeaderRow);
        
        // Add columns
        if (tableSchema.columns) {
            tableSchema.columns.forEach(column => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding-left: 30px;">
                        ${column.primary_key ? '<i class="fas fa-key primary-key" title="Primary Key"></i>' : ''}
                        <strong>${tableName}.${column.name}</strong>
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
        
        // Add spacing between tables
        const spacerRow = document.createElement('tr');
        spacerRow.innerHTML = '<td colspan="5" style="height: 10px; border-bottom: none;"></td>';
        columnsTableBody.appendChild(spacerRow);
    });
    
    // Show relationships if any
    if (schema.relationships && schema.relationships.length > 0) {
        const relationshipsRow = document.createElement('tr');
        relationshipsRow.style.backgroundColor = '#fef3c7';
        relationshipsRow.innerHTML = `
            <td colspan="5" style="font-weight: bold; color: #92400e; padding: 15px 12px;">
                <i class="fas fa-link" style="margin-right: 8px;"></i>
                Table Relationships
            </td>
        `;
        columnsTableBody.appendChild(relationshipsRow);
        
        schema.relationships.forEach(rel => {
            const relRow = document.createElement('tr');
            const fromCols = rel.from_columns.join(', ');
            const toCols = rel.to_columns.join(', ');
            relRow.innerHTML = `
                <td colspan="5" style="padding: 8px 30px; font-family: monospace; color: #374151;">
                    <i class="fas fa-arrow-right" style="color: #f59e0b; margin: 0 8px;"></i>
                    <strong>${rel.from_table}.${fromCols}</strong> → <strong>${rel.to_table}.${toCols}</strong>
                </td>
            `;
            columnsTableBody.appendChild(relRow);
        });
    }
}

function updateContextInfoMultiTable(database, tables) {
    contextInfo.innerHTML = `<strong>${database}</strong> (${tables.length} tables: ${tables.join(', ')})`;
}

function updateBreadcrumbMultiTable(step) {
    const tablesList = mysqlState.selectedTables.join(', ');
    const breadcrumbItems = {
        'questions': `<div class="breadcrumb-item"><i class="fas fa-database"></i><span>${mysqlState.selectedDatabase}</span></div>
                      <span class="breadcrumb-separator">→</span>
                      <div class="breadcrumb-item"><i class="fas fa-layer-group"></i><span>${mysqlState.selectedTables.length} Tables</span></div>
                      <span class="breadcrumb-separator">→</span>
                      <div class="breadcrumb-item active"><i class="fas fa-question"></i><span>Ask Questions</span></div>`
    };
    
    breadcrumb.innerHTML = breadcrumbItems[step] || breadcrumbItems['questions'];
}

function updateSubmitButtonMultiTable() {
    const question = mysqlQuestion.value.trim();
    const hasData = mysqlState.selectedDatabase && mysqlState.selectedTables.length > 0;
    mysqlSubmitBtn.disabled = !question || !hasData;
}

// Update the main handleQuestionSubmit to support multi-table
async function handleQuestionSubmitMultiTable(e) {
    e.preventDefault();
    
    const question = mysqlQuestion.value.trim();
    if (!question) return;
    
    // Check if we're in multi-table mode
    if (mysqlState.multiTableMode && mysqlState.selectedTables.length > 1) {
        if (!mysqlState.selectedDatabase || mysqlState.selectedTables.length === 0) {
            showError('Please select a database and tables first.');
            return;
        }
        
        setMySQLLoadingState(true);
        hideResults();
        
        try {
            const response = await fetch('/api/mysql/ask-multi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    database: mysqlState.selectedDatabase,
                    tables: mysqlState.selectedTables
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
    } else {
        // Single table mode - use existing function
        return handleQuestionSubmit(e);
    }
}

// Relationship highlighting functions
async function loadTableRelationships(database, tableNames) {
    try {
        // Get all possible relationships by testing all table combinations
        const tablesParam = tableNames.join(',');
        const response = await fetch(`/api/mysql/multi-schema/${database}?tables=${tablesParam}`);
        const result = await response.json();
        
        if (result.success && result.schema.relationships) {
            // Build relationship map
            mysqlState.tableRelationships = {};
            
            result.schema.relationships.forEach(rel => {
                // Add bidirectional relationships
                if (!mysqlState.tableRelationships[rel.from_table]) {
                    mysqlState.tableRelationships[rel.from_table] = new Set();
                }
                if (!mysqlState.tableRelationships[rel.to_table]) {
                    mysqlState.tableRelationships[rel.to_table] = new Set();
                }
                
                mysqlState.tableRelationships[rel.from_table].add(rel.to_table);
                mysqlState.tableRelationships[rel.to_table].add(rel.from_table);
            });
        }
    } catch (error) {
        console.log('Could not load relationship information:', error.message);
    }
}

function updateRelationshipHighlighting() {
    if (!mysqlState.multiTableMode || mysqlState.selectedTables.length === 0) {
        // Clear all relationship highlighting
        document.querySelectorAll('.table-item').forEach(item => {
            item.classList.remove('has-relationship');
            const tooltip = item.querySelector('.relationship-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
        return;
    }
    
    // Get all related tables for currently selected tables
    const relatedTables = new Set();
    const relationshipDetails = {};
    
    mysqlState.selectedTables.forEach(selectedTable => {
        if (mysqlState.tableRelationships[selectedTable]) {
            mysqlState.tableRelationships[selectedTable].forEach(relatedTable => {
                if (!mysqlState.selectedTables.includes(relatedTable)) {
                    relatedTables.add(relatedTable);
                    if (!relationshipDetails[relatedTable]) {
                        relationshipDetails[relatedTable] = new Set();
                    }
                    relationshipDetails[relatedTable].add(selectedTable);
                }
            });
        }
    });
    
    // Update all table items
    document.querySelectorAll('.table-item').forEach(item => {
        const tableName = item.dataset.tableName;
        
        // Remove existing relationship highlighting and tooltips
        item.classList.remove('has-relationship');
        const existingTooltip = item.querySelector('.relationship-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Add relationship highlighting if this table is related to selected tables
        if (relatedTables.has(tableName)) {
            item.classList.add('has-relationship');
            
            // Create relationship tooltip
            const relatedToTables = Array.from(relationshipDetails[tableName]);
            const tooltip = document.createElement('div');
            tooltip.className = 'relationship-tooltip';
            tooltip.textContent = `Related to: ${relatedToTables.join(', ')}`;
            item.appendChild(tooltip);
        }
    });
}

function setTableMode(isMultiMode) {
    mysqlState.multiTableMode = isMultiMode;
    mysqlState.selectedTables = [];
    
    // Update UI
    singleTableMode.classList.toggle('active', !isMultiMode);
    multiTableModeBtn.classList.toggle('active', isMultiMode);
    
    // Hide/show multi-table info
    selectedTablesInfo.style.display = isMultiMode ? 'block' : 'none';
    continueMultiTable.style.display = 'none';
    
    // Clear relationship highlighting when switching modes
    if (!isMultiMode) {
        updateRelationshipHighlighting();
    }
    
    // Reload tables with new mode
    if (mysqlState.selectedDatabase) {
        loadTables(mysqlState.selectedDatabase);
    }
    
    updateSelectedTablesDisplay();
}

// Approach Management Functions
async function loadCurrentApproach() {
    try {
        const response = await fetch('/api/mysql/approach');
        const result = await response.json();
        mysqlState.currentApproach = result.approach;
        updateApproachUI();
    } catch (error) {
        console.log('Could not load current approach:', error.message);
        mysqlState.currentApproach = 'sql';
        updateApproachUI();
    }
}

async function setApproach(approach) {
    try {
        const response = await fetch('/api/mysql/approach', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ approach: approach })
        });
        
        const result = await response.json();
        if (result.success) {
            mysqlState.currentApproach = approach;
            updateApproachUI();
        }
    } catch (error) {
        console.error('Failed to set approach:', error.message);
    }
}

function updateApproachUI() {
    // Update button states
    document.querySelectorAll('.approach-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mysqlState.currentApproach === 'sql') {
        sqlApproach.classList.add('active');
        approachDescription.textContent = 'Direct SQL execution on database';
    } else {
        pandasApproach.classList.add('active');
        approachDescription.textContent = 'Create data snapshots and use pandas analysis';
    }
}

function updateResultsForApproach(result) {
    // Update code header and badge based on approach
    const codeHeaderTitle = document.getElementById('codeHeaderTitle');
    const approachBadge = document.getElementById('approachBadge');
    
    if (result.approach === 'pandas') {
        codeHeaderTitle.textContent = 'Generated Pandas Code:';
        approachBadge.textContent = 'PANDAS';
        approachBadge.style.background = '#10b981';
    } else {
        codeHeaderTitle.textContent = 'Generated SQL Query:';
        approachBadge.textContent = 'SQL';
        approachBadge.style.background = '#667eea';
    }
}

// Add event listeners for approach buttons
document.addEventListener('DOMContentLoaded', function() {
    if (sqlApproach) {
        sqlApproach.addEventListener('click', () => setApproach('sql'));
    }
    if (pandasApproach) {
        pandasApproach.addEventListener('click', () => setApproach('pandas'));
    }
});