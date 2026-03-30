"""
GuardianEye — Python AI Service (Flask) v3.1
Endpoints:
  POST /detect            — Analyze a single base64 frame
  POST /analyze-video     — Analyze an uploaded video file by path
  POST /analyze-youtube   — Resolve YouTube/stream URL & analyze via yt-dlp
  GET  /health            — Service health check
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from detector import detect_frame, analyze_video_file ##analyze_youtube_url

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("GuardianEye.API")

app = Flask(__name__)
CORS(app, origins=["http://localhost:4000", "http://localhost:5173"])


# ─────────────────────────────────────────────────
# GET /health
# ─────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "GuardianEye AI v3.1"}), 200


# ─────────────────────────────────────────────────
# POST /detect  — single base64 frame
# ─────────────────────────────────────────────────
@app.route("/detect", methods=["POST"])
def detect():
    """
    Body: { "image": "<base64>", "source": "live"|"upload"|"drone"|"youtube" }
    """
    try:
        data = request.get_json(force=True)
        if not data or "image" not in data:
            return jsonify({"error": "Missing 'image' field"}), 400

        image_b64 = data["image"]
        source    = data.get("source", "live")

        if not image_b64:
            return jsonify({"error": "Empty image data"}), 400

        result      = detect_frame(image_b64, source)
        alert_types = [a["alertType"] for a in result.get("alerts", [])]

        logger.info(
            f"[/detect] source={source} alert={result['alert']} "
            f"status={result.get('status','safe')} "
            f"types={alert_types} conf={result['confidence']:.2f}"
        )
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"[/detect] Error: {e}", exc_info=True)
        return jsonify({
            "error":      str(e),
            "alert":      False,
            "alerts":     [],
            "confidence": 0.0,
            "status":     "safe",
            "reason":     "Detection error"
        }), 500


# ─────────────────────────────────────────────────
# POST /analyze-video  — local file path
# ─────────────────────────────────────────────────
@app.route("/analyze-video", methods=["POST"])
def analyze_video():
    """
    Body: { "file_path": "/absolute/path/to/video.mp4", "sample_every": 5 }
    """
    try:
        data = request.get_json(force=True)
        if not data or "file_path" not in data:
            return jsonify({"error": "Missing 'file_path' field"}), 400

        file_path    = data["file_path"]
        sample_every = int(data.get("sample_every", 5))

        if not os.path.exists(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404

        logger.info(f"[/analyze-video] Processing: {file_path}, sample_every={sample_every}")
        result = analyze_video_file(file_path, sample_every)
        logger.info(
            f"[/analyze-video] Done — alert={result['alert']}, "
            f"analyzed={result['analyzed_frames']} frames, "
            f"alert_frames={result['alert_frames']}"
        )
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"[/analyze-video] Error: {e}", exc_info=True)
        return jsonify({
            "error":      str(e),
            "alert":      False,
            "alerts":     [],
            "confidence": 0.0,
            "reason":     "Video analysis error"
        }), 500


# ─────────────────────────────────────────────────
# POST /analyze-youtube  — YouTube / stream URL
# ─────────────────────────────────────────────────
@app.route("/analyze-youtube", methods=["POST"])
def analyze_youtube():
    """
    Resolves a YouTube / stream URL to a direct video URL using yt-dlp,
    then samples frames via OpenCV and runs AI detection on each.

    Body: { "url": "https://youtube.com/watch?v=...", "max_frames": 60, "sample_every": 5 }
    Response: {
      "alert": bool,
      "alerts": [...],
      "confidence": float,
      "reason": str,
      "detections": [...],
      "analyzed_frames": int,
      "alert_frames": int
    }
    """
    try:
        data = request.get_json(force=True)
        if not data or "url" not in data:
            return jsonify({"error": "Missing 'url' field"}), 400

        url          = data["url"].strip()
        max_frames   = int(data.get("max_frames", 60))
        sample_every = int(data.get("sample_every", 5))

        if not url:
            return jsonify({"error": "Empty URL"}), 400

        logger.info(f"[/analyze-youtube] URL={url}, max_frames={max_frames}")
        result = analyze_youtube_url(url, max_frames=max_frames, sample_every=sample_every)
        logger.info(
            f"[/analyze-youtube] Done — alert={result['alert']}, "
            f"analyzed={result['analyzed_frames']} frames, "
            f"alert_frames={result['alert_frames']}"
        )
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"[/analyze-youtube] Error: {e}", exc_info=True)
        return jsonify({
            "error":      str(e),
            "alert":      False,
            "alerts":     [],
            "confidence": 0.0,
            "reason":     "YouTube analysis error",
            "detections": [],
            "analyzed_frames": 0,
            "alert_frames":    0
        }), 500


# ─────────────────────────────────────────────────
# Start
# ─────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("AI_PORT", 5001))
    logger.info(f"Starting GuardianEye AI Service v3.1 on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
