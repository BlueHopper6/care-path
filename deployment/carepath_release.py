#!/usr/bin/env python3
"""Administrator-installed CarePath release verifier. No repository code is executed."""

import contextlib
import datetime as dt
import hashlib
import io
import json
import os
import re
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

REPOSITORY = "bluehopper6/carepath"
API = "https://api.github.com/repos/" + REPOSITORY
FRONTEND_IMAGE = "ghcr.io/bluehopper6/carepath-frontend"
BACKEND_IMAGE = "ghcr.io/bluehopper6/carepath-backend"
ARTIFACT_NAME = "carepath-release"
CONFIG = Path("/etc/carepath")
STATE = Path("/var/lib/carepath-deployer")
MAX_JSON = 262144
MAX_ARCHIVE = 65536
MAX_MANIFEST = 4096
MAX_AGE = dt.timedelta(hours=24)

HEALTH_CMD = (
    "node -e \"fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(5000)})"
    ".then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""
)


class ReleaseError(Exception):
    """Safe diagnostic text only; upstream bodies, URLs and credentials stay private."""


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def identity(value):
    require(type(value) is int and 0 < value <= 9007199254740991, "Invalid numeric identity.")
    return value


def run_identity(value):
    require(isinstance(value, str) and re.fullmatch(r"[1-9][0-9]{0,15}", value), "Invalid run identity.")
    return identity(int(value))


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate metadata field.")
        result[key] = value
    return result


def parse_json(raw, limit=MAX_JSON):
    require(len(raw) <= limit, "Metadata exceeds its bound.")
    try:
        value = json.loads(
            raw,
            object_pairs_hook=unique_object,
            parse_constant=lambda _: require(False, "Invalid JSON number."),
        )
    except (ValueError, UnicodeError, RecursionError):
        raise ReleaseError("Invalid JSON metadata.") from None
    require(type(value) is dict, "Metadata must be an object.")
    return value


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 32, "Invalid metadata time.")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(parsed.utcoffset() == dt.timedelta(0), "Metadata time must be UTC.")
        return parsed
    except ValueError:
        raise ReleaseError("Invalid metadata time.") from None


def trusted_path(path, *, private=False, directory=False, max_size=None):
    for item in [*reversed(path.parents), path]:
        info = item.lstat()
        require(not stat.S_ISLNK(info.st_mode), "Symlink path refused.")
        require(info.st_uid == 0 and not info.st_mode & 0o022, "Untrusted ownership or permissions.")
    info = path.lstat()
    if directory:
        require(stat.S_ISDIR(info.st_mode), "Expected directory.")
    else:
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "Expected regular single-link file.")
    if private:
        require(not info.st_mode & 0o077, "Private path must not be group/world accessible.")
    if max_size is not None:
        require(0 < info.st_size <= max_size, "File size out of bounds.")
    return info


def read_private(path, limit=65536):
    trusted_path(path, private=True, max_size=limit)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(
            stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077 and info.st_size <= limit,
            "Unsafe private file descriptor.",
        )
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(limit + 1)
        require(len(raw) <= limit, "Private file exceeds bound.")
        return raw
    finally:
        os.close(fd)


def sync_directory(directory):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


@contextlib.contextmanager
def release_lock(path):
    import fcntl
    trusted_path(path.parent, private=True, directory=True)
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077, "Unsafe lock file.")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ReleaseError("Another CarePath rollout operation is already running.") from None
        yield
    finally:
        os.close(fd)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHub:
    def __init__(self, token):
        require(isinstance(token, str) and re.fullmatch(r"[A-Za-z0-9_]{16,512}", token), "Invalid API credential format.")
        self.token = token
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, url, limit, authenticated=True, redirect=False):
        if authenticated:
            require(url.startswith(API + "/") or url == API, "Invalid API destination.")
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "carepath-guest-verifier",
            "X-GitHub-Api-Version": "2022-11-28",
            "Accept-Encoding": "identity",
        }
        if authenticated:
            headers["Authorization"] = "Bearer " + self.token
        started = time.monotonic()
        try:
            response = self.opener.open(urllib.request.Request(url, headers=headers), timeout=10)
        except urllib.error.HTTPError as error:
            try:
                if redirect and error.code == 302:
                    location = error.headers.get("Location", "")
                    require(len(location) <= 8192, "Artifact redirect exceeds its bound.")
                    return location
            finally:
                error.close()
            raise ReleaseError("Authenticated release metadata unavailable.") from None
        except (OSError, ValueError):
            raise ReleaseError("Release request failed.") from None
        with response:
            require(not redirect and response.status == 200, "Unexpected release response.")
            length = response.headers.get("Content-Length")
            require(length is None or (length.isdecimal() and int(length) <= limit), "Release response exceeds its bound.")
            require(response.headers.get("Content-Encoding", "identity") == "identity", "Unexpected release encoding.")
            chunks, size = [], 0
            try:
                while True:
                    require(time.monotonic() - started < 30, "Release request deadline exceeded.")
                    chunk = response.read1(min(8192, limit - size + 1))
                    if not chunk:
                        break
                    size += len(chunk)
                    require(size <= limit, "Release response exceeds its bound.")
                    chunks.append(chunk)
            except OSError:
                raise ReleaseError("Release response failed.") from None
            return b"".join(chunks)

    def get(self, path):
        require(path == "" or (path.startswith("/") and ".." not in path), "Invalid API path.")
        return parse_json(self.request(API + path, MAX_JSON))

    def archive(self, artifact_id):
        identity(artifact_id)
        location = self.request(API + "/actions/artifacts/" + str(artifact_id) + "/zip", MAX_ARCHIVE, redirect=True)
        try:
            url = urllib.parse.urlsplit(location)
            host = url.hostname or ""
            require(
                url.scheme == "https"
                and not url.username
                and not url.password
                and url.port in (None, 443)
                and not url.fragment
                and any(
                    host.endswith(suffix)
                    for suffix in (".blob.core.windows.net", ".githubusercontent.com", ".actions.githubusercontent.com")
                ),
                "Unexpected artifact download destination.",
            )
        except ValueError:
            raise ReleaseError("Invalid artifact download destination.") from None
        return self.request(location, MAX_ARCHIVE, authenticated=False)


