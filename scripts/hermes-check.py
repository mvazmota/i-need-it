#!/usr/bin/env python3
"""Ask Hermes to check due wishlist prices and post them back to ineedit.

Run manually on the Pi:
    python3 scripts/hermes-check.py
    python3 scripts/hermes-check.py --all

The scheduled run is handled by deploy/ineedit-hermes-check.timer.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env(path: Path, override: bool = False) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if override or key not in os.environ:
            os.environ[key] = value


load_env(BASE_DIR / ".env")
load_env(BASE_DIR / ".env.local", override=True)

APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:3000").rstrip("/")
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "").strip()
HERMES_BIN = os.environ.get(
    "HERMES_BIN", "/home/martin/.hermes/hermes-agent/.hermes/bin/hermes"
)
HERMES_HOME = os.environ.get("HERMES_HOME", "/home/martin/.hermes")
HERMES_TOOLSETS = os.environ.get("HERMES_TOOLSETS", "web,browser")
HERMES_TIMEOUT = int(os.environ.get("HERMES_CHECK_TIMEOUT", "240"))
MAX_ITEMS = int(os.environ.get("HERMES_CHECK_MAX_ITEMS", "20"))


def log(message: str) -> None:
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] {message}", flush=True)


def api(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    body = None
    headers = {
        "Authorization": f"Bearer {WORKER_TOKEN}",
        "Accept": "application/json",
    }
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{APP_URL}{path}", data=body, headers=headers, method=method
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def hermes_prompt(item: dict) -> str:
    lines = [
        "You are a price checker for a personal wishlist. Use your browser/web tools.",
        f"Open this exact product URL: {item['url']}",
        f"Product title: {item.get('title') or 'unknown'}",
        f"Stored currency: {item.get('currency') or 'EUR'}",
        "Find the current selling price for the default variant. Do not add to cart, do not buy, and do not use search results.",
    ]
    if item.get("priceSelector"):
        lines.append(
            f"If possible, read the price from this CSS selector: {item['priceSelector']}"
        )
    lines.extend(
        [
            "Reply with ONLY one compact JSON object and no markdown, explanation, or currency symbols in the number.",
            'On success: {"price": 94.00, "currency": "EUR", "availability": "in_stock"}',
            'If the page is blocked or has no price: {"error": "short reason"}',
            'availability must be one of: "in_stock", "out_of_stock", "preorder", "backorder", "unknown".',
        ]
    )
    return "\n".join(lines)


def strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def extract_result(text: str) -> dict | None:
    text = strip_ansi(text).replace("```json", "").replace("```", "")
    decoder = json.JSONDecoder()
    candidates: list[dict] = []
    for index, character in enumerate(text):
        if character != "{":
            continue
        try:
            value, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            candidates.append(value)

    for candidate in reversed(candidates):
        if "price" in candidate or "error" in candidate:
            return candidate
    return None


def parse_price(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        return number if number > 0 else None

    text = str(value).replace("\u00a0", " ").strip()
    text = re.sub(r"[^\d.,-]", "", text)
    if not text:
        return None

    last_dot = text.rfind(".")
    last_comma = text.rfind(",")

    if last_dot != -1 and last_comma != -1:
        if last_comma > last_dot:
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif last_comma != -1:
        parts = text.split(",")
        if len(parts) == 2 and 1 <= len(parts[1]) <= 2:
            text = f"{parts[0]}.{parts[1]}"
        else:
            text = text.replace(",", "")
    elif last_dot != -1:
        parts = text.split(".")
        if len(parts) == 2 and len(parts[1]) == 3:
            text = parts[0] + parts[1]

    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None


def normalize_availability(value: object) -> str | None:
    text = str(value or "").lower().replace("_", " ").replace("-", " ")
    if "out" in text:
        return "out_of_stock"
    if "pre" in text:
        return "preorder"
    if "back" in text:
        return "backorder"
    if "in" in text and "stock" in text:
        return "in_stock"
    return None


def run_hermes(item: dict) -> dict:
    env = os.environ.copy()
    env["HERMES_HOME"] = HERMES_HOME
    env.setdefault(
        "PATH",
        ":".join(
            [
                "/home/martin/.hermes/hermes-agent/node_modules/.bin",
                "/home/martin/.hermes/tools/node-26.12.1-linux-arm64/bin",
                "/home/martin/.hermes/tools/npm-12.0.2-linux-arm64/bin",
                "/home/martin/.local/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
            ]
        ),
    )

    command = [
        HERMES_BIN,
        "--yolo",
        "-t",
        HERMES_TOOLSETS,
        "-z",
        hermes_prompt(item),
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=HERMES_TIMEOUT,
            env=env,
            cwd=str(Path.home()),
        )
    except subprocess.TimeoutExpired:
        return {"error": f"Hermes timed out after {HERMES_TIMEOUT}s."}
    except OSError as error:
        return {"error": f"Could not start Hermes: {error}"}

    if completed.returncode != 0:
        detail = strip_ansi(
            (completed.stderr or completed.stdout or "").strip()
        ).splitlines()
        tail = detail[-1] if detail else f"exit code {completed.returncode}"
        return {"error": f"Hermes failed: {tail[:400]}"}

    result = extract_result(completed.stdout)
    if not result:
        tail = strip_ansi(completed.stdout.strip()).splitlines()
        last = tail[-1] if tail else "empty response"
        return {"error": f"Hermes returned no JSON: {last[:400]}"}
    return result


def check_item(item: dict) -> bool:
    log(f"checking {item['title']} -> {item['url']}")
    result = run_hermes(item)

    if result.get("error"):
        message = str(result["error"])[:500]
        log(f"  failed: {message}")
        try:
            api(
                f"/api/hermes/items/{item['id']}/result",
                method="POST",
                payload={"error": message},
            )
        except Exception as error:  # noqa: BLE001 - report and continue
            log(f"  could not report failure: {error}")
        return False

    price = parse_price(result.get("price"))
    if price is None:
        log(f"  failed: no usable price in {result!r}")
        try:
            api(
                f"/api/hermes/items/{item['id']}/result",
                method="POST",
                payload={"error": "Hermes returned an unreadable price."},
            )
        except Exception as error:  # noqa: BLE001
            log(f"  could not report failure: {error}")
        return False

    currency = str(result.get("currency") or item.get("currency") or "EUR").upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        currency = item.get("currency") or "EUR"

    payload = {
        "priceCents": round(price * 100),
        "currency": currency,
        "availability": normalize_availability(result.get("availability")),
    }

    try:
        response = api(
            f"/api/hermes/items/{item['id']}/result",
            method="POST",
            payload=payload,
        )
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        log(f"  app rejected price: HTTP {error.code} {body[:300]}")
        return False
    except Exception as error:  # noqa: BLE001
        log(f"  could not post price: {error}")
        return False

    if response.get("ok"):
        log(
            f"  saved {currency} {price:.2f}"
            + ("" if response.get("inserted", True) else " (unchanged)")
        )
        return True

    log(f"  app response: {response}")
    return False


def fetch_due(force_all: bool) -> list[dict]:
    suffix = "?all=1" if force_all else ""
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return api(f"/api/hermes/due{suffix}").get("items", [])
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(3)
    raise RuntimeError(f"Could not fetch due items: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="check every watching item, not just due ones",
    )
    args = parser.parse_args()

    if not WORKER_TOKEN:
        log("WORKER_TOKEN is not set; add it to .env on the Pi.")
        return 2

    try:
        items = fetch_due(args.all)[:MAX_ITEMS]
    except Exception as error:  # noqa: BLE001
        log(str(error))
        return 1

    if not items:
        log("nothing due")
        return 0

    log(f"checking {len(items)} item(s) with Hermes")
    ok = 0
    for index, item in enumerate(items):
        if check_item(item):
            ok += 1
        if index < len(items) - 1:
            time.sleep(2)

    log(f"done: {ok} ok, {len(items) - ok} failed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
