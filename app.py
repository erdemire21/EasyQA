from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
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
from utilities.data_preprocessing import preprocess_dataset, save_preprocessed_dataset
from utilities.mysql_handler import MySQLHandler
from utilities.sql_agents import generate_sql_query
from dotenv import load_dotenv, set_key
from pathlib import Path

# Load environment variables
load_dotenv()

app = FastAPI(title="QA-UI Dataset Question Answering", version="1.0.0")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class QuestionRequest(BaseModel):
    question: str
    dataset: str

class MySQLQuestionRequest(BaseModel):
    question: str
    database: str
    table: str

class QuestionResponse(BaseModel):
    answer: str
    generated_code: str
    dataset_used: str
    success: bool
    error_message: Optional[str] = None

class Settings(BaseModel):
    api_key: str
    api_base_url: str
    main_llm: str
    error_llm: str
    mysql_host: Optional[str] = None
    mysql_port: Optional[str] = None
    mysql_username: Optional[str] = None
    mysql_password: Optional[str] = None
    mysql_database: Optional[str] = None

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
            try:
                # Get unique values, handling potential array comparison issues
                column_series = df[column]
                # Convert to string first to avoid array comparison issues
                string_series = column_series.astype(str)
                # Filter out 'nan', 'None', etc.
                filtered_series = string_series[~string_series.isin(['nan', 'None', 'null', ''])]
                unique_values = filtered_series.unique()
            except Exception:
                # Fallback: just get first few values as strings
                unique_values = df[column].head(5).astype(str).tolist()
            
            limited_values = unique_values[:5]
            processed_values = []
            cumulative_char_count = 0
            
            for value in limited_values:
                if cumulative_char_count > 50:
                    break
                if len(str(value)) > 100:
                    value = str(value)[:97] + "..."
                processed_values.append(str(value))
                cumulative_char_count += len(str(value))
            
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

@app.get("/mysql", response_class=HTMLResponse)
async def mysql_page(request: Request):
    """MySQL database connection and querying interface."""
    return templates.TemplateResponse("mysql.html", {"request": request})

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

