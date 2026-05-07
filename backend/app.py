"""
AgeGuesser Flask backend.

Serves face images from the UTKFace dataset and provides a random-image
selection endpoint filtered by age, gender, race, resolution and dataset type.

Dataset must be downloaded first:
    python manage.py download
"""

from __future__ import annotations

import os
import re
import random
import sys
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
from PIL import Image

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
DATASET_DIRS: dict[str, Path] = {
    "cropped": DATA_DIR / "UTKFace",
    "wild": DATA_DIR / "in-the-wild",
}

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    _check_dataset()
    _register_routes(app)
    return app


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

VALID_IMAGE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png"}


def _check_dataset() -> None:
    """Warn on startup if no dataset images are found."""
    found = any(
        path.is_dir() and bool(_list_images(path))
        for path in DATASET_DIRS.values()
    )

    if not found:
        print(
            "\n"
            "╔══════════════════════════════════════════════════════════╗\n"
            "║  WARNING: UTKFace dataset not found!                     ║\n"
            "║                                                          ║\n"
            "║  Download and prepare the dataset by running:            ║\n"
            "║                                                          ║\n"
            "║      python manage.py download                           ║\n"
            "║                                                          ║\n"
            "║  /api/random returns 404 until images are available.     ║\n"
            "╚══════════════════════════════════════════════════════════╝\n",
            file=sys.stderr,
        )


def _list_images(directory: Path) -> list[str]:
    """Return a list of image filenames in *directory*."""
    try:
        return [
            entry.name
            for entry in directory.iterdir()
            if entry.suffix.lower() in VALID_IMAGE_EXTENSIONS
        ]
    except OSError:
        return []


def _parse_filename(filename: str) -> dict[str, int] | None:
    """
    Parse a UTKFace filename into age, gender, race.

    Filename format: [age]_[gender]_[race]_[date&time].jpg
    Returns None if the filename cannot be parsed.
    """
    stem = Path(filename).stem
    parts = stem.split("_")
    if len(parts) < 3:
        return None
    try:
        age = int(parts[0])
        gender = int(parts[1])
        race = int(parts[2])
        return {"age": age, "gender": gender, "race": race}
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Resolution helpers
# ---------------------------------------------------------------------------

# Pixel threshold (smaller image dimension) that separates resolution classes.
_RESOLUTION_HIGH_THRESHOLD: int = 300
_RESOLUTION_LOW_THRESHOLD: int = 100

def _classify_resolution(width: int, height: int) -> str:
    """Classify an image into 'low', 'medium', or 'high' based on its dimensions."""
    smaller = min(width, height)
    if smaller > _RESOLUTION_HIGH_THRESHOLD:
        return "high"
    if smaller >= _RESOLUTION_LOW_THRESHOLD:
        return "medium"
    return "low"


# LRU cache (max 65 536 entries) so each file path is read at most once per
# process while preventing unbounded memory growth.
@lru_cache(maxsize=65536)
def _get_image_resolution(path: Path) -> str:
    """
    Return the resolution class ('low', 'medium', or 'high') for the image at
    *path*, reading dimensions via Pillow.  Results are cached so each file is
    read at most once per process.
    """
    try:
        with Image.open(path) as img:
            width, height = img.size
        return _classify_resolution(width, height)
    except Exception:
        return "medium"  # fallback for unreadable images


def _build_image_index(datasets: list[str]) -> list[dict[str, str | int]]:
    """
    Build an in-memory list of all matching images across the requested
    datasets.  Returns a list of dicts with keys: dataset, filename, age,
    gender, race, resolution.
    """
    index: list[dict[str, str | int]] = []
    for ds in datasets:
        directory = DATASET_DIRS.get(ds)
        if directory is None or not directory.is_dir():
            continue
        for filename in _list_images(directory):
            meta = _parse_filename(filename)
            if meta is None:
                continue
            resolution = _get_image_resolution(directory / filename)
            index.append(
                {
                    "dataset": ds,
                    "filename": filename,
                    "age": meta["age"],
                    "gender": meta["gender"],
                    "race": meta["race"],
                    "resolution": resolution,
                }
            )
    return index


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


def _register_routes(app: Flask) -> None:

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/image/<dataset>/<filename>")
    def get_image(dataset: str, filename: str):
        """Serve a single image file from the dataset."""
        if dataset not in DATASET_DIRS:
            return jsonify({"error": "Unknown dataset"}), 404

        # Quick pre-validation: reject filenames with unsafe characters.
        if not re.fullmatch(r"[A-Za-z0-9._\-]+", filename):
            return jsonify({"error": "Forbidden"}), 403

        directory = DATASET_DIRS[dataset]

        # Look up the file by listing the directory.  We intentionally use the
        # filesystem-sourced name (known_filename) in the path construction –
        # not the user-supplied value – so that path injection is impossible.
        for known_filename in _list_images(directory):
            if known_filename == filename:
                return send_file(directory / known_filename)

        return jsonify({"error": "Image not found"}), 404

    @app.route("/api/random")
    def get_random():
        """
        Return a random image matching the given filter criteria.

        Query parameters:
            min_age      (int, default 0)
            max_age      (int, default 116)
            genders      (comma-separated ints, default 0,1)
            races        (comma-separated ints, default 0,1,2,3,4)
            resolutions  (comma-separated strings, default low,medium,high)
            datasets     (comma-separated strings, default cropped,wild)
        """
        try:
            min_age = int(request.args.get("min_age", 0))
            max_age = int(request.args.get("max_age", 116))
        except ValueError:
            return jsonify({"error": "min_age and max_age must be integers"}), 400

        genders_raw = request.args.get("genders", "0,1")
        races_raw = request.args.get("races", "0,1,2,3,4")
        resolutions_raw = request.args.get("resolutions", "low,medium,high")
        datasets_raw = request.args.get("datasets", "cropped,wild")

        try:
            genders = [int(g) for g in genders_raw.split(",") if g.strip()]
            races = [int(r) for r in races_raw.split(",") if r.strip()]
        except ValueError:
            return jsonify({"error": "genders and races must be comma-separated integers"}), 400

        resolutions = [r.strip() for r in resolutions_raw.split(",") if r.strip()]
        if not resolutions:
            return jsonify({"error": "At least one resolution must be specified"}), 400

        datasets = [d.strip() for d in datasets_raw.split(",") if d.strip()]
        if not datasets:
            return jsonify({"error": "At least one dataset must be specified"}), 400

        index = _build_image_index(datasets)

        candidates = [
            img
            for img in index
            if (min_age <= img["age"] <= max_age)
            and (img["gender"] in genders)
            and (img["race"] in races)
            and (img["resolution"] in resolutions)
        ]

        if not candidates:
            return jsonify({"error": "No images match the given criteria"}), 404

        chosen = random.choice(candidates)
        return jsonify(
            {
                "dataset": chosen["dataset"],
                "filename": chosen["filename"],
                "age": chosen["age"],
                "gender": chosen["gender"],
                "race": chosen["race"],
                "resolution": chosen["resolution"],
                "url": f"/api/image/{chosen['dataset']}/{chosen['filename']}",
            }
        )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
