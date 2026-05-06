"""
Tests for the AgeGuesser Flask backend.
"""

import os
import shutil
import pytest
from app import create_app, _parse_filename, _list_images, _build_image_index


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
def app_with_wild(tmp_path):
    """Flask app with both cropped and wild datasets populated."""
    cropped_dir = tmp_path / "UTKFace"
    wild_dir = tmp_path / "in-the-wild"
    cropped_dir.mkdir()
    wild_dir.mkdir()

    cropped_images = [
        "25_0_0_20170110183900092.jpg",
        "40_1_2_20170110183900001.jpg",
    ]
    wild_images = [
        "35_0_3_20170110183900111.jpg",
        "55_1_4_20170110183900222.jpg",
    ]
    for name in cropped_images:
        (cropped_dir / name).write_text("fake image data")
    for name in wild_images:
        (wild_dir / name).write_text("fake image data")

    import app as app_module
    original_data_dir = app_module.DATA_DIR
    original_dataset_dirs = app_module.DATASET_DIRS.copy()

    app_module.DATA_DIR = str(tmp_path)
    app_module.DATASET_DIRS["cropped"] = str(cropped_dir)
    app_module.DATASET_DIRS["wild"] = str(wild_dir)

    flask_app = create_app()
    flask_app.config["TESTING"] = True

    yield flask_app

    app_module.DATA_DIR = original_data_dir
    app_module.DATASET_DIRS.update(original_dataset_dirs)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def client_with_wild(app_with_wild):
    return app_with_wild.test_client()


# ---------------------------------------------------------------------------
# Unit tests – _parse_filename
# ---------------------------------------------------------------------------

class TestParseFilename:
    def test_valid_filename(self):
        result = _parse_filename("25_0_2_20170110183900092.jpg")
        assert result == {"age": 25, "gender": 0, "race": 2}

    def test_valid_filename_png(self):
        result = _parse_filename("100_1_4_20170110.png")
        assert result == {"age": 100, "gender": 1, "race": 4}

    def test_age_zero(self):
        result = _parse_filename("0_0_0_date.jpg")
        assert result == {"age": 0, "gender": 0, "race": 0}

    def test_max_age(self):
        result = _parse_filename("116_1_3_date.jpg")
        assert result == {"age": 116, "gender": 1, "race": 3}

    def test_extra_parts_in_filename(self):
        # UTKFace filenames have more than 3 underscore-separated parts
        result = _parse_filename("25_0_2_20170110183900092_extra.jpg")
        assert result == {"age": 25, "gender": 0, "race": 2}

    def test_invalid_filename_too_few_parts(self):
        assert _parse_filename("25_0.jpg") is None

    def test_invalid_filename_non_numeric(self):
        assert _parse_filename("abc_def_ghi_date.jpg") is None

    def test_invalid_age_non_numeric(self):
        assert _parse_filename("abc_0_0_date.jpg") is None

    def test_no_extension(self):
        result = _parse_filename("25_0_2_date")
        assert result == {"age": 25, "gender": 0, "race": 2}


# ---------------------------------------------------------------------------
# Unit tests – _list_images
# ---------------------------------------------------------------------------

class TestListImages:
    def test_returns_images(self, tmp_path):
        (tmp_path / "1_0_0_date.jpg").write_text("")
        (tmp_path / "2_1_1_date.png").write_text("")
        (tmp_path / "readme.txt").write_text("")
        images = _list_images(str(tmp_path))
        assert sorted(images) == ["1_0_0_date.jpg", "2_1_1_date.png"]

    def test_returns_only_images(self, tmp_path):
        (tmp_path / "face.jpg").write_text("")
        (tmp_path / "face.jpeg").write_text("")
        (tmp_path / "face.png").write_text("")
        (tmp_path / "data.csv").write_text("")
        (tmp_path / "notes.md").write_text("")
        images = sorted(_list_images(str(tmp_path)))
        assert images == ["face.jpeg", "face.jpg", "face.png"]

    def test_empty_directory(self, tmp_path):
        assert _list_images(str(tmp_path)) == []

    def test_returns_empty_for_missing_dir(self):
        assert _list_images("/nonexistent/path") == []

    def test_case_insensitive_extension(self, tmp_path):
        (tmp_path / "face.JPG").write_text("")
        (tmp_path / "face2.JPEG").write_text("")
        images = _list_images(str(tmp_path))
        assert len(images) == 2


