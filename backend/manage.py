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
from uuid import uuid4

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
        if _has_images(DATASET_DIRS["cropped"]):
            click.echo("  Cropped faces already present, skipping download.")
        else:
            _download_cropped()

    if "wild" in selected:
        if _has_images(DATASET_DIRS["wild"]):
            click.echo("  Wild faces already present, skipping download.")
        else:
            _download_wild()

    _fix_swapped_dataset_dirs()

    click.echo("\n✓ Dataset download complete.")
    click.echo(f"  Cropped faces: {DATASET_DIRS['cropped']}")
    click.echo(f"  Wild faces:    {DATASET_DIRS['wild']}")


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------


def _download_cropped() -> None:
    """Download and extract the dataset mapped to the cropped directory."""
    dest_dir = DATASET_DIRS["cropped"]
    dest_dir.mkdir(parents=True, exist_ok=True)

    click.echo("\n→ Downloading cropped faces…")
    tmp_dir = DATA_DIR / "_tmp_cropped"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        file_id, archive_name = WILD_ARCHIVE
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
    """Download and extract the dataset mapped to the wild directory."""
    dest_dir = DATASET_DIRS["wild"]
    dest_dir.mkdir(parents=True, exist_ok=True)

    click.echo("\n→ Downloading in-the-wild faces (3 parts)…")
    tmp_dir = DATA_DIR / "_tmp_wild"
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

    click.echo(f"  Wild faces ready in {dest_dir}")


def _has_images(directory: Path) -> bool:
    """Return True if *directory* contains at least one image file."""
    if not directory.is_dir():
        return False
    valid_exts = {".jpg", ".jpeg", ".png"}
    for path in directory.iterdir():
        if path.is_file() and path.suffix.lower() in valid_exts:
            return True
    return False


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


def _looks_like_cropped(directory: Path, sample_size: int = 50) -> bool:
    """
    Heuristic for the 3-part UTKFace archive split downloaded by this project.

    That split commonly contains names like `...jpg.chip.jpg`.
    Returns True when such names are seen within the first *sample_size* images.
    """
    valid_exts = {".jpg", ".jpeg", ".png"}
    checked = 0
    for path in directory.iterdir():
        if not path.is_file() or path.suffix.lower() not in valid_exts:
            continue
        checked += 1
        if ".chip." in path.name.lower():
            return True
        if checked >= sample_size:
            break
    return False


def _fix_swapped_dataset_dirs() -> None:
    """
    Swap dataset directories when downloaded content appears reversed.

    This handles cases where remote archives are mislabeled upstream.
    """
    cropped_dir = DATASET_DIRS["cropped"]
    wild_dir = DATASET_DIRS["wild"]
    if not cropped_dir.is_dir() or not wild_dir.is_dir():
        return

    cropped_looks_cropped = _looks_like_cropped(cropped_dir)
    wild_looks_cropped = _looks_like_cropped(wild_dir)

    # Expected mapping is: cropped -> single archive, wild -> 3-part split.
    # Swap only when cropped looks like the 3-part split and wild does not.
    if not cropped_looks_cropped or wild_looks_cropped:
        return

    tmp_dir = DATA_DIR / f"_tmp_dataset_swap_{uuid4().hex}"
    try:
        cropped_dir.rename(tmp_dir)
        wild_dir.rename(cropped_dir)
        tmp_dir.rename(wild_dir)
    except OSError:
        # Step 2 succeeded but step 3 failed: restore original paths.
        if cropped_dir.exists() and tmp_dir.exists() and not wild_dir.exists():
            cropped_dir.rename(wild_dir)
            tmp_dir.rename(cropped_dir)
        # Step 1 succeeded but step 2 failed: restore cropped path.
        elif tmp_dir.exists() and not cropped_dir.exists():
            tmp_dir.rename(cropped_dir)
        raise
    click.echo("  Detected swapped datasets, fixed directory mapping automatically.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cli()
