import os
from databench_eval import Evaluator, utils
import zipfile

os.chdir(os.path.dirname(os.path.abspath(__file__)))

file_path = 'predictions/DEV/combinedqweno3_swap/predictions.txt'
# Evaluate predictions from predictions.txt
with open(file_path, "r", encoding='utf-8') as file:
    predictions = file.readlines()
predictions = [i.strip() for i in predictions]

qa = utils.load_qa(lang="ES", name="iberlef", split="dev")

# Initialize evaluator
evaluator = Evaluator(qa=qa)

accuracy = evaluator.eval(predictions)
print(f"DataBench accuracy is {accuracy}")
