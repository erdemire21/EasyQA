import json
import pandas as pd
import os


def load_schemas(schema_path):
    """Load the pandas schemas from file."""
    with open(schema_path, encoding='utf-8') as f:
        return json.load(f)


def read_dataset(file_path: str) -> pd.DataFrame:
    """
    Read a dataset file in various formats (parquet, csv, json, xlsx).
    
    Args:
        file_path (str): Path to the dataset file
        
    Returns:
        pd.DataFrame: The loaded dataset
        
    Raises:
        ValueError: If the file format is not supported
    """
    file_extension = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_extension == '.parquet':
            return pd.read_parquet(file_path)
        elif file_extension == '.csv':
            return pd.read_csv(file_path)
        elif file_extension == '.json':
            return pd.read_json(file_path)
        elif file_extension == '.xlsx':
            return pd.read_excel(file_path, engine='openpyxl')
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
    except Exception as e:
        raise ValueError(f"Error reading file {file_path}: {str(e)}")


def load_questions(qa_path):
    """Load the questions from file."""
    with open(qa_path, encoding='utf-8') as f:
        return json.load(f)