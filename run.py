#!/usr/bin/env python3
"""
Simple script to run the QA-UI application
"""

import uvicorn
import os

if __name__ == "__main__":
    # Check if .env file exists
    if not os.path.exists(".env"):
        print("⚠️  Warning: .env file not found!")
        print("Please create a .env file with your API configuration:")
        print("API_KEY=your_api_key_here")
        print("API_BASE_URL=your_api_base_url_here")
        print("MAIN_LLM=deepseek-ai/DeepSeek-R1")
        print("ERROR_LLM=deepseek-ai/DeepSeek-R1")
        print()
    
    print("🧠 Starting QA-UI Dataset Question Answering System...")
    print("📊 Available datasets will be loaded from the 'datasets' folder")
    print("🌐 Server will be available at: http://localhost:8000")
    print("🛑 Press Ctrl+C to stop the server")
    print()
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes during development
        log_level="info"
    ) 