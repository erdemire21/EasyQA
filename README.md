# Easy-QA Web Interface

A beautiful web interface for asking questions about your datasets using AI-powered code generation. **Now with advanced MySQL database support including multi-table queries!**

## 🌟 Features

### Dataset Analysis
- **Interactive Web UI**: Beautiful, modern interface with responsive design
- **Real-time Dataset Information**: Automatically loads dataset info (rows, columns, sample data)
- **Multi-format Dataset Support**: Works with Parquet, CSV, JSON **and** Excel (XLSX) files
- **AI-Powered Code Generation**: Uses LLMs to generate pandas code for answering questions
- **Error Recovery**: Automatic retry with error correction
- **Live Code Execution**: Executes generated code and shows results instantly

### MySQL Database Integration
- **Direct Database Querying**: Connect to MySQL databases and query tables directly
- **Progressive Disclosure UI**: Easy navigation from Database → Table → Questions
- **Multi-Table Support**: Select and query multiple related tables simultaneously
- **Relationship Highlighting**: Visual indicators show which tables are related
- **Database Discovery**: Automatically discover available databases and tables
- **Schema Analysis**: View table structure with column names, types, and row counts
- **AI-Powered SQL Generation**: Natural language to SQL/JOIN query conversion
- **Smart Result Formatting**: Clean, readable results with intelligent formatting
- **Real-time Connections**: Test connections and browse databases live
- **Table Data Viewer**: Browse actual table data with pagination
- **Foreign Key Detection**: Automatic relationship discovery between tables

### User Experience
- **Copy to Clipboard**: Easy copying of generated code and results
- **Keyboard Shortcuts**: Ctrl/Cmd+Enter to submit, Escape to clear
- **Example Questions**: Double-click datasets for example questions
- **Unified Settings**: Configure both AI and MySQL settings in one place
- **Source Selection**: Choose between file uploads or MySQL databases

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

The requirements file includes all necessary dependencies including MySQL support (`pymysql`, `sqlalchemy`).

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
# AI Configuration (Required)
API_KEY=your_api_key_here
API_BASE_URL=your_api_base_url_here
MAIN_LLM=deepseek-ai/DeepSeek-R1
ERROR_LLM=deepseek-ai/DeepSeek-R1

# MySQL Configuration (Optional - can also be set via Settings UI)
MYSQL_HOST=hostname_or_ip
MYSQL_PORT=port_number  
MYSQL_USERNAME=your_username
MYSQL_PASSWORD=your_password
```

### 3. Prepare Your Data Sources

#### Option A: File-based Datasets
Place any of the supported data files (`.parquet`, `.csv`, `.json`, `.xlsx`) in the `datasets/` folder. Sample datasets are included:
- `050_ING.parquet`
- `051_Pokemon.parquet` 
- `052_Professional.parquet`
- `053_Patents.parquet`
- `054_Joe.parquet`
- `055_German.parquet`

#### Option B: MySQL Database
Ensure you have a MySQL server running and accessible with the credentials in your `.env` file.

### 4. Start the Server
```bash
python run.py
```

### 5. Open Your Browser
Navigate to: http://localhost:8000

## 🎯 How to Use

### File Upload Mode
1. **Select "File Upload"** as your data source
2. **Upload or Select a Dataset**: Either upload a new file or click on an existing dataset card
3. **Ask a Question**: Type your question in natural language
4. **Get Answers**: The AI will generate pandas code and execute it automatically
5. **View Results**: See both the answer and the executed code

### MySQL Database Mode
1. **Select "MySQL Database"** as your data source
2. **Connect to MySQL**: You'll be taken to the MySQL interface
3. **Choose Database**: Select from available databases
4. **Choose Tables**: 
   - **Single Table**: Pick one table to analyze
   - **Multiple Tables**: Toggle to multi-table mode and select related tables
   - **Relationship Hints**: See golden highlighting for tables related to your selection
5. **Ask Questions**: Ask questions in natural language about your table(s)
   - Single table: "How many records are in this table?"
   - Multi-table: "How many albums does each artist have?"
6. **Get SQL Results**: The AI generates SQL queries (including JOINs) and shows formatted results

### Example Questions:

#### For File Datasets:
- "How many unique values are in the name column?"
- "What is the average value in the price column?"
- "How many rows have missing data?"
- "What are the top 5 most common categories?"

#### For MySQL Tables:

**Single Table Queries:**
- "How many records are in this table?"
- "What are the most common values in the status column?"
- "Show me the average salary by department"
- "Find all entries where the date is after 2023-01-01"

**Multi-Table Queries:**
- "How many albums does each artist have?"
- "Which artist has the most tracks?"
- "Show me all customers and their total order amounts"
- "What are the top 5 products by sales across all orders?"
- "List all employees and their managers"

## 🛠 API Endpoints

### Web Interfaces
- `GET /` - Main web interface (file upload mode)
- `GET /mysql` - MySQL database interface

### Dataset API Endpoints
- `GET /api/datasets` - List available datasets
- `GET /api/dataset/{name}/info` - Get dataset information
- `POST /api/ask` - Ask a question about a dataset
- `POST /api/upload-dataset` - Upload a new dataset
- `DELETE /api/delete-dataset/{name}` - Delete a dataset

### MySQL API Endpoints
- `GET /api/mysql/test-connection` - Test MySQL connection
- `GET /api/mysql/databases` - List available databases
- `GET /api/mysql/tables/{database}` - List tables in a database
- `GET /api/mysql/schema/{database}/{table}` - Get table schema
- `GET /api/mysql/multi-schema/{database}?tables=table1,table2` - Get multi-table schema with relationships
- `GET /api/mysql/table-data/{database}/{table}` - Get paginated table data
- `POST /api/mysql/ask` - Ask a question about single MySQL table
- `POST /api/mysql/ask-multi` - Ask a question about multiple MySQL tables

### Settings API
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings (AI + MySQL configuration)

### API Usage Examples

#### File Dataset Query
```bash
curl -X POST "http://localhost:8000/api/ask" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "How many rows are in this dataset?",
       "dataset": "051_Pokemon"
     }'
