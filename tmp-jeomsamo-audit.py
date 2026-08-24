import collections
import datetime
import json
import urllib.parse
import urllib.request

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
BASE = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app/clubs/morning"


def req(url, data=None, method=None):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method or ("POST" if data is not None else "GET"),
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        return json.loads(raw.decode("utf-8")) if raw else None


def auth_token():
    res = req(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
        {"returnSecureToken": True},
    )
    return res["idToken"]


TOKEN = auth_token()


def get(path):
    return req(f"{BASE}/{path}.json?auth={urllib.parse.quote(TOKEN)}")


def as_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return [item for item in value if item]
    if isinstance(value, dict):
        return list(value.values())
    return []


def iso_week(date_value):
    try:
        date = datetime.date.fromisoformat(str(date_value)[:10])
        year, week, _ = date.isocalendar()
        return f"{year}-W{week:02d}"
    except Exception:
        return ""


settings = get("settings") or {}
leagues = settings.get("leagues") or {}
meta = get("meta") or {}
matches = as_list(get("matches"))
players = as_list(get("players"))

print("LEAGUES")
for league_id, league in leagues.items():
    print(
        league_id,
        league.get("name"),
        "kind=",
        league.get("kind"),
        "fmt=",
        league.get("fmt"),
        "day=",
        league.get("dayOfWeek"),
        "cup=",
        league.get("cup"),
    )

print("\ncounts total matches", len(matches), "players", len(players))
jeomsamo_ids = [
    league_id
    for league_id, league in leagues.items()
    if "점사모" in (league.get("name") or "")
]
print("jeom_ids", jeomsamo_ids)

for league_id in jeomsamo_ids:
    counts = collections.Counter()
    dates = collections.defaultdict(set)
    for match in matches:
        if match.get("lg") == league_id or match.get("league") == league_id:
            rd = match.get("rd") or match.get("round") or iso_week(match.get("date", ""))
            counts[rd] += 1
            if match.get("date"):
                dates[rd].add(match.get("date"))

    print("\nJUMSAMO", league_id, leagues[league_id].get("name"))
    for rd in sorted(counts):
        if str(rd).startswith("2026"):
            print(rd, counts[rd], ",".join(sorted(dates[rd])[:4]))

    print("\nMETA rounds containing lg")
    for key, value in sorted((meta.get("rounds") or {}).items()):
        if not isinstance(value, dict):
            continue
        if (
            str(key).startswith(f"{league_id}|2026")
            or str(key).startswith(f"{league_id}__2026")
            or value.get("lg") == league_id
            or value.get("league") == league_id
        ):
            print(
                key,
                "participants=",
                len(value.get("participants") or []),
                "fmt=",
                value.get("fmt"),
                "date=",
                value.get("date"),
                "title=",
                value.get("title"),
            )
