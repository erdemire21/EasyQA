from pydantic import BaseModel
from typing import List, Tuple, Union
import openai
from utilities.utils import get_text_after_last_think_tag
import os
from dotenv import load_dotenv
import re

# Load environment variables
load_dotenv()

# Initialize OpenAI clients with proper configuration
error_args = {"api_key": os.getenv("API_KEY")}
if os.getenv("API_BASE_URL"):
    error_args["base_url"] = os.getenv("API_BASE_URL")
    
ERROR_LLM_PROVIDER = openai.OpenAI(**error_args)

main_args = {"api_key": os.getenv("API_KEY")}
if os.getenv("API_BASE_URL"):
    main_args["base_url"] = os.getenv("API_BASE_URL")
    
MAIN_LLM_PROVIDER = openai.OpenAI(**main_args)

MAIN_LLM = os.getenv("MAIN_LLM", "deepseek-ai/DeepSeek-R1")  # Default model
ERROR_LLM = os.getenv("ERROR_LLM", "deepseek-ai/DeepSeek-R1")  # Error handling model


def get_pandas_code(
    dataset_name: str,
    question: str,
    schema: str,
    temperature: float = 0,
    error_code: Union[Tuple[str, str], List[Tuple[str, str]], None] = None
) -> str:
    """
    Generates Python code using pandas to answer a given question based on a dataset schema.
    If error_code is provided, it attempts to fix the error(s) in the previous code.

    Parameters:
    dataset_name (str): The name of the dataset.
    question (str): The question to be answered using the dataset.
    schema (str): The schema of the dataset.
    temperature (float): Temperature for LLM generation.
    error_code (tuple or list[tuple], optional):
        * If a single retry, a 2‑tuple (previous_code, error_message).
        * If multiple retries, a list of such tuples ordered oldest→newest.

    Returns:
    str: The generated Python code as a string.
    """
    instructions = '''The code should return a print statement with the answer to the question.
    The code should leave the answer be and not print anything other than the variable that holds the answer.
    Please write a single Python code block that answers the following question and prints the result in one line at the end.'''

    unique_keywords = ['unique', 'different', 'distinct']
    if all(keyword not in question.lower() for keyword in unique_keywords):
        instructions += '''
        If the question doesn't specifically ask for it, don't use unique() or drop_duplicates() functions.'''

    instructions += '''
    If it is a Yes or No question, the answer should be a boolean.
    Do not include any explanations, comments, or additional code blocks.
    Do not print intermediate steps just the answer.
    Do not interact with the user.
    Never display any sort of dataframes or tables.
    Your output can never take more than a single line after printing and it can never be any sort of objects such as pandas or numpy objects, series etc. 
    Your output must be one of the following:

    Boolean: True/False
    Category/String: A value
    Number: A numerical value
    List[category/string]: ['cat', 'dog']
    List[number]: [1, 2, 3]
    So the outputs have to be native python

    '''
    # For GPT o models, this instruction is needed as they tend to generate overly complex code
    if MAIN_LLM.startswith("o"):
        instructions += '''
    Generate the *simplest possible* pandas code that correctly answers the question. Avoid unnecessary complexity, helper functions, or overly defensive programming unless strictly required by the question's logic. Prefer direct pandas operations.
    '''

    user_prompt = f'''Given the dataset schema {schema}
                Generate a python code to answer this question: `{question}` that strictly follows the instructions below:
                {instructions}`:'''

    user_prompt += (
        f"The following python code made for pandas for the parquet file {dataset_name}.parquet reads the parquet file and "
        f"running it returns the answer that is enough to answer the question `{question}`"
    )

    # ------------------  Error‑handling / retry specific block --------------
    if error_code:
        if isinstance(error_code, tuple):
            prev_code, error_msg = error_code

            user_prompt = f'''
                    Please fix the code to properly answer the question: `{question}`
                    Dataset schema: {schema}
                    Follow these instructions:
                    {instructions}
                    The following code generated an error when executed:
                    ```python
                    {prev_code}
                    ```
                    Error: {error_msg} Solve the error and provide the corrected code '''
            user_prompt += (
                f"The following python code made for pandas for the parquet file {dataset_name}.parquet reads the parquet file and "
                f"running it returns the answer that is enough to answer the question `{question}` with the error fixed"
            )

        # Handle *multiple* previous errors – new behaviour
        elif isinstance(error_code, list):
            # keep the *latest* attempt exactly as the single‑retry prompt
            last_code, last_error = error_code[-1]

            user_prompt = f'''
                    Please fix the code to properly answer the question: `{question}`
                    Dataset schema: {schema}
                    Follow these instructions:
                    {instructions}
                    The following code generated an error when executed:
                    ```python
                    {last_code}
                    ```
                    Error: {last_error} Solve the error and provide the corrected code'''

            # -------- Append an *extra* section enumerating earlier failures -----
            user_prompt += "\n\nHere are earlier attempts that also failed:\n"
            for idx, (p_code, p_err) in enumerate(error_code[:-1], start=1):
                user_prompt += f"\nAttempt {idx}:\n{p_code}\n```\nError: {p_err}\n"

            user_prompt += (
                f"The following python code made for pandas for the parquet file {dataset_name}.parquet reads the parquet file and "
                f"running it returns the answer that is enough to answer the question `{question}` with the error fixed"
            )



    CURRENT_LLM = ERROR_LLM if error_code else MAIN_LLM
    CURRENT_PROVIDER = ERROR_LLM_PROVIDER if error_code else MAIN_LLM_PROVIDER

    # Choose proper parameter name based on model name
    token_param_name = "max_completion_tokens" if CURRENT_LLM.startswith("o") else "max_tokens"
    
    completion_args = {
        "model": CURRENT_LLM,
        "messages": [{"role": "user", "content": user_prompt}],
        token_param_name: 5000,
        # "seed": 42
    }
    
    # Only include temperature for non-'o' models
    if not CURRENT_LLM.startswith("o"):
        completion_args["temperature"] = temperature
    else:
        # Include reasoning_effort for 'o' models
        completion_args["reasoning_effort"] = "high"
    
    chat_completion = CURRENT_PROVIDER.chat.completions.create(**completion_args)
    to_return = get_text_after_last_think_tag(chat_completion.choices[0].message.content)
    return to_return

