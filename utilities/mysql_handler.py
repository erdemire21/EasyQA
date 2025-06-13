"""
MySQL Database Handler
Provides functionality for connecting to MySQL databases, discovering tables, and analyzing schemas.
"""

import os
import pandas as pd
import pymysql
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class MySQLHandler:
    """Handle MySQL database connections and operations."""
    
    def __init__(self):
        """Initialize MySQL handler with environment variables."""
        self.host = os.getenv('MYSQL_HOST', 'localhost')
        self.port = int(os.getenv('MYSQL_PORT', '3306'))
        self.user = os.getenv('MYSQL_USER', 'root')
        self.password = os.getenv('MYSQL_PASSWORD', '')
        self.engine = None
        self.current_database = None
    
    def test_connection(self) -> Tuple[bool, str]:
        """Test connection to MySQL server without selecting a database."""
        try:
            # Create connection URL without database
            connection_url = f"mysql+pymysql://{self.user}:{self.password}@{self.host}:{self.port}/"
            engine = create_engine(connection_url)
            
            # Test connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            return True, "Connection successful"
        except SQLAlchemyError as e:
            return False, f"Connection failed: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    def get_databases(self) -> List[str]:
        """Get list of available databases."""
        try:
            # Create connection URL without database
            connection_url = f"mysql+pymysql://{self.user}:{self.password}@{self.host}:{self.port}/"
            engine = create_engine(connection_url)
            
            with engine.connect() as conn:
                result = conn.execute(text("SHOW DATABASES"))
                databases = [row[0] for row in result.fetchall()]
                
                # Filter out system databases
                system_dbs = ['information_schema', 'performance_schema', 'mysql', 'sys']
                user_databases = [db for db in databases if db not in system_dbs]
                
                return sorted(user_databases)
        except SQLAlchemyError as e:
            raise Exception(f"Failed to retrieve databases: {str(e)}")
    
    def connect_to_database(self, database_name: str) -> bool:
        """Connect to a specific database."""
        try:
            # Create connection URL with database
            connection_url = f"mysql+pymysql://{self.user}:{self.password}@{self.host}:{self.port}/{database_name}"
            self.engine = create_engine(connection_url)
            
            # Test the connection
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            self.current_database = database_name
            return True
        except SQLAlchemyError as e:
            raise Exception(f"Failed to connect to database '{database_name}': {str(e)}")
    
    def get_tables(self, database_name: str = None) -> List[Dict[str, any]]:
        """Get list of tables with metadata."""
        if not database_name:
            database_name = self.current_database
        
        if not database_name:
            raise Exception("No database selected")
        
        try:
            # Ensure we're connected to the right database
            if self.current_database != database_name:
                self.connect_to_database(database_name)
            
            inspector = inspect(self.engine)
            tables = inspector.get_table_names()
            
            table_info = []
            for table_name in tables:
                try:
                    # Get row count
                    with self.engine.connect() as conn:
                        count_result = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`"))
                        row_count = count_result.fetchone()[0]
                    
                    # Get column info
                    columns = inspector.get_columns(table_name)
                    column_count = len(columns)
                    column_names = [col['name'] for col in columns]
                    
                    table_info.append({
                        'name': table_name,
                        'rows': row_count,
                        'columns': column_count,
                        'column_names': column_names
                    })
                except Exception as e:
                    # If we can't get detailed info, still include the table
                    table_info.append({
                        'name': table_name,
                        'rows': 0,
                        'columns': 0,
                        'column_names': [],
                        'error': str(e)
                    })
            
            return sorted(table_info, key=lambda x: x['name'])
        except SQLAlchemyError as e:
            raise Exception(f"Failed to retrieve tables: {str(e)}")
    
    def get_table_schema(self, table_name: str, database_name: str = None) -> Dict[str, any]:
        """Get detailed schema information for a table with column value context."""
        if not database_name:
            database_name = self.current_database
        
        if not database_name:
            raise Exception("No database selected")
        
        try:
            # Ensure we're connected to the right database
            if self.current_database != database_name:
                self.connect_to_database(database_name)
            
            inspector = inspect(self.engine)
            
            # Get column information
            columns = inspector.get_columns(table_name)
            
            # Get sample data for better understanding
            with self.engine.connect() as conn:
                sample_result = conn.execute(text(f"SELECT * FROM `{table_name}` LIMIT 5"))
                sample_data = sample_result.fetchall()
                
                # Get row count
                count_result = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`"))
                row_count = count_result.fetchone()[0]
                
                # Get column names for value analysis
                column_names = [col['name'] for col in columns]
            
            # Format column information with value context
            column_info = []
            for i, col in enumerate(columns):
                col_name = col['name']
                col_type = str(col['type'])
                
                # Get example values and unique count for this column
                try:
                    with self.engine.connect() as conn:
                        # Get distinct values with limit for performance
                        distinct_query = f"""
                        SELECT DISTINCT `{col_name}` 
                        FROM `{table_name}` 
                        WHERE `{col_name}` IS NOT NULL 
                        LIMIT 5
                        """
                        distinct_result = conn.execute(text(distinct_query))
                        distinct_values = [str(row[0]) for row in distinct_result.fetchall()]
                        
                        # Get total unique count (with reasonable limit for performance)
                        count_query = f"""
                        SELECT COUNT(DISTINCT `{col_name}`) 
                        FROM `{table_name}` 
                        WHERE `{col_name}` IS NOT NULL
                        """
                        unique_count_result = conn.execute(text(count_query))
                        total_unique = unique_count_result.fetchone()[0]
                        
                        # Process example values similar to pandas approach
                        limited_values = distinct_values[:5]
                        processed_values = []
                        cumulative_char_count = 0
                        
                        for value in limited_values:
                            if cumulative_char_count > 50:
                                break
                            if len(str(value)) > 100:
                                value = str(value)[:97] + "..."
                            processed_values.append(str(value))
                            cumulative_char_count += len(str(value))
                        
                        example_values = processed_values
                        
                except Exception as e:
                    # Fallback: use sample data if available
                    example_values = []
                    total_unique = 0
                    if sample_data and i < len(sample_data[0]):
                        for row in sample_data:
                            if i < len(row) and row[i] is not None:
                                val = str(row[i])
                                if len(val) > 100:
                                    val = val[:97] + "..."
                                example_values.append(val)
                        total_unique = len(set(example_values)) if example_values else 0
                
                col_info = {
                    'name': col_name,
                    'type': col_type,
                    'nullable': col['nullable'],
                    'default': col['default'],
                    'primary_key': col.get('primary_key', False),
                    'example_values': example_values,
                    'total_unique': total_unique
                }
                column_info.append(col_info)
            
            return {
                'table_name': table_name,
                'database_name': database_name,
                'row_count': row_count,
                'columns': column_info,
                'sample_data': [list(row) for row in sample_data] if sample_data else []
            }
        except SQLAlchemyError as e:
            raise Exception(f"Failed to get schema for table '{table_name}': {str(e)}")
    
    def execute_query(self, query: str, limit: int = 100) -> pd.DataFrame:
        """Execute a SQL query and return results as pandas DataFrame."""
        if not self.engine:
            raise Exception("No database connection established")
        
        try:
            # Add LIMIT clause if not already present
            query_lower = query.lower().strip()
            if not query_lower.startswith('select'):
                raise Exception("Only SELECT queries are allowed")
            
            if 'limit' not in query_lower:
                query = f"{query.rstrip(';')} LIMIT {limit}"
            
            # Execute query
            df = pd.read_sql(query, self.engine)
            return df
        except SQLAlchemyError as e:
            raise Exception(f"Query execution failed: {str(e)}")
    
    def get_table_preview(self, table_name: str, limit: int = 10) -> pd.DataFrame:
        """Get a preview of table data."""
        if not self.engine:
            raise Exception("No database connection established")
        
        try:
            query = f"SELECT * FROM `{table_name}` LIMIT {limit}"
            df = pd.read_sql(query, self.engine)
            return df
        except SQLAlchemyError as e:
            raise Exception(f"Failed to preview table '{table_name}': {str(e)}")
    
    def close_connection(self):
        """Close the database connection."""
        if self.engine:
            self.engine.dispose()
            self.engine = None
            self.current_database = None 