"""Dedicated CarePath Traefik file-provider routing; no Docker provider or proxy reloads."""

import hashlib
import http.client
import json
import os
from pathlib import Path
import time

BINARY = "/opt/carepath-router/traefik"
CONFIG = Path("/etc/carepath-router/dynamic/routes.yml")
HOST_HEADER = "carepath.vilohit.dev"


def route_hash(route):
    canonical = json.dumps(route, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()[:16]


def configuration(route, c):
    c.require(set(route) == {"generation", "active"} and c.integer(route["generation"], 1), "Invalid route object.")
    c.record(route["active"])
    identity = route_hash(route)
    slot = route["active"]["slot"]
    port = c.SLOTS[slot]
    service_name = "active-" + identity
    routers = {
        service_name: {
            "entryPoints": ["app"],
            "priority": 10,
            "rule": "PathPrefix(`/`)",
            "service": service_name,
            "middlewares": ["origin"],
        }
    }
    services = {
        service_name: {
            "loadBalancer": {
                "servers": [{"url": f"http://127.0.0.1:{port}"}],
            }
        }
    }
    middlewares = {
        "origin": {
            "headers": {
                "customRequestHeaders": {
                    "Host": HOST_HEADER,
                    "X-Forwarded-Host": HOST_HEADER,
                    "X-Forwarded-Proto": "https",
                }
            }
        }
    }
    return json.dumps(
        {"http": {"routers": routers, "services": services, "middlewares": middlewares}},
        sort_keys=True,
        separators=(",", ":"),
    ).encode()


def static_configuration():
    return {
        "entryPoints": {
            "app": {
                "address": "127.0.0.1:3400",
                "transport": {
                    "lifeCycle": {"graceTimeOut": "75s"},
                    "respondingTimeouts": {"readTimeout": "90s", "writeTimeout": "90s", "idleTimeout": "60s"},
                },
            },
            "traefik": {"address": "127.0.0.1:3401"},
        },
        "providers": {
            "providersThrottleDuration": "100ms",
            "file": {"directory": str(CONFIG.parent), "watch": True},
        },
        "api": {"insecure": True, "dashboard": False},
        "log": {"level": "ERROR"},
        "global": {"checkNewVersion": False, "sendAnonymousUsage": False},
    }


def observe(expected_uid=None, api_port=3401):
    if expected_uid is not None:
        owners = {}
        # 127.0.0.1:3400 -> 0100007F:0D48, 127.0.0.1:3401 -> 0100007F:0D49
        for row in Path("/proc/net/tcp").read_text().splitlines()[1:]:
            fields = row.split()
            if len(fields) > 7 and fields[1] in {"0100007F:0D48", "0100007F:0D49"} and fields[3] == "0A":
                owners[fields[1]] = int(fields[7])
        if owners != {"0100007F:0D48": expected_uid, "0100007F:0D49": expected_uid}:
            return None

    connection = http.client.HTTPConnection("127.0.0.1", api_port, timeout=3)
    try:
        connection.request("GET", "/api/http/routers", headers={"Connection": "close"})
        response = connection.getresponse()
        raw = response.read(65537)
        if response.status != 200 or len(raw) > 65536:
            return None
        routers = json.loads(raw)
        if type(routers) is not list or len(routers) > 16:
            return None
        identities = set()
        for item in routers:
            name = item.get("name", "")
            if name.endswith("@file") and item.get("status") != "enabled":
                return None
            if name.startswith("active-") and name.endswith("@file") and item.get("status") == "enabled":
                identities.add(name[len("active-") : -len("@file")])
        return next(iter(identities)) if len(identities) == 1 else None
    except (OSError, ValueError, http.client.HTTPException, AttributeError):
        return None
    finally:
        connection.close()


class Router:
    def __init__(self, c, g, binary_hash, *, config_path=CONFIG, api_port=3401, expected_uid=None):
        self.c, self.g = c, g
        self.config_path = config_path
        self.api_port = api_port
        if expected_uid is None and binary_hash is not None:
            import pwd
            self.uid = pwd.getpwnam("carepath-router").pw_uid
        else:
            self.uid = expected_uid
        if binary_hash is not None:
            binary = Path(BINARY)
            g.trusted_path(binary)
            c.require(
                binary.stat().st_size <= 256 * 1024 * 1024
                and hashlib.sha256(binary.read_bytes()).hexdigest() == binary_hash,
                "CarePath Traefik binary differs from reviewed installation.",
            )

    def observed_route(self):
        return observe(self.uid, api_port=self.api_port)

    def _write_config(self, payload):
        self.g.trusted_path(self.config_path.parent, directory=True)
        tmp = self.config_path.with_name(f".routes.{os.getpid()}.tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(tmp, self.config_path)
            self.g.sync_directory(self.config_path.parent)
        except Exception:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            raise

    def write_route_offline(self, route):
        payload = configuration(route, self.c)
        self._write_config(payload)
        return route_hash(route)

    def switch(self, route, authorized_hashes):
        target_hash = route_hash(route)
        self.c.require(target_hash in authorized_hashes, "Requested CarePath route is not authorized.")
        payload = configuration(route, self.c)
        self._write_config(payload)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.observed_route() == target_hash:
                return target_hash
            time.sleep(0.15)
        raise self.c.Unsafe("CarePath router did not confirm updated route generation.")

    def ensure_route(self, route):
        target_hash = route_hash(route)
        if self.observed_route() == target_hash:
            return target_hash
        return self.switch(route, {target_hash})
