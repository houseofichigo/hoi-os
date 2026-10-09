"""Check package structure, integrity and instruction archives without executing skills."""
from pathlib import Path,PurePosixPath
import hashlib,json,re,zipfile
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'skills/catalog.json').read_text())
names=[s['name'] for s in catalog['skills']]
assert len(names)==21 and len(set(names))==21
assert set(names)=={p.name for p in (root/'skills').iterdir() if p.is_dir()}
for name in names:
 assert re.fullmatch(r'hoi-[a-z0-9-]+',name)
 text=(root/'skills'/name/'SKILL.md').read_text()
 assert text.startswith('---\n') and f'name: {name}\n' in text and 'description:' in text
 for p in (root/'skills'/name).rglob('*'):
  assert not p.is_symlink()
  if p.is_file():
   t=p.read_text()
   assert not re.search(r'/Users/|myn8n|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|sk-(?:proj-|ant-)[A-Za-z0-9_-]{15,}',t),f'Sensitive pattern: {p.name}'
expected=set()
for line in (root/'dist/SHA256SUMS').read_text().splitlines():
 sha,name=line.split('  ',1);p=root/'dist'/name
 assert p.resolve().is_relative_to((root/'dist').resolve())
 assert hashlib.sha256(p.read_bytes()).hexdigest()==sha
 expected.add(name)
assert expected=={p.relative_to(root/'dist').as_posix() for p in (root/'dist').rglob('*.zip')}
assert len(expected)==22
for archive in (root/'dist').rglob('*.zip'):
 with zipfile.ZipFile(archive) as z:
  assert z.testzip() is None
  assert len(z.namelist())==len(set(z.namelist()))
  for name in z.namelist():
   parts=PurePosixPath(name).parts
   assert not name.startswith('/') and '..' not in parts and '\\' not in name
   assert ((z.getinfo(name).external_attr>>16)&0o170000)!=0o120000
   if archive.parent.name=='individual':
    assert parts[0]==archive.stem
    source=root/'LICENSE' if parts[-1]=='LICENSE' else root/'skills'/name
   else: source=root/name
   assert source.is_file() and z.read(name)==source.read_bytes(),name
print('PASS: 21 skills; 22 archives; checksums and archive/source bytes match.')
