from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import pandas as pd
import json
import os
import asyncio
from typing import Optional, List
from utilities.agents import get_pandas_code
from utilities.code_execution import capture_exec_output
from utilities.code_processing import clean_pandas_code, modify_dataset_paths
from utilities.data_loading import read_dataset

app = FastAPI(title="QA-UI Dataset Question Answering", version="1.0.0")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class QuestionRequest(BaseModel):
    question: str
    dataset: str

class QuestionResponse(BaseModel):
    answer: str
    generated_code: str
    dataset_used: str
    success: bool
    error_message: Optional[str] = None

def get_available_datasets():
    """Get list of available datasets (names only) from the datasets folder."""
    datasets = []
    datasets_path = "datasets"
    supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
    
    if os.path.exists(datasets_path):
        for file in os.listdir(datasets_path):
            file_extension = os.path.splitext(file)[1].lower()
            if file_extension in supported_extensions:
                dataset_name = os.path.splitext(file)[0]
                datasets.append(dataset_name)
    return sorted(set(datasets))

def generate_schema_for_dataset(dataset_name: str) -> str:
    """Generate schema summary for a dataset."""
    try:
        # Find the file with matching name but any supported extension
        datasets_path = "datasets"
        supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
        dataset_file = None
        
        for ext in supported_extensions:
            potential_file = f"{datasets_path}/{dataset_name}{ext}"
            if os.path.exists(potential_file):
                dataset_file = potential_file
                break
        
        if not dataset_file:
            raise FileNotFoundError(f"No dataset file found for {dataset_name}")
            
        df = read_dataset(dataset_file)
        
        # Generate schema summary similar to preprocessing
        summary_lines = []
        intro = f'Here are the columns for the {dataset_name} dataset:\n'
        
        for column in df.columns:
            value_type = df[column].dtype
            unique_values = df[column].dropna().astype(str).unique()
            limited_values = unique_values[:5]
            processed_values = []
            cumulative_char_count = 0
            
            for value in limited_values:
                if cumulative_char_count > 50:
                    break
                if len(value) > 100:
                    value = value[:97] + "..."
                processed_values.append(value)
                cumulative_char_count += len(value)
            
            example_values = ", ".join(processed_values)
            total_unique = len(unique_values)
            line = (f"Column Name: {column}, Data type -- {value_type}, -- Example values: {example_values},"
                    f" Total unique elements: {total_unique}")
            summary_lines.append(line)
        
        return intro + "\n".join(summary_lines)
    except Exception as e:
        return f"Error generating schema for {dataset_name}: {str(e)}"

async def process_question_async(question: str, dataset: str, max_retries: int = 2) -> QuestionResponse:
    """Process a question asynchronously with retry logic."""
    try:
        # Generate schema for the dataset
        schema = generate_schema_for_dataset(dataset)
        
        error_history = []
        
        for attempt in range(max_retries + 1):
            try:
                # Determine if this is an error retry
                error_code = None
                if error_history:
                    if len(error_history) == 1:
                        error_code = error_history[0]  # Single tuple
                    else:
                        error_code = error_history  # List of tuples
                
                # Generate pandas code using LLM
                generated_code = get_pandas_code(
                    dataset_name=dataset,
                    question=question,
                    schema=schema,
                    temperature=0,
                    error_code=error_code
                )
                
                # Clean and modify the code
                cleaned_code = clean_pandas_code(generated_code)
                modified_code = modify_dataset_paths(cleaned_code, dataset_folder_path="datasets/")
                
                # Execute the code
                result = capture_exec_output(modified_code)
                
                # Check if execution was successful
                if isinstance(result, str) and result.startswith("Error :"):
                    error_msg = result[7:]  # Remove "Error :" prefix
                    error_history.append((cleaned_code, error_msg))
                    if attempt == max_retries:
                        return QuestionResponse(
                            answer="",
                            generated_code=modified_code,
                            dataset_used=dataset,
                            success=False,
                            error_message=f"Failed after {max_retries + 1} attempts. Last error: {error_msg}"
                        )
                    continue
                
                # Success!
                return QuestionResponse(
                    answer=str(result),
                    generated_code=modified_code,
                    dataset_used=dataset,
                    success=True
                )
                
            except Exception as e:
                error_msg = str(e)
                if attempt < max_retries:
                    error_history.append((generated_code if 'generated_code' in locals() else "", error_msg))
                    continue
                else:
                    return QuestionResponse(
                        answer="",
                        generated_code=modified_code if 'modified_code' in locals() else (generated_code if 'generated_code' in locals() else ""),
                        dataset_used=dataset,
                        success=False,
                        error_message=f"Failed after {max_retries + 1} attempts. Last error: {error_msg}"
                    )
        
    except Exception as e:
        return QuestionResponse(
            answer="",
            generated_code="",
            dataset_used=dataset,
            success=False,
            error_message=f"Unexpected error: {str(e)}"
        )

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the main page."""
    datasets = get_available_datasets()
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "datasets": datasets
    })

@app.get("/api/datasets")
async def get_datasets():
    """API endpoint to get available datasets."""
    return {"datasets": get_available_datasets()}

@app.post("/api/ask", response_model=QuestionResponse)
async def ask_question(question_request: QuestionRequest):
    """API endpoint to process a question."""
    if not question_request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    if not question_request.dataset:
        raise HTTPException(status_code=400, detail="Dataset must be specified")
    
    # Check if dataset exists
    available_datasets = get_available_datasets()
    if question_request.dataset not in available_datasets:
        raise HTTPException(status_code=400, detail=f"Dataset '{question_request.dataset}' not found")
    
    # Process the question
    response = await process_question_async(
        question_request.question, 
        question_request.dataset
    )
    
    return response

@app.get("/api/dataset/{dataset_name}/info")
async def get_dataset_info(dataset_name: str):
    """Get basic information about a dataset."""
    available_datasets = get_available_datasets()
    
    if dataset_name not in available_datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        # Find the file with matching name but any supported extension
        datasets_path = "datasets"
        supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
        dataset_file = None
        
        for ext in supported_extensions:
            potential_file = f"{datasets_path}/{dataset_name}{ext}"
            if os.path.exists(potential_file):
                dataset_file = potential_file
                file_format = ext[1:]  # Remove the dot
                break
        
        if not dataset_file:
            raise FileNotFoundError(f"No dataset file found for {dataset_name}")
            
        df = read_dataset(dataset_file)
        
        return {
            "name": dataset_name,
            "format": file_format,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "schema": generate_schema_for_dataset(dataset_name)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading dataset: {str(e)}")

@app.post("/api/execute")
async def execute_code(code_data: dict):
    """Execute pandas code and return the result."""
    try:
        # Extract and clean the code
        raw_code = code_data.get('code', '')
        cleaned_code = clean_pandas_code(raw_code)
        
        # Modify the dataset paths and execute the code
        modified_code = modify_dataset_paths(cleaned_code, dataset_folder_path="datasets/")
        result = capture_exec_output(modified_code)
        
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 