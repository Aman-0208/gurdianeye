# GuardianEye — Advanced AI Detector v2.1 (IMPROVED, SAFE REPLACEMENT)

import cv2
import numpy as np
import base64
import logging
from datetime import datetime, timezone
from collections import deque
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GuardianEye.Detector")

# YOLO Model
model = YOLO("yolov8n.pt")

# State memory
_frame_history = deque(maxlen=6)
_vehicle_history = deque(maxlen=6)
_fire_history = deque(maxlen=5)

PROCESS_WIDTH = 320

ALERT_TYPES = {
    "fire_small": {"severity": "low"},
    "fire_moderate": {"severity": "medium"},
    "fire_severe": {"severity": "critical"},
    "accident": {"severity": "high"},
    "anomaly": {"severity": "medium"},
    "signal_lost": {"severity": "low"},
}

VEHICLE_CLASSES = {"car", "truck", "motorcycle", "bus", "bicycle"}

# ─────────────────────────────────────────────────────────
# UTIL
# ─────────────────────────────────────────────────────────
def decode_base64_frame(b64_str):
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        img_bytes = base64.b64decode(b64_str)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except:
        return None

def resize_frame(frame):
    h, w = frame.shape[:2]
    ratio = PROCESS_WIDTH / w
    return cv2.resize(frame, (PROCESS_WIDTH, int(h * ratio)))

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def make_alert(alert_type, confidence, reason):
    return {
        "alertType": alert_type,
        "severity": ALERT_TYPES[alert_type]["severity"],
        "confidence": round(confidence, 4),
        "reason": reason,
    }

# ─────────────────────────────────────────────────────────
# 🔥 IMPROVED FIRE DETECTION
# ─────────────────────────────────────────────────────────
def detect_fire(frame):
    global _fire_history

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, w = frame.shape[:2]

    # Improved color mask
    mask1 = cv2.inRange(hsv, (0, 100, 100), (25, 255, 255))
    mask2 = cv2.inRange(hsv, (160, 100, 100), (179, 255, 255))
    fire_mask = cv2.bitwise_or(mask1, mask2)

    # Morphology
    kernel = np.ones((5,5), np.uint8)
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN, kernel)

    flame_ratio = np.sum(fire_mask > 0) / (h * w)

    # 🔥 Motion validation
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _frame_history.append(gray)

    motion_ratio = 0
    if len(_frame_history) >= 3:
        diff = cv2.absdiff(gray, _frame_history[-3])
        motion_ratio = np.sum(diff > 25) / diff.size

    # 🔥 YOLO cross-check (optional signal)
    yolo_fire_hint = False
    results = model(frame, conf=0.5, imgsz=320, verbose=False)
    for r in results:
        if len(r.boxes) > 0:
            yolo_fire_hint = True
            break

    fire_detected = (
        flame_ratio > 0.01 and
        motion_ratio > 0.02 and
        yolo_fire_hint
    )

    _fire_history.append(fire_detected)

    # 🔥 Temporal consistency
    if sum(_fire_history) < 3:
        return None

    if not fire_detected:
        return None

    # Severity
    if flame_ratio > 0.2:
        return make_alert("fire_severe", 0.9, "Severe fire detected")
    elif flame_ratio > 0.05:
        return make_alert("fire_moderate", 0.75, "Moderate fire detected")
    else:
        return make_alert("fire_small", 0.6, "Small fire detected")

# ─────────────────────────────────────────────────────────
# 🚗 ACCIDENT DETECTION (UNCHANGED LOGIC)
# ─────────────────────────────────────────────────────────
def detect_accident(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _frame_history.append(gray)

    if len(_frame_history) < 3:
        return None

    diff = cv2.absdiff(gray, _frame_history[-3])
    motion = np.sum(diff > 25) / diff.size

    vehicles = []
    results = model(frame, conf=0.4, imgsz=320, verbose=False)

    for r in results:
        for box in r.boxes:
            cls = model.names[int(box.cls[0])]
            if cls in VEHICLE_CLASSES:
                vehicles.append(box)

    if motion > 0.25 and len(vehicles) > 0:
        return make_alert("accident", 0.85, "Possible accident detected")

    return None

# ─────────────────────────────────────────────────────────
# GENERIC ANOMALY
# ─────────────────────────────────────────────────────────
def detect_generic_anomaly(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean_b = np.mean(gray)

    if mean_b > 230:
        return make_alert("anomaly", 0.7, "Overexposed frame")
    if mean_b < 15:
        return make_alert("signal_lost", 0.8, "Dark frame")

    return None

# ─────────────────────────────────────────────────────────
# MAIN PIPELINE (UNCHANGED API)
# ─────────────────────────────────────────────────────────
def detect_frame(b64_image, source="live"):
    frame = decode_base64_frame(b64_image)

    if frame is None:
        return {"alert": False, "reason": "Invalid frame"}

    frame = resize_frame(frame)

    alerts = []

    fire = detect_fire(frame)
    if fire:
        alerts.append(fire)

    accident = detect_accident(frame)
    if accident:
        alerts.append(accident)

    if not alerts:
        anomaly = detect_generic_anomaly(frame)
        if anomaly:
            alerts.append(anomaly)

    if not alerts:
        return {
            "alert": False,
            "confidence": 0,
            "reason": "Safe",
            "status": "safe",
            "timestamp": utc_now()
        }

    top = max(alerts, key=lambda x: x["confidence"])

    return {
        "alert": True,
        "alerts": alerts,
        "confidence": top["confidence"],
        "reason": top["reason"],
        "status": "warning",
        "timestamp": utc_now()
    }

# ─────────────────────────────────────────────────────────
# VIDEO SUPPORT (UNCHANGED)
# ─────────────────────────────────────────────────────────
def analyze_video_file(file_path, sample_every=5):
    cap = cv2.VideoCapture(file_path)

    if not cap.isOpened():
        return {"alert": False, "reason": "Cannot open video"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_idx = 0
    results = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % sample_every != 0:
            continue

        _, buffer = cv2.imencode(".jpg", frame)
        b64 = base64.b64encode(buffer).decode("utf-8")

        result = detect_frame(b64)
        result["frame"] = frame_idx
        result["time"] = frame_idx / fps

        results.append(result)

    cap.release()

    return {
        "alert": any(r["alert"] for r in results),
        "results": results
    }