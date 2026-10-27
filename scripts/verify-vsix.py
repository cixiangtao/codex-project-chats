"""Inspect the actual extension archive without requiring third-party packages."""
import json
import sys
from pathlib import Path
from zipfile import ZipFile

manifest = json.loads(Path("package.json").read_text())
archive = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(f"{manifest['name']}-{manifest['version']}.vsix")
with ZipFile(archive) as package:
    names = package.namelist()
    packed = json.loads(package.read("extension/package.json"))
    for field in ("name", "publisher", "version", "repository", "homepage", "bugs", "main"):
        assert packed[field] == manifest[field], f"Manifest mismatch: {field}"
    for name in ("extension/readme.md", "extension/changelog.md", "extension/LICENSE.txt",
                 "extension/README.zh-CN.md", "extension/SUPPORT.md", "extension/media/icon.png",
                 "extension/dist/webview/view.html", "extension/dist/webview/view.css", "extension/dist/webview/main.js",
                 "extension/dist/extension/extension.js",
                 "extension/package.nls.json", "extension/package.nls.zh.json", "extension/package.nls.zh-cn.json"):
        assert name in names, f"Missing public asset: {name}"
    allowed = ("extension/dist/extension/", "extension/dist/webview/", "extension/media/")
    docs = {"extension/package.json", "extension/readme.md", "extension/changelog.md",
            "extension/LICENSE.txt", "extension/README.zh-CN.md", "extension/SUPPORT.md",
            "extension/package.nls.json", "extension/package.nls.zh.json", "extension/package.nls.zh-cn.json"}
    translations = [json.loads(package.read(name)) for name in sorted(docs) if '/package.nls' in name]
    assert all(set(bundle) == set(translations[0]) for bundle in translations), "Incomplete packaged translations"
    for name in names:
        assert name in ("extension.vsixmanifest", "[Content_Types].xml") or name in docs or name.startswith(allowed), f"Unexpected file: {name}"
    readme = package.read("extension/readme.md").decode()
    assert "Browse Codex conversations by project" in readme
    assert "https://raw.githubusercontent.com/cixiangtao/codex-project-chats/main/docs/images/" in readme
print(f"Verified {archive.name}: {len(names)} public runtime/documentation files")
