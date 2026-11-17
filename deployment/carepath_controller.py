"""CarePath two-container rollout state machine."""

import re

SLOTS = {"blue": 3301, "green": 3302}
OBSERVE_SECONDS = 30
DRAIN_SECONDS = 70
MAX_STATE = 16384


class Unsafe(Exception):
    """Raised when rollout state, identity, or safety preconditions fail."""


def require(condition, message="CarePath rollout check failed."):
    if not condition:
        raise Unsafe(message)


def integer(value, minimum=0):
    return type(value) is int and value >= minimum


def sha(value):
    return isinstance(value, str) and bool(re.fullmatch(r"[a-f0-9]{64}", value))


def container_id(value):
    return isinstance(value, str) and bool(re.fullmatch(r"[a-f0-9]{64}", value))


def image_id(value):
    return isinstance(value, str) and bool(re.fullmatch(r"sha256:[a-f0-9]{64}", value))


def manifest_check(manifest):
    require(
        type(manifest) is dict
        and set(manifest) == {"schemaVersion", "repository", "revision", "verificationRunId", "releaseRunId", "frontend", "backend"},
        "Invalid manifest shape.",
    )
    require(manifest["schemaVersion"] == 1 and manifest["repository"] == "bluehopper6/care-path", "Invalid manifest repository.")
    require(isinstance(manifest["revision"], str) and bool(re.fullmatch(r"[a-f0-9]{40}", manifest["revision"])), "Invalid manifest revision.")
    for key in ("frontend", "backend"):
        part = manifest[key]
        require(
            type(part) is dict
            and set(part) == {"image", "digest"}
            and part["image"] == f"ghcr.io/bluehopper6/carepath-{key}"
            and image_id(part["digest"]),
            f"Invalid {key} manifest reference.",
        )


def record(value, *, candidate=False):
    require(type(value) is dict, "Slot record must be an object.")
    expected = {
        "slot",
        "manifest",
        "frontendContainer",
        "backendContainer",
        "frontendImageId",
        "backendImageId",
        "runtimeHash",
    }
    require(set(value) == expected, "Invalid slot record fields.")
    require(value["slot"] in SLOTS, "Invalid slot name.")
    manifest_check(value["manifest"])
    require(sha(value["runtimeHash"]), "Invalid runtime configuration digest.")
    if candidate and value["frontendContainer"] is None and value["backendContainer"] is None:
        require(image_id(value["frontendImageId"]) and image_id(value["backendImageId"]), "Missing candidate image IDs.")
        return
    require(
        container_id(value["frontendContainer"]) and container_id(value["backendContainer"]),
        "Missing exact container IDs.",
    )
    require(image_id(value["frontendImageId"]) and image_id(value["backendImageId"]), "Missing image IDs.")


def validate(state):
    require(type(state) is dict, "State must be an object.")
    require(
        set(state) == {"schemaVersion", "phase", "generation", "active", "prior", "candidate", "lastAttempt"},
        "Invalid rollout state keys.",
    )
    require(state["schemaVersion"] == 1, "Unsupported state schemaVersion.")
    require(
        state["phase"] in {"stable", "preparing", "switching", "retaining", "retiring", "rolling-back", "rolled-back", "recovery-required"},
        "Invalid rollout phase.",
    )
    require(integer(state["generation"], 1), "Invalid routing generation.")
    require(integer(state["lastAttempt"], 0), "Invalid attempt watermark.")
    record(state["active"])
    if state["prior"] is not None:
        record(state["prior"])
        require(state["prior"]["slot"] != state["active"]["slot"], "Active and prior slots must differ.")
    if state["candidate"] is not None:
        record(state["candidate"], candidate=True)
        require(state["candidate"]["slot"] != state["active"]["slot"], "Candidate and active slots must differ.")
    return state


def route_for(state, *, use_prior=False, use_candidate=False):
    if use_prior:
        require(state["prior"] is not None, "No prior slot for route.")
        return {"generation": state["generation"] + 1, "active": state["prior"]}
    if use_candidate:
        require(state["candidate"] is not None, "No candidate slot for route.")
        return {"generation": state["generation"] + 1, "active": state["candidate"]}
    return {"generation": state["generation"], "active": state["active"]}


