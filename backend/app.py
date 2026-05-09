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
import json
from functools import lru_cache
from pathlib import Path
from uuid import uuid4
from datetime import date

from flask import Flask, jsonify, send_file, request, session
from flask_cors import CORS
from PIL import Image
from werkzeug.security import check_password_hash

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
DATASET_DIRS: dict[str, Path] = {
    "cropped": DATA_DIR / "UTKFace",
    "wild": DATA_DIR / "in-the-wild",
}
CUSTOM_DATASET_ROOT: str = "custom-datasets"
DATASET_METADATA_FILE: str = "_metadata.json"
ADMIN_ACCOUNTS_FILE: str = "admins.json"

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get(
        "AGEGUESSER_SECRET_KEY",
        "ageguesser-dev-secret",
    )
    CORS(app)

    _check_dataset()
    _register_routes(app)
    return app


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

VALID_IMAGE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png"}


def _is_safe_dataset_name(dataset: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_\-]+", dataset))


def _custom_dataset_root() -> Path:
    return DATA_DIR / CUSTOM_DATASET_ROOT


def _dataset_metadata_path(dataset: str) -> Path:
    return _get_dataset_dir(dataset, create_if_missing=True) / DATASET_METADATA_FILE


def _admins_file_path() -> Path:
    return DATA_DIR / ADMIN_ACCOUNTS_FILE


def _get_dataset_dirs() -> dict[str, Path]:
    dataset_dirs = DATASET_DIRS.copy()
    custom_root = _custom_dataset_root()
    if custom_root.is_dir():
        for entry in custom_root.iterdir():
            if entry.is_dir() and _is_safe_dataset_name(entry.name):
                dataset_dirs[entry.name] = entry
    return dataset_dirs


def _get_dataset_dir(dataset: str, create_if_missing: bool = False) -> Path:
    if dataset in DATASET_DIRS:
        return DATASET_DIRS[dataset]
    if not _is_safe_dataset_name(dataset):
        raise ValueError("Invalid dataset name")
    directory = _custom_dataset_root() / dataset
    if create_if_missing:
        directory.mkdir(parents=True, exist_ok=True)
    return directory


def _load_dataset_metadata(dataset: str) -> dict[str, dict[str, int | str]]:
    path = _dataset_metadata_path(dataset)
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}

    data: dict[str, dict[str, int | str]] = {}
    for filename, meta in payload.items():
        if isinstance(filename, str) and isinstance(meta, dict):
            try:
                data[filename] = {
                    "age": int(meta["age"]),
                    "gender": int(meta["gender"]),
                    "race": int(meta["race"]),
                    "age_mode": str(meta.get("age_mode", "years")),
                    "dob": str(meta.get("dob", "")),
                    "picture_date": str(meta.get("picture_date", "")),
                    "years_old_at_upload": str(meta.get("years_old_at_upload", "")),
                }
            except (KeyError, TypeError, ValueError):
                continue
    return data


def _save_dataset_metadata(dataset: str, metadata: dict[str, dict[str, int | str]]) -> None:
    path = _dataset_metadata_path(dataset)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8")


def _load_admins() -> dict[str, str]:
    path = _admins_file_path()
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    return {
        str(username): str(password_hash)
        for username, password_hash in payload.items()
    }


def _is_logged_in_admin() -> bool:
    username = session.get("admin_username")
    return isinstance(username, str) and username in _load_admins()


