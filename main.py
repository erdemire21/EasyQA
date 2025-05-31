from utilities.pipeline import run_pipeline


if __name__ == "__main__":
    # Define paths
    SCHEMA_PATH = 'data/pandas_schemas.json'
    QA_PATH = 'data/all_qa.json'
    OUTPUT_PATH = 'intermediate_results/code_execution_results.json'
    DATASET_FOLDER_PATH = 'data/'

    # Run the pipeline with 2 retry attempt and default dataset folder path
    run_pipeline(SCHEMA_PATH, QA_PATH, OUTPUT_PATH, max_retries=2, dataset_folder_path=DATASET_FOLDER_PATH)
