"""
SQL Query Generation Agent
Generates SQL queries for MySQL databases based on natural language questions.
"""

import openai
import os
from dotenv import load_dotenv
from utilities.utils import get_text_after_last_think_tag
from typing import Union, Tuple, List

# Load environment variables
load_dotenv()

# Initialize OpenAI clients
main_args = {"api_key": os.getenv("API_KEY")}
if os.getenv("API_BASE_URL"):
    main_args["base_url"] = os.getenv("API_BASE_URL")
    
MAIN_LLM_PROVIDER = openai.OpenAI(**main_args)
MAIN_LLM = os.getenv("MAIN_LLM", "deepseek-ai/DeepSeek-R1")

def generate_sql_query(
    question: str,
    database_name: str,
    table_name: str,
    table_schema: dict,
    temperature: float = 0
) -> str:
    """
    Generate a SQL query to answer a natural language question about a MySQL table.
    
    Parameters:
    question (str): The natural language question
    database_name (str): Name of the database
    table_name (str): Name of the table
    table_schema (dict): Schema information including columns
    temperature (float): Temperature for LLM generation
    
    Returns:
    str: Generated SQL query
    """
    
    # Build schema context
    schema_context = f"Database: {database_name}\nTable: {table_name}\n"
    schema_context += f"Row Count: {table_schema.get('row_count', 'Unknown')}\n\nColumns:\n"
    
    for col in table_schema.get('columns', []):
        schema_context += f"- {col['name']} ({col['type']}) "
        if col.get('primary_key'):
            schema_context += "PRIMARY KEY "
        schema_context += "NULL" if col.get('nullable') else "NOT NULL"
        if col.get('default'):
            schema_context += f" DEFAULT {col['default']}"
        schema_context += "\n"
    
    # Create the prompt
    instructions = """
Generate a MySQL SQL query to answer the given question. Follow these rules:

1. Use only SELECT statements (no INSERT, UPDATE, DELETE, etc.)
2. Use proper MySQL syntax
3. Include LIMIT clause (max 100 rows unless specifically asked for more)
4. Use backticks around table/column names if they contain special characters or spaces
5. Handle NULL values appropriately
6. Use proper aggregation functions when needed (COUNT, SUM, AVG, etc.)
7. Use proper WHERE clauses for filtering
8. Use ORDER BY when showing top/bottom results
9. Return only the SQL query, no explanations or comments
10. Do not include ```sql``` markdown formatting

Example formats:
- For counting: SELECT COUNT(*) FROM `table_name` WHERE condition;
- For listing: SELECT column1, column2 FROM `table_name` WHERE condition LIMIT 10;
- For aggregation: SELECT column, COUNT(*) FROM `table_name` GROUP BY column ORDER BY COUNT(*) DESC LIMIT 10;
"""
    
    user_prompt = f"""
Given this MySQL table schema:
{schema_context}

Generate a SQL query to answer this question: {question}

{instructions}

SQL Query:"""
    
    # Choose proper parameter name based on model name
    token_param_name = "max_completion_tokens" if MAIN_LLM.startswith("o") else "max_tokens"
    
    completion_args = {
        "model": MAIN_LLM,
        "messages": [{"role": "user", "content": user_prompt}],
        token_param_name: 2000,
    }
    
    # Only include temperature for non-'o' models
    if not MAIN_LLM.startswith("o"):
        completion_args["temperature"] = temperature
    else:
        # Include reasoning_effort for 'o' models
        completion_args["reasoning_effort"] = "medium"
    
    try:
        chat_completion = MAIN_LLM_PROVIDER.chat.completions.create(**completion_args)
        sql_query = get_text_after_last_think_tag(chat_completion.choices[0].message.content)
        
        # Clean up the query
        sql_query = sql_query.strip()
        
        # Remove markdown formatting if present
        if sql_query.startswith('```sql'):
            sql_query = sql_query.replace('```sql', '').replace('```', '').strip()
        elif sql_query.startswith('```'):
            sql_query = sql_query.replace('```', '').strip()
        
        # Ensure it ends with semicolon
        if not sql_query.endswith(';'):
            sql_query += ';'
            
        return sql_query
        
    except Exception as e:
        # Fallback simple query
        return f"SELECT * FROM `{table_name}` LIMIT 10;" 