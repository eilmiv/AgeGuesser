# AgeGuesser – Copilot Instructions

## Project overview
AgeGuesser is a learning tool that trains people to guess the age of a person
from a photograph.  It consists of:

- **backend/** – Python / Flask REST API
- **frontend/** – React single-page application (Create React App)

## Dataset: UTKFace
The backend relies on the [UTKFace](https://susanqq.github.io/UTKFace/) dataset.
Images are **never** committed to the repository.  Run the management command to
download them:

```bash
cd backend
python manage.py download
```

Image filename convention (after extraction):
```
[age]_[gender]_[race]_[date&time].jpg
```
- `age`   – integer 0–116
- `gender` – 0 = male, 1 = female
- `race`   – 0 = white, 1 = black, 2 = asian, 3 = indian, 4 = others

Two sub-datasets are used:
- **cropped** (`data/UTKFace/`) – aligned & cropped faces
- **wild** (`data/in-the-wild/`) – in-the-wild faces

## Backend conventions
- Entry point: `backend/app.py`  (run with `flask run` or `python app.py`)
- Management commands: `backend/manage.py` (uses Click)
- All API routes are prefixed with `/api/`
- CORS is enabled for local development (frontend runs on port 3000)
- On startup the app warns if the dataset is missing and which command to run
- Images are served via `/api/image/<dataset>/<filename>`
- Random image selection: `GET /api/random` with query params
  `min_age`, `max_age`, `genders` (comma-separated), `races` (comma-separated),
  `datasets` (comma-separated: `cropped`, `wild`)

## Frontend conventions
- Entry point: `frontend/src/index.js`
- **All application state is stored in `localStorage`** – no backend DB required
- Key `ageguesser_configs` stores an array of configuration objects
- React functional components with hooks only (no class components)
- Styling: plain CSS modules (`.css` file per component)
- Visualization: recharts library for history charts
- No TypeScript; plain JavaScript (ES2020+)

## Configuration data model
```json
{
  "id": "uuid-string",
  "name": "My Config",
  "facesPerRun": 10,
  "minAge": 0,
  "maxAge": 100,
  "genders": [0, 1],
  "races": [0, 1, 2, 3, 4],
  "datasets": ["cropped", "wild"],
  "history": [
    { "date": "2026-01-01T12:00:00Z", "avgDistance": 7.3 }
  ]
}
```

## Run result data model (kept in component state, not persisted until run ends)
```json
{
  "image": { "filename": "25_0_2_....jpg", "dataset": "cropped", "age": 25 },
  "guess": 28,
  "distance": 3
}
```

## Development setup
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py download   # one-time dataset download
flask run                    # starts on http://localhost:5000

# Frontend
cd frontend
npm install
npm start                    # starts on http://localhost:3000
```
