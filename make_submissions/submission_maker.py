import json
import pathlib
import ast
import re
import os

# Get the directory of the current file
current_file_directory = os.path.dirname(os.path.abspath(__file__))

# Change the current working directory to the directory of the current file
os.chdir(current_file_directory)

def load_json(file_path):
    """
    Load a JSON file from the given file path.
    """
    path = pathlib.Path(file_path)
    with path.open(encoding='utf-8') as f:
        return json.load(f)

def can_be_number(s):
    """
    Check if a string can be converted to a number.
    """
    try:
        float(s)
        return True
    except Exception:
        return False

def fix_final_answer(data):
    """
    Clean and standardize the 'final_answer' field in the data.
    """
    for item in data:
        if 'final_answer' in item:
            value = item['final_answer']

            # If already a Python list, skip
            if isinstance(value, list):
                continue

            # If it's a well-formed list-like string
            if isinstance(value, str) and re.match(r'^\[.*\]$', value):
                try:
                    # Attempt to parse the string as a Python literal
                    parsed_value = ast.literal_eval(value)
                    if isinstance(parsed_value, list):
                        # Check if it is a list of tuples
                        if all(isinstance(i, tuple) for i in parsed_value):
                            # Extract the first items of each tuple
                            item['final_answer'] = [i[0] for i in parsed_value]
                        else:
                            # Otherwise, treat it as a normal list
                            item['final_answer'] = parsed_value
                        continue
                except (ValueError, SyntaxError):
                    pass  # Not a valid Python literal, fall through

            # If it's a malformed list-like string
            if isinstance(value, str) and re.match(r'^\[.*\]$', value):
                try:
                    # Clean and convert to a proper list
                    cleaned_list = [
                        float(x) if '.' in x else int(x)
                        for x in value.strip('[]').split()
                    ]
                    item['final_answer'] = cleaned_list
                except ValueError:
                    pass  # If it fails, leave it unchanged
    return data

def extract_predictions(data):
    """
    Extract the 'final_answer' field from the data.
    """
    return [i['final_answer'] for i in data]

def write_predictions_to_file(predictions, output_file):
    """
    Write predictions to a file, only the first line of each prediction.
    """
    if not os.path.exists(os.path.dirname(output_file)):
        os.makedirs(os.path.dirname(output_file))
    with open(output_file, 'w', encoding='utf-8') as f:
        for prediction in predictions:
            lines = str(prediction).split('\n')  # Split the entry into lines
            first_line = lines[0]               # Select the first line
            f.write(first_line + '\n')          # Write the first line to the file

            if len(lines) > 1:                  # Check if there are more than 1 line
                print("Multiline entry found:", prediction)  # Print the original multiline entry

def process_json_to_predictions(input_file, output_file):
    """
    Main function to process the JSON file and generate predictions.
    """
    data = load_json(input_file)
    cleaned_data = fix_final_answer(data)
    predictions = extract_predictions(cleaned_data)
    write_predictions_to_file(predictions, output_file)

# Example usage:
if __name__ == '__main__':
    # Path configurations
    ALL_RESULTS_PATH = '../intermediate_results/code_execution_results.json'
    PREDICTIONS_PATH = 'predictions/predictions.txt'

    process_json_to_predictions(ALL_RESULTS_PATH, PREDICTIONS_PATH)

