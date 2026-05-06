"""
Tests for the AgeGuesser Flask backend.
"""

import os
import shutil
import pytest
from app import create_app, _parse_filename, _list_images


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def app(tmp_path):
    """Create a Flask app with a temporary data directory containing mock images."""
    cropped_dir = tmp_path / "UTKFace"
    cropped_dir.mkdir()

    # Create a few mock image files with valid UTKFace filenames
    mock_images = [
        "25_0_0_20170110183900092.jpg",  # age 25, male, white
        "30_1_1_20170110184000045.jpg",  # age 30, female, black
        "45_0_2_20170110184100023.jpg",  # age 45, male, asian
        "60_1_3_20170110184200001.jpg",  # age 60, female, indian
        "10_0_4_20170110184300099.jpg",  # age 10, male, other
    ]
    for name in mock_images:
        (cropped_dir / name).write_text("fake image data")

    # Patch DATA_DIR to point to tmp_path
    import app as app_module
    original_data_dir = app_module.DATA_DIR
    original_dataset_dirs = app_module.DATASET_DIRS.copy()

    app_module.DATA_DIR = str(tmp_path)
    app_module.DATASET_DIRS["cropped"] = str(cropped_dir)
    app_module.DATASET_DIRS["wild"] = str(tmp_path / "in-the-wild")

    flask_app = create_app()
    flask_app.config["TESTING"] = True

    yield flask_app

    # Restore original paths
    app_module.DATA_DIR = original_data_dir
    app_module.DATASET_DIRS.update(original_dataset_dirs)


@pytest.fixture
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Unit tests – helpers
# ---------------------------------------------------------------------------

class TestParseFilename:
    def test_valid_filename(self):
        result = _parse_filename("25_0_2_20170110183900092.jpg")
        assert result == {"age": 25, "gender": 0, "race": 2}

    def test_valid_filename_png(self):
        result = _parse_filename("100_1_4_20170110.png")
        assert result == {"age": 100, "gender": 1, "race": 4}

    def test_invalid_filename_too_few_parts(self):
        assert _parse_filename("25_0.jpg") is None

    def test_invalid_filename_non_numeric(self):
        assert _parse_filename("abc_def_ghi_date.jpg") is None


class TestListImages:
    def test_returns_images(self, tmp_path):
        (tmp_path / "1_0_0_date.jpg").write_text("")
        (tmp_path / "2_1_1_date.png").write_text("")
        (tmp_path / "readme.txt").write_text("")
        images = _list_images(str(tmp_path))
        assert sorted(images) == ["1_0_0_date.jpg", "2_1_1_date.png"]

    def test_returns_empty_for_missing_dir(self):
        assert _list_images("/nonexistent/path") == []


# ---------------------------------------------------------------------------
# Integration tests – API endpoints
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_returns_ok(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.get_json() == {"status": "ok"}


class TestRandomEndpoint:
    def test_returns_image(self, client):
        response = client.get("/api/random?datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert "filename" in data
        assert "age" in data
        assert "dataset" in data
        assert data["dataset"] == "cropped"

    def test_filters_by_age(self, client):
        response = client.get("/api/random?min_age=25&max_age=25&datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert data["age"] == 25

    def test_no_match_returns_404(self, client):
        response = client.get("/api/random?min_age=90&max_age=100&datasets=cropped")
        assert response.status_code == 404

    def test_filters_by_gender(self, client):
        # Only females (gender=1) – should return age 30 or 60
        response = client.get("/api/random?genders=1&datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert data["gender"] == 1

    def test_invalid_age_params(self, client):
        response = client.get("/api/random?min_age=abc&datasets=cropped")
        assert response.status_code == 400

    def test_missing_dataset_param_uses_default(self, client):
        # No datasets param – uses default (cropped,wild); cropped is present
        response = client.get("/api/random")
        assert response.status_code == 200


class TestImageEndpoint:
    def test_returns_image_file(self, client, app, tmp_path):
        # Write actual content so send_file works
        img_path = tmp_path / "UTKFace" / "25_0_0_20170110183900092.jpg"
        img_path.write_bytes(b"\xff\xd8\xff")  # minimal JPEG header
        response = client.get("/api/image/cropped/25_0_0_20170110183900092.jpg")
        assert response.status_code == 200

    def test_unknown_dataset_returns_404(self, client):
        response = client.get("/api/image/nonexistent/some.jpg")
        assert response.status_code == 404

    def test_missing_file_returns_404(self, client):
        response = client.get("/api/image/cropped/99_0_0_missing.jpg")
        assert response.status_code == 404

    def test_path_traversal_blocked(self, client):
        response = client.get("/api/image/cropped/../../../etc/passwd")
        assert response.status_code in (403, 404)
