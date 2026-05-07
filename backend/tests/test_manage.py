"""
Tests for the AgeGuesser management commands (manage.py).
"""

import io
import tarfile
import zipfile
import shutil
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock
from click.testing import CliRunner

import manage
from manage import cli, _extract_archive


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def runner():
    return CliRunner()


def _make_tar_gz(archive_path: Path, files: dict) -> None:
    """Create a .tar.gz archive with the given {name: content} mapping."""
    with tarfile.open(archive_path, "w:gz") as tf:
        for name, content in files.items():
            data = content.encode() if isinstance(content, str) else content
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))


def _make_zip(archive_path: Path, files: dict) -> None:
    """Create a .zip archive with the given {name: content} mapping."""
    with zipfile.ZipFile(archive_path, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)


# ---------------------------------------------------------------------------
# Unit tests – _extract_archive
# ---------------------------------------------------------------------------

class TestExtractArchive:
    def test_extracts_tar_gz(self, tmp_path):
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_tar_gz(archive, {
            "25_0_0_date.jpg": "fake jpeg",
            "30_1_2_date.jpg": "fake jpeg 2",
        })

        _extract_archive(archive, dest)

        files = [f.name for f in dest.iterdir()]
        assert "25_0_0_date.jpg" in files
        assert "30_1_2_date.jpg" in files

    def test_extracts_zip(self, tmp_path):
        archive = tmp_path / "archive.zip"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_zip(archive, {
            "10_0_3_date.png": "fake png",
            "20_1_1_date.jpg": "fake jpg",
        })

        _extract_archive(archive, dest)

        files = [f.name for f in dest.iterdir()]
        assert "10_0_3_date.png" in files
        assert "20_1_1_date.jpg" in files

    def test_flattens_subdirectories(self, tmp_path):
        """Images nested inside subdirectories should be moved to dest_dir."""
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_tar_gz(archive, {
            "subdir/part1/15_0_0_date.jpg": "img1",
            "subdir/part2/20_1_2_date.jpg": "img2",
        })

        _extract_archive(archive, dest)

        files = [f.name for f in dest.iterdir()]
        assert "15_0_0_date.jpg" in files
        assert "20_1_2_date.jpg" in files

    def test_skips_non_image_files(self, tmp_path):
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_tar_gz(archive, {
            "25_0_0_date.jpg": "img",
            "README.md": "readme",
            "labels.csv": "a,b,c",
        })

        _extract_archive(archive, dest)

        files = [f.name for f in dest.iterdir()]
        assert "25_0_0_date.jpg" in files
        assert "README.md" not in files
        assert "labels.csv" not in files

    def test_does_not_overwrite_existing_files(self, tmp_path):
        """Existing destination files should not be overwritten."""
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        original_content = b"original"
        (dest / "25_0_0_date.jpg").write_bytes(original_content)

        _make_tar_gz(archive, {"25_0_0_date.jpg": "new content"})

        _extract_archive(archive, dest)

        assert (dest / "25_0_0_date.jpg").read_bytes() == original_content

    def test_unknown_format_logs_warning(self, tmp_path):
        """An unrecognised archive format should log a warning and not crash."""
        archive = tmp_path / "archive.dat"
        dest = tmp_path / "dest"
        dest.mkdir()
        archive.write_bytes(b"not a real archive format at all")

        # Should not raise
        _extract_archive(archive, dest)
        # dest remains empty
        assert list(dest.iterdir()) == []

    def test_cleans_up_temp_directory(self, tmp_path):
        """The _extracted temp dir should be removed even on success."""
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_tar_gz(archive, {"1_0_0_date.jpg": "img"})
        _extract_archive(archive, dest)

        # The temp extraction dir should have been removed
        expected_tmp = archive.parent / (archive.name + "_extracted")
        assert not expected_tmp.exists()

    def test_count_of_moved_files(self, tmp_path, capsys):
        archive = tmp_path / "archive.tar.gz"
        dest = tmp_path / "dest"
        dest.mkdir()

        _make_tar_gz(archive, {
            "1_0_0_date.jpg": "a",
            "2_0_0_date.jpg": "b",
            "3_0_0_date.jpg": "c",
        })

        _extract_archive(archive, dest)
        # All 3 images should now be in dest
        assert len(list(dest.iterdir())) == 3


# ---------------------------------------------------------------------------
# Integration tests – CLI download command
# ---------------------------------------------------------------------------

class TestDownloadCli:
    def test_download_cropped_calls_gdown(self, runner, tmp_path):
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download") as mock_download, \
             patch("manage._extract_archive") as mock_extract:
            result = runner.invoke(cli, ["download", "--datasets", "cropped"])
            assert result.exit_code == 0
            assert mock_download.call_count == len(manage.CROPPED_PARTS)

    def test_download_wild_calls_gdown(self, runner, tmp_path):
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download") as mock_download, \
             patch("manage._extract_archive") as mock_extract:
            result = runner.invoke(cli, ["download", "--datasets", "wild"])
            assert result.exit_code == 0
            assert mock_download.call_count == 1

    def test_download_both_datasets_calls_gdown_for_all(self, runner, tmp_path):
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download") as mock_download, \
             patch("manage._extract_archive") as mock_extract:
            result = runner.invoke(cli, ["download", "--datasets", "cropped,wild"])
            assert result.exit_code == 0
            # cropped has 3 parts + wild has 1 = 4 total
            assert mock_download.call_count == len(manage.CROPPED_PARTS) + 1

    def test_download_skips_already_downloaded_archive(self, runner, tmp_path):
        """If archive already exists on disk, gdown should not be called for it."""
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download") as mock_download, \
             patch("manage._extract_archive") as mock_extract:

            # Pre-create the wild archive so it looks already downloaded
            tmp_wild = tmp_path / "_tmp_wild"
            tmp_wild.mkdir()
            _, archive_name = manage.WILD_ARCHIVE
            (tmp_wild / archive_name).write_bytes(b"existing")

            result = runner.invoke(cli, ["download", "--datasets", "wild"])
            assert result.exit_code == 0
            mock_download.assert_not_called()

    def test_unknown_dataset_is_ignored(self, runner, tmp_path):
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download"), \
             patch("manage._extract_archive"):
            result = runner.invoke(cli, ["download", "--datasets", "unknown"])
            # Should exit cleanly; unknown datasets are simply ignored
            assert result.exit_code == 0

    def test_download_output_contains_dataset_info(self, runner, tmp_path):
        with patch.object(manage, "DATA_DIR", tmp_path), \
             patch.object(manage, "DATASET_DIRS", {
                 "cropped": tmp_path / "UTKFace",
                 "wild": tmp_path / "in-the-wild",
             }), \
             patch("manage.gdown.download"), \
             patch("manage._extract_archive"):
            result = runner.invoke(cli, ["download", "--datasets", "cropped"])
            assert "cropped" in result.output.lower()
