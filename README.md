# semeval8-itunlp

## Configuration

This project uses environment variables for configuration. Create a `.env` file in the root directory with the following variables:

```env
# API Configuration
API_KEY=your_api_key_here
API_BASE_URL=your_api_base_url_here

# LLM Model Configuration
MAIN_LLM=deepseek-ai/DeepSeek-R1
ERROR_LLM=deepseek-ai/DeepSeek-R1
```

### Environment Variables
Any provider that has an OpenAI compatible API can be used by modifying the following environment variables:

- `API_KEY`: Your API key for accessing the LLM services
- `API_BASE_URL`: The base URL for the API endpoint
- `MAIN_LLM`: The model to use for primary code generation (defaults to "deepseek-ai/DeepSeek-R1")
- `ERROR_LLM`: The model to use for error correction (defaults to "deepseek-ai/DeepSeek-R1")

## Pipeline Execution

The project pipeline is designed to run in three sequential steps:

1. **Preprocessing**:
   - Run the preprocessing script located in the `preprocessing` directory:
     ```bash
     python preprocessing/preprocessing.py
     ```
   - This step prepares and pre-processes raw competition data such as datasets and questions.
   - **Note:** For competition tasks, please ensure that the folder containing competition datasets and questions is placed within the `competition` folder. The hierarchy should be as follows:

     ```
     competition
     ├── dataset1.parquet
     ├── dataset2.parquet
     ├── dataset3.parquet
     └── iberlef_blindtest.csv
     ```

2. **Main Pipeline**:
   - Execute the main pipeline by running:
     ```bash
     python main.py
     ```
   - The main script performs several tasks:
       - Loads schemas from `data/pandas_schemas.json`.
       - Loads questions from `data/all_qa.json`.
       - Generates and refines pandas code for answering questions with built-in error checking and retry logic.
       - Executes the generated code in parallel using a thread pool and saves intermediate results in the `intermediate_results` directory.

3. **Make Submissions**:
   - Run the submission maker script in the `make_submissions` directory:
     ```bash
     python make_submissions/submission_maker.py
     ```
   - This script aggregates the processed results, creating the final submission files based on the pipeline outputs.

### Additional Information

- Ensure that the `.env` file in the root directory is properly configured with the required API keys and model settings as described in the Configuration section.

- You may need to adjust file paths in the scripts if you modify the directory structure.

- Intermediate outputs are saved for debugging and review.