@app.get("/api/settings")
async def get_settings():
    """Get current settings from .env file."""
    try:
        return {
            "api_key": os.getenv("API_KEY", ""),
            "api_base_url": os.getenv("API_BASE_URL", ""),
            "main_llm": os.getenv("MAIN_LLM", ""),
            "error_llm": os.getenv("ERROR_LLM", ""),
            "mysql_host": os.getenv("MYSQL_HOST", ""),
            "mysql_port": os.getenv("MYSQL_PORT", ""),
            "mysql_username": os.getenv("MYSQL_USERNAME", ""),
            "mysql_password": os.getenv("MYSQL_PASSWORD", ""),
            "mysql_database": os.getenv("MYSQL_DATABASE", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading settings: {str(e)}")

@app.post("/api/settings")
async def update_settings(settings: Settings):
    """Update settings in .env file."""
    try:
        env_path = Path('.env')
        
        # Update environment variables
        os.environ["API_KEY"] = settings.api_key
        os.environ["API_BASE_URL"] = settings.api_base_url
        os.environ["MAIN_LLM"] = settings.main_llm
        os.environ["ERROR_LLM"] = settings.error_llm
        if settings.mysql_host:
            os.environ["MYSQL_HOST"] = settings.mysql_host
        if settings.mysql_port:
            os.environ["MYSQL_PORT"] = settings.mysql_port
        if settings.mysql_username:
            os.environ["MYSQL_USERNAME"] = settings.mysql_username
        if settings.mysql_password:
            os.environ["MYSQL_PASSWORD"] = settings.mysql_password
        if settings.mysql_database:
            os.environ["MYSQL_DATABASE"] = settings.mysql_database
        
        # Update .env file
        set_key(env_path, "API_KEY", settings.api_key)
        set_key(env_path, "API_BASE_URL", settings.api_base_url)
        set_key(env_path, "MAIN_LLM", settings.main_llm)
        set_key(env_path, "ERROR_LLM", settings.error_llm)
        if settings.mysql_host:
            set_key(env_path, "MYSQL_HOST", settings.mysql_host)
        if settings.mysql_port:
            set_key(env_path, "MYSQL_PORT", settings.mysql_port)
        if settings.mysql_username:
            set_key(env_path, "MYSQL_USERNAME", settings.mysql_username)
        if settings.mysql_password:
            set_key(env_path, "MYSQL_PASSWORD", settings.mysql_password)
        if settings.mysql_database:
            set_key(env_path, "MYSQL_DATABASE", settings.mysql_database)
        
        return {"message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating settings: {str(e)}")

@app.post("/api/upload-dataset")
async def upload_dataset(file: UploadFile = File(...), dataset_name: str = Form(None)):
    """
    Upload and preprocess a dataset file.
    
    The file will be:
    1. Validated for supported format
    2. Preprocessed to normalize column names
    3. Saved to the datasets directory
    """
    try:
        # Check file extension
        file_extension = os.path.splitext(file.filename)[1].lower()
        supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
        
        if file_extension not in supported_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format: {file_extension}. Supported formats: {', '.join(supported_extensions)}"
            )
        
        # Use provided dataset name or original filename without extension
        final_name = dataset_name or os.path.splitext(file.filename)[0]
        
        # Check if dataset with this name already exists
        existing_datasets = get_available_datasets()
        if final_name in existing_datasets:
            raise HTTPException(
                status_code=409,  # Conflict status code
                detail=f"Dataset with name '{final_name}' already exists. Please use a different name."
            )
        
        # Create a temporary file to store the uploaded content
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        try:
            # Read the dataset
            df = read_dataset(temp_file_path)
            
            # Preprocess the dataset
            preprocessed_df = preprocess_dataset(df)
            
            # Save the preprocessed dataset
            output_path = save_preprocessed_dataset(preprocessed_df, final_name)
            
            # Get basic dataset info
            row_count = len(preprocessed_df)
            column_count = len(preprocessed_df.columns)
            
            return {
                "success": True,
                "message": f"Dataset '{final_name}' uploaded and preprocessed successfully",
                "dataset_name": final_name,
                "rows": row_count,
                "columns": column_count,
                "column_names": preprocessed_df.columns.tolist()
            }
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    
    except HTTPException:
        # Re-raise HTTP exceptions as they already have the right format
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing dataset: {str(e)}")

@app.delete("/api/delete-dataset/{dataset_name}")
async def delete_dataset(dataset_name: str):
    """Delete a dataset file."""
    try:
        # Check if dataset exists
        datasets_path = "datasets"
        supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
        dataset_file = None
        
        for ext in supported_extensions:
            potential_file = f"{datasets_path}/{dataset_name}{ext}"
            if os.path.exists(potential_file):
                dataset_file = potential_file
                break
        
        if not dataset_file:
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found")
        
        # Delete the file
        os.remove(dataset_file)
        
        return {"success": True, "message": f"Dataset '{dataset_name}' deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting dataset: {str(e)}")

@app.get("/dataset/{dataset_name}/view", response_class=HTMLResponse)
async def view_dataset(request: Request, dataset_name: str, page: int = 1, per_page: int = 10):
    """View dataset data with pagination."""
    try:
        # Check if dataset exists
        available_datasets = get_available_datasets()
        if dataset_name not in available_datasets:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Find the dataset file
        datasets_path = "datasets"
        supported_extensions = ['.parquet', '.csv', '.json', '.xlsx']
        dataset_file = None
        
        for ext in supported_extensions:
            potential_file = f"{datasets_path}/{dataset_name}{ext}"
            if os.path.exists(potential_file):
                dataset_file = potential_file
                break
        
        if not dataset_file:
            raise HTTPException(status_code=404, detail=f"Dataset file not found for {dataset_name}")
        
        # Read the dataset
        df = read_dataset(dataset_file)
        
        # Validate per_page parameter
        valid_per_page_options = [10, 25, 100, 1000]
        if per_page not in valid_per_page_options:
            per_page = 10
        
        # Pagination settings
        rows_per_page = per_page
        total_rows = len(df)
        total_pages = max(1, (total_rows + rows_per_page - 1) // rows_per_page)
        
        # Validate page number
        if page < 1:
            page = 1
        elif page > total_pages:
            page = total_pages
        
        # Get data for current page
        start_idx = (page - 1) * rows_per_page
        end_idx = min(start_idx + rows_per_page, total_rows)
        
        # Simple approach: convert everything to strings upfront
        columns = [str(col) for col in df.columns]
        
        # Get the data slice and convert to simple lists
        data_rows = []
        for i in range(start_idx, end_idx):
            row_data = []
            for j, col in enumerate(df.columns):
                try:
                    # Get value by position
                    val = df.iat[i, j]
                    # Convert to string
                    str_val = str(val)
                    # Clean up common null representations
                    if str_val.lower() in ['nan', 'none', 'null']:
                        str_val = ""
                    # Truncate if too long
                    if len(str_val) > 50:
                        str_val = str_val[:47] + "..."
                    row_data.append(str_val)
                except:
                    row_data.append("[Error]")
            data_rows.append(row_data)
        
        return templates.TemplateResponse("dataset_viewer.html", {
            "request": request,
            "dataset_name": dataset_name,
            "columns": columns,
            "data": data_rows,
            "current_page": page,
            "total_pages": total_pages,
            "total_rows": total_rows,
            "total_columns": len(columns),
            "rows_per_page": rows_per_page,
            "per_page": per_page,
            "valid_per_page_options": valid_per_page_options
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error viewing dataset: {str(e)}")

# MySQL API Endpoints
@app.get("/api/mysql/test-connection")
async def test_mysql_connection():
    """Test MySQL connection."""
    try:
        mysql_handler = MySQLHandler()
        success, message = mysql_handler.test_connection()
        return {"success": success, "message": message}
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

@app.get("/api/mysql/databases")
async def get_mysql_databases():
    """Get list of available MySQL databases."""
    try:
        mysql_handler = MySQLHandler()
        databases = mysql_handler.get_databases()
        return {"success": True, "databases": databases}
    except Exception as e:
        return {"success": False, "message": str(e), "databases": []}

@app.get("/api/mysql/tables/{database_name}")
async def get_mysql_tables(database_name: str):
    """Get list of tables in a specific database."""
    try:
        mysql_handler = MySQLHandler()
        tables = mysql_handler.get_tables(database_name)
        return {"success": True, "tables": tables}
    except Exception as e:
        return {"success": False, "message": str(e), "tables": []}

@app.get("/api/mysql/schema/{database_name}/{table_name}")
async def get_mysql_table_schema(database_name: str, table_name: str):
    """Get detailed schema for a specific table."""
    try:
        mysql_handler = MySQLHandler()
        schema = mysql_handler.get_table_schema(table_name, database_name)
        return {"success": True, "schema": schema}
    except Exception as e:
        return {"success": False, "message": str(e), "schema": {}}

@app.post("/api/mysql/ask")
async def ask_mysql_question(mysql_request: MySQLQuestionRequest):
    """Process a question about MySQL data."""
    try:
        if not mysql_request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        # Initialize MySQL handler and connect to database
        mysql_handler = MySQLHandler()
        mysql_handler.connect_to_database(mysql_request.database)
        
        # Get table schema for context
        schema = mysql_handler.get_table_schema(mysql_request.table, mysql_request.database)
        
        # Generate SQL query using the dedicated SQL agent
        sql_code = generate_sql_query(
            question=mysql_request.question,
            database_name=mysql_request.database,
            table_name=mysql_request.table,
            table_schema=schema
        )
        
        # Execute the SQL query
        df = mysql_handler.execute_query(sql_code)
        
        # Format the result intelligently
        if df.empty:
            answer = "No results found for your query."
        else:
            # Check if it's a simple single-value result (like COUNT, SUM, AVG)
            if len(df) == 1 and len(df.columns) == 1:
                # For single value results, just return the clean value
                value = df.iloc[0, 0]
                if pd.isna(value):
                    answer = "NULL"
                else:
                    # Format numbers nicely
                    if isinstance(value, (int, float)):
                        if isinstance(value, float) and value.is_integer():
                            answer = str(int(value))
                        else:
                            answer = str(value)
                    else:
                        answer = str(value)
            # Check if it's a simple single-column result
            elif len(df.columns) == 1 and len(df) <= 10:
                # For single column results, show values without column header
                values = df.iloc[:, 0].tolist()
                answer = "\n".join(str(v) if not pd.isna(v) else "NULL" for v in values)
            # For multi-column or larger results, show with headers
            elif len(df) <= 10:
                answer = df.to_string(index=False)
            else:
                answer = f"Found {len(df)} results. Here are the first 10:\n\n"
                answer += df.head(10).to_string(index=False)
                answer += f"\n\n... and {len(df) - 10} more rows."
        
        mysql_handler.close_connection()
        
        return {
            "success": True,
            "answer": answer,
            "code": sql_code,
            "rows_returned": len(df)
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Error processing question: {str(e)}",
            "answer": "",
            "code": ""
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 