```

#### Single Table MySQL Query
```bash
curl -X POST "http://localhost:8000/api/mysql/ask" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "How many people are in the forbes list?",
       "database": "final",
       "table": "forbes"
     }'
```

#### Multi-Table MySQL Query
```bash
curl -X POST "http://localhost:8000/api/mysql/ask-multi" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "How many albums does each artist have?",
       "database": "chinook",
       "tables": ["artist", "album"]
     }'
```

## 🎨 UI Features

### Beautiful Design
- Modern gradient backgrounds with glass morphism effects
- Smooth animations and transitions
- Responsive design for all screen sizes
- Dark code editor with syntax highlighting
- Progressive disclosure interface for MySQL

### Interactive Elements
- **Source Selection**: Toggle between file upload and MySQL database modes
- **Dataset Cards**: Show real-time information (rows, columns, sample data)
- **MySQL Flow**: Database → Table(s) → Questions progression with clear visual feedback
- **Multi-Table Selection**: Toggle between single and multiple table modes
- **Relationship Highlighting**: Golden highlighting with animations for related tables
- **Interactive Tooltips**: Hover over related tables to see connection details
- **Table Data Browser**: View actual table content with pagination controls
- **Smart Forms**: Buttons enable only when all required fields are provided
- **Loading States**: Visual feedback during processing
- **Results Display**: Clean separation of answers and executed code
- **Settings Modal**: Unified configuration for AI and MySQL settings

### Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Submit forms
- `Escape`: Clear forms
- Double-click dataset: Add example question

## 🧠 How It Works

### File Dataset Analysis
1. **Dataset Selection**: Schema information is loaded automatically
2. **Question Processing**: Natural language question + dataset schema → LLM
3. **Pandas Code Generation**: LLM generates pandas code to answer the question
4. **Code Execution**: Generated code runs safely in a controlled environment
5. **Error Handling**: Automatic retry with error correction if needed
6. **Result Display**: Final answer is displayed with the generated code

### MySQL Database Analysis
1. **Connection**: Establish connection using configured credentials
2. **Database Discovery**: Browse available databases and tables
3. **Table Selection**: Choose single or multiple tables with relationship detection
4. **Schema Analysis**: Examine table structure (columns, types, row counts, relationships)
5. **Question Processing**: Natural language question + table/multi-table schema → LLM
6. **SQL Generation**: LLM generates SQL query (including JOINs for multi-table) using MySQL syntax
7. **Query Execution**: SQL executes against the live database
8. **Result Formatting**: Smart formatting for different result types
9. **Answer Display**: Clean, readable results with query shown

## 🔧 Technical Details

### Backend (FastAPI)
- **Async Processing**: Non-blocking question processing for both file and MySQL modes
- **Error Recovery**: Multiple retry attempts with different LLMs
- **Schema Generation**: Automatic dataset and database schema analysis with relationship detection
- **Safe Code Execution**: Controlled environment for running generated code
- **MySQL Integration**: SQLAlchemy-based connection management with multi-table support
- **Relationship Detection**: Automatic foreign key relationship discovery
- **Result Formatting**: Smart formatting for various data types

### Frontend (Vanilla JavaScript)
- **Modern ES6+**: Clean, maintainable JavaScript
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Source Switching**: Seamless transition between file and database modes

### Security Features
- **Code Sandboxing**: Generated code runs in a controlled environment
- **Connection Security**: Secure credential handling for database connections
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Safe error display without exposing internals

## 📁 Project Structure

```
Easy-QA/
├── app.py                    # Main FastAPI application
├── run.py                    # Simple startup script
├── requirements.txt          # Python dependencies (includes MySQL support)
├── .env                      # Environment configuration (create this)
├── templates/
│   ├── index.html           # Main web interface (file upload mode)
│   └── mysql.html           # MySQL database interface (with multi-table support)
├── static/
│   ├── style.css            # Styles and animations
│   ├── script.js            # File upload functionality
│   └── mysql.js             # MySQL interface functionality (with relationship highlighting)
├── utilities/               # Core processing modules
│   ├── agents.py            # LLM integration for pandas code
│   ├── sql_agents.py        # LLM integration for SQL generation (single & multi-table)
│   ├── mysql_handler.py     # MySQL connection and operations (with relationship detection)
│   ├── code_execution.py    # Safe code execution
│   └── ...
└── datasets/               # Your data files (.parquet / .csv / .json / .xlsx)
    ├── 050_ING.parquet
    ├── 051_Pokemon.parquet
    └── ...
