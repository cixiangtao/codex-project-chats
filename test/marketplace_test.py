"""Release recovery must reject an existing version with different extension content."""
import importlib.util
import io
from pathlib import Path
import unittest
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('marketplace', Path(__file__).resolve().parents[1] / 'scripts/marketplace.py')
marketplace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(marketplace)


def archive(content, signing=False):
    result = io.BytesIO()
    with ZipFile(result, 'w') as package:
        for name, value in content.items():
            package.writestr(name, value)
        if signing:
            package.writestr('Signature.p7s', 'server signature')
    return result.getvalue()


class PayloadVerification(unittest.TestCase):
    def test_rejects_extra_extension_files(self):
        data = {'extension/package.json': '{}'}
        with self.assertRaises(ValueError):
            marketplace.compare_payload(archive(data), archive({**data, 'extension/extra.js': 'unexpected'}))

    def test_allows_only_container_signature_additions(self):
        data = {'extension/package.json': '{"version":"0.1.2"}', 'extension/dist/extension.js': 'trusted code', 'extension/readme.md': 'public docs'}
        marketplace.compare_payload(archive(data), archive(data, signing=True))

    def test_rejects_changed_runtime_or_documentation_and_missing_files(self):
        data = {'extension/package.json': '{}', 'extension/dist/extension.js': 'trusted code', 'extension/readme.md': 'public docs'}
        for name in data:
            changed = dict(data)
            changed[name] = 'different'
            with self.assertRaises(ValueError):
                marketplace.compare_payload(archive(data), archive(changed))
            del changed[name]
            with self.assertRaises(ValueError):
                marketplace.compare_payload(archive(data), archive(changed))


if __name__ == '__main__':
    unittest.main()
