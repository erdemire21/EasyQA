import json
import pathlib
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm
from .data_loading import load_schemas, load_questions
from .question_processing import process_question
from .code_execution import execute_pandas_code


def run_pipeline(schema_path, qa_path, output_path, max_retries=1, dataset_folder_path="data/"):
    """Run the complete pipeline with error checking and retrying."""
    # Load input data
    schemas = load_schemas(schema_path)
    questions = load_questions(qa_path)

    # Generate pandas code with error checking
    print("Generating pandas code with error checking...")
    results = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        for result in tqdm(executor.map(lambda q: process_question(q, schemas, dataset_folder_path, max_retries), questions), total=len(questions)):
            results.append(result)

    # Save intermediate results
    intermediate_file = "intermediate_results/all_qa_pandas_code_not_executed.json"
    pathlib.Path(intermediate_file).parent.mkdir(parents=True, exist_ok=True)
    with open(intermediate_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=4)

    # Execute code and save results for full datasets only
    print("Executing code on full datasets...")
    full_results = execute_pandas_code(results.copy(), dataset_folder_path=dataset_folder_path)
    pathlib.Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(full_results, f, ensure_ascii=False, indent=4) 