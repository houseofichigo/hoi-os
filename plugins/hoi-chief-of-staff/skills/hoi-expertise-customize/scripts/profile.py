#!/usr/bin/env python3
"""Prepare private descriptive profiles. This is not an engine authorization tool."""
import argparse
import copy
import datetime
import hashlib
import json
import os
import pathlib
import re
import sys

FIELDS = json.loads((pathlib.Path(__file__).resolve().parent.parent / 'references' / 'profile-fields.json').read_text())
STATES = {'confirmed', 'reported', 'inferred', 'missing', 'conflicting', 'deferred'}

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def exact(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(label + ': unexpected or missing fields')

def text(value, label, maximum=4000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(label + ': expected nonempty bounded text')
    # A conservative obvious-secret check, not a credential scanner.
    if re.search(r'(sk-[A-Za-z0-9_-]{16,}|-----BEGIN .*PRIVATE KEY|Bearer\s+\S{12,})', value):
        raise ValueError(label + ': suspected credential; exclude it')

def validate(value):
    exact(value, ['schemaVersion', 'workspaceId', 'clientId', 'version', 'status', 'packs', 'review'], 'profile')
    if type(value['schemaVersion']) is not int or value['schemaVersion'] != 1 or type(value['version']) is not int or value['version'] < 1:
        raise ValueError('Unsupported profile version')
    text(value['workspaceId'], 'workspaceId', 120); text(value['clientId'], 'clientId', 120)
    if value['status'] not in {'draft', 'reviewed'}: raise ValueError('Invalid status')
    if not isinstance(value['packs'], dict) or not value['packs']: raise ValueError('Select at least one pack')
    missing = []
    for pack, values in value['packs'].items():
        if pack not in FIELDS: raise ValueError('Unknown pack: ' + pack)
        exact(values, FIELDS[pack], pack)
        for field, item in values.items():
            exact(item, ['state', 'value', 'evidence'], field)
            if item['state'] not in STATES: raise ValueError('Invalid field state')
            if not isinstance(item['evidence'], list) or len(item['evidence']) > 20: raise ValueError('Invalid evidence')
            for ref in item['evidence']:
                exact(ref, ['recordId', 'revision', 'locator'], 'evidence')
                for key, val in ref.items(): text(val, key, 600)
            if item['state'] in {'missing', 'deferred'}:
                if item['value'] is not None: raise ValueError('Unknown values must be null')
            else: text(item['value'], field)
            if item['state'] in {'confirmed', 'reported'} and not item['evidence']:
                raise ValueError('Confirmed/reported fields need exact source or attributed statement references')
            if item['state'] != 'confirmed': missing.append(pack + '.' + field + ': ' + item['state'])
    if value['status'] == 'draft':
        if value['review'] is not None: raise ValueError('Draft cannot retain a review')
    else:
        exact(value['review'], ['reviewer', 'reviewedAt', 'contentDigest', 'meaning'], 'review')
        text(value['review']['reviewer'], 'reviewer', 120)
        datetime.datetime.fromisoformat(value['review']['reviewedAt'].replace('Z', '+00:00'))
        bare = copy.deepcopy(value); bare['status'] = 'draft'; bare['review'] = None
        if value['review']['contentDigest'] != digest(bare): raise ValueError('Profile changed after review')
        if value['review']['meaning'] != 'Descriptive context only; no engine authorization': raise ValueError('Invalid review meaning')
    return missing

def preview(selection, previous=None):
    exact(selection, ['workspaceId', 'clientId', 'packs'], 'selection')
    result = {'schemaVersion': 1, 'workspaceId': selection['workspaceId'], 'clientId': selection['clientId'], 'version': 1, 'status': 'draft', 'packs': {}, 'review': None}
    if previous:
        validate(previous)
        if (previous['workspaceId'], previous['clientId']) != (result['workspaceId'], result['clientId']): raise ValueError('Client/workspace mismatch')
        result['version'] = previous['version'] + 1
    for pack, supplied in selection['packs'].items():
        if pack not in FIELDS or not isinstance(supplied, dict) or set(supplied) - set(FIELDS[pack]): raise ValueError('Unknown pack or field')
        result['packs'][pack] = {key: supplied.get(key, {'state': 'missing', 'value': None, 'evidence': []}) for key in FIELDS[pack]}
    validate(result)
    return result

def review(value, reviewer, expected):
    validate(value)
    if value['status'] != 'draft' or digest(value) != expected: raise ValueError('Stale profile or already reviewed')
    text(reviewer, 'reviewer', 120)
    result = copy.deepcopy(value)
    result['status'] = 'reviewed'
    result['review'] = {'reviewer': reviewer, 'reviewedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'contentDigest': expected, 'meaning': 'Descriptive context only; no engine authorization'}
    validate(result)
    return result

def read(path):
    p = pathlib.Path(path)
    if p.is_symlink() or p.stat().st_size > 256 * 1024: raise ValueError('Unsafe or oversized input')
    return json.loads(p.read_text())

def write_new(path, value):
    p = pathlib.Path(path).absolute()
    if any(parent.is_symlink() for parent in [p] + list(p.parents)): raise ValueError('Symlink output refused')
    if any((parent / '.git').exists() for parent in p.parents): raise ValueError('Private profiles must be outside Git repositories')
    if not p.parent.is_dir(): raise ValueError('Create the intended private output directory first')
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf8') as f: json.dump(value, f, ensure_ascii=False, indent=2); f.write('\n')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['preview', 'validate', 'compare', 'review'])
    parser.add_argument('input'); parser.add_argument('--previous'); parser.add_argument('--output')
    parser.add_argument('--reviewer'); parser.add_argument('--expected-digest')
    args = parser.parse_args(); value = read(args.input)
    if args.command == 'preview':
        result = preview(value, read(args.previous) if args.previous else None)
    elif args.command == 'review':
        if not args.reviewer or not args.expected_digest: raise ValueError('Review needs reviewer and exact expected digest')
        result = review(value, args.reviewer, args.expected_digest)
    elif args.command == 'compare':
        if not args.previous: raise ValueError('Compare needs --previous')
        previous = read(args.previous); validate(previous); validate(value)
        if (value['workspaceId'], value['clientId']) != (previous['workspaceId'], previous['clientId']): raise ValueError('Client/workspace mismatch')
        changed = [pack + '.' + field for pack, fields in value['packs'].items() for field, item in fields.items() if previous['packs'].get(pack, {}).get(field) != item]
        removed = [pack + '.' + field for pack, fields in previous['packs'].items() for field in fields if field not in value['packs'].get(pack, {})]
        print(json.dumps({'changed': changed, 'removed': removed, 'previousDigest': digest(previous), 'currentDigest': digest(value)})); return
    else:
        print(json.dumps({'valid': True, 'gaps': validate(value), 'digest': digest(value), 'authority': 'Schema validation only; permissions and factual correctness not verified'})); return
    if not args.output: raise ValueError('A new private --output path is required')
    write_new(args.output, result)
    print(json.dumps({'written': True, 'digest': digest(result), 'gaps': validate(result), 'activated': False}))

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, TypeError, KeyError, AttributeError) as exc:
        print('Profile operation failed: ' + str(exc), file=sys.stderr); sys.exit(1)