class Controller:
    def __init__(self, runtime, load_state, save_state, clock):
        self.runtime = runtime
        self.load = load_state
        self.save = save_state
        self.clock = clock

    def _save(self, state):
        validate(state)
        self.save(state)
        return state

    def boot_offline(self):
        require(self.runtime.observed_route() is None, "Router is already serving; offline boot refused.")
        state = validate(self.load())
        if state["phase"] == "rolling-back":
            self.runtime.assert_pair(state["prior"], healthy=False)
            self.runtime.stop_pair(state["active"])
            next_state = {
                **state,
                "phase": "stable",
                "generation": state["generation"] + 1,
                "active": state["prior"],
                "prior": None,
            }
            self.runtime.write_route_offline(route_for(next_state))
            return self._save(next_state)
        if state["phase"] in {"preparing", "switching"}:
            self.runtime.assert_pair(state["active"], healthy=False)
            if state["candidate"] and state["candidate"]["frontendContainer"]:
                self.runtime.stop_pair(state["candidate"])
            next_state = {**state, "phase": "stable", "candidate": None}
            self.runtime.write_route_offline(route_for(next_state))
            return self._save(next_state)
        if state["phase"] in {"retaining", "retiring"}:
            self.runtime.assert_pair(state["active"], healthy=False)
            if state["prior"]:
                self.runtime.stop_pair(state["prior"])
            next_state = {**state, "phase": "stable", "prior": None}
            self.runtime.write_route_offline(route_for(next_state))
            return self._save(next_state)
        if state["phase"] == "stable":
            self.runtime.assert_pair(state["active"], healthy=False)
            self.runtime.write_route_offline(route_for(state))
            return state
        raise Unsafe("Rollout requires administrator review.")

    def recover_or_boot(self):
        state = validate(self.load())
        if state["phase"] == "stable":
            self.runtime.assert_pair(state["active"], healthy=True)
            self.runtime.ensure_route(route_for(state))
            return state
        if state["phase"] == "retaining":
            self.runtime.assert_pair(state["active"], healthy=True)
            self.runtime.ensure_route(route_for(state))
            return state
        if state["phase"] == "retiring":
            self.runtime.assert_pair(state["active"], healthy=True)
            self.runtime.ensure_route(route_for(state))
            if state["prior"]:
                self.runtime.stop_pair(state["prior"])
            return self._save({**state, "phase": "stable", "prior": None})
        if state["phase"] == "preparing":
            self.runtime.assert_pair(state["active"], healthy=True)
            self.runtime.ensure_route(route_for(state))
            if state["candidate"] and state["candidate"]["frontendContainer"]:
                self.runtime.stop_pair(state["candidate"])
            return self._save({**state, "phase": "stable", "candidate": None})
        if state["phase"] == "switching":
            observed = self.runtime.observed_route()
            active_hash = self.runtime.route_hash(route_for(state))
            cand_hash = self.runtime.route_hash(route_for(state, use_candidate=True))
            if observed == cand_hash:
                self.runtime.assert_pair(state["candidate"], healthy=True)
                return self._save({
                    **state,
                    "phase": "retiring",
                    "generation": state["generation"] + 1,
                    "active": state["candidate"],
                    "prior": state["active"],
                    "candidate": None,
                })
            require(observed == active_hash, "Ambiguous switching route; manual review required.")
            self.runtime.assert_pair(state["active"], healthy=True)
            if state["candidate"] and state["candidate"]["frontendContainer"]:
                self.runtime.stop_pair(state["candidate"])
            return self._save({**state, "phase": "stable", "candidate": None})
        if state["phase"] == "rolling-back":
            self.runtime.assert_pair(state["prior"], healthy=True)
            self.runtime.switch(route_for(state, use_prior=True))
            self.runtime.stop_pair(state["active"])
            return self._save({
                **state,
                "phase": "stable",
                "generation": state["generation"] + 1,
                "active": state["prior"],
                "prior": None,
            })
        raise Unsafe("Rollout requires administrator review.")

    def deploy(self, manifest, verify_again, sleep_fn):
        state = validate(self.load())
        if state["phase"] != "stable":
            state = self.recover_or_boot()
        manifest_check(manifest)
        run_num = int(manifest["releaseRunId"])
        if run_num <= state["lastAttempt"]:
            return "unchanged"
        if (
            manifest["revision"] == state["active"]["manifest"]["revision"]
            and manifest["frontend"]["digest"] == state["active"]["manifest"]["frontend"]["digest"]
            and manifest["backend"]["digest"] == state["active"]["manifest"]["backend"]["digest"]
            and self.runtime.runtime_identity() == state["active"]["runtimeHash"]
        ):
            return "unchanged"

        self.runtime.assert_pair(state["active"], healthy=True)
        self.runtime.headroom()
        images = self.runtime.pull(manifest)
        verify_again()

        target_slot = "green" if state["active"]["slot"] == "blue" else "blue"
        runtime_hash = self.runtime.runtime_identity()
        cand = {
            "slot": target_slot,
            "manifest": manifest,
            "frontendContainer": None,
            "backendContainer": None,
            "frontendImageId": images["frontendImageId"],
            "backendImageId": images["backendImageId"],
            "runtimeHash": runtime_hash,
        }
        state = self._save({**state, "phase": "preparing", "candidate": cand, "lastAttempt": run_num})

        try:
            ids = self.runtime.create_and_start_pair(cand, retired=state["prior"])
            cand = {**cand, **ids}
            state = self._save({**state, "candidate": cand})
            self.runtime.wait_ready(cand)
        except Exception:
            if cand.get("frontendContainer") or cand.get("backendContainer"):
                self.runtime.stop_pair(cand)
            else:
                self.runtime.cleanup_slot(target_slot)
            self._save({**state, "phase": "stable", "candidate": None})
            return "failed-release-latched"

        # Promote candidate atomically in Traefik
        next_route = route_for(state, use_candidate=True)
        state = self._save({**state, "phase": "switching"})
        self.runtime.switch(next_route)

        state = self._save({
            **state,
            "phase": "retaining",
            "generation": state["generation"] + 1,
            "active": cand,
            "prior": state["active"],
            "candidate": None,
        })

        # Observe candidate health for 30s; roll back once if unhealthy
        deadline = self.clock() + OBSERVE_SECONDS
        while self.clock() < deadline:
            if not self.runtime.probe_pair(state["active"]):
                state = self._save({**state, "phase": "rolling-back"})
                self.runtime.switch(route_for(state, use_prior=True))
                self.runtime.stop_pair(state["active"])
                self._save({
                    **state,
                    "phase": "stable",
                    "generation": state["generation"] + 1,
                    "active": state["prior"],
                    "prior": None,
                })
                return "rolled-back"
            sleep_fn(3)

        # Drain old slot connections and stop old containers
        state = self._save({**state, "phase": "retiring"})
        self.runtime.drain(DRAIN_SECONDS)
        self.runtime.stop_pair(state["prior"])
        self._save({**state, "phase": "stable", "prior": None})
        return "promoted-stable"

    def rollback(self):
        state = validate(self.load())
        require(state["phase"] in {"retaining", "retiring"} and state["prior"] is not None, "No retained prior slot available for rollback.")
        require(self.runtime.runtime_identity() == state["prior"]["runtimeHash"], "Prior runtime configuration changed; manual review required.")
        self.runtime.assert_pair(state["prior"], healthy=True)
        state = self._save({**state, "phase": "rolling-back"})
        self.runtime.switch(route_for(state, use_prior=True))
        self.runtime.stop_pair(state["active"])
        return self._save({
            **state,
            "phase": "stable",
            "generation": state["generation"] + 1,
            "active": state["prior"],
            "prior": None,
        })
