from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pypdf import PdfReader
from docx import Document
import io, re

app = FastAPI(title="LevelUp Pro Resume Service", version="0.1.0")

EMAIL_RE = re.compile(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", re.IGNORECASE)
PHONE_RE = re.compile(r"(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}")

def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(parts)

def extract_text_from_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    parts = []
    for p in doc.paragraphs:
        t = (p.text or "").strip()
        if t:
            parts.append(t)
    return "\n".join(parts)

def parse_basics(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    name = ""
    if lines:
        # Heuristic: first line that's not an email/phone and has letters
        for ln in lines[:10]:
            if EMAIL_RE.search(ln) or PHONE_RE.search(ln):
                continue
            if re.search(r"[A-Za-z]", ln):
                name = ln[:120]
                break
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    return {
        "name": name,
        "email": email.group(1) if email else "",
        "phone": phone.group(0) if phone else "",
    }

def parse_skills(text: str) -> list:
    # Simple "Skills" section grab: take 1-3 lines after a "Skills" header
    m = re.search(r"(?im)^\s*skills\s*[:\-]?\s*$", text)
    if not m:
        m = re.search(r"(?im)^\s*technical skills\s*[:\-]?\s*$", text)
    if not m:
        return []
    tail = text[m.end():]
    lines = [ln.strip() for ln in tail.splitlines() if ln.strip()]
    chunk = " ".join(lines[:3])[:1200]
    # split on bullets/commas/semicolons
    raw = re.split(r"[•\u2022\-|,;\n\t]+", chunk)
    skills = []
    for s in raw:
        s = s.strip()
        if 1 <= len(s) <= 48:
            skills.append(s)
    # de-dupe preserve order
    seen=set()
    out=[]
    for s in skills:
        key=s.lower()
        if key in seen: 
            continue
        seen.add(key)
        out.append(s)
    return out[:60]

@app.post("/parse_resume")
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    name = file.filename.lower()
    try:
        if name.endswith(".pdf") or file.content_type == "application/pdf":
            text = extract_text_from_pdf(data)
        elif name.endswith(".docx") or file.content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            text = extract_text_from_docx(data)
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type. Upload .pdf or .docx")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse: {e}")

    text = (text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="No text extracted")

    basics = parse_basics(text)
    skills = parse_skills(text)

    # Keep payload stable for the Next.js app's fallback schema.
    payload = {
        "basics": basics,
        "headline": "",
        "skills": skills,
        "experience": [],
        "education": [],
        "certifications": [],
        "keywords": [],
        "note": "heuristic_parse_v0",
        "rawTextPreview": text[:2000],
    }
    return JSONResponse(payload)
