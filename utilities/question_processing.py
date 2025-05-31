import traceback
from .agents import get_pandas_code
from .error_handling import classify_error
from .code_processing import clean_pandas_code, modify_parquet_paths
from .code_execution import capture_exec_output


def process_question(question_data, schemas, dataset_folder_path, max_retries=1):
    """Process a single question to generate pandas code with error checking and retrying."""
    # initialize per-question error history
    question_data.setdefault("error_history", [])

    # NEW -------------  keep track of *all* failed code/error pairs -------------
    previous_attempts = []          # [(code, error_msg), ...]
    # ---------------------------------------------------------------------------

    try:
        MAIN_QUESTION = question_data['question']
        DATASET = question_data['dataset']
        TABLE_NAME = DATASET

        dataset_info = schemas[TABLE_NAME]
        error_code = None
        pandas_code = get_pandas_code(DATASET, MAIN_QUESTION, dataset_info)

        # Save original code before path modification
        original_code = clean_pandas_code(pandas_code)
        
        # Test the code on full dataset
        modified_code = modify_parquet_paths(pandas_code, dataset_folder_path=dataset_folder_path, is_sample=False)
        modified_code = clean_pandas_code(modified_code)
        retries = 0

        exec_output = ""

        while retries <= max_retries:
            try:
                # Try executing the code
                exec_output = capture_exec_output(clean_pandas_code(modified_code))
                if isinstance(exec_output, str) and 'Error' in exec_output:
                    raise Exception(exec_output)

                # successful execution
                question_data["status"] = "success"
                break  # If successful, break the loop

            except Exception as exec_error:
                # classify the error
                category = classify_error(exec_error)
                tb = traceback.format_exc()

                # append to this question's history, including the code that caused the error
                question_data["error_history"].append({
                    "iteration": retries,
                    "error_type": category,
                    "exception": type(exec_error).__name__,
                    "message": str(exec_error),
                    "traceback": tb,
                    "code": modified_code
                })

                # ------------ keep a concise record for the next LLM call ---------
                # Use original code (without path modifications) for error reporting to LLM
                previous_attempts.append(
                    (original_code, str(exec_error))
                )
                if retries == max_retries:
                    break

                # If there's an error and we have retries left, try to fix it
                if len(previous_attempts) == 1:
                    error_arg = previous_attempts[0]           # tuple, old behaviour
                else:
                    error_arg = previous_attempts[:]           # list – new behaviour

                pandas_code = get_pandas_code(
                    DATASET,
                    MAIN_QUESTION,
                    dataset_info,
                    error_code=error_arg
                )
                
                # Update original code with the new code from LLM
                original_code = clean_pandas_code(pandas_code)
                
                modified_code = modify_parquet_paths(
                    pandas_code,
                    dataset_folder_path=dataset_folder_path,
                    is_sample=False
                )
                modified_code = clean_pandas_code(modified_code)
                retries += 1

        # if we never succeeded, mark as failed
        if question_data.get("status") != "success":
            question_data["status"] = "failed"

        question_data['pandas_code'] = pandas_code
        return question_data

    except Exception as e:
        # catch any unexpected top-level error
        question_data["status"] = "failed"
        category = classify_error(e)
        tb = traceback.format_exc()
        # include whatever pandas_code was last set (if any)
        last_code = question_data.get('pandas_code', '')
        question_data["error_history"].append({
            "iteration": None,
            "error_type": category,
            "exception": type(e).__name__,
            "message": str(e),
            "traceback": tb,
            "code": last_code
        })
        question_data['pandas_code'] = str(e)
        return question_data 