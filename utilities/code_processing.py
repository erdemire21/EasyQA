import re


def modify_parquet_paths(code, dataset_folder_path="datasets/", is_sample=False):
    """Modifies pd.read_parquet paths in the code to prepend a fixed path."""
    # For the web interface, we want to use the datasets directly
    # No need to add subdirectories like all_datasets or sample_datasets
    return re.sub(
        r"pd\.read_parquet\(['\"](.*?\.parquet)['\"]\)",
        lambda match: f"pd.read_parquet('{dataset_folder_path}{match.group(1)}')",
        code
    )


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