import datetime as dt
import hashlib
import hmac
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment"))
import carepath_events as ev

SECRET = b"0123456789abcdef0123456789abcdef"
POLICY = {"repositoryId": 99999, "workflowId": 88888}
SHA = "a" * 40


def sign(raw):
    return "sha256=" + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()


class CarePathEventsTests(unittest.TestCase):
    def _payload(self, *, repo="BlueHopper6/CarePath", path=".github/workflows/deploy.yaml", attempt=1):
        now = dt.datetime(2026, 11, 17, 0, 0, tzinfo=dt.timezone.utc)
        body = {
            "action": "completed",
            "repository": {
                "id": 99999,
                "full_name": repo,
                "private": False,
                "default_branch": "main",
            },
            "workflow": {"id": 88888, "path": path},
            "workflow_run": {
                "id": 55555,
                "workflow_id": 88888,
                "path": path,
                "head_branch": "main",
                "status": "completed",
                "conclusion": "success",
                "run_attempt": attempt,
                "event": "workflow_run",
                "head_sha": SHA,
                "head_repository": {"id": 99999, "full_name": repo},
                "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        }
        return json.dumps(body).encode(), now

    def test_accepts_valid_carepath_event(self):
        raw, now = self._payload()
        self.assertEqual(ev.notification(raw, sign(raw), "workflow_run", SECRET, POLICY, now), 55555)

    def test_rejects_life_compass_repo_or_bad_signature(self):
        raw, now = self._payload(repo="BlueHopper6/life-compass")
        with self.assertRaises(ev.Refused):
            ev.notification(raw, sign(raw), "workflow_run", SECRET, POLICY, now)

        raw2, now2 = self._payload()
        with self.assertRaises(ev.Refused):
            ev.notification(raw2, "sha256=" + ("0" * 64), "workflow_run", SECRET, POLICY, now2)

    def test_rejects_verify_workflow_or_rerun(self):
        raw, now = self._payload(path=".github/workflows/verify.yaml")
        with self.assertRaises(ev.Refused):
            ev.notification(raw, sign(raw), "workflow_run", SECRET, POLICY, now)

        raw2, now2 = self._payload(attempt=2)
        with self.assertRaises(ev.Refused):
            ev.notification(raw2, sign(raw2), "workflow_run", SECRET, POLICY, now2)


if __name__ == "__main__":
    unittest.main()