def get_mysql_pandas_code(
    question: str,
    schema: str,
    table_snapshots: dict,
    temperature: float = 0,
    error_code: Union[Tuple[str, str], List[Tuple[str, str]], None] = None
) -> str:
    """
    Generates Python pandas code to answer questions about MySQL data using temporary parquet snapshots.
    
    Parameters:
    question (str): The natural language question
    schema (str): Combined schema for all tables
    table_snapshots (dict): Mapping of table_name -> parquet_file_path
    temperature (float): Temperature for LLM generation
    error_code: Previous error information for retry attempts
    
    Returns:
    str: Generated pandas code
    """
    
    instructions = '''The code should return a print statement with the answer to the question.
    
    APPROACH - Column Renaming Method:
    1. Load each table and immediately rename conflicting columns
    2. Use simple merges without suffixes (since columns are unique)
    3. Reference renamed columns consistently
    4. Handle edge cases carefully
    
    MANDATORY RENAMING PATTERN:
    ```python
    import pandas as pd
    
    # Load and rename columns to be unique
    artists = pd.read_parquet('datasets/music_artist.parquet')
    artists = artists.rename(columns={'Name': 'ArtistName'})
    
    albums = pd.read_parquet('datasets/music_album.parquet') 
    albums = albums.rename(columns={'Title': 'AlbumTitle'})
    
    tracks = pd.read_parquet('datasets/music_track.parquet')
    tracks = tracks.rename(columns={'Name': 'TrackName'})
    
    genres = pd.read_parquet('datasets/music_genre.parquet')
    genres = genres.rename(columns={'Name': 'GenreName'})
    
    mediatypes = pd.read_parquet('datasets/music_mediatype.parquet')
    mediatypes = mediatypes.rename(columns={'Name': 'MediaTypeName'})
    
    sales = pd.read_parquet('datasets/music_sales.parquet')
    
    customers = pd.read_parquet('datasets/music_customers.parquet')
    customers = customers.rename(columns={'Name': 'CustomerName'})
    
    # Merge step by step
    data = artists.merge(albums, on='ArtistId')
    data = data.merge(tracks, on='AlbumId')  
    data = data.merge(genres, on='GenreId')
    # etc...
    
    # Use renamed column names
    result = data[data['Country'] == 'USA']['ArtistName'].tolist()
    print(result)
    ```
    
    CRITICAL FIXES FOR COMMON ISSUES:
    - When filtering by customer Country, use customers table: customers[customers['Country'].isin(['Germany', 'Spain', 'UK'])]
    - When calculating revenue, multiply: sales['Quantity'] * tracks['UnitPrice']
    - All Country information is in the customers table, NOT the artists table
    - For date filtering: sales[sales['SaleDate'].str.contains('2023-02')]
    - Time conversions: Milliseconds/1000 for seconds, Milliseconds/60000 for minutes
    
    COLUMN NAMING AFTER RENAME:
    - ArtistName (was Name in artists)
    - AlbumTitle (was Title in albums)  
    - TrackName (was Name in tracks)
    - GenreName (was Name in genres)
    - MediaTypeName (was Name in mediatypes)
    - CustomerName (was Name in customers)
    - All other columns keep original names
    
    Return only: boolean, string, number, or list.
    The code should leave the answer be and not print anything other than the variable that holds the answer.
    Do not include any explanations, comments, or additional code blocks.
    Do not print intermediate steps just the answer.
    Do not interact with the user.
    Never display any sort of dataframes or tables.
    Your output can never take more than a single line after printing and it can never be any sort of objects such as pandas or numpy objects, series etc. 
    Your output must be one of the following:

    Boolean: True/False
    Category/String: A value
    Number: A numerical value
    List[category/string]: ['cat', 'dog']
    List[number]: [1, 2, 3]
    So the outputs have to be native python
    '''
    
    # For GPT o models, this instruction is needed as they tend to generate overly complex code
    if MAIN_LLM.startswith("o"):
        instructions += '''
    Generate the *simplest possible* pandas code that correctly answers the question. Avoid unnecessary complexity, helper functions, or overly defensive programming unless strictly required by the question's logic. Prefer direct pandas operations.
    '''

    # Create file loading context based on actual snapshots
    file_context = "Available parquet files:\n"
    for table_name, file_path in table_snapshots.items():
        file_context += f"- {table_name}: {file_path}\n"
    
    user_prompt = f'''Given the MySQL database schema converted to parquet files:
{schema}

{file_context}

Generate pandas code to answer this question: `{question}` that strictly follows the instructions above.

The code should load the appropriate parquet files using pd.read_parquet() and perform the necessary operations to answer the question.'''

    # Error handling block
    if error_code:
        if isinstance(error_code, tuple):
            prev_code, error_msg = error_code
            user_prompt = f'''
Please fix the code to properly answer the question: `{question}`
Dataset schema: {schema}
Available files: {file_context}
Follow these instructions:
{instructions}
The following code generated an error when executed:
```python
{prev_code}
```
Error: {error_msg} 
Solve the error and provide the corrected code that reads from parquet files and answers the question.'''

        elif isinstance(error_code, list):
            last_code, last_error = error_code[-1]
            user_prompt = f'''
Please fix the code to properly answer the question: `{question}`
Dataset schema: {schema}
Available files: {file_context}
Follow these instructions:
{instructions}
The following code generated an error when executed:
```python
{last_code}
```
Error: {last_error}
Solve the error and provide the corrected code'''

            user_prompt += "\n\nHere are earlier attempts that also failed:\n"
            for idx, (p_code, p_err) in enumerate(error_code[:-1], start=1):
                user_prompt += f"\nAttempt {idx}:\n{p_code}\n```\nError: {p_err}\n"

    CURRENT_LLM = ERROR_LLM if error_code else MAIN_LLM
    CURRENT_PROVIDER = ERROR_LLM_PROVIDER if error_code else MAIN_LLM_PROVIDER

    # Choose proper parameter name based on model name
    token_param_name = "max_completion_tokens" if CURRENT_LLM.startswith("o") else "max_tokens"
    
    completion_args = {
        "model": CURRENT_LLM,
        "messages": [{"role": "user", "content": user_prompt}],
        token_param_name: 5000,
    }
    
    # Only include temperature for non-'o' models
    if not CURRENT_LLM.startswith("o"):
        completion_args["temperature"] = temperature
    else:
        # Include reasoning_effort for 'o' models
        completion_args["reasoning_effort"] = "high"
    
    chat_completion = CURRENT_PROVIDER.chat.completions.create(**completion_args)
    raw_response = get_text_after_last_think_tag(chat_completion.choices[0].message.content)
    
    # Clean the code to extract only executable Python
    cleaned_code = clean_mysql_pandas_code(raw_response)
    
    return cleaned_code

