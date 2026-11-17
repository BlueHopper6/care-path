import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment"))
import carepath_release as rel

SHA_A = "a" * 40
SHA_B = "b" * 40
DIGEST_FE = "sha256:" + ("1" * 64)
DIGEST_BE = "sha256:" + ("2" * 64)


def make_zip(manifest):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("release.json", json.dumps(manifest))
    raw = buf.getvalue()
    return raw, "sha256:" + hashlib.sha256(raw).hexdigest()


class FakeGitHub:
    def __init__(self, responses, archive_bytes):
        self.responses = responses
        self.archive_bytes = archive_bytes

    def get(self, path):
        return self.responses[path]

    def archive(self, artifact_id):
        return self.archive_bytes


class CarePathReleaseTests(unittest.TestCase):
    def _fixture(self, *, now=None, pub_event="workflow_run", ver_event="push", head_repo=rel.REPOSITORY, attempt=1):
        now = now or dt.datetime(2026, 11, 17, 0, 0, tzinfo=dt.timezone.utc)
        ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        manifest = {
            "schemaVersion": 1,
            "repository": rel.REPOSITORY,
            "revision": SHA_A,
            "verificationRunId": "100",
            "releaseRunId": "200",
            "frontend": {"image": rel.FRONTEND_IMAGE, "digest": DIGEST_FE},
            "backend": {"image": rel.BACKEND_IMAGE, "digest": DIGEST_BE},
        }
        raw_zip, zip_digest = make_zip(manifest)
        responses = {
            "": {"full_name": "BlueHopper6/CarePath", "default_branch": "main", "private": False},
            "/git/ref/heads/main": {"object": {"sha": SHA_A}},
            "/actions/runs/200": {
                "id": 200,
                "path": ".github/workflows/deploy.yaml",
                "head_branch": "main",
                "status": "completed",
                "conclusion": "success",
                "run_attempt": attempt,
                "event": pub_event,
                "head_sha": SHA_A,
                "head_repository": {"full_name": head_repo},
                "updated_at": ts,
            },
            "/actions/runs/200/artifacts": {
                "artifacts": [
                    {
                        "id": 77,
                        "name": rel.ARTIFACT_NAME,
                        "expired": False,
                        "size_in_bytes": len(raw_zip),
                        "digest": zip_digest,
                    }
                ]
            },
            "/actions/runs/100": {
                "id": 100,
                "path": ".github/workflows/verify.yaml",
                "head_branch": "main",
                "status": "completed",
                "conclusion": "success",
                "run_attempt": 1,
                "event": ver_event,
                "head_sha": SHA_A,
                "head_repository": {"full_name": rel.REPOSITORY},
                "updated_at": ts,
            },
        }
        return FakeGitHub(responses, raw_zip), manifest, now

    def test_valid_public_repo_two_image_release_passes(self):
        gh, expected, now = self._fixture()
        actual = rel.verify_release(gh, "200", now=now)
        self.assertEqual(actual, expected)

    def test_rejects_fork_head_repository(self):
        gh, _, now = self._fixture(head_repo="attacker/carepath")
        with self.assertRaises(rel.ReleaseError):
            rel.verify_release(gh, "200", now=now)

    def test_rejects_rerun_attempt_gt_1(self):
        gh, _, now = self._fixture(attempt=2)
        with self.assertRaises(rel.ReleaseError):
            rel.verify_release(gh, "200", now=now)

    def test_rejects_stale_release(self):
        now = dt.datetime(2026, 11, 17, 0, 0, tzinfo=dt.timezone.utc)
        old = now - dt.timedelta(hours=25)
        gh, _, _ = self._fixture(now=old)
        with self.assertRaises(rel.ReleaseError):
            rel.verify_release(gh, "200", now=now)

    def test_rejects_artifact_digest_mismatch(self):
        gh, _, now = self._fixture()
        gh.archive_bytes = b"tampered"
        with self.assertRaises(rel.ReleaseError):
            rel.verify_release(gh, "200", now=now)

    def test_rejects_single_image_or_wrong_image_manifest(self):
        gh, manifest, now = self._fixture()
        manifest["backend"]["image"] = "ghcr.io/bluehopper6/life-compass"
        raw_zip, zip_digest = make_zip(manifest)
        gh.archive_bytes = raw_zip
        gh.responses["/actions/runs/200/artifacts"]["artifacts"][0]["digest"] = zip_digest
        gh.responses["/actions/runs/200/artifacts"]["artifacts"][0]["size_in_bytes"] = len(raw_zip)
        with self.assertRaises(rel.ReleaseError):
            rel.verify_release(gh, "200", now=now)

    def test_discover_latest_selects_current_main_run(self):
        now = dt.datetime(2026, 11, 17, 0, 0, tzinfo=dt.timezone.utc)
        ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        gh = FakeGitHub(
            {
                "/git/ref/heads/main": {"object": {"sha": SHA_A}},
                "/actions/workflows/deploy.yaml/runs?branch=main&status=success&per_page=20": {
                    "workflow_runs": [
                        {"id": 199, "head_sha": SHA_B, "head_branch": "main", "conclusion": "success", "run_attempt": 1, "updated_at": ts},
                        {"id": 201, "head_sha": SHA_A, "head_branch": "main", "conclusion": "success", "run_attempt": 1, "updated_at": ts},
                    ]
                },
            },
            b"",
        )
        self.assertEqual(rel.discover_latest(gh, now=now), "201")


if __name__ == "__main__":
    unittest.main()
