#!/usr/bin/env python3
"""Administrator-installed CarePath rollout entry point; no caller-selected paths/options."""

import hashlib
import os
from pathlib import Path
import socket
import stat
import sys
import tempfile
import time
import types

ROOT = Path("/opt/carepath")
POLICY_ROOT = Path("/etc/carepath-rollout")
ALLOWED_MODULES = {
    "carepath_release.py",
    "carepath_controller.py",
    "carepath_runtime.py",
    "carepath_router.py",
}


class Stopped(Exception):
    pass


SAFE_ERRORS = (Stopped,)


def pinned(name, digest):
    if name not in ALLOWED_MODULES:
        raise Stopped("Unexpected CarePath module.")
    path = ROOT / name
    for item in [*reversed(path.parents), path]:
        info = item.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise Stopped("Unsafe CarePath module path.")
    if not stat.S_ISREG(path.lstat().st_mode) or path.stat().st_size > 131072:
        raise Stopped("Invalid CarePath module type or bound.")
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise Stopped("Installed CarePath module hash differs from reviewed policy.")
    module = types.ModuleType(name.removesuffix(".py"))
    module.__file__ = str(path)
    exec(compile(raw, str(path), "exec"), module.__dict__)
    sys.modules[module.__name__] = module
    return module


def load():
    global SAFE_ERRORS
    if not (
        sys.platform == "linux"
        and os.geteuid() == 0
        and sys.flags.isolated == 1
        and socket.gethostname() == "h2-backend-vm"
    ):
        raise Stopped("Run isolated as administrator inside h2-backend-vm.")
    os.umask(0o077)
    policy_path = POLICY_ROOT / "policy.json"
    for item in [*reversed(policy_path.parents), policy_path]:
        info = item.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise Stopped("Unsafe CarePath rollout policy path.")
    import json
    policy = json.loads(policy_path.read_bytes())
    if (
        type(policy) is not dict
        or set(policy) != {"schemaVersion", "modules", "routerSha256", "receiverUid"}
        or policy["schemaVersion"] != 1
        or type(policy["modules"]) is not dict
        or set(policy["modules"]) != ALLOWED_MODULES
    ):
        raise Stopped("Invalid CarePath rollout policy.")

    g = pinned("carepath_release.py", policy["modules"]["carepath_release.py"])
    c = pinned("carepath_controller.py", policy["modules"]["carepath_controller.py"])
    r = pinned("carepath_router.py", policy["modules"]["carepath_router.py"])
    rt = pinned("carepath_runtime.py", policy["modules"]["carepath_runtime.py"])
    SAFE_ERRORS = (Stopped, g.ReleaseError, c.Unsafe)

    g.trusted_path(g.STATE, private=True, directory=True)
    g.trusted_path(g.CONFIG, private=True, directory=True)
    router = r.Router(c, g, policy["routerSha256"])
    runtime = rt.Runtime(c, g, router)

    def read_state():
        return c.validate(g.parse_json(g.read_private(g.STATE / "rollout.json", c.MAX_STATE), c.MAX_STATE))

    return g, c, runtime, read_state, policy


