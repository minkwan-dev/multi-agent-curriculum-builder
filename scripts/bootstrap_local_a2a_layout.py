#!/usr/bin/env python3
"""Create .local-a2a-servers/<port>/<agent>/ with symlinks + agent.json for adk api_server --a2a."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / "agents"
OUT = ROOT / ".local-a2a-servers"

# (uvicorn port, folder name under agents/)
SERVERS: list[tuple[int, str]] = [
    (8001, "researcher"),
    (8002, "judge"),
    (8003, "content_builder"),
    (8004, "orchestrator"),
]


def main() -> None:
    from a2a.types import AgentCapabilities, AgentCard, AgentSkill

    if OUT.exists():
        shutil.rmtree(OUT)

    for port, name in SERVERS:
        agent_dir = AGENTS / name
        if not agent_dir.is_dir():
            print(f"Missing agent folder: {agent_dir}", file=sys.stderr)
            sys.exit(1)

        d = OUT / str(port) / name
        d.mkdir(parents=True, exist_ok=True)

        for fname in ("agent.py", "__init__.py"):
            src = (agent_dir / fname).resolve()
            dst = d / fname
            if dst.exists() or dst.is_symlink():
                dst.unlink()
            dst.symlink_to(src)

        base = f"http://127.0.0.1:{port}/a2a/{name}"
        card = AgentCard(
            name=name,
            description=f"Local A2A agent ({name})",
            url=base,
            version="1.0.0",
            capabilities=AgentCapabilities(),
            default_input_modes=["text/plain"],
            default_output_modes=["text/plain"],
            skills=[
                AgentSkill(
                    id="default",
                    name="default",
                    description="Run this agent via A2A",
                    tags=["adk"],
                )
            ],
        )
        (d / "agent.json").write_text(
            card.model_dump_json(indent=2),
            encoding="utf-8",
        )

    ui = OUT / "ui" / "orchestrator"
    ui.mkdir(parents=True, exist_ok=True)
    for fname in ("agent.py", "__init__.py"):
        src = (AGENTS / "orchestrator" / fname).resolve()
        dst = ui / fname
        if dst.exists() or dst.is_symlink():
            dst.unlink()
        dst.symlink_to(src)

    print(f"Wrote A2A layout under {OUT}")
    print(f"Web UI layout (orchestrator only): {OUT / 'ui'}")


if __name__ == "__main__":
    main()
