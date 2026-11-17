from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment"))
import carepath_controller as ctrl
import carepath_router as router_mod

RUNTIME_HASH = "f" * 64


def make_manifest(run_id, rev_char):
    return {
        "schemaVersion": 1,
        "repository": "bluehopper6/carepath",
        "revision": rev_char * 40,
        "verificationRunId": str(int(run_id) - 10),
        "releaseRunId": str(run_id),
        "frontend": {"image": "ghcr.io/bluehopper6/carepath-frontend", "digest": "sha256:" + (rev_char * 64)},
        "backend": {"image": "ghcr.io/bluehopper6/carepath-backend", "digest": "sha256:" + (rev_char * 64)},
    }


def make_record(slot, run_id, rev_char):
    slot_hex = "e" if slot == "blue" else "f"
    return {
        "slot": slot,
        "manifest": make_manifest(run_id, rev_char),
        "frontendContainer": (slot_hex * 64),
        "backendContainer": (rev_char * 64),
        "frontendImageId": "sha256:" + (rev_char * 64),
        "backendImageId": "sha256:" + (rev_char * 64),
        "runtimeHash": RUNTIME_HASH,
    }


class FakeRuntime:
    def __init__(self):
        self.route_hash_value = None
        self.running = {"blue"}
        self.fail_ready = False
        self.fail_probe_after_switch = False
        self.stopped_slots = []
        self.cleaned_slots = []
        self.drained = []

    def observed_route(self):
        return self.route_hash_value

    def route_hash(self, route):
        return router_mod.route_hash(route)

    def switch(self, route):
        self.route_hash_value = self.route_hash(route)

    def ensure_route(self, route):
        self.route_hash_value = self.route_hash(route)

    def write_route_offline(self, route):
        self.route_hash_value = self.route_hash(route)

    def runtime_identity(self):
        return RUNTIME_HASH

    def headroom(self):
        return None

    def pull(self, manifest):
        return {
            "frontendImageId": manifest["frontend"]["digest"],
            "backendImageId": manifest["backend"]["digest"],
        }

    def assert_pair(self, record, *, healthy=True):
        if record["slot"] not in self.running and healthy:
            raise ctrl.Unsafe("Slot not running.")

    def create_and_start_pair(self, record, *, retired=None):
        slot = record["slot"]
        self.running.add(slot)
        rev = record["manifest"]["revision"][0]
        slot_hex = "e" if slot == "blue" else "f"
        return {"frontendContainer": slot_hex * 64, "backendContainer": rev * 64}

    def wait_ready(self, record):
        if self.fail_ready:
            raise ctrl.Unsafe("Candidate readiness failed.")

    def probe_pair(self, record):
        return not self.fail_probe_after_switch

    def drain(self, seconds):
        self.drained.append(seconds)

    def stop_pair(self, record):
        self.running.discard(record["slot"])
        self.stopped_slots.append(record["slot"])

    def cleanup_slot(self, slot):
        self.running.discard(slot)
        self.cleaned_slots.append(slot)


class CarePathControllerTests(unittest.TestCase):
    def _controller(self, state):
        box = [state]
        now = [0.0]
        rt = FakeRuntime()
        rt.route_hash_value = rt.route_hash(ctrl.route_for(state))

        def clock():
            return now[0]

        def sleep(sec):
            now[0] += sec

        c = ctrl.Controller(rt, lambda: box[0], lambda s: box.__setitem__(0, s), clock)
        return c, rt, box, sleep

    def test_successive_blue_green_blue_promotions(self):
        initial = {
            "schemaVersion": 1,
            "phase": "stable",
            "generation": 1,
            "active": make_record("blue", 100, "a"),
            "prior": None,
            "candidate": None,
            "lastAttempt": 100,
        }
        c, rt, box, sleep = self._controller(initial)

        res1 = c.deploy(make_manifest(200, "b"), lambda: None, sleep)
        self.assertEqual(res1, "promoted-stable")
        self.assertEqual(box[0]["active"]["slot"], "green")
        self.assertEqual(box[0]["phase"], "stable")
        self.assertIsNone(box[0]["prior"])
        self.assertEqual(rt.stopped_slots, ["blue"])
        self.assertEqual(rt.drained, [70])

        res2 = c.deploy(make_manifest(300, "c"), lambda: None, sleep)
        self.assertEqual(res2, "promoted-stable")
        self.assertEqual(box[0]["active"]["slot"], "blue")
        self.assertEqual(rt.stopped_slots, ["blue", "green"])

    def test_readiness_failure_latches_and_preserves_active_slot(self):
        initial = {
            "schemaVersion": 1,
            "phase": "stable",
            "generation": 1,
            "active": make_record("blue", 100, "a"),
            "prior": None,
            "candidate": None,
            "lastAttempt": 100,
        }
        c, rt, box, sleep = self._controller(initial)
        rt.fail_ready = True

        res = c.deploy(make_manifest(200, "b"), lambda: None, sleep)
        self.assertEqual(res, "failed-release-latched")
        self.assertEqual(box[0]["active"]["slot"], "blue")
        self.assertEqual(box[0]["lastAttempt"], 200)
        self.assertEqual(rt.stopped_slots, ["green"])

        # Same failed run ID is not retried in a loop
        self.assertEqual(c.deploy(make_manifest(200, "b"), lambda: None, sleep), "unchanged")

    def test_observation_failure_rolls_back_to_prior_slot(self):
        initial = {
            "schemaVersion": 1,
            "phase": "stable",
            "generation": 1,
            "active": make_record("blue", 100, "a"),
            "prior": None,
            "candidate": None,
            "lastAttempt": 100,
        }
        c, rt, box, sleep = self._controller(initial)
        rt.fail_probe_after_switch = True

        res = c.deploy(make_manifest(200, "b"), lambda: None, sleep)
        self.assertEqual(res, "rolled-back")
        self.assertEqual(box[0]["active"]["slot"], "blue")
        self.assertEqual(box[0]["generation"], 3)
        self.assertEqual(rt.stopped_slots, ["green"])
        self.assertEqual(rt.route_hash_value, rt.route_hash({"generation": 3, "active": box[0]["active"]}))

    def test_boot_offline_recovers_interrupted_switching(self):
        blue = make_record("blue", 100, "a")
        cand = make_record("green", 200, "b")
        interrupted = {
            "schemaVersion": 1,
            "phase": "switching",
            "generation": 1,
            "active": blue,
            "prior": None,
            "candidate": cand,
            "lastAttempt": 200,
        }
        c, rt, box, _ = self._controller(interrupted)
        rt.route_hash_value = None  # Router has not started yet on boot
        rt.running = {"blue", "green"}

        c.boot_offline()
        self.assertEqual(box[0]["phase"], "stable")
        self.assertEqual(box[0]["active"]["slot"], "blue")
        self.assertIsNone(box[0]["candidate"])
        self.assertEqual(rt.stopped_slots, ["green"])


if __name__ == "__main__":
    unittest.main()
