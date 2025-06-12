# QA-UI Web Interface

A beautiful web interface for asking questions about your datasets using AI-powered code generation.

## 🌟 Features

- **Interactive Web UI**: Beautiful, modern interface with responsive design
- **Real-time Dataset Information**: Automatically loads dataset info (rows, columns, sample data)
- **Multi-format Dataset Support**: Works with Parquet, CSV, JSON **and** Excel (XLSX) files
- **AI-Powered Code Generation**: Uses LLMs to generate pandas code for answering questions
- **Error Recovery**: Automatic retry with error correction
- **Live Code Execution**: Executes generated code and shows results instantly
- **Copy to Clipboard**: Easy copying of generated code
- **Keyboard Shortcuts**: Ctrl/Cmd+Enter to submit, Escape to clear
- **Example Questions**: Double-click datasets for example questions

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

The requirements file now includes `openpyxl` for Excel file support. No extra steps are needed.

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
API_KEY=your_api_key_here
API_BASE_URL=your_api_base_url_here
MAIN_LLM=deepseek-ai/DeepSeek-R1
ERROR_LLM=deepseek-ai/DeepSeek-R1
```

### 3. Prepare Your Datasets
Place any of the supported data files (`.parquet`, `.csv`, `.json`, `.xlsx`) in the `datasets/` folder. A few sample parquet datasets are included for convenience:
- `050_ING.parquet`
- `051_Pokemon.parquet` 
- `052_Professional.parquet`
- `053_Patents.parquet`
- `054_Joe.parquet`
- `055_German.parquet`

### 4. Start the Server
```bash
python run.py
```

### 5. Open Your Browser
Navigate to: http://localhost:8000

## 🎯 How to Use

1. **Select a Dataset**: Click on any dataset card to select it
2. **Ask a Question**: Type your question in natural language
3. **Get Answers**: The AI will generate code and execute it automatically
4. **View Results**: See both the answer and the *executed* code (the exact code that actually ran)

### Example Questions:
- "How many unique values are in the name column?"
- "What is the average value in the price column?"
- "How many rows have missing data?"
- "What are the top 5 most common categories?"

## 🛠 API Endpoints

### Web Interface
- `GET /` - Main web interface

### API Endpoints
- `GET /api/datasets` - List available datasets
- `GET /api/dataset/{name}/info` - Get dataset information
- `POST /api/ask` - Ask a question about a dataset

### API Usage Example
```bash
curl -X POST "http://localhost:8000/api/ask" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "How many rows are in this dataset?",
       "dataset": "051_Pokemon"
     }'
```

## 🎨 UI Features

### Beautiful Design
- Modern gradient backgrounds
- Glass morphism effects
- Smooth animations and transitions
- Responsive design for all screen sizes
- Dark code editor with syntax highlighting

### Interactive Elements
- **Dataset Cards**: Show real-time information (rows, columns, sample data)
- **Smart Form**: Button enables only when both dataset and question are provided
- **Loading States**: Visual feedback during processing
- **Results Display**: Clean separation of answers and the executed code
- **Error Handling**: User-friendly error messages

### Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Submit the form
- `Escape`: Clear the form
- Double-click dataset: Add example question

## 🧠 How It Works

1. **Dataset Selection**: When you select a dataset, the system loads its schema information
2. **Question Processing**: Your natural language question is sent to the LLM along with the dataset schema
3. **Code Generation**: The LLM generates pandas code to answer your question
4. **Code Execution**: The generated code is executed safely in a controlled environment
5. **Error Handling**: If the code fails, the system automatically retries with error correction
6. **Result Display**: The final answer is displayed along with the generated code

## 🔧 Technical Details

### Backend (FastAPI)
- **Async Processing**: Non-blocking question processing
- **Error Recovery**: Multiple retry attempts with different LLMs
- **Schema Generation**: Automatic dataset schema analysis
- **Safe Code Execution**: Controlled environment for running generated code

### Frontend (Vanilla JavaScript)
- **Modern ES6+**: Clean, maintainable JavaScript
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Security Features
- **Code Sandboxing**: Generated code runs in a controlled environment
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Safe error display without exposing internals

## 📁 Project Structure

```
QA-UI/
├── app.py                 # Main FastAPI application
├── run.py                 # Simple startup script
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration (create this)
├── templates/
│   └── index.html        # Main web interface
├── static/
│   ├── style.css         # Styles and animations
│   └── script.js         # Interactive functionality
├── utilities/            # Core processing modules
│   ├── agents.py         # LLM integration
│   ├── code_execution.py # Safe code execution
│   └── ...
└── datasets/            # Your data files (.parquet / .csv / .json / .xlsx)
    ├── 050_ING.parquet
    ├── 051_Pokemon.parquet
    └── ...
```

## 🆚 Differences from Batch Version

| Feature | Batch Version | Web Interface |
|---------|---------------|---------------|
| **Usage** | Process multiple questions at once | One question at a time |
| **Interface** | Command line | Beautiful web UI |
| **Interaction** | Static files | Real-time interaction |
| **Feedback** | Terminal output | Visual loading states |
| **Results** | JSON files | Instant display |
| **Error Handling** | Logs | User-friendly messages |

## 🎯 Best Practices

### Writing Good Questions
- Be specific about what you want to know
- Use column names if you know them
- Ask one question at a time
- Use natural language

### Examples of Good Questions:
✅ "How many unique Pokemon types are there?"  
✅ "What is the average attack value?"  
✅ "Which Pokemon has the highest defense?"  
✅ "How many Pokemon are water type?"  

### Examples to Avoid:
❌ "Tell me everything about this data"  
❌ "What's interesting here?"  
❌ "Analyze this dataset"  

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
- Check if port 8000 is already in use
- Verify all dependencies are installed
- Ensure `.env` file exists with proper configuration

**Questions fail:**
- Check your API key and base URL in `.env`
- Verify the LLM model names are correct
- Try simpler questions first

**No datasets showing:**
- Ensure your data files are in the `datasets/` folder
- Check file permissions
- Verify files are valid parquet format

### Debug Mode
Run with debug logging:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --log-level debug
```

## 🤝 Contributing

Feel free to contribute improvements:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project maintains the same license as the original QA-UI project.

---

**Enjoy exploring your datasets with AI! 🧠📊** 