def clean_mysql_pandas_code(raw_code: str) -> str:
    """
    Clean the generated code to extract only executable Python code.
    Removes explanations, markdown formatting, and comments.
    """
    if not raw_code:
        return ""
    
    # Try to extract code from markdown blocks first
    code_blocks = re.findall(r'```python\s*(.*?)\s*```', raw_code, re.DOTALL)
    if code_blocks:
        # Use the first code block found
        code = code_blocks[0].strip()
    else:
        # Look for code between ``` blocks (without language specification)
        code_blocks = re.findall(r'```\s*(.*?)\s*```', raw_code, re.DOTALL)
        if code_blocks:
            code = code_blocks[0].strip()
        else:
            # If no code blocks, try to extract Python-looking lines
            lines = raw_code.split('\n')
            python_lines = []
            
            for line in lines:
                line = line.strip()
                # Skip empty lines, explanations, markdown headers, etc.
                if (line and 
                    not line.startswith('#') and 
                    not line.startswith('*') and
                    not line.startswith('-') and
                    not line.startswith('Here') and
                    not line.startswith('To answer') and
                    not line.startswith('This code') and
                    not line.startswith('Explanation') and
                    not line.startswith('###') and
                    not re.match(r'^\d+\.', line) and  # numbered lists
                    ('import' in line or 'pd.' in line or 'print(' in line or '=' in line)):
                    python_lines.append(line)
            
            code = '\n'.join(python_lines)
    
    # Final cleanup
    code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)  # Remove comments
    code = '\n'.join(line.strip() for line in code.split('\n') if line.strip())  # Remove empty lines
    
    return code
