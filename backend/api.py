import os
from pathlib import Path
import io, time
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from fatsecret_client import call_server_api
import pytesseract

try:
    from ultralytics import YOLO
    import torch
except Exception:
    YOLO = None
    torch = None

BASE = Path(__file__).resolve().parent
MODELS = BASE / "models"
DET_PATH = MODELS / "best.pt"                 # detector
FOOD101_PATH = MODELS / "food101_cls_best.pt" # Food101 classifier
FIL_PATH = MODELS / "filipino_cls_best.pt"    # Filipino classifier

def load_model(p: Path):
    if YOLO is None or not p.exists(): return None
    try:
        return YOLO(str(p))
    except Exception:
        return None

detector = load_model(DET_PATH)
food101 = load_model(FOOD101_PATH)
filipino = load_model(FIL_PATH)

class Box(BaseModel):
    class_name: str
    confidence: float
    x1: float; y1: float; x2: float; y2: float
    label: Optional[str] = None

class TopKItem(BaseModel):
    label: str
    conf: float

class RecognizeResponse(BaseModel):
    model: str
    device: str
    elapsed_ms: float
    detections: List[Box] = []
    # classification summaries
    global_class: Optional[str] = None
    global_conf: Optional[float] = None
    global_class_source: Optional[str] = None
    # top-k
    main_topk: List[TopKItem] = []        # Food101
    food101_topk: List[TopKItem] = []     # alias for compatibility
    fil_topk: List[TopKItem] = []         # Filipino
    filipino_topk: List[TopKItem] = []    # alias
    note: Optional[str] = None

app = FastAPI(title="REcipe API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {
            "detector": bool(detector),
            "cls_main": bool(food101),
            "cls_fil": bool(filipino),
        },
    }

