#!/usr/bin/env python3
"""Calculate selected fictional or authorized budget rows; no account access."""
import decimal
import json
import re
import sys

decimal.getcontext().prec = 100

def calculate(value):
    if not isinstance(value, dict) or set(value) != {'currency', 'period', 'rows'}: raise ValueError('Expected currency, period and rows')
    if not re.fullmatch('[A-Z]{3}', str(value['currency'])) or not isinstance(value['period'], str) or not value['period'].strip(): raise ValueError('Specify one currency and one comparable period')
    if not isinstance(value['rows'], list) or not 1 <= len(value['rows']) <= 1000: raise ValueError('Expected 1–1000 rows')
    output = []; seen = set()
    for row in value['rows']:
        if not isinstance(row, dict) or set(row) != {'id', 'budget', 'actual'}: raise ValueError('Expected row id, budget and actual')
        if not isinstance(row['id'], str) or not row['id'].strip() or row['id'] in seen: raise ValueError('Unique nonempty row IDs required')
        seen.add(row['id'])
        if any(not isinstance(row[k], str) or len(row[k]) > 40 or not re.fullmatch(r'-?\d+(\.\d+)?', row[k]) for k in ['budget', 'actual']): raise ValueError('Use finite decimal strings, without currency symbols or exponents')
        budget, actual = decimal.Decimal(row['budget']), decimal.Decimal(row['actual'])
        difference = actual - budget
        output.append({'id': row['id'], 'difference': str(difference), 'percentOfAbsoluteBudget': None if not budget else str((difference / abs(budget) * 100).quantize(decimal.Decimal('.01'))), 'interpretation': 'Sign only; favorable/unfavorable requires account context'})
    return {'currency': value['currency'], 'period': value['period'], 'rows': output}

if __name__ == '__main__':
    try:
        with open(sys.argv[1]) as f: print(json.dumps(calculate(json.load(f))))
    except (ValueError, OSError, IndexError, decimal.InvalidOperation) as exc:
        print('Variance calculation failed: ' + str(exc), file=sys.stderr); sys.exit(1)
