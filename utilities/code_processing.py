import re
import os
from typing import Tuple


SUPPORTED_EXTENSIONS = [
    ('.parquet', 'read_parquet'),
    ('.csv', 'read_csv'),
    ('.json', 'read_json'),
    ('.xlsx', 'read_excel')
]


def _find_dataset_file(dataset_name: str, dataset_folder_path: str) -> Tuple[str, str]:
    """Return (file_path, pandas_reader) for the first supported extension that exists."""
    for ext, reader in SUPPORTED_EXTENSIONS:
        potential_file = os.path.join(dataset_folder_path, f"{dataset_name}{ext}")
        if os.path.exists(potential_file):
            return potential_file, reader
    return None, None


def modify_dataset_paths(code, dataset_folder_path="datasets/", is_sample=False):
    """Modifies pandas read paths in the code to prepend a fixed path and adjust file extensions if needed."""
    dataset_folder_path = dataset_folder_path.rstrip("/\\") + "/"

    def replace_parquet(match):
        """Replace pd.read_parquet calls with correct reader/path based on existing dataset file."""
        # Extract provided path inside the read_parquet call
        original_path = match.group(1)  # e.g., "my_file.parquet" or "subdir/my_file.parquet"
        # Get the base filename without directory and extension
        dataset_name = os.path.splitext(os.path.basename(original_path))[0]

        file_path, reader = _find_dataset_file(dataset_name, dataset_folder_path)
        if file_path and reader:
            # Build replacement string
            if reader == 'read_excel':
                return f"pd.{reader}('{file_path}', engine='openpyxl')"
            else:
                return f"pd.{reader}('{file_path}')"
        # Fallback: just prefix original parquet path
        return f"pd.read_parquet('{dataset_folder_path}{original_path}')"

    # First, adjust any pd.read_parquet occurrences
    code = re.sub(r"pd\.read_parquet\(['\"](.*?)['\"]\)", replace_parquet, code)

    # Then, simply prefix path for other explicit formats
    read_functions = [
        (r"pd\.read_csv\(['\"](.*?\.csv)['\"]\)", lambda m: f"pd.read_csv('{m.group(1)}')" if m.group(1).startswith(dataset_folder_path) else f"pd.read_csv('{dataset_folder_path}{m.group(1)}')"),
        (r"pd\.read_json\(['\"](.*?\.json)['\"]\)", lambda m: f"pd.read_json('{m.group(1)}')" if m.group(1).startswith(dataset_folder_path) else f"pd.read_json('{dataset_folder_path}{m.group(1)}')"),
        (r"pd\.read_excel\(['\"](.*?\.xlsx)['\"]\)", lambda m: f"pd.read_excel('{m.group(1)}', engine='openpyxl')" if m.group(1).startswith(dataset_folder_path) else f"pd.read_excel('{dataset_folder_path}{m.group(1)}', engine='openpyxl')")
    ]

    for pattern, replacement in read_functions:
        code = re.sub(pattern, replacement, code)

    return code


def clean_pandas_code(raw_code):
    """
    Clean and extract Python code from a raw string.

    Args:
        raw_code (str): The raw string containing Python code with possible markdown formatting.

    Returns:
        str: The cleaned Python code.
    """
    raw_code = raw_code.strip()
    if '```python' in raw_code:
        # Extract everything between '```python' and the next '```'
        cleaned_code = raw_code.split('```python', 1)[1].split('```', 1)[0].strip()
    else:
        # Otherwise, get everything up to the first ```
        cleaned_code = raw_code.split('```', 1)[0].strip()
    return cleaned_code 