def manifest_from_archive(raw, expected_digest):
    require(len(raw) <= MAX_ARCHIVE, "Release archive exceeds its bound.")
    require(expected_digest == "sha256:" + hashlib.sha256(raw).hexdigest(), "Release archive digest mismatch.")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = archive.namelist()
            require(names == ["release.json"], "Unexpected release archive contents.")
            info = archive.getinfo("release.json")
            require(info.file_size <= MAX_MANIFEST and not info.is_dir(), "Release manifest exceeds bound.")
            data = archive.read("release.json")
    except zipfile.BadZipFile:
        raise ReleaseError("Invalid release archive.") from None
    return parse_json(data, MAX_MANIFEST)


def validate_manifest(manifest, run_id, main_sha):
    require(
        set(manifest)
        == {"schemaVersion", "repository", "revision", "verificationRunId", "releaseRunId", "frontend", "backend"},
        "Invalid release manifest schema.",
    )
    require(manifest["schemaVersion"] == 1, "Unsupported manifest schemaVersion.")
    require(manifest["repository"] == REPOSITORY, "Unexpected manifest repository.")
    require(isinstance(manifest["revision"], str) and re.fullmatch(r"[a-f0-9]{40}", manifest["revision"]), "Invalid revision.")
    require(manifest["revision"] == main_sha, "Release revision does not match current main.")
    require(manifest["releaseRunId"] == str(run_id), "Release run ID mismatch.")
    run_identity(manifest["verificationRunId"])

    expected = {"frontend": FRONTEND_IMAGE, "backend": BACKEND_IMAGE}
    for key, image_name in expected.items():
        part = manifest[key]
        require(type(part) is dict and set(part) == {"image", "digest"}, f"Invalid {key} image entry.")
        require(part["image"] == image_name, f"Unexpected {key} image repository.")
        require(isinstance(part["digest"], str) and re.fullmatch(r"sha256:[a-f0-9]{64}", part["digest"]), f"Invalid {key} digest.")
    return manifest


def validate_run(run, workflow_path, expected_sha, now, allowed_events):
    require(type(run) is dict, "Missing workflow run metadata.")
    require(run.get("path") == workflow_path, "Unexpected workflow path.")
    require(run.get("head_branch") == "main", "Workflow run must target main.")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "Workflow run is not successful.")
    require(run.get("run_attempt") == 1, "Workflow run attempt must be 1.")
    require(run.get("event") in allowed_events, "Workflow trigger event is not allowed.")
    head_repo = run.get("head_repository")
    require(type(head_repo) is dict and str(head_repo.get("full_name", "")).lower() == REPOSITORY, "Fork or external repository refused.")
    sha = run.get("head_sha")
    require(isinstance(sha, str) and re.fullmatch(r"[a-f0-9]{40}", sha), "Invalid workflow commit SHA.")
    if expected_sha is not None:
        require(sha == expected_sha, "Workflow commit SHA mismatch.")
    updated = timestamp(run.get("updated_at"))
    require(now - MAX_AGE <= updated <= now + dt.timedelta(minutes=5), "Workflow metadata is stale or clock-skewed.")
    return sha


