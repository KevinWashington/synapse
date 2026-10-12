"""Backup validation must reject damaged or incomplete recovery sets."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "backup-production.py"


class BackupSafetyTests(unittest.TestCase):
    def load(self):
        self.assertTrue(SCRIPT.exists(), "Production backup implementation is missing")
        spec = importlib.util.spec_from_file_location("production_backup", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_corrupt_archive_is_rejected(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "postgres.dump").write_bytes(b"damaged")
            (path / "manifest.json").write_text(json.dumps({"files": {"postgres.dump": "0" * 64}}))
            with self.assertRaisesRegex(ValueError, "checksum"):
                module.verify_files(path)

    def test_missing_archive_is_rejected(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "manifest.json").write_text(json.dumps({"files": {"postgres.dump": "0" * 64}}))
            with self.assertRaisesRegex(ValueError, "missing"):
                module.verify_files(path)

    def test_parent_path_in_manifest_is_rejected(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "manifest.json").write_text(json.dumps({"files": {"../secret": "0" * 64}}))
            with self.assertRaisesRegex(ValueError, "path"):
                module.verify_files(path)

    def test_empty_backup_manifest_is_rejected(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "manifest.json").write_text('{"files": {}}')
            with self.assertRaisesRegex(ValueError, "empty"):
                module.verify_files(path)


if __name__ == "__main__":
    unittest.main()
