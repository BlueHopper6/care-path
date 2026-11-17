#!/usr/bin/env python3
"""Bounded unprivileged CarePath publication webhook receiver; never deploys code."""

import datetime as dt
import hashlib
import hmac
import http.server
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys
import threading
import time

MAX_BODY = 262144
MAX_HEADERS = 16384
PATH = "/hooks/carepath/publication"
REPOSITORY = "bluehopper6/carepath"


class Refused(Exception):
    """Fixed error surface so untrusted callers never learn internal diagnostics."""


def require(value):
    if not value:
        raise Refused("Publication notification refused.")


def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def parse(raw, bound):
    require(len(raw) <= bound)
    try:
        value = json.loads(raw, object_pairs_hook=unique, parse_constant=lambda _: require(False))
    except (ValueError, UnicodeError, RecursionError):
        raise Refused("Publication notification refused.") from None
    require(type(value) is dict)
    return value


def positive(value):
    return type(value) is int and 0 < value <= 9007199254740991


def notification(raw, signature, event, secret, policy, now):
    require(0 < len(raw) <= MAX_BODY and 32 <= len(secret) <= 256)
    require(type(signature) is str and re.fullmatch(r"sha256=[a-f0-9]{64}", signature))
    require(hmac.compare_digest(signature, "sha256=" + hmac.new(secret, raw, hashlib.sha256).hexdigest()))
    require(event in {"workflow_run", "ping"})
    body = parse(raw, MAX_BODY)
    if event == "ping":
        repo = body.get("repository")
        require(
            type(repo) is dict
            and repo.get("id") == policy["repositoryId"]
            and str(repo.get("full_name", "")).lower() == REPOSITORY
        )
        return None
    require(body.get("action") == "completed")
    repo, workflow, run = (body.get(key) for key in ("repository", "workflow", "workflow_run"))
    require(all(type(item) is dict for item in (repo, workflow, run)))
    require(
        repo.get("id") == policy["repositoryId"]
        and positive(repo.get("id"))
        and str(repo.get("full_name", "")).lower() == REPOSITORY
        and repo.get("default_branch") == "main"
    )
    require(
        workflow.get("id") == policy["workflowId"]
        and positive(workflow.get("id"))
        and workflow.get("path") == ".github/workflows/deploy.yaml"
        and run.get("workflow_id") == workflow["id"]
        and run.get("path") == workflow["path"]
        and positive(run.get("id"))
        and run.get("head_branch") == "main"
        and run.get("status") == "completed"
        and run.get("conclusion") == "success"
        and type(run.get("run_attempt")) is int
        and run["run_attempt"] == 1
        and run.get("event") in ("workflow_run", "workflow_dispatch")
        and isinstance(run.get("head_sha"), str)
        and re.fullmatch(r"[a-f0-9]{40}", run["head_sha"])
    )
    head = run.get("head_repository")
    require(
        type(head) is dict
        and head.get("id") == repo["id"]
        and str(head.get("full_name", "")).lower() == REPOSITORY
    )
    try:
        updated = dt.datetime.fromisoformat(run["updated_at"].replace("Z", "+00:00"))
        require(updated.utcoffset() == dt.timedelta(0) and now - dt.timedelta(hours=24) <= updated <= now + dt.timedelta(minutes=5))
    except (KeyError, ValueError, TypeError, AttributeError):
        raise Refused("Publication notification refused.") from None
    return run["id"]


def sync(directory):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def safe_file(path, uid, bound):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(
            stat.S_ISREG(info.st_mode)
            and info.st_uid == uid
            and info.st_nlink == 1
            and not info.st_mode & 0o077
            and info.st_size <= bound
        )
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(bound + 1)
        require(len(raw) <= bound)
        return raw
    finally:
        os.close(fd)


def read_credential(path):
    import errno
    uid = os.geteuid()
    for parent in reversed(path.parents):
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(
            stat.S_ISREG(info.st_mode)
            and info.st_uid in (0, uid)
            and info.st_nlink in (0, 1)
            and not info.st_mode & 0o7022
            and 32 <= info.st_size <= 256
        )
        try:
            acl = os.getxattr(fd, "system.posix_acl_access")
        except OSError as error:
            require(error.errno in (errno.ENODATA, errno.ENOTSUP))
            acl = None
        if acl is None:
            require(info.st_uid == uid and stat.S_IMODE(info.st_mode) == 0o400)
        else:
            require(len(acl) == 44 and struct.unpack_from("<I", acl)[0] == 2)
            entries = [struct.unpack_from("<HHI", acl, offset) for offset in range(4, 44, 8)]
            require(
                stat.S_IMODE(info.st_mode) == 0o440
                and entries == [(1, 4, 0xFFFFFFFF), (2, 4, uid), (4, 0, 0xFFFFFFFF), (16, 4, 0xFFFFFFFF), (32, 0, 0xFFFFFFFF)]
            )
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(257)
        require(len(raw) <= 256)
        return raw.strip()
    finally:
        os.close(fd)


class WakeStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = threading.Lock()

    def write_wake(self):
        with self.lock:
            target = self.directory / "wake"
            if os.path.lexists(target):
                return
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            try:
                with os.fdopen(fd, "wb", closefd=False) as stream:
                    stream.write(b"publication\n")
                    stream.flush()
                    os.fsync(stream.fileno())
                sync(self.directory)
            finally:
                os.close(fd)


class BoundedHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 16


def make_handler(secret, policy, wake_store, now_fn=lambda: dt.datetime.now(dt.timezone.utc)):
    class Handler(http.server.BaseHTTPRequestHandler):
        timeout = 5

        def log_message(self, format, *args):
            return

        def do_POST(self):
            if self.path != PATH:
                self.send_response(404)
                self.end_headers()
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                require(0 < length <= MAX_BODY)
                raw = self.rfile.read(length)
                require(len(raw) == length)
                sig = self.headers.get("X-Hub-Signature-256", "")
                event = self.headers.get("X-GitHub-Event", "")
                run_id = notification(raw, sig, event, secret, policy, now_fn())
                if run_id is not None:
                    wake_store.write_wake()
                    self.send_response(202)
                else:
                    self.send_response(204)
                self.end_headers()
            except (ValueError, Refused):
                self.send_response(403)
                self.end_headers()

    return Handler


def main():
    if not (sys.platform == "linux" and sys.flags.isolated == 1):
        raise SystemExit("Run with python3 -I -B.")
    cred_dir = os.environ.get("CREDENTIALS_DIRECTORY", "")
    require(cred_dir.startswith("/run/credentials/"))
    secret = read_credential(Path(cred_dir) / "webhook-secret")
    policy = parse(safe_file(Path("/etc/carepath-events/policy.json"), 0, 4096), 4096)
    require(set(policy) == {"repositoryId", "workflowId"} and positive(policy["repositoryId"]) and positive(policy["workflowId"]))
    wake_store = WakeStore("/var/lib/carepath-events")
    server = BoundedHTTPServer(("127.0.0.1", 3410), make_handler(secret, policy, wake_store))
    server.serve_forever()


if __name__ == "__main__":
    main()
