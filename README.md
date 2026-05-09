# AgeGuesser

A learning tool that trains you to estimate the age of a person from their photograph.
It uses the [UTKFace](https://susanqq.github.io/UTKFace/) dataset (both aligned/cropped faces and in-the-wild faces).

## Architecture

| Part | Technology | Directory |
|------|-----------|-----------|
| Backend | Python / Flask | `backend/` |
| Frontend | React (Create React App) | `frontend/` |

## Features

### Backend
- **Dataset management command** – downloads and prepares the UTKFace dataset (cropped + in-the-wild)
- **Admin curation commands** – create admin accounts via `python manage.py create-admin`
- **Startup warning** – clear error message with instructions when the dataset has not been downloaded yet
- **`GET /api/image/<dataset>/<filename>`** – serve a single face image
- **`GET /api/random`** – pick a random image matching age range, gender, race, resolution and dataset filters
- **Admin curation API** – login, list datasets, preview datasets, and add images to custom datasets

### Frontend
- **All state stored in the browser** (`localStorage`) – no account or database needed
- **Configurations** – create named configurations that define:
  - Number of faces per run
  - Age range to practise
  - Which genders / races to include
  - Whether to use cropped and/or in-the-wild faces
- **Learning history** – each run's average age-distance is saved and plotted as a progress chart
- **Run view** – random face images are shown one by one; click the age line to guess
- **Result reveal** – after guessing, the correct age and your guess are shown colour-coded by accuracy; click the image to advance
- **Summary view** – after each run a grid of all faces with correct ages and guess quality is displayed

## Quick start

### 1 – Download the dataset

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py download       # downloads both cropped and in-the-wild faces
# or download only one:
python manage.py download --datasets cropped
python manage.py download --datasets wild
```

### 2 – Start the backend

```bash
cd backend
source venv/bin/activate
flask run                        # http://localhost:5000
```

### 3 – Start the frontend

```bash
cd frontend
npm install
npm start                        # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## UTKFace filename format

Images are named:

```
[age]_[gender]_[race]_[date&time].jpg
```

| Field | Values |
|-------|--------|
| age | 0–116 |
| gender | 0 = male, 1 = female |
| race | 0 = white, 1 = black, 2 = asian, 3 = indian, 4 = others |

## API reference

### `GET /api/health`
Returns `{"status": "ok"}`.

### `GET /api/random`
Returns a random image matching the given criteria.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `min_age` | int | 0 | Minimum age (inclusive) |
| `max_age` | int | 116 | Maximum age (inclusive) |
| `genders` | comma-sep ints | 0,1 | Genders to include |
| `races` | comma-sep ints | 0,1,2,3,4 | Races to include |
| `resolutions` | comma-sep strings | low,medium,high | Resolutions to include (`low` < 100 px, `medium` 100–300 px, `high` > 300 px) |
| `datasets` | comma-sep strings | cropped,wild | Datasets to include |

**Example response:**
```json
{
  "dataset": "cropped",
  "filename": "28_0_2_20170110183900092.jpg",
  "age": 28,
  "gender": 0,
  "race": 2,
  "resolution": "medium",
  "url": "/api/image/cropped/28_0_2_20170110183900092.jpg"
}
```

### `GET /api/count`
Returns the number of images matching the given criteria. Accepts the same query parameters as `/api/random`.

**Example response:**
```json
{ "count": 4821 }
```

### `GET /api/image/<dataset>/<filename>`
Serves the raw image file. `dataset` can be `cropped`, `wild`, or any curated custom dataset.

### Admin curation endpoints

- `POST /api/admin/login` – admin login
- `POST /api/admin/logout` – admin logout
- `GET /api/admin/status` – current admin login status
- `GET /api/admin/datasets` – list datasets with image counts
- `GET /api/admin/datasets/<dataset>/preview` – preview dataset images
- `POST /api/admin/datasets/<dataset>/add-image` – upload an image + metadata

## Development

### Backend tests
```bash
cd backend
source venv/bin/activate
python -m pytest        # add tests/test_app.py as needed
```

### Frontend tests
```bash
cd frontend
npm test
```

### Frontend build
```bash
cd frontend
npm run build
```

## License
MIT – see [LICENSE](LICENSE).
