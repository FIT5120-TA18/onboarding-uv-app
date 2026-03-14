from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

OWM_API_KEY = os.environ.get("OWM_API_KEY")

UV_BANDS = [
    (2,  "Low",        "#388E3C", None),
    (5,  "Moderate",   "#F9A825", None),
    (7,  "High",       "#EF6C00", 12),
    (10, "Very High",  "#C62828", 7),
    (999, "Extreme",   "#6A1B9A", 3),
]

def get_risk(uv: float):
    for threshold, label, colour, burn_minutes in UV_BANDS:
        if uv <= threshold:
            return label, colour, burn_minutes
    return "Extreme", "#6A1B9A", 3

def get_warning(label: str, uv: float):
    if uv < 6:
        return None
    burn_times = {"High": 12, "Very High": 7, "Extreme": 3}
    mins = burn_times.get(label)
    if mins:
        return (
            f"Your skin may start burning in {mins} minutes. "
            "Seek shade or apply SPF 50+ sunscreen."
        )
    return None

@app.route("/api/uv")
def uv_index():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon required"}), 400

    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude":  lat,
                "longitude": lon,
                "current":   "uv_index",  # returns current UV directly
            },
            timeout=5,
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        return jsonify({"error": "Weather API timed out."}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Could not reach weather API."}), 502

    data = resp.json()
    current_uv = data["current"]["uv_index"]

    risk_label, colour, _ = get_risk(current_uv)
    warning = get_warning(risk_label, current_uv)

    return jsonify({
        "uv_index":   round(current_uv, 1),
        "risk_label": risk_label,
        "colour":     colour,
        "warning":    warning,
    })

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "api_key_set": bool(OWM_API_KEY)})



if __name__ == "__main__":
    app.run(debug=True, port = 5001)