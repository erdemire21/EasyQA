import io
import ast
import numpy as np
import pandas as pd
from contextlib import redirect_stdout
from tqdm import tqdm
from .code_processing import clean_pandas_code, modify_parquet_paths


def capture_exec_output(code):
    """
    Execute code and return its output in its original format. If no output,
    return 'None'. If an error occurs, return the exception.

    Dynamically extracts imports from the code and includes them in the execution context.
    """

    def extract_imports(code):
        """
        Extract all imported modules and objects from the given code.
        Returns a dictionary of imported modules and their names.
        If an error occurs during parsing, returns an empty dictionary.
        """
        try:
            tree = ast.parse(code)
            imports = {}

            for node in ast.walk(tree):
                # Handle `import` statements
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        module_name = alias.name
                        as_name = alias.asname or alias.name
                        imports[as_name] = __import__(module_name)

                # Handle `from ... import ...` statements
                elif isinstance(node, ast.ImportFrom):
                    module_name = node.module
                    for alias in node.names:
                        name = alias.name
                        as_name = alias.asname or alias.name
                        if module_name:
                            full_name = f"{module_name}.{name}"
                            imports[as_name] = __import__(module_name, fromlist=[name]).__dict__[name]

            return imports
        except Exception:
            # Return empty dictionary if any error occurs during import extraction
            return {}

    # Extract imports from the code
    dynamic_imports = extract_imports(code)

    # Prepare the execution environment with built-ins and dynamic imports
    execution_globals = {"__builtins__": __builtins__, "np": np, "pd": pd, "ast": ast}
    execution_globals.update(dynamic_imports)

    f = io.StringIO()
    try:
        local_vars = {}
        with redirect_stdout(f):
            exec(code, execution_globals, local_vars)

        # Check if there are any local variables
        if local_vars:
            # Get the last defined variable
            last_var = list(local_vars.values())[-1]
            if isinstance(last_var, np.ndarray):
                return last_var.tolist()  # Convert NumPy array to Python list

        # If last variable is not a NumPy ndarray, proceed to capture stdout
        output = f.getvalue().strip()

        # If there's stdout output, return it
        if output:
            try:
                eval_output = eval(output)
                if isinstance(eval_output, np.ndarray):
                    return eval_output.tolist()  # Convert NumPy array to Python list
                return eval_output
            except Exception:
                return output  # If not evaluatable, return raw output
        # If no stdout, check for the last variable again (in case it's not ndarray)
        elif local_vars:
            last_var = list(local_vars.values())[-1]
            if isinstance(last_var, np.ndarray):
                return last_var.tolist()  # Convert NumPy array to Python list
            return last_var
        else:
            return 'None'  # No output, no variables
    except Exception as e:
        return "Error :" + str(e)  # Return exception as a string


def convert_types(obj):
    """Convert NumPy types and sets to Python native types for JSON serialization."""
    if isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, set):
        return [convert_types(item) for item in obj]
    elif isinstance(obj, (list, tuple)):
        return [convert_types(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_types(value) for key, value in obj.items()}
    elif isinstance(obj, pd.DataFrame):
        return obj.to_string(index=False)
    elif callable(obj):
        return f"<callable {obj.__name__}>"
    else:
        return obj


def execute_pandas_code(data, dataset_folder_path="../datasets/", is_sample=False):
    """
    Execute pandas code for each question and capture results.

    Args:
        data (list): A list of dictionaries containing pandas code under the 'pandas_code' key.
        dataset_folder_path (str): The path to fix in the parquet files.
        is_sample (bool): Flag to determine whether to use sample datasets.

    Returns:
        list: The updated data with the 'final_answer' key added to each entry.
    """
    for entry in tqdm(data, desc="Executing pandas code"):
        # Extract and clean the code
        raw_code = entry.get('pandas_code', '')
        cleaned_code = clean_pandas_code(raw_code)

        # Modify the parquet paths and execute the code
        modified_code = modify_parquet_paths(cleaned_code, dataset_folder_path=dataset_folder_path, is_sample=is_sample)
        result = capture_exec_output(modified_code)
        entry['final_answer'] = result

    return convert_types(data) 