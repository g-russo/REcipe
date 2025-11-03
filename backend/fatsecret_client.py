import os
import time
import requests

FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_SERVER_API = "https://platform.fatsecret.com/rest/server.api"

CLIENT_ID = os.getenv("FATSECRET_CLIENT_ID")
CLIENT_SECRET = os.getenv("FATSECRET_CLIENT_SECRET")

_token_cache = {"access_token": None, "expires_at": 0}

def _need_token_refresh() -> bool:
    return not _token_cache["access_token"] or time.time() >= _token_cache["expires_at"] - 30

def _fetch_token():
    if not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("FATSECRET_CLIENT_ID/SECRET not set")
    resp = requests.post(
        FATSECRET_TOKEN_URL,
        data={"grant_type": "client_credentials", "scope": "basic"},
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=15,
    )
    resp.raise_for_status()
    j = resp.json()
    _token_cache["access_token"] = j["access_token"]
    _token_cache["expires_at"] = time.time() + int(j.get("expires_in", 3600))

def get_token() -> str:
    if _need_token_refresh():
        _fetch_token()
    return _token_cache["access_token"]

def call_server_api(method: str, params: dict):
    token = get_token()
    data = {"method": method, "format": "json", **(params or {})}
    r = requests.post(
        FATSECRET_SERVER_API,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()