def atomic_json(g, path, value):
    g.require(path.parent == g.STATE and path.name in {"rollout.json", "last-check.json"}, "Unexpected state target.")
    g.trusted_path(g.STATE, private=True, directory=True)
    if os.path.lexists(path):
        g.trusted_path(path, private=True)
    payload = (g.json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=g.STATE)
    tmp = Path(tmp_name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb", closefd=False) as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
        g.sync_directory(g.STATE)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise
    finally:
        try:
            os.close(fd)
        except OSError:
            pass


def enabled(g):
    g.require(
        g.read_private(POLICY_ROOT / "enabled", 64).strip() == b"reviewed-carepath-rollout-enabled",
        "CarePath rollout is paused or not enabled.",
    )


def claim_hint(g, uid):
    incoming = Path("/var/lib/carepath-events/wake")
    claimed = incoming.with_name("claimed")
    inflight = g.STATE / "event-inflight"

    def check(path, owner):
        info = path.lstat()
        g.require(
            stat.S_ISREG(info.st_mode) and info.st_uid == owner and info.st_nlink == 1 and info.st_size <= 32 and not info.st_mode & 0o077,
            "Unsafe CarePath notification inode retained.",
        )

    if not os.path.lexists(inflight) and os.path.lexists(incoming):
        check(incoming, uid)
        g.require(not os.path.lexists(claimed), "Unexpected claimed CarePath notification retained.")
        fd = os.open(inflight, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, "wb", closefd=False) as stream:
                stream.write(b"publication\n")
                stream.flush()
                os.fsync(stream.fileno())
        finally:
            os.close(fd)
        g.sync_directory(g.STATE)
        try:
            os.rename(incoming, claimed)
        except FileNotFoundError:
            pass
        g.sync_directory(incoming.parent)

    if os.path.lexists(inflight):
        check(inflight, os.geteuid())
        if os.path.lexists(claimed):
            check(claimed, uid)
            claimed.unlink()
            g.sync_directory(incoming.parent)
        return inflight
    return None


def main():
    args = sys.argv[1:]
    g, c, runtime, read_state, policy = load()

    if args == ["status"]:
        state = read_state()
        print(
            g.json.dumps(
                {
                    "phase": state["phase"],
                    "revision": state["active"]["manifest"]["revision"],
                    "publication": state["active"]["manifest"]["releaseRunId"],
                    "slot": state["active"]["slot"],
                    "generation": state["generation"],
                    "priorRetained": state["prior"] is not None,
                    "queued": os.path.lexists("/var/lib/carepath-events/wake"),
                    "inflightHint": os.path.lexists(g.STATE / "event-inflight"),
                    "lastAttempt": state["lastAttempt"],
                }
            )
        )
        return

    if len(args) == 2 and args[0] == "verify":
        token = g.read_private(g.CONFIG / "github-read-token", 1024).decode().strip()
        manifest = g.verify_release(g.GitHub(token), args[1])
        print(g.json.dumps(manifest))
        return

    if len(args) == 2 and args[0] == "bootstrap":
        enabled(g)
        with g.release_lock(g.STATE / "rollout.lock"):
            g.require(not os.path.lexists(g.STATE / "rollout.json"), "CarePath rollout state already exists.")
            token = g.read_private(g.CONFIG / "github-read-token", 1024).decode().strip()
            gh = g.GitHub(token)
            manifest = g.verify_release(gh, args[1])
            images = runtime.pull(manifest)
            g.verify_release(gh, args[1])
            record = {
                "slot": "blue",
                "manifest": manifest,
                "frontendContainer": None,
                "backendContainer": None,
                "frontendImageId": images["frontendImageId"],
                "backendImageId": images["backendImageId"],
                "runtimeHash": runtime.runtime_identity(),
            }
            ids = runtime.create_and_start_pair(record)
            record = {**record, **ids}
            try:
                runtime.wait_ready(record)
            except Exception:
                runtime.stop_pair(record)
                runtime.cleanup_slot("blue")
                raise
            initial = {
                "schemaVersion": 1,
                "phase": "stable",
                "generation": 1,
                "active": record,
                "prior": None,
                "candidate": None,
                "lastAttempt": int(manifest["releaseRunId"]),
            }
            atomic_json(g, g.STATE / "rollout.json", initial)
            route = {"generation": 1, "active": record}
            if runtime.observed_route() is None:
                runtime.write_route_offline(route)
            else:
                runtime.ensure_route(route)
            print("bootstrapped-blue")
        return

    if args == ["boot"]:
        with g.release_lock(g.STATE / "rollout.lock"):
            c.Controller(runtime, read_state, lambda v: atomic_json(g, g.STATE / "rollout.json", v), time.monotonic).boot_offline()
        print("boot-ok")
        return

    if args == ["monitor"]:
        with g.release_lock(g.STATE / "rollout.lock"):
            state = read_state()
            if state["phase"] != "stable":
                c.Controller(runtime, read_state, lambda v: atomic_json(g, g.STATE / "rollout.json", v), time.monotonic).recover_or_boot()
            else:
                runtime.assert_pair(state["active"], healthy=True)
                runtime.ensure_route(c.route_for(state))
        print("monitor-ok")
        return

    if args == ["rollback"]:
        enabled(g)
        with g.release_lock(g.STATE / "rollout.lock"):
            c.Controller(runtime, read_state, lambda v: atomic_json(g, g.STATE / "rollout.json", v), time.monotonic).rollback()
        print("rolled-back")
        return

    if args == ["worker"]:
        enabled(g)
        with g.release_lock(g.STATE / "rollout.lock"):
            hint = claim_hint(g, policy["receiverUid"])
            result = "failed-review-required"
            try:
                token = g.read_private(g.CONFIG / "github-read-token", 1024).decode().strip()
                gh = g.GitHub(token)
                run_id = g.discover_latest(gh)
                if not run_id:
                    result = "unchanged"
                else:
                    manifest = g.verify_release(gh, run_id)
                    ctrl = c.Controller(runtime, read_state, lambda v: atomic_json(g, g.STATE / "rollout.json", v), time.monotonic)
                    result = ctrl.deploy(manifest, lambda: g.verify_release(gh, run_id), time.sleep)
            finally:
                atomic_json(
                    g,
                    g.STATE / "last-check.json",
                    {"time": int(time.time()), "result": result, "trigger": "event" if hint else "reconciliation"},
                )
                if hint and os.path.lexists(hint):
                    hint.unlink()
                    g.sync_directory(g.STATE)
            print(result)
        return

    raise Stopped("Usage: carepath_rollout.py status|verify RUN_ID|bootstrap RUN_ID|worker|monitor|boot|rollback")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(
            str(error) if isinstance(error, SAFE_ERRORS) else "CarePath rollout stopped; preserve private state and inspect diagnostics.",
            file=sys.stderr,
        )
        raise SystemExit(1)