def verify_release(gh, run_id_str, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    rid = run_identity(run_id_str)
    repo = gh.get("")
    require(str(repo.get("full_name", "")).lower() == REPOSITORY and repo.get("default_branch") == "main", "Repository identity mismatch.")
    main_ref = gh.get("/git/ref/heads/main")
    main_sha = main_ref.get("object", {}).get("sha")
    require(isinstance(main_sha, str) and re.fullmatch(r"[a-f0-9]{40}", main_sha), "Invalid main ref SHA.")

    pub_run = gh.get("/actions/runs/" + str(rid))
    require(pub_run.get("id") == rid, "Publication run ID mismatch.")
    pub_sha = validate_run(pub_run, ".github/workflows/deploy.yaml", main_sha, now, {"workflow_run", "workflow_dispatch"})

    artifacts_resp = gh.get("/actions/runs/" + str(rid) + "/artifacts")
    artifacts = artifacts_resp.get("artifacts")
    require(type(artifacts) is list and len(artifacts) <= 20, "Invalid artifact list.")
    matches = [a for a in artifacts if type(a) is dict and a.get("name") == ARTIFACT_NAME]
    require(len(matches) == 1, "Expected exactly one carepath-release artifact.")
    artifact = matches[0]
    require(artifact.get("expired") is False, "Release artifact has expired.")
    require(type(artifact.get("size_in_bytes")) is int and 0 < artifact["size_in_bytes"] <= MAX_ARCHIVE, "Artifact size out of bounds.")
    digest = artifact.get("digest")
    require(isinstance(digest, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", digest), "Missing artifact SHA-256 digest.")

    archive_bytes = gh.archive(artifact["id"])
    manifest = validate_manifest(manifest_from_archive(archive_bytes, digest), rid, pub_sha)

    ver_id = run_identity(manifest["verificationRunId"])
    ver_run = gh.get("/actions/runs/" + str(ver_id))
    require(ver_run.get("id") == ver_id, "Verification run ID mismatch.")
    allowed_ver_events = {"push"} if pub_run["event"] == "workflow_run" else {"push", "workflow_dispatch", "schedule"}
    validate_run(ver_run, ".github/workflows/verify.yaml", pub_sha, now, allowed_ver_events)
    return manifest


def discover_latest(gh, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    main_ref = gh.get("/git/ref/heads/main")
    main_sha = main_ref.get("object", {}).get("sha")
    require(isinstance(main_sha, str) and re.fullmatch(r"[a-f0-9]{40}", main_sha), "Invalid main ref SHA.")
    runs_resp = gh.get("/actions/workflows/deploy.yaml/runs?branch=main&status=success&per_page=20")
    runs = runs_resp.get("workflow_runs")
    require(type(runs) is list, "Invalid deploy runs response.")
    for run in runs:
        if (
            type(run) is dict
            and run.get("head_sha") == main_sha
            and run.get("head_branch") == "main"
            and run.get("conclusion") == "success"
            and run.get("run_attempt") == 1
        ):
            updated = timestamp(run.get("updated_at", ""))
            if now - MAX_AGE <= updated <= now + dt.timedelta(minutes=5):
                return str(run["id"])
    return None


class Docker:
    BASE_ENV = {"PATH": "/usr/bin:/bin", "HOME": "/nonexistent", "LANG": "C", "DOCKER_HOST": "unix:///var/run/docker.sock"}

    def __init__(self, registry_config=CONFIG / "registry" / "config.json"):
        self.registry_config = registry_config
        self.env = {**self.BASE_ENV, "DOCKER_CONFIG": "/nonexistent"}

    def call(self, *args, capture=False, timeout=120, env=None):
        result = subprocess.run(
            ["/usr/bin/docker", *args],
            env=env or self.env,
            cwd="/",
            stdin=subprocess.DEVNULL,
            capture_output=capture,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise ReleaseError(f"Docker command failed ({args[0]} {args[1] if len(args) > 1 else ''}).")
        return result.stdout.strip() if capture else ""

    def _validate_registry_config(self):
        trusted_path(self.registry_config.parent, private=True, directory=True)
        cfg = parse_json(read_private(self.registry_config, 16384), 16384)
        require(set(cfg) == {"auths"} and type(cfg["auths"]) is dict and set(cfg["auths"]) == {"ghcr.io"}, "Invalid registry auth config.")
        entry = cfg["auths"]["ghcr.io"]
        require(type(entry) is dict and set(entry) == {"auth"} and isinstance(entry["auth"], str) and 16 <= len(entry["auth"]) <= 4096, "Invalid GHCR auth token.")

    def _pull_and_verify_image(self, image_name, digest, revision):
        ref = f"{image_name}@{digest}"
        pull_env = {**self.BASE_ENV, "DOCKER_CONFIG": str(self.registry_config.parent)}
        self.call("pull", ref, timeout=300, env=pull_env)
        fmt = '{{.Id}}|{{.Os}}|{{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{index .Config.Labels "org.opencontainers.image.source"}}'
        raw = self.call("image", "inspect", "--format", fmt, ref, capture=True)
        parts = raw.split("|")
        require(len(parts) == 5, "Invalid pulled image inspection metadata.")
        image_id, os_name, arch, rev_label, src_label = parts
        require(re.fullmatch(r"sha256:[a-f0-9]{64}", image_id), "Invalid local image ID.")
        require(os_name == "linux" and arch == "amd64", "Unexpected image platform.")
        require(rev_label == revision, "Image revision label mismatch.")
        require(src_label.lower() == f"https://github.com/{REPOSITORY}", "Image source label mismatch.")
        return image_id

    def prepare(self, manifest):
        self._validate_registry_config()
        return {
            "frontendImageId": self._pull_and_verify_image(
                manifest["frontend"]["image"], manifest["frontend"]["digest"], manifest["revision"]
            ),
            "backendImageId": self._pull_and_verify_image(
                manifest["backend"]["image"], manifest["backend"]["digest"], manifest["revision"]
            ),
        }