def _check_dataset() -> None:
    """Warn on startup if no dataset images are found."""
    found = any(
        path.is_dir() and bool(_list_images(path))
        for path in _get_dataset_dirs().values()
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
        if not _is_safe_dataset_name(ds):
            continue
        directory = _get_dataset_dir(ds)
        if not directory.is_dir():
            continue
        metadata = _load_dataset_metadata(ds)
        for filename in _list_images(directory):
            meta_from_file = _parse_filename(filename)
            meta: dict[str, int] | None
            if filename in metadata:
                meta = {
                    "age": int(metadata[filename]["age"]),
                    "gender": int(metadata[filename]["gender"]),
                    "race": int(metadata[filename]["race"]),
                }
            else:
                meta = meta_from_file
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
# Filter helpers (shared by /api/random and /api/count)
# ---------------------------------------------------------------------------

# Typed exception classes for validation failures so that route handlers can
# return completely static error-message literals with no tainted data flow.
class _BadAgeParams(Exception):
    """Raised when min_age / max_age cannot be parsed as integers."""

class _BadGenderRaceParams(Exception):
    """Raised when genders or races contain non-integer values."""

class _EmptyResolutions(Exception):
    """Raised when the resolutions list is empty after parsing."""

class _EmptyDatasets(Exception):
    """Raised when the datasets list is empty after parsing."""


def _parse_filter_params(
    args: dict[str, str],
) -> dict:
    """
    Parse and validate common filter query parameters.

    Returns a dict with keys: min_age, max_age, genders, races,
    resolutions, datasets.

    Raises a typed exception (no payload) on validation failure so that
    callers can respond with fully static error-message literals.
    """
    try:
        min_age = int(args.get("min_age", 0))
        max_age = int(args.get("max_age", 116))
    except ValueError:
        raise _BadAgeParams()

    genders_raw = args.get("genders", "0,1")
    races_raw = args.get("races", "0,1,2,3,4")
    resolutions_raw = args.get("resolutions", "low,medium,high")
    datasets_raw = args.get("datasets", "cropped,wild")

    try:
        genders = [int(g) for g in genders_raw.split(",") if g.strip()]
        races = [int(r) for r in races_raw.split(",") if r.strip()]
    except ValueError:
        raise _BadGenderRaceParams()

    resolutions = [r.strip() for r in resolutions_raw.split(",") if r.strip()]
    if not resolutions:
        raise _EmptyResolutions()

    datasets = [d.strip() for d in datasets_raw.split(",") if d.strip()]
    if not datasets:
        raise _EmptyDatasets()

    return {
        "min_age": min_age,
        "max_age": max_age,
        "genders": genders,
        "races": races,
        "resolutions": resolutions,
        "datasets": datasets,
    }


def _filter_candidates(
    params: dict,
) -> list[dict[str, str | int]]:
    """Return all images matching the given filter parameters."""
    index = _build_image_index(params["datasets"])
    return [
        img
        for img in index
        if (params["min_age"] <= img["age"] <= params["max_age"])
        and (img["gender"] in params["genders"])
        and (img["race"] in params["races"])
        and (img["resolution"] in params["resolutions"])
    ]


def _years_between_dates(start: date, end: date) -> int:
    years = end.year - start.year
    if (end.month, end.day) < (start.month, start.day):
        years -= 1
    return years


def _parse_add_image_metadata(form: dict[str, str]) -> dict[str, int | str]:
    age_mode = form.get("age_mode", "")
    if age_mode not in {"years", "dob_taken", "dob_uploaded_years"}:
        raise ValueError("Invalid age mode")

    try:
        gender = int(form.get("gender", ""))
        race = int(form.get("race", ""))
    except ValueError as exc:
        raise ValueError("gender and race must be integers") from exc

    if gender not in {0, 1}:
        raise ValueError("gender must be 0 or 1")
    if race not in {0, 1, 2, 3, 4}:
        raise ValueError("race must be 0,1,2,3,4")

    dob_raw = form.get("dob", "")
    picture_date_raw = form.get("picture_date", "")
    years_old_raw = form.get("years_old_at_upload", "")

    if age_mode == "years":
        try:
            age = int(form.get("age", ""))
        except ValueError as exc:
            raise ValueError("age must be an integer") from exc
    elif age_mode == "dob_taken":
        if not dob_raw or not picture_date_raw:
            raise ValueError("dob and picture_date are required")
        dob = date.fromisoformat(dob_raw)
        picture_date = date.fromisoformat(picture_date_raw)
        if picture_date < dob:
            raise ValueError("picture_date must be on/after dob")
        age = _years_between_dates(dob, picture_date)
    else:
        if not dob_raw:
            raise ValueError("dob is required")
        date.fromisoformat(dob_raw)
        try:
            age = int(years_old_raw)
        except ValueError as exc:
            raise ValueError("years_old_at_upload must be an integer") from exc

    if age < 0 or age > 116:
        raise ValueError("age must be between 0 and 116")

    return {
        "age_mode": age_mode,
        "age": age,
        "gender": gender,
        "race": race,
        "dob": dob_raw,
        "picture_date": picture_date_raw,
        "years_old_at_upload": years_old_raw,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


def _register_routes(app: Flask) -> None:

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/datasets")
    def list_datasets():
        items = []
        for name, directory in sorted(_get_dataset_dirs().items()):
            image_count = len(_list_images(directory))
            items.append(
                {
                    "name": name,
                    "count": image_count,
                    "is_default": name in DATASET_DIRS,
                }
            )
        return jsonify({"datasets": items})

    @app.route("/api/admin/status")
    def admin_status():
        username = session.get("admin_username") if _is_logged_in_admin() else None
        return jsonify(
            {
                "logged_in": bool(username),
                "username": username,
            }
        )

    @app.route("/api/admin/login", methods=["POST"])
    def admin_login():
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        admins = _load_admins()
        password_hash = admins.get(username)
        if not password_hash or not check_password_hash(password_hash, password):
            return jsonify({"error": "Invalid username or password"}), 401
        session["admin_username"] = username
        return jsonify({"ok": True, "username": username})

    @app.route("/api/admin/logout", methods=["POST"])
    def admin_logout():
        session.pop("admin_username", None)
        return jsonify({"ok": True})

    @app.route("/api/admin/datasets")
    def admin_list_datasets():
        if not _is_logged_in_admin():
            return jsonify({"error": "Unauthorized"}), 401
        return list_datasets()

    @app.route("/api/admin/datasets/<dataset>/preview")
    def admin_dataset_preview(dataset: str):
        if not _is_logged_in_admin():
            return jsonify({"error": "Unauthorized"}), 401
        if not _is_safe_dataset_name(dataset):
            return jsonify({"error": "Invalid dataset"}), 400
        directory = _get_dataset_dir(dataset)
        if not directory.is_dir():
            return jsonify({"error": "Dataset not found"}), 404
        try:
            limit = int(request.args.get("limit", 24))
        except ValueError:
            return jsonify({"error": "limit must be an integer"}), 400
        limit = max(1, min(limit, 100))
        indexed = _build_image_index([dataset])
        preview = [
            {
                "filename": item["filename"],
                "age": item["age"],
                "gender": item["gender"],
                "race": item["race"],
                "url": f"/api/image/{dataset}/{item['filename']}",
            }
            for item in indexed[:limit]
        ]
        return jsonify({"dataset": dataset, "images": preview})

    @app.route("/api/admin/datasets/<dataset>/add-image", methods=["POST"])
    def admin_add_dataset_image(dataset: str):
        if not _is_logged_in_admin():
            return jsonify({"error": "Unauthorized"}), 401
        if not _is_safe_dataset_name(dataset):
            return jsonify({"error": "Invalid dataset name"}), 400

        upload = request.files.get("image")
        if upload is None or not upload.filename:
            return jsonify({"error": "image file is required"}), 400

        ext = Path(upload.filename).suffix.lower()
        if ext not in VALID_IMAGE_EXTENSIONS:
            return jsonify({"error": "Unsupported image format"}), 400

        try:
            metadata = _parse_add_image_metadata(request.form)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        directory = _get_dataset_dir(dataset, create_if_missing=True)
        stem = re.sub(r"[^A-Za-z0-9_\-]", "_", Path(upload.filename).stem)[:40] or "image"
        filename = f"{stem}_{uuid4().hex[:8]}{ext}"
        destination = directory / filename
        upload.save(destination)
        _get_image_resolution.cache_clear()

        metadata_map = _load_dataset_metadata(dataset)
        metadata_map[filename] = metadata
        _save_dataset_metadata(dataset, metadata_map)

        return jsonify(
            {
                "dataset": dataset,
                "filename": filename,
                "age": metadata["age"],
                "gender": metadata["gender"],
                "race": metadata["race"],
                "url": f"/api/image/{dataset}/{filename}",
            }
        )

    @app.route("/api/image/<dataset>/<filename>")
    def get_image(dataset: str, filename: str):
        """Serve a single image file from the dataset."""
        if not _is_safe_dataset_name(dataset):
            return jsonify({"error": "Unknown dataset"}), 404

        directory = _get_dataset_dir(dataset)
        if not directory.is_dir():
            return jsonify({"error": "Unknown dataset"}), 404

        # Quick pre-validation: reject filenames with unsafe characters.
        if not re.fullmatch(r"[A-Za-z0-9._\-]+", filename):
            return jsonify({"error": "Forbidden"}), 403

        # Look up the file by listing the directory.  We intentionally use the
        # filesystem-sourced name (known_filename) in the path construction –
        # not the user-supplied value – so that path injection is impossible.
        for known_filename in _list_images(directory):
            if known_filename == filename:
                return send_file(directory / known_filename)

        return jsonify({"error": "Image not found"}), 404

    @app.route("/api/count")
    def get_count():
        """
        Return the number of images matching the given filter criteria.

        Query parameters: same as /api/random
        """
        try:
            params = _parse_filter_params(request.args)
        except _BadAgeParams:
            return jsonify({"error": "min_age and max_age must be integers"}), 400
        except _BadGenderRaceParams:
            return jsonify({"error": "genders and races must be comma-separated integers"}), 400
        except _EmptyResolutions:
            return jsonify({"error": "At least one resolution must be specified"}), 400
        except _EmptyDatasets:
            return jsonify({"error": "At least one dataset must be specified"}), 400

        count = len(_filter_candidates(params))
        return jsonify({"count": count})

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
            params = _parse_filter_params(request.args)
        except _BadAgeParams:
            return jsonify({"error": "min_age and max_age must be integers"}), 400
        except _BadGenderRaceParams:
            return jsonify({"error": "genders and races must be comma-separated integers"}), 400
        except _EmptyResolutions:
            return jsonify({"error": "At least one resolution must be specified"}), 400
        except _EmptyDatasets:
            return jsonify({"error": "At least one dataset must be specified"}), 400

        candidates = _filter_candidates(params)

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
