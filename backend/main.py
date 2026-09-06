from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="OceanVision 3D API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://oceanvision3d-q3j8.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



stations = [
    {"id":"ST001","name":"Bay of Bengal North","lat":12.25,"lon":82.45,"depth":10,"temperature":28.4,"salinity":34.8,"current_speed":0.82},
    {"id":"ST002","name":"Bay of Bengal East","lat":11.10,"lon":83.20,"depth":20,"temperature":29.1,"salinity":35.1,"current_speed":0.67},
    {"id":"ST003","name":"Bay of Bengal Central","lat":10.25,"lon":84.15,"depth":50,"temperature":27.9,"salinity":34.5,"current_speed":0.91},
    {"id":"ST004","name":"Bay of Bengal South","lat":9.10,"lon":85.00,"depth":100,"temperature":26.8,"salinity":35.3,"current_speed":0.54},
    {"id":"ST005","name":"Sri Lanka Basin","lat":7.80,"lon":82.70,"depth":200,"temperature":25.9,"salinity":35.0,"current_speed":0.48},
    {"id":"ST006","name":"Andaman Sea","lat":12.80,"lon":92.20,"depth":50,"temperature":28.8,"salinity":34.2,"current_speed":1.05},
]

def model_value(station, parameter):
    # Deterministic sample model values for the demo.
    offset = {"ST001":0.2, "ST002":-0.2, "ST003":0.3, "ST004":0.3, "ST005":-0.1, "ST006":0.4}[station["id"]]
    if parameter == "temperature":
        return round(station["temperature"] + offset, 2)
    if parameter == "salinity":
        return round(station["salinity"] + offset * 0.35, 2)
    return round(station["current_speed"] + offset * 0.12, 2)

@app.get("/")
def root():
    return {"name":"OceanVision 3D API","status":"running"}

@app.get("/api/stations")
def get_stations(parameter: str = Query("temperature")):
    return [
        {
            **s,
            "model_value": model_value(s, parameter),
            "difference": round(model_value(s, parameter) - s[parameter], 2)
        }
        for s in stations
    ]

@app.get("/api/stations/{station_id}")
def get_station(station_id: str, parameter: str = Query("temperature")):
    station = next((s for s in stations if s["id"] == station_id), None)
    if not station:
        return {"error":"Station not found"}
    mv = model_value(station, parameter)
    return {**station, "model_value": mv, "difference": round(mv - station[parameter], 2)}

@app.get("/api/timeseries/{station_id}")
def timeseries(station_id: str, parameter: str = Query("temperature")):
    station = next((s for s in stations if s["id"] == station_id), None)
    if not station:
        return {"error":"Station not found"}
    base = station[parameter]
    model = model_value(station, parameter)
    rows = []
    for hour in range(0, 24, 2):
        wave = sin(radians(hour * 15))
        rows.append({
            "time": f"{hour:02d}:00",
            "observed": round(base + wave * (0.25 if parameter != "current_speed" else 0.04), 2),
            "model": round(model + wave * (0.18 if parameter != "current_speed" else 0.03), 2)
        })
    return rows

@app.get("/api/anomalies")
def anomalies(threshold: Optional[float] = None, parameter: str = Query("temperature")):
    if threshold is None:
        threshold = 0.7 if parameter == "temperature" else (0.4 if parameter == "salinity" else 0.12)
    result = []
    for s in stations:
        diff = abs(model_value(s, parameter) - s[parameter])
        if diff > threshold:
            result.append({
                "station_id": s["id"],
                "name": s["name"],
                "difference": round(diff, 2),
                "threshold": threshold,
                "parameter": parameter
            })
    return result
