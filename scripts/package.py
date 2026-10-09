"""Rebuild instruction archives; no skill instructions or supporting scripts run."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'skills/catalog.json').read_text())
version=catalog['version']
dist=root/'dist';(dist/'individual').mkdir(parents=True,exist_ok=True)
def write(path, files):
 with zipfile.ZipFile(path,'w') as z:
  for name,p in sorted(files.items()):
   if p.is_symlink(): raise ValueError('Symlinks forbidden')
   info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
   z.writestr(info,p.read_bytes())
for s in catalog['skills']:
 name=s['name'];folder=root/'skills'/name
 files={f'{name}/{p.relative_to(folder).as_posix()}':p for p in folder.rglob('*') if p.is_file()}
 files[f'{name}/LICENSE']=root/'LICENSE'
 write(dist/'individual'/f'{name}.zip',files)
files={p.relative_to(root).as_posix():p for folder in ['skills','docs'] for p in (root/folder).rglob('*') if p.is_file()}
for name in ['README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md']: files[name]=root/name
write(dist/f'hoi-os-skills-{version}.zip',files)
(dist/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(dist).as_posix()}\n' for p in sorted(dist.rglob('*.zip'))))
