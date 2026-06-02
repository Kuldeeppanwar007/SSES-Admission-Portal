# AI Calling Backend (FastAPI + MongoDB)

This is the Python FastAPI voice agent backend copied directly from the `marge-in-SSES-Admission-Portal` branch of `SSISM-Voice-Agent`. It is fully migrated to use the MongoDB database of the main portal.

## Local Setup & Running

### 1. Prerequisites
- Python 3.10 or higher installed on your system.
- Recommended: `uv` (a fast Python package manager) or `pip` + `venv`.

### 2. Environment Configurations
The `.env` file has been pre-configured with the MongoDB cloud URI that the admission portal uses:
```env
MONGODB_URL=mongodb+srv://anees_khan:aneeskhan123786@cluster0.bbpgmdt.mongodb.net/SSES-Admission-Portal?retryWrites=true&w=majority
MONGODB_DB_NAME=SSES-Admission-Portal
```
To enable live AI calling and Groq LLM logic:
1. Open the `.env` file inside `calling_backend/`
2. Fill in your **Plivo Credentials** (`PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, etc.)
3. Fill in your **Groq API Key** (`GROQ_API_KEY`)

### 3. Install Dependencies
Using standard Python `venv` and `pip`:
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows Powershell)
.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

*(Or if you use `uv`, simply run `uv pip install -r requirements.txt`)*

### 4. Run the Server
Start the FastAPI server on port `8000`:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Once running, the React frontend of the admission portal (which is already configured to point to `http://localhost:8000/api/v1`) will communicate with it seamlessly to load logs, stats, trigger AI voice calls, send WhatsApp texts, and schedule callbacks!
