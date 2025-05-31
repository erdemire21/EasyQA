import json


def load_schemas(schema_path):
    """Load the pandas schemas from file."""
    with open(schema_path, encoding='utf-8') as f:
        return json.load(f)


def load_questions(qa_path):
    """Load the questions from file."""
    with open(qa_path, encoding='utf-8') as f:
        return json.load(f)