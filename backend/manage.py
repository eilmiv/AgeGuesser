"""
AgeGuesser management commands.

Usage:
    python manage.py download [--datasets cropped,wild]
"""

import os
import tarfile
import zipfile
import shutil
import sys

import click
import gdown

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

# ---------------------------------------------------------------------------
# UTKFace download configuration
#
# The UTKFace dataset is hosted on Google Drive.  The file IDs below are from
# the official dataset page: https://susanqq.github.io/UTKFace/
# ---------------------------------------------------------------------------

CROPPED_PARTS = [
    # part1, part2, part3 of the aligned & cropped faces
    ("1mb08GBt4_IXkm_RKWaXs0FGhfIexz7E-", "part1.tar.gz"),
    ("1hxqeGlkbDk7GCMH5YJMOWgJdIvBFRjkU", "part2.tar.gz"),
    ("1GFmBVBXaFBTFd9qVYh2PNNKqN6Y4qGiI", "part3.tar.gz"),
]

WILD_ARCHIVE = (
    "1HBM4GAnCx9we7Y-2u9u6Apu5PqBZJJpV",
    "UTKFace_wild.tar.gz",
)

DATASET_DIRS = {
    "cropped": os.path.join(DATA_DIR, "UTKFace"),
    "wild": os.path.join(DATA_DIR, "in-the-wild"),
}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.group()
def cli():
    """AgeGuesser management commands."""


@cli.command()
@click.option(
    "--datasets",
    default="cropped,wild",
    show_default=True,
    help="Comma-separated list of datasets to download: cropped, wild",
)
def download(datasets):
    """Download and prepare the UTKFace dataset."""
    os.makedirs(DATA_DIR, exist_ok=True)
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


def _download_cropped():
    """Download and extract the aligned & cropped faces dataset."""
    dest_dir = DATASET_DIRS["cropped"]
    os.makedirs(dest_dir, exist_ok=True)

    click.echo("\n→ Downloading cropped faces (3 parts)…")
    tmp_dir = os.path.join(DATA_DIR, "_tmp_cropped")
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        for file_id, archive_name in CROPPED_PARTS:
            archive_path = os.path.join(tmp_dir, archive_name)
            if os.path.exists(archive_path):
                click.echo(f"  {archive_name} already downloaded, skipping.")
            else:
                click.echo(f"  Downloading {archive_name}…")
                url = f"https://drive.google.com/uc?id={file_id}"
                gdown.download(url, archive_path, quiet=False)

            click.echo(f"  Extracting {archive_name}…")
            _extract_archive(archive_path, dest_dir)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    click.echo(f"  Cropped faces ready in {dest_dir}")


def _download_wild():
    """Download and extract the in-the-wild faces dataset."""
    dest_dir = DATASET_DIRS["wild"]
    os.makedirs(dest_dir, exist_ok=True)

    click.echo("\n→ Downloading in-the-wild faces…")
    file_id, archive_name = WILD_ARCHIVE
    tmp_dir = os.path.join(DATA_DIR, "_tmp_wild")
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        archive_path = os.path.join(tmp_dir, archive_name)
        if os.path.exists(archive_path):
            click.echo(f"  {archive_name} already downloaded, skipping.")
        else:
            url = f"https://drive.google.com/uc?id={file_id}"
            gdown.download(url, archive_path, quiet=False)

        click.echo(f"  Extracting {archive_name}…")
        _extract_archive(archive_path, dest_dir)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    click.echo(f"  Wild faces ready in {dest_dir}")


def _extract_archive(archive_path, dest_dir):
    """Extract a .tar.gz or .zip archive, moving images to dest_dir."""
    tmp_extract = archive_path + "_extracted"
    os.makedirs(tmp_extract, exist_ok=True)
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
        for root, _dirs, files in os.walk(tmp_extract):
            for fname in files:
                if os.path.splitext(fname)[1].lower() in valid_exts:
                    src = os.path.join(root, fname)
                    dst = os.path.join(dest_dir, fname)
                    if not os.path.exists(dst):
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