```

## 🆚 File Upload vs MySQL Database

| Feature | File Upload Mode | MySQL Database Mode |
|---------|------------------|---------------------|
| **Data Source** | Local files (upload or pre-loaded) | Live MySQL database |
| **Supported Formats** | .parquet, .csv, .json, .xlsx | Any MySQL table(s) |
| **Data Processing** | Pandas-based analysis | SQL query execution (single/multi-table) |
| **Code Generation** | Python/pandas code | MySQL SQL queries (including JOINs) |
| **Relationships** | N/A (single file) | Automatic foreign key detection |
| **Data Size** | Limited by file size and memory | Limited by database performance |
| **Real-time Data** | Static snapshots | Live, current data |
| **Schema Discovery** | Automatic from file | Live from database with relationships |
| **Setup Required** | Just drop files in datasets/ | MySQL server + credentials |

## 🎯 Best Practices

### Writing Good Questions

#### For File Datasets:
✅ "How many unique Pokemon types are there?"  
✅ "What is the average attack value?"  
✅ "Which Pokemon has the highest defense?"  
✅ "How many Pokemon are water type?"  

#### For MySQL Tables:
✅ "How many people are in the forbes list?"  
✅ "What's the average net worth by country?"  
✅ "Show me the top 10 richest people"  
✅ "How many billionaires are there from each industry?"

### Questions to Avoid:
❌ "Tell me everything about this data"  
❌ "What's interesting here?"  
❌ "Analyze this dataset/table"  

### MySQL Configuration Tips:
- Use read-only database users when possible
- Test connections before running complex queries
- Be aware that large result sets may take time to load
- Use specific questions to avoid accidentally running expensive queries

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
- Check if port 8000 is already in use
- Verify all dependencies are installed (`pip install -r requirements.txt`)
- Ensure `.env` file exists with proper AI configuration

**Questions fail:**
- Check your API key and base URL in `.env` or Settings
- Verify the LLM model names are correct
- Try simpler questions first

**MySQL connection issues:**
- Verify MySQL server is running and accessible
- Check credentials in `.env` file or Settings modal
- Ensure MySQL user has proper permissions
- Test connection using the "Test Connection" button

**No datasets showing:**
- Ensure your data files are in the `datasets/` folder
- Check file permissions
- Verify files are in a valid format (.parquet / .csv / .json / .xlsx)

### Debug Mode
Run with debug logging:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --log-level debug
```

### MySQL Connection Testing
Use the built-in connection test in the MySQL interface or via API:
```bash
curl http://localhost:8000/api/mysql/test-connection
```

## 🤝 Contributing

Feel free to contribute improvements:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project maintains the same license as the original Easy-QA project.

---

**Enjoy exploring your datasets and databases with AI! 🧠📊🗄️** 