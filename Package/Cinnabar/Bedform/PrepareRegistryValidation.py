"""Stage unchanged registry sources and verified fixtures without modifying the source import.

Bedform integration tooling, under the repository's applicable license.
No BDS executable is launched and no tool is installed by this command.
"""

import hashlib, json, pathlib, re, shutil, urllib.request

source = pathlib.Path(__file__).resolve().parent.parent
destination = source / '.local' / 'asset-validation'
seen = set()
def visit(directory):
    directory = directory.resolve()
    if directory in seen: return
    seen.add(directory)
    text = (directory / 'Cargo.toml').read_text(encoding='utf-8')
    for relative in re.findall(r'\bpath\s*=\s*"([^"]+)"', text):
        target = directory / relative
        if (target / 'Cargo.toml').is_file(): visit(target)
visit(source / 'crates/asset-compiler')
print('Selected crates:', len(seen), flush=True)
for directory in sorted(seen):
    shutil.copytree(directory, destination / directory.relative_to(source), dirs_exist_ok=True)
for directory in ['assets', 'docs', 'tools/registrygen', 'tools/localserver', 'packaging/common',
                  'crates/protocol/data', 'crates/json-ui/data', 'scripts/acceptance']:
    shutil.copytree(source / directory, destination / directory, dirs_exist_ok=True)
for name in ['Cargo.lock', '.gitattributes', 'Makefile', 'tools/dist/src/layout.rs',
             'crates/protocol/Cargo.toml', 'crates/launcher/src/install_layout.rs',
             'crates/launcher-host/src/local_worlds/mod.rs', '.github/workflows/ci.yml']:
    (destination / name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / name, destination / name)
text = (source / 'Cargo.toml').read_text(encoding='utf-8')
members = [p.relative_to(source).as_posix() for p in sorted(seen)]
text = re.sub(r'(?ms)^members\s*=\s*\[.*?\]', 'members = ' + json.dumps(members), text, count=1)
text = re.sub(r'(?ms)^default-members\s*=\s*\[.*?\]\s*', '', text)
text = re.sub(r'(?ms)^\[patch\.crates-io\].*?(?=^\[|\Z)', '', text)
(destination / 'Cargo.toml').write_text(text, encoding='utf-8', newline='\n')
inventory = json.loads((source / 'Bedform/import.json').read_text(encoding='utf-8'))
restored = []
for entry in inventory['excluded']:
    if not entry['path'].endswith('.bin'): continue
    file = destination / entry['path']
    url = f"https://raw.githubusercontent.com/cinnabar-mc/cinnabar/{inventory['commit']}/{entry['path']}"
    if not file.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Bedform-target-validation'})
        with urllib.request.urlopen(request, timeout=90) as response: data = response.read()
        digest = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if digest != entry['sha']: raise RuntimeError(f'Upstream blob mismatch: {entry["path"]}')
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
    data = file.read_bytes()
    if hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() != entry['sha']: raise RuntimeError('Existing blob mismatch')
    restored.append({'path':entry['path'],'gitBlob':entry['sha'],'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
    print('Verified fixture:', entry['path'], len(data), flush=True)
(destination / 'validation-inputs.json').write_text(json.dumps({'members':members,'restored':restored},indent=2)+'\n', encoding='utf-8', newline='\n')
print('Validation workspace prepared.', flush=True)
