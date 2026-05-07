"""
AgeGuesser management commands.

Usage:
    python manage.py download [--datasets cropped,wild]
"""

from __future__ import annotations

import shutil
import tarfile
import zipfile
from pathlib import Path

import click
import gdown

BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"

# ---------------------------------------------------------------------------
# UTKFace download configuration
#
# The UTKFace dataset is hosted on Google Drive.  The file IDs below are from
# the official dataset page: https://susanqq.github.io/UTKFace/
# ---------------------------------------------------------------------------

CROPPED_PARTS: list[tuple[str, str]] = [
    # part1, part2, part3 of the aligned & cropped faces
    # IDs sourced from the official UTKFace dataset page
    ("1mb5Z24TsnKI3ygNIlX6ZFiwUj0_PmpAW", "part1.tar.gz"),
    ("19vdaXVRtkP-nyxz1MYwXiFsh_m_OL72b", "part2.tar.gz"),
    ("1oj9ZWsLV2-k2idoW_nRSrLQLUP3hus3b", "part3.tar.gz"),
]

WILD_ARCHIVE: tuple[str, str] = (
    # ID sourced from the official UTKFace dataset page
    "1W-vm-rgSDsPA015wQQ9vWzquR_KvgBwe",
    "UTKFace_wild.tar.gz",
)

DATASET_DIRS: dict[str, Path] = {
    "cropped": DATA_DIR / "UTKFace",
    "wild": DATA_DIR / "in-the-wild",
}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.group()
def cli() -> None:
    """AgeGuesser management commands."""


@cli.command()
@click.option(
    "--datasets",
    default="cropped,wild",
    show_default=True,
    help="Comma-separated list of datasets to download: cropped, wild",
)
def download(datasets: str) -> None:
    """Download and prepare the UTKFace dataset."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    selected = [d.strip() for d in datasets.split(",") if d.strip()]

    if "cropped" in selected:
        _download_cropped()

    if "wild" in selected:
        _download_wild()

    click.echo("\n✓ Dataset download complete.")
    click.echo(f"  Cropped faces: {DATASET_DIRS['cropped']}")
    click.echo(f"  Wild faces:    {DATASET_DIRS['wild']}")


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------


def _download_cropped() -> None:
    """Download and extract the aligned & cropped faces dataset."""
    dest_dir = DATASET_DIRS["cropped"]
    dest_dir.mkdir(parents=True, exist_ok=True)

    click.echo("\n→ Downloading cropped faces (3 parts)…")
    tmp_dir = DATA_DIR / "_tmp_cropped"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        for file_id, archive_name in CROPPED_PARTS:
            archive_path = tmp_dir / archive_name
            if archive_path.exists():
                click.echo(f"  {archive_name} already downloaded, skipping.")
            else:
                click.echo(f"  Downloading {archive_name}…")
                url = f"https://drive.google.com/uc?id={file_id}"
                gdown.download(url, str(archive_path), quiet=False)

            click.echo(f"  Extracting {archive_name}…")
            _extract_archive(archive_path, dest_dir)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    click.echo(f"  Cropped faces ready in {dest_dir}")


def _download_wild() -> None:
    """Download and extract the in-the-wild faces dataset."""
    dest_dir = DATASET_DIRS["wild"]
    dest_dir.mkdir(parents=True, exist_ok=True)

    click.echo("\n→ Downloading in-the-wild faces…")
    file_id, archive_name = WILD_ARCHIVE
    tmp_dir = DATA_DIR / "_tmp_wild"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        archive_path = tmp_dir / archive_name
        if archive_path.exists():
            click.echo(f"  {archive_name} already downloaded, skipping.")
        else:
            url = f"https://drive.google.com/uc?id={file_id}"
            gdown.download(url, str(archive_path), quiet=False)

        click.echo(f"  Extracting {archive_name}…")
        _extract_archive(archive_path, dest_dir)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    click.echo(f"  Wild faces ready in {dest_dir}")


def _extract_archive(archive_path: Path, dest_dir: Path) -> None:
    """Extract a .tar.gz or .zip archive, moving images to dest_dir."""
    tmp_extract = archive_path.parent / (archive_path.name + "_extracted")
    tmp_extract.mkdir(parents=True, exist_ok=True)
    try:
        if tarfile.is_tarfile(archive_path):
            with tarfile.open(archive_path, "r:gz") as tf:
                tf.extractall(tmp_extract)
        elif zipfile.is_zipfile(archive_path):
            with zipfile.ZipFile(archive_path, "r") as zf:
                zf.extractall(tmp_extract)
        else:
            click.echo(f"  WARNING: Unknown archive format for {archive_path}", err=True)
            return

        # Move all image files to dest_dir (flatten subdirectories)
        valid_exts = {".jpg", ".jpeg", ".png"}
        count = 0
        for src in tmp_extract.rglob("*"):
            if src.is_file() and src.suffix.lower() in valid_exts:
                dst = dest_dir / src.name
                if not dst.exists():
                    shutil.move(src, dst)
                    count += 1
        click.echo(f"    Moved {count} image(s) to {dest_dir}")
    finally:
        shutil.rmtree(tmp_extract, ignore_errors=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cli()
