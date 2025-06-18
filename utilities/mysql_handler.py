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
import tempfile
import shutil
from pathlib import Path

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
    
    def get_multi_table_schema(self, table_names: List[str], database_name: str = None) -> Dict[str, any]:
        """Get detailed schema information for multiple tables with relationship analysis."""
        if not database_name:
            database_name = self.current_database
        
        if not database_name:
            raise Exception("No database selected")
        
        try:
            # Ensure we're connected to the right database
            if self.current_database != database_name:
                self.connect_to_database(database_name)
            
            inspector = inspect(self.engine)
            
            # Get schemas for all tables
            table_schemas = {}
            for table_name in table_names:
                schema = self.get_table_schema(table_name, database_name)
                table_schemas[table_name] = schema
            
            # Detect relationships between tables
            relationships = self._detect_table_relationships(table_names, inspector)
            
            return {
                'database_name': database_name,
                'tables': table_schemas,
                'relationships': relationships,
                'table_count': len(table_names)
            }
        except SQLAlchemyError as e:
            raise Exception(f"Failed to get multi-table schema: {str(e)}")
    
    def _detect_table_relationships(self, table_names: List[str], inspector) -> List[Dict[str, str]]:
        """Detect foreign key relationships between selected tables."""
        relationships = []
        
        try:
            for table_name in table_names:
                # Get foreign keys for this table
                foreign_keys = inspector.get_foreign_keys(table_name)
                
                for fk in foreign_keys:
                    referred_table = fk['referred_table']
                    # Only include relationships where both tables are selected
                    if referred_table in table_names:
                        relationship = {
                            'from_table': table_name,
                            'to_table': referred_table,
                            'from_columns': fk['constrained_columns'],
                            'to_columns': fk['referred_columns'],
                            'constraint_name': fk.get('name', 'unnamed')
                        }
                        relationships.append(relationship)
        except Exception as e:
            # If relationship detection fails, continue without relationships
            pass
        
        return relationships
    
    def close_connection(self):
        """Close the database connection."""
        if self.engine:
            self.engine.dispose()
            self.engine = None
            self.current_database = None
    
    def create_table_snapshot(self, table_name: str, output_dir: str = "datasets") -> str:
        """Create a temporary parquet snapshot of a MySQL table."""
        if not self.engine:
            raise Exception("No database connection established")
        
        try:
            # Create output directory if it doesn't exist
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            snapshot_filename = f"{self.current_database}_{table_name}.parquet"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            
            # Load all data from the table
            query = f"SELECT * FROM `{table_name}`"
            df = pd.read_sql(query, self.engine)
            
            # Save as parquet
            df.to_parquet(snapshot_path, index=False)
            
            return snapshot_path
        except Exception as e:
            raise Exception(f"Failed to create snapshot for table '{table_name}': {str(e)}")
    
    def create_multi_table_snapshots(self, table_names: List[str], output_dir: str = "datasets") -> Dict[str, str]:
        """Create temporary parquet snapshots for multiple MySQL tables."""
        if not self.engine:
            raise Exception("No database connection established")
        
        snapshots = {}
        try:
            for table_name in table_names:
                snapshot_path = self.create_table_snapshot(table_name, output_dir)
                snapshots[table_name] = snapshot_path
            
            return snapshots
        except Exception as e:
            # Cleanup any created files on error
            for path in snapshots.values():
                if os.path.exists(path):
                    os.remove(path)
            raise Exception(f"Failed to create snapshots: {str(e)}")
    
    def generate_parquet_schema(self, table_name: str, parquet_path: str) -> str:
        """Generate schema string for a parquet file (similar to main page schema generation)."""
        try:
            # Load the parquet file to analyze
            df = pd.read_parquet(parquet_path)
            
            # Get basic info
            row_count = len(df)
            column_count = len(df.columns)
            
            schema_lines = [
                f"Dataset: {table_name}",
                f"Shape: {row_count} rows, {column_count} columns",
                f"File: {os.path.basename(parquet_path)}",
                ""
            ]
            
            # Analyze each column
            for col in df.columns:
                dtype = str(df[col].dtype)
                unique_count = df[col].nunique()
                
                # Get example values (limit to avoid long strings)
                example_values = []
                non_null_values = df[col].dropna()
                if len(non_null_values) > 0:
                    samples = non_null_values.head(5).astype(str).tolist()
                    for val in samples:
                        if len(val) > 50:
                            val = val[:47] + "..."
                        example_values.append(val)
                
                example_str = ", ".join(example_values) if example_values else "No examples"
                
                # Format similar to pandas schema
                schema_line = (f"Column Name: {col}, Data type -- {dtype}, "
                             f"-- Example values: {example_str}, Total unique elements: {unique_count}")
                schema_lines.append(schema_line)
            
            return "\n".join(schema_lines)
        except Exception as e:
            raise Exception(f"Failed to generate schema for {parquet_path}: {str(e)}")
    
    def generate_multi_table_parquet_schema(self, table_snapshots: Dict[str, str]) -> str:
        """Generate combined schema for multiple parquet files."""
        try:
            schema_parts = []
            
            schema_parts.append(f"Multi-table dataset with {len(table_snapshots)} tables:")
            schema_parts.append("")
            
            for table_name, parquet_path in table_snapshots.items():
                table_schema = self.generate_parquet_schema(table_name, parquet_path)
                schema_parts.append(f"=== TABLE: {table_name} ===")
                schema_parts.append(table_schema)
                schema_parts.append("")
            
            return "\n".join(schema_parts)
        except Exception as e:
            raise Exception(f"Failed to generate multi-table schema: {str(e)}") 