# ---------------------------------------------------------------------------
# Unit tests – _build_image_index
# ---------------------------------------------------------------------------

class TestBuildImageIndex:
    def test_indexes_cropped_dataset(self, tmp_path):
        import app as app_module
        original = app_module.DATASET_DIRS.copy()

        cropped_dir = tmp_path / "UTKFace"
        cropped_dir.mkdir()
        (cropped_dir / "25_0_2_date.jpg").write_text("")
        (cropped_dir / "30_1_0_date.jpg").write_text("")

        app_module.DATASET_DIRS["cropped"] = str(cropped_dir)
        app_module.DATASET_DIRS["wild"] = str(tmp_path / "nonexistent")

        try:
            index = _build_image_index(["cropped"])
            assert len(index) == 2
            assert all(e["dataset"] == "cropped" for e in index)
            ages = sorted(e["age"] for e in index)
            assert ages == [25, 30]
        finally:
            app_module.DATASET_DIRS.update(original)

    def test_indexes_multiple_datasets(self, tmp_path):
        import app as app_module
        original = app_module.DATASET_DIRS.copy()

        cropped_dir = tmp_path / "UTKFace"
        wild_dir = tmp_path / "in-the-wild"
        cropped_dir.mkdir()
        wild_dir.mkdir()
        (cropped_dir / "20_0_0_date.jpg").write_text("")
        (wild_dir / "50_1_2_date.jpg").write_text("")

        app_module.DATASET_DIRS["cropped"] = str(cropped_dir)
        app_module.DATASET_DIRS["wild"] = str(wild_dir)

        try:
            index = _build_image_index(["cropped", "wild"])
            assert len(index) == 2
            datasets = {e["dataset"] for e in index}
            assert datasets == {"cropped", "wild"}
        finally:
            app_module.DATASET_DIRS.update(original)

    def test_skips_missing_dataset_directory(self, tmp_path):
        import app as app_module
        original = app_module.DATASET_DIRS.copy()

        app_module.DATASET_DIRS["wild"] = str(tmp_path / "nonexistent")

        try:
            index = _build_image_index(["wild"])
            assert index == []
        finally:
            app_module.DATASET_DIRS.update(original)

    def test_skips_unparseable_filenames(self, tmp_path):
        import app as app_module
        original = app_module.DATASET_DIRS.copy()

        cropped_dir = tmp_path / "UTKFace"
        cropped_dir.mkdir()
        (cropped_dir / "25_0_0_date.jpg").write_text("")
        (cropped_dir / "bad_name.jpg").write_text("")
        (cropped_dir / "also_bad.jpg").write_text("")

        app_module.DATASET_DIRS["cropped"] = str(cropped_dir)

        try:
            index = _build_image_index(["cropped"])
            assert len(index) == 1
            assert index[0]["age"] == 25
        finally:
            app_module.DATASET_DIRS.update(original)

    def test_unknown_dataset_key_is_skipped(self):
        index = _build_image_index(["unknown_dataset"])
        assert index == []


# ---------------------------------------------------------------------------
# Integration tests – /api/health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_returns_ok(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.get_json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Integration tests – /api/random
# ---------------------------------------------------------------------------

