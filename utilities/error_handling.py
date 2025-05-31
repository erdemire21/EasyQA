import logging
import traceback


def classify_error(exc):
    """Classify an exception into syntax, logic, data-type, or other."""
    msg = str(exc).lower()
    if isinstance(exc, SyntaxError) or "syntax error" in msg or "unexpected eof" in msg:
        return "syntax"
    elif isinstance(exc, TypeError) or "dtype" in msg or "typeerror" in msg:
        return "data-type"
    elif "groupby" in msg or "aggregation" in msg or "cannot insert" in msg:
        return "logic"
    else:
        return "other" 