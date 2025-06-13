import pandas as pd
import numpy as np
import re
import json
import os
from typing import Dict, Any


def normalize_spanish_letters(text):
    """
    Replace Spanish special letters with their English counterparts.
    """
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N',
    }
    for spanish_char, eng_char in replacements.items():
        text = text.replace(spanish_char, eng_char)
    return text


def rename_columns_for_sql(df):
    """
    Renames DataFrame columns to be SQL-friendly:
    - Replaces spaces and special characters with underscores, except at the end where it is replaced with an empty string.
    - Converts column names to lowercase.
    - Ensures column names are unique.
    - Ensures column names start with a letter.
    
    Parameters:
    df (pd.DataFrame): The DataFrame whose columns need to be renamed.

    Returns:
    pd.DataFrame: A new DataFrame with renamed columns.
    """
    column_count = {}
    new_columns = []
    
    for col in df.columns:
        # Normalize Spanish special letters
        new_col = normalize_spanish_letters(col)
        # Replace spaces and special characters with underscores except at the end
        new_col = re.sub(r'\W+(?=\w)', '_', new_col)
        # Replace special characters at the end with an empty string
        new_col = re.sub(r'\W+$', '', new_col)
        # Convert to lowercase
        new_col = new_col.lower()
        # Ensure column starts with a letter
        if not re.match(r'^[a-zA-Z]', new_col):
            new_col = 'col_' + new_col
        # Ensure uniqueness
        if new_col in column_count:
            column_count[new_col] += 1
            new_col = f"{new_col}_{column_count[new_col]}"
        else:
            column_count[new_col] = 1
        new_columns.append(new_col)
    
    df = df.copy()
    df.columns = new_columns
    return df


def serialize_value(value):
    """
    Serialize a value for consistent representation.
    Converts NumPy arrays to lists and serializes using JSON for complex types.
    """
    if isinstance(value, np.ndarray):
        value = value.tolist()
    elif isinstance(value, list):
        pass  # Lists are expected to be JSON-serializable
    return json.dumps(value) if isinstance(value, (list, dict)) else str(value)


def preprocess_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply all preprocessing steps to a dataset.
    
    Args:
        df (pd.DataFrame): The DataFrame to preprocess
        
    Returns:
        pd.DataFrame: The preprocessed DataFrame
    """
    # Apply SQL-friendly column renaming
    df = rename_columns_for_sql(df)
    
    return df


def save_preprocessed_dataset(df: pd.DataFrame, file_name: str, output_dir: str = "datasets") -> str:
    """
    Save a preprocessed dataset to the datasets directory.
    
    Args:
        df (pd.DataFrame): The DataFrame to save
        file_name (str): The name to give the file (without extension)
        output_dir (str): The directory to save the file in
        
    Returns:
        str: The path to the saved file
    """
    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Remove any extension from the file name
    file_name = os.path.splitext(file_name)[0]
    
    # Save as parquet by default (more efficient)
    output_path = os.path.join(output_dir, f"{file_name}.parquet")
    df.to_parquet(output_path, index=False)
    
    return output_path 