def pil_from_upload(upload: UploadFile) -> Image.Image:
    b = upload.file.read()
    if not b:
        raise HTTPException(400, "Empty image")
    try:
        return Image.open(io.BytesIO(b)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image")

def topk_from_probs(res, k: int):
    # res: Ultralytics classification result (res.probs, res.names)
    items: List[TopKItem] = []
    try:
        probs = res.probs.data
        if hasattr(probs, "cpu"):
            probs = probs.cpu()
        if hasattr(probs, "numpy"):
            probs = probs.numpy()
        vals = [(int(i), float(p)) for i, p in enumerate(probs)]
        vals.sort(key=lambda x: x[1], reverse=True)
        names = res.names if hasattr(res, "names") else {}
        for idx, p in vals[:k]:
            label = names[idx] if isinstance(names, dict) and idx in names else str(idx)
            items.append(TopKItem(label=label, conf=p))
    except Exception:
        pass
    return items

@app.post("/recognize", response_model=RecognizeResponse)
async def recognize(file: UploadFile = File(...), k: int = Query(5, ge=1, le=50)):
    t0 = time.time()
    img = pil_from_upload(file)
    device = "cpu"
    note_parts = []

    # 1) Detector (all boxes)
    detections: List[Box] = []
    if detector:
        try:
            det_res = detector(img, device=device, verbose=False)[0]
            names = det_res.names if hasattr(det_res, "names") else {}
            if hasattr(det_res, "boxes") and det_res.boxes is not None:
                xyxy = det_res.boxes.xyxy
                conf = det_res.boxes.conf
                cls = det_res.boxes.cls
                if hasattr(xyxy, "cpu"): xyxy = xyxy.cpu()
                if hasattr(conf, "cpu"): conf = conf.cpu()
                if hasattr(cls, "cpu"): cls = cls.cpu()
                if hasattr(xyxy, "numpy"): xyxy = xyxy.numpy()
                if hasattr(conf, "numpy"): conf = conf.numpy()
                if hasattr(cls, "numpy"): cls = cls.numpy()
                W, H = img.size
                for i in range(len(conf)):
                    x1, y1, x2, y2 = xyxy[i].tolist()
                    label = names.get(int(cls[i]), "object")
                    detections.append(Box(
                        class_name=label,
                        label=label,
                        confidence=float(conf[i]),
                        x1=float(x1), y1=float(y1), x2=float(x2), y2=float(y2),
                    ))
        except Exception as e:
            note_parts.append(f"detector failed: {e}")
    else:
        note_parts.append("detector not loaded")

    # 2) Food101 classification (top-k)
    main_topk: List[TopKItem] = []
    if food101:
        try:
            res = food101(img, device=device, verbose=False)[0]
            main_topk = topk_from_probs(res, k=k)
        except Exception as e:
            note_parts.append(f"food101 failed: {e}")
    else:
        note_parts.append("food101 not loaded")

    # 3) Filipino classification (top-k)
    fil_topk: List[TopKItem] = []
    if filipino:
        try:
            res = filipino(img, device=device, verbose=False)[0]
            fil_topk = topk_from_probs(res, k=k)
        except Exception as e:
            note_parts.append(f"filipino failed: {e}")
    else:
        note_parts.append("filipino not loaded")

    # 4) Global top-1 summary (best of the two classifiers)
    global_class = None
    global_conf = None
    global_src = None
    if main_topk[:1]:
        global_class = main_topk[0].label
        global_conf = main_topk[0].conf
        global_src = "food101"
    if fil_topk[:1] and (global_conf is None or fil_topk[0].conf > global_conf):
        global_class = fil_topk[0].label
        global_conf = fil_topk[0].conf
        global_src = "filipino"

    elapsed_ms = (time.time() - t0) * 1000.0

    return RecognizeResponse(
        model="ultralytics" if YOLO else "none",
        device=device,
        elapsed_ms=elapsed_ms,
        detections=detections,
        global_class=global_class,
        global_conf=global_conf,
        global_class_source=global_src,
        main_topk=main_topk,
        food101_topk=main_topk,   # alias for UI compatibility
        fil_topk=fil_topk,
        filipino_topk=fil_topk,   # alias for UI compatibility
        note="; ".join(note_parts) if note_parts else None,
    )

@app.post("/ocr/extract")
async def ocr_extract_text(file: UploadFile = File(...)):
    """Extract text from image using OCR (Tesseract)."""
    try:
        img = pil_from_upload(file)
        
        # Use Tesseract OCR to extract text
        text = pytesseract.image_to_string(img, lang='eng')
        
        # Clean up text
        text = text.strip()
        
        return {
            "success": True,
            "text": text,
            "length": len(text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

# ============================================================================
# FatSecret API Endpoints
# ============================================================================

@app.get("/fatsecret/foods/search")
def fs_foods_search(q: str, page: int = Query(0, ge=0), max_results: int = Query(20, ge=1, le=50)):
    """Search for foods by text query."""
    try:
        result = call_server_api(
            "foods.search",
            {"search_expression": q, "page_number": page, "max_results": max_results},
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FatSecret search failed: {e}")

@app.get("/fatsecret/food")
def fs_food_get(food_id: int = Query(..., alias="id")):
    """Get detailed food information by food_id."""
    try:
        result = call_server_api("food.get.v2", {"food_id": food_id})
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FatSecret food.get failed: {e}")

@app.get("/fatsecret/barcode")
async def fatsecret_barcode(barcode: str = Query(...)):
    """Lookup food by barcode."""
    try:
        # ✅ Use call_server_api (not fatsecret_client object)
        result = call_server_api("food.find_id_for_barcode", {"barcode": barcode})
        if not result or "error" in result:
            return {"error": {"message": "Barcode not found"}}
        
        # If barcode found, get full food details
        food_id = result.get("food_id", {}).get("value")
        if food_id:
            food_details = call_server_api("food.get.v2", {"food_id": food_id})
            return {"food": food_details.get("food", {})}
        
        return {"error": {"message": "Invalid barcode response"}}
    except Exception as e:
        return {"error": {"message": str(e)}}

@app.get("/fatsecret/qr")
async def fatsecret_qr(qr_code: str = Query(...)):
    """Lookup food by QR code."""
    try:
        result = call_server_api("food.find_id_for_qr", {"qr_code": qr_code})
        if not result or "error" in result:
            return {"error": {"message": "QR code not found"}}
        
        # If QR found, get full food details
        food_id = result.get("food_id", {}).get("value")
        if food_id:
            food_details = call_server_api("food.get.v2", {"food_id": food_id})
            return {"food": food_details.get("food", {})}
        
        return {"error": {"message": "Invalid QR code response"}}
    except Exception as e:
        return {"error": {"message": str(e)}}
