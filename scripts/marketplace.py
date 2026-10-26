"""Reconcile the inspected VSIX with the public Marketplace version before recording a release."""
import io
import json
from pathlib import Path
import sys
import time
import urllib.parse
import urllib.request
from zipfile import ZipFile

GALLERY = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'


def compare_payload(local, remote):
    with ZipFile(io.BytesIO(local)) as expected, ZipFile(io.BytesIO(remote)) as actual:
        expected_names = [name for name in expected.namelist() if name.startswith('extension/')]
        actual_names = [name for name in actual.namelist() if name.startswith('extension/')]
        if set(expected_names) != set(actual_names) or len(actual_names) != len(set(actual_names)):
            raise ValueError('Existing Marketplace version contains a different set of extension files')
        for name in expected.namelist():
            # The service may add signature/container metadata; extension payload must match exactly.
            if name.startswith('extension/'):
                if name not in actual.namelist() or expected.read(name) != actual.read(name):
                    raise ValueError('Existing Marketplace version has a different payload: ' + name)


def public_payload(version):
    body = {'filters': [{'criteria': [{'filterType': 7, 'value': 'cixiangtao.codex-project-chats'}]}], 'flags': 3}
    request = urllib.request.Request(GALLERY, data=json.dumps(body).encode(), headers={
        'Content-Type': 'application/json', 'Accept': 'application/json;api-version=7.2-preview.1',
        'User-Agent': 'codex-project-chats-release',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    for group in result.get('results', []):
        for extension in group.get('extensions', []):
            if extension['publisher']['publisherName'] != 'cixiangtao' or extension['extensionName'] != 'codex-project-chats':
                continue
            for item in extension.get('versions', []):
                if item['version'] != version:
                    continue
                for asset in item.get('files', []):
                    if asset['assetType'] != 'Microsoft.VisualStudio.Services.VSIXPackage':
                        continue
                    parsed = urllib.parse.urlparse(asset['source'])
                    if parsed.scheme != 'https' or not (parsed.hostname == 'marketplace.visualstudio.com' or (parsed.hostname or '').endswith('.vsassets.io')):
                        raise ValueError('Unexpected Marketplace asset host')
                    with urllib.request.urlopen(asset['source'], timeout=30) as response:
                        payload = response.read(20 * 1024 * 1024 + 1)
                    if len(payload) > 20 * 1024 * 1024:
                        raise ValueError('Unexpectedly large Marketplace asset')
                    return payload
    return None


def reconcile(archive, wait=False):
    local = Path(archive).read_bytes()
    with ZipFile(io.BytesIO(local)) as package:
        manifest = json.loads(package.read('extension/package.json'))
    if manifest['publisher'] != 'cixiangtao' or manifest['name'] != 'codex-project-chats':
        raise ValueError('Wrong release package identity')
    attempts = 21 if wait else 1
    for attempt in range(attempts):
        remote = public_payload(manifest['version'])
        if remote is not None:
            compare_payload(local, remote)
            print('Marketplace version is public and its extension payload matches the inspected artifact.')
            return True
        if attempt + 1 < attempts:
            print('Marketplace version is not public yet; waiting for validation.', flush=True)
            time.sleep(15)
    return False


if __name__ == '__main__':
    try:
        found = reconcile(sys.argv[1], '--wait' in sys.argv[2:])
        # Probe: 10 means absent, all other failures remain errors (never silently publish after a mismatch).
        sys.exit(0 if found else (1 if '--wait' in sys.argv[2:] else 10))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
