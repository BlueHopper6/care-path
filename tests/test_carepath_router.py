import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment"))
import carepath_controller as ctrl
import carepath_router as router_mod


def sample_route(slot, gen):
    return {
        "generation": gen,
        "active": {
            "slot": slot,
            "manifest": {
                "schemaVersion": 1,
                "repository": "bluehopper6/carepath",
                "revision": "a" * 40,
                "verificationRunId": "10",
                "releaseRunId": "20",
                "frontend": {"image": "ghcr.io/bluehopper6/carepath-frontend", "digest": "sha256:" + ("1" * 64)},
                "backend": {"image": "ghcr.io/bluehopper6/carepath-backend", "digest": "sha256:" + ("2" * 64)},
            },
            "frontendContainer": "b" * 64,
            "backendContainer": "c" * 64,
            "frontendImageId": "sha256:" + ("1" * 64),
            "backendImageId": "sha256:" + ("2" * 64),
            "runtimeHash": "d" * 64,
        },
    }


class CarePathRouterTests(unittest.TestCase):
    def test_configuration_shape_and_host_headers(self):
        route = sample_route("blue", 1)
        payload = json.loads(router_mod.configuration(route, ctrl))
        self.assertIn("http", payload)
        headers = payload["http"]["middlewares"]["origin"]["headers"]["customRequestHeaders"]
        self.assertEqual(headers["Host"], "carepath.vilohit.dev")
        self.assertEqual(headers["X-Forwarded-Proto"], "https")
        self.assertEqual(
            payload["http"]["services"][f"active-{router_mod.route_hash(route)}"]["loadBalancer"]["servers"][0]["url"],
            "http://127.0.0.1:3301",
        )

    @unittest.skipUnless(os.environ.get("CAREPATH_TRAEFIK_TEST") == "1", "Real Traefik binary test enabled in CI.")
    def test_real_traefik_file_provider_reload(self):
        binary = os.environ["TRAEFIK_BINARY"]
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            dyn_dir = tmp_dir / "dynamic"
            dyn_dir.mkdir()
            routes_file = dyn_dir / "routes.yml"
            static_cfg = router_mod.static_configuration()
            static_cfg["entryPoints"]["app"]["address"] = "127.0.0.1:13400"
            static_cfg["entryPoints"]["traefik"]["address"] = "127.0.0.1:13401"
            static_cfg["providers"]["file"]["directory"] = str(dyn_dir)
            static_file = tmp_dir / "static.json"
            static_file.write_text(json.dumps(static_cfg))

            r1 = sample_route("blue", 1)
            routes_file.write_bytes(router_mod.configuration(r1, ctrl))

            proc = subprocess.Popen([binary, f"--configFile={static_file}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                deadline = time.monotonic() + 10
                observed = None
                while time.monotonic() < deadline:
                    observed = router_mod.observe(expected_uid=None, api_port=13401)
                    if observed == router_mod.route_hash(r1):
                        break
                    time.sleep(0.2)
                self.assertEqual(observed, router_mod.route_hash(r1))

                r2 = sample_route("green", 2)
                routes_file.write_bytes(router_mod.configuration(r2, ctrl))
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    observed = router_mod.observe(expected_uid=None, api_port=13401)
                    if observed == router_mod.route_hash(r2):
                        break
                    time.sleep(0.2)
                self.assertEqual(observed, router_mod.route_hash(r2))
            finally:
                proc.terminate()
                proc.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
