"""Fixed Linux Docker runtime effects for CarePath blue/green slots."""

import hashlib
import http.client
import json
import os
from pathlib import Path
import time

NETWORKS = {"blue": "carepath-blue-net", "green": "carepath-green-net"}
FRONTEND_NAMES = {"blue": "carepath-frontend-blue", "green": "carepath-frontend-green"}
BACKEND_NAMES = {"blue": "carepath-backend-blue", "green": "carepath-backend-green"}


class Runtime:
    def __init__(self, c, g, router):
        self.c = c
        self.g = g
        self.router = router
        self.docker = g.Docker()

    def observed_route(self):
        return self.router.observed_route()

    def route_hash(self, route):
        import carepath_router
        return carepath_router.route_hash(route)

    def switch(self, route):
        target_hash = self.route_hash(route)
        self.router.switch(route, {target_hash})

    def ensure_route(self, route):
        self.router.ensure_route(route)

    def write_route_offline(self, route):
        self.router.write_route_offline(route)

    def drain(self, seconds):
        time.sleep(seconds)

    def runtime_identity(self):
        h = hashlib.sha256()
        h.update(self.g.read_private(self.g.CONFIG / "frontend.env", 65536))
        h.update(b"\0")
        h.update(self.g.read_private(self.g.CONFIG / "backend.env", 65536))
        return h.hexdigest()

    def headroom(self):
        values = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
        avail_kb = int(values["MemAvailable"].split()[0])
        self.c.require(avail_kb >= 1280 * 1024, "Insufficient available memory for CarePath slot overlap.")
        space = os.statvfs("/var/lib/docker")
        self.c.require(space.f_bavail * space.f_frsize >= 2 * 1024 ** 3, "Insufficient Docker filesystem space.")

    def pull(self, manifest):
        return self.docker.prepare(manifest)

    def _ensure_network(self, slot):
        net_name = NETWORKS[slot]
        found = self.docker.call("network", "ls", "--filter", f"name=^{net_name}$", "--format", "{{.Name}}", capture=True)
        if not found:
            self.docker.call("network", "create", "--driver", "bridge", net_name)

    def _inspect_container(self, name):
        found = self.docker.call("container", "ls", "--all", "--filter", f"name=^/{name}$", "--format", "{{.Names}}", capture=True)
        self.c.require(found in ("", name))
        if not found:
            return None
        fields = (
            ".Id",
            ".Image",
            ".State.Running",
            ".State.Health.Status",
            ".Config.User",
            ".HostConfig.ReadonlyRootfs",
            ".HostConfig.Privileged",
            ".HostConfig.Binds",
            ".HostConfig.CapDrop",
            ".HostConfig.CapAdd",
            ".HostConfig.SecurityOpt",
            ".HostConfig.Memory",
            ".HostConfig.MemorySwap",
            ".HostConfig.NanoCpus",
            ".HostConfig.PidsLimit",
            ".HostConfig.NetworkMode",
            ".HostConfig.PortBindings",
            ".HostConfig.Tmpfs",
            ".HostConfig.LogConfig",
        )
        template = (
            "["
            + ",".join(
                '{{with (index .State "Health")}}{{json (index . "Status")}}{{else}}""{{end}}'
                if f == ".State.Health.Status"
                else "{{json " + f + "}}"
                for f in fields
            )
            + ',{{json (index .Config.Labels "com.carepath.revision")}}'
            + ',{{json (index .Config.Labels "com.carepath.runtime")}}]'
        )
        raw = self.docker.call("container", "inspect", "--format", template, name, capture=True)
        try:
            result = json.loads(raw)
        except (ValueError, TypeError):
            raise self.c.Unsafe("Invalid selected container metadata.") from None
        self.c.require(type(result) is list and len(result) == 21)
        return result

    def assert_pair(self, record, *, healthy=True):
        self.c.record(record)
        slot = record["slot"]
        net = NETWORKS[slot]

        be = self._inspect_container(BACKEND_NAMES[slot])
        self.c.require(
            be is not None and be[0] == record["backendContainer"] and be[1] == record["backendImageId"],
            "Backend container exact identity differs.",
        )
        self.c.require(
            be[4:11] == ["1001:1001", True, False, None, ["ALL"], None, ["no-new-privileges:true"]]
            and be[11:16] == [536870912, 536870912, 1000000000, 128, net]
            and be[16] in ({}, None)
            and be[17] == {"/tmp": "rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001"}
            and be[18] == {"Type": "local", "Config": {"max-size": "10m", "max-file": "3"}}
            and be[19:] == [record["manifest"]["revision"], record["runtimeHash"]],
            "Backend runtime restrictions differ from reviewed policy.",
        )
        self.c.require(not healthy or be[2:4] == [True, "healthy"], "CarePath backend is not healthy.")

        fe = self._inspect_container(FRONTEND_NAMES[slot])
        self.c.require(
            fe is not None and fe[0] == record["frontendContainer"] and fe[1] == record["frontendImageId"],
            "Frontend container exact identity differs.",
        )
        self.c.require(
            fe[4:11] == ["1001:1001", True, False, None, ["ALL"], None, ["no-new-privileges:true"]]
            and fe[11:16] == [268435456, 268435456, 500000000, 128, net]
            and fe[16] == {"3000/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(self.c.SLOTS[slot])}]}
            and fe[17]
            == {
                "/tmp": "rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001",
                "/app/.next/cache": "rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001",
            }
            and fe[18] == {"Type": "local", "Config": {"max-size": "10m", "max-file": "3"}}
            and fe[19:] == [record["manifest"]["revision"], record["runtimeHash"]],
            "Frontend runtime restrictions differ from reviewed policy.",
        )
        self.c.require(not healthy or fe[2:4] == [True, "healthy"], "CarePath frontend is not healthy.")

    def cleanup_slot(self, slot):
        for name in (FRONTEND_NAMES[slot], BACKEND_NAMES[slot]):
            if self._inspect_container(name):
                self.docker.call("container", "rm", "-f", name)

    def create_and_start_pair(self, record, *, retired=None):
        slot = record["slot"]
        self._ensure_network(slot)
        net = NETWORKS[slot]

        existing_names = [name for name in (BACKEND_NAMES[slot], FRONTEND_NAMES[slot]) if self._inspect_container(name)]
        if existing_names:
            self.c.require(retired and retired["slot"] == slot, f"Unmanaged container(s) present in {slot} slot.")
            self.assert_pair(retired, healthy=False)
            for name in existing_names:
                info = self._inspect_container(name)
                self.c.require(info[2] is False, f"Retired container {name} is unexpectedly running.")
                self.docker.call("container", "rm", name)

        revision = record["manifest"]["revision"]
        runtime_hash = record["runtimeHash"]

        self.docker.call(
            "container",
            "create",
            "--name",
            BACKEND_NAMES[slot],
            "--pull=never",
            "--restart=unless-stopped",
            "--label",
            f"com.carepath.revision={revision}",
            "--label",
            f"com.carepath.runtime={runtime_hash}",
            "--user=1001:1001",
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--pids-limit=128",
            "--memory=512m",
            "--memory-swap=512m",
            "--cpus=1.0",
            "--init",
            f"--network={net}",
            "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001",
            "--env-file=" + str(self.g.CONFIG / "backend.env"),
            "--log-driver=local",
            "--log-opt=max-size=10m",
            "--log-opt=max-file=3",
            "--health-cmd=" + self.g.HEALTH_CMD,
            "--health-interval=5s",
            "--health-timeout=6s",
            "--health-start-period=20s",
            "--health-retries=3",
            f'{record["manifest"]["backend"]["image"]}@{record["manifest"]["backend"]["digest"]}',
            "node",
            "index.js",
        )
        be_info = self._inspect_container(BACKEND_NAMES[slot])
        self.c.require(be_info is not None)

        self.docker.call(
            "container",
            "create",
            "--name",
            FRONTEND_NAMES[slot],
            "--pull=never",
            "--restart=unless-stopped",
            "--label",
            f"com.carepath.revision={revision}",
            "--label",
            f"com.carepath.runtime={runtime_hash}",
            "--user=1001:1001",
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--pids-limit=128",
            "--memory=256m",
            "--memory-swap=256m",
            "--cpus=0.5",
            "--init",
            f"--network={net}",
            f"--publish=127.0.0.1:{self.c.SLOTS[slot]}:3000",
            "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001",
            "--tmpfs=/app/.next/cache:rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001",
            "--env-file=" + str(self.g.CONFIG / "frontend.env"),
            f"--env=INTERNAL_API_URL=http://{BACKEND_NAMES[slot]}:3000",
            "--log-driver=local",
            "--log-opt=max-size=10m",
            "--log-opt=max-file=3",
            "--health-cmd=" + self.g.HEALTH_CMD,
            "--health-interval=5s",
            "--health-timeout=6s",
            "--health-start-period=20s",
            "--health-retries=3",
            f'{record["manifest"]["frontend"]["image"]}@{record["manifest"]["frontend"]["digest"]}',
            "node",
            "server.js",
        )
        fe_info = self._inspect_container(FRONTEND_NAMES[slot])
        self.c.require(fe_info is not None)

        self.docker.call("container", "start", BACKEND_NAMES[slot])
        self.docker.call("container", "start", FRONTEND_NAMES[slot])
        return {"backendContainer": be_info[0], "frontendContainer": fe_info[0]}

    def probe_pair(self, record):
        try:
            self.assert_pair(record, healthy=True)
        except self.c.Unsafe:
            return False
        port = self.c.SLOTS[record["slot"]]
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=4)
        try:
            conn.request("GET", "/api/health", headers={"Connection": "close"})
            resp = conn.getresponse()
            raw = resp.read(4097)
            if resp.status != 200 or len(raw) > 4096:
                return False
            data = json.loads(raw)
            return (
                data.get("status") == "ok"
                and data.get("ready") is True
                and data.get("frontendRevision") == record["manifest"]["revision"]
                and data.get("backendRevision") == record["manifest"]["revision"]
            )
        except (OSError, ValueError, http.client.HTTPException):
            return False
        finally:
            conn.close()

    def wait_ready(self, record, timeout=60):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.probe_pair(record):
                return
            time.sleep(2)
        raise self.c.Unsafe("Candidate CarePath slot failed readiness checks.")

    def stop_pair(self, record):
        slot = record["slot"]
        for name in (FRONTEND_NAMES[slot], BACKEND_NAMES[slot]):
            info = self._inspect_container(name)
            if info and info[2] is True:
                self.docker.call("container", "stop", "--time=15", name)