class TestRandomEndpoint:
    def test_returns_image(self, client):
        response = client.get("/api/random?datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert "filename" in data
        assert "age" in data
        assert "dataset" in data
        assert data["dataset"] == "cropped"

    def test_response_includes_url_field(self, client):
        response = client.get("/api/random?datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert "url" in data
        assert data["url"].startswith("/api/image/")

    def test_filters_by_age(self, client):
        response = client.get("/api/random?min_age=25&max_age=25&datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert data["age"] == 25

    def test_age_range_inclusive(self, client):
        # min and max age should be inclusive
        response = client.get("/api/random?min_age=10&max_age=30&datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert 10 <= data["age"] <= 30

    def test_no_match_returns_404(self, client):
        response = client.get("/api/random?min_age=90&max_age=100&datasets=cropped")
        assert response.status_code == 404
        assert "error" in response.get_json()

    def test_filters_by_gender(self, client):
        # Only females (gender=1) – should return age 30 or 60
        response = client.get("/api/random?genders=1&datasets=cropped")
        assert response.status_code == 200
        data = response.get_json()
        assert data["gender"] == 1

    def test_filters_by_male_gender(self, client):
        response = client.get("/api/random?genders=0&datasets=cropped")
        assert response.status_code == 200
        assert response.get_json()["gender"] == 0

    def test_filters_by_race(self, client):
        # Only Asian (race=2) images
        response = client.get("/api/random?races=2&datasets=cropped")
        assert response.status_code == 200
        assert response.get_json()["race"] == 2

    def test_no_matching_race_returns_404(self, client):
        # No race=2 images in white-only query
        response = client.get("/api/random?races=0&min_age=45&max_age=45&datasets=cropped")
        # age=45 is asian (race=2), so requesting race=0 should not match
        assert response.status_code == 404

    def test_invalid_age_params(self, client):
        response = client.get("/api/random?min_age=abc&datasets=cropped")
        assert response.status_code == 400

    def test_invalid_max_age_param(self, client):
        response = client.get("/api/random?max_age=xyz&datasets=cropped")
        assert response.status_code == 400

    def test_invalid_gender_param(self, client):
        response = client.get("/api/random?genders=abc&datasets=cropped")
        assert response.status_code == 400

    def test_invalid_race_param(self, client):
        response = client.get("/api/random?races=notanint&datasets=cropped")
        assert response.status_code == 400

    def test_empty_datasets_returns_400(self, client):
        response = client.get("/api/random?datasets=")
        assert response.status_code == 400

    def test_missing_dataset_param_uses_default(self, client):
        # No datasets param – uses default (cropped,wild); cropped is present
        response = client.get("/api/random")
        assert response.status_code == 200

    def test_wild_dataset(self, client_with_wild):
        response = client_with_wild.get("/api/random?datasets=wild")
        assert response.status_code == 200
        assert response.get_json()["dataset"] == "wild"

    def test_both_datasets_return_results(self, client_with_wild):
        response = client_with_wild.get("/api/random?datasets=cropped,wild")
        assert response.status_code == 200
        data = response.get_json()
        assert data["dataset"] in ("cropped", "wild")

    def test_nonexistent_dataset_ignored(self, client):
        # If only a non-existent dataset is requested, no results
        response = client.get("/api/random?datasets=nonexistent")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Integration tests – /api/image
# ---------------------------------------------------------------------------

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
        # Path traversal with slashes is blocked by filename validation regex
        response = client.get("/api/image/cropped/..%2F..%2Fetc%2Fpasswd")
        assert response.status_code in (403, 404)

    def test_filename_with_special_chars_blocked(self, client):
        response = client.get("/api/image/cropped/evil;cmd.jpg")
        assert response.status_code == 403

    def test_filename_with_space_blocked(self, client):
        response = client.get("/api/image/cropped/evil file.jpg")
        assert response.status_code == 403

    def test_filename_with_null_byte_blocked(self, client):
        response = client.get("/api/image/cropped/evil%00.jpg")
        assert response.status_code in (400, 403, 404)

    def test_wild_dataset_missing_file(self, client):
        response = client.get("/api/image/wild/99_0_0_missing.jpg")
        assert response.status_code == 404
