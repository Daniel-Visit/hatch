#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic", "pydantic>=2.0"]
# ///
"""
Execute a single test case against a skill.

This is the equivalent of `uv run train.py > run.log 2>&1` in autoresearch.
It runs a test prompt through Claude with the target skill loaded and captures outputs.

Usage:
    uv run run_eval.py \
        --skill-path /path/to/skill/ \
        --prompt "User's test prompt" \
        --outputs-dir /path/to/outputs/ \
        --method cli|api

    # With eval_config.json:
    uv run run_eval.py \
        --eval-config /path/to/eval_config.json \
        --test-case-id 1 \
        --outputs-dir /path/to/outputs/
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Allow importing from parent (skill-improver) directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic
from models import ExecMetadata


def run_via_cli(skill_path: str, prompt: str, outputs_dir: Path,
                model: str = "claude-sonnet-4-6") -> ExecMetadata:
    """Execute test case via claude CLI."""
    outputs_dir.mkdir(parents=True, exist_ok=True)

    # Build the prompt that tells Claude to use the skill and save outputs
    full_prompt = f"""First, read the skill at {skill_path}/SKILL.md and follow its instructions to complete this task.

Save all output files to {outputs_dir}/

Task: {prompt}"""

    start_time = time.time()
    result = subprocess.run(
        ["claude", "-p", full_prompt, "--model", model],
        capture_output=True, text=True, timeout=300  # 5 min timeout like autoresearch
    )
    duration = time.time() - start_time

    # Save transcript
    transcript_path = outputs_dir.parent / "transcript.md"
    with open(transcript_path, "w") as f:
        f.write("# Test Case Execution\n\n")
        f.write(f"**Prompt:** {prompt}\n\n")
        f.write(f"**Skill:** {skill_path}\n\n")
        f.write(f"**Duration:** {duration:.1f}s\n\n")
        f.write(f"## stdout\n```\n{result.stdout}\n```\n\n")
        if result.stderr:
            f.write(f"## stderr\n```\n{result.stderr}\n```\n")

    return ExecMetadata(
        success=result.returncode == 0,
        duration_seconds=round(duration, 1),
        returncode=result.returncode,
    )


def run_via_api(skill_path: str, prompt: str, outputs_dir: Path,
                model: str = "claude-sonnet-4-6") -> ExecMetadata:
    """Execute test case via Anthropic API with tool use."""
    outputs_dir.mkdir(parents=True, exist_ok=True)

    # Read the skill
    skill_md_path = Path(skill_path) / "SKILL.md"
    skill_content = skill_md_path.read_text() if skill_md_path.exists() else ""

    # Build system prompt with skill
    system = f"""You have access to the following skill. Follow its instructions to complete the user's task.

<skill>
{skill_content}
</skill>

Produce your outputs as clearly structured text. For file contents, use code blocks with the filename as a comment at the top."""

    client = anthropic.Anthropic()
    start_time = time.time()

    response = client.messages.create(
        model=model,
        max_tokens=8000,
        system=system,
        messages=[{"role": "user", "content": prompt}]
    )
    duration = time.time() - start_time

    # Extract text response
    text_output = ""
    for block in response.content:
        if hasattr(block, 'text'):
            text_output += block.text

    # Save output
    output_path = outputs_dir / "response.md"
    with open(output_path, "w") as f:
        f.write(text_output)

    # Save transcript
    transcript_path = outputs_dir.parent / "transcript.md"
    with open(transcript_path, "w") as f:
        f.write("# Test Case Execution\n\n")
        f.write(f"**Prompt:** {prompt}\n\n")
        f.write(f"**Skill:** {skill_path}\n\n")
        f.write(f"**Duration:** {duration:.1f}s\n\n")
        f.write(f"**Tokens:** input={response.usage.input_tokens}, output={response.usage.output_tokens}\n\n")
        f.write(f"## Response\n{text_output}\n")

    return ExecMetadata(
        success=True,
        duration_seconds=round(duration, 1),
        returncode=0,
    )


def check_gates(outputs_dir: Path, gate_metrics: list) -> dict:
    """Run gate metric checks. Returns pass/fail for each gate."""
    results = {}
    for gate in gate_metrics:
        name = gate["name"]
        check_cmd = gate.get("check", "")

        if not check_cmd:
            results[name] = {"passed": True, "evidence": "No check defined"}
            continue

        try:
            # HATCH-013 fix: parse the gate command with shlex and pass the
            # resulting argv list with shell=False so quoted args / odd
            # quoting in gate definitions cannot trigger shell injection.
            import shlex
            argv = shlex.split(check_cmd)
            result = subprocess.run(
                argv, shell=False, capture_output=True, text=True,
                cwd=str(outputs_dir), timeout=30
            )
            passed = result.returncode == 0
            results[name] = {
                "passed": passed,
                "evidence": result.stdout.strip() if passed else result.stderr.strip()
            }
        except subprocess.TimeoutExpired:
            results[name] = {"passed": False, "evidence": "Gate check timed out"}
        except Exception as e:
            results[name] = {"passed": False, "evidence": str(e)}

    return results


def detect_execution_method() -> str:
    """Auto-detect best available execution method."""
    # Check for claude CLI
    if shutil.which("claude"):
        return "cli"

    # Check for API key
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "api"

    return "none"


def main():
    parser = argparse.ArgumentParser(description="Execute a test case against a skill")
    parser.add_argument("--skill-path", type=Path, help="Path to the skill directory")
    parser.add_argument("--prompt", type=str, help="Test case prompt")
    parser.add_argument("--eval-config", type=Path, help="Path to eval_config.json")
    parser.add_argument("--test-case-id", type=int, help="Test case ID from eval_config")
    parser.add_argument("--outputs-dir", type=Path, required=True,
                       help="Directory to save outputs")
    parser.add_argument("--method", choices=["cli", "api", "auto"], default="auto",
                       help="Execution method")
    parser.add_argument("--model", default="claude-sonnet-4-6",
                       help="Model to use")
    parser.add_argument("--check-gates", action="store_true",
                       help="Run gate checks after execution")

    args = parser.parse_args()

    # Resolve skill path and prompt
    skill_path = args.skill_path
    prompt = args.prompt
    gate_metrics = []

    if args.eval_config:
        with open(args.eval_config) as f:
            config = json.load(f)
        skill_path = skill_path or Path(config["target_skill"])
        gate_metrics = config.get("gate_metrics", [])

        if args.test_case_id is not None:
            test_cases = {tc["id"]: tc for tc in config["test_cases"]}
            tc = test_cases[args.test_case_id]
            prompt = tc["prompt"]

    if not skill_path or not prompt:
        print("Error: Need --skill-path and --prompt, or --eval-config and --test-case-id")
        sys.exit(1)

    # Detect method
    method = args.method
    if method == "auto":
        method = detect_execution_method()
        if method == "none":
            print("Error: No execution method available.")
            print("  Install Claude Code: npm install -g @anthropic-ai/claude-code")
            print("  Or set API key: export ANTHROPIC_API_KEY=sk-...")
            sys.exit(1)

    print(f"Running test case via {method}...")
    print(f"Skill: {skill_path}")
    print(f"Prompt: {prompt[:100]}...")

    # Execute
    if method == "cli":
        exec_meta = run_via_cli(str(skill_path), prompt, args.outputs_dir, args.model)
    else:
        exec_meta = run_via_api(str(skill_path), prompt, args.outputs_dir, args.model)

    # Run gate checks if requested
    if args.check_gates and gate_metrics:
        gate_results = check_gates(args.outputs_dir, gate_metrics)
        exec_meta.gates = gate_results
        exec_meta.gates_passed = all(g["passed"] for g in gate_results.values())

    # Save execution metadata
    meta_path = args.outputs_dir.parent / "exec_metadata.json"
    with open(meta_path, "w") as f:
        f.write(exec_meta.model_dump_json(indent=2))

    print(f"Execution complete. Duration: {exec_meta.duration_seconds}s")
    if exec_meta.gates is not None:
        status = "PASS" if exec_meta.gates_passed else "FAIL"
        print(f"Gates: {status}")


if __name__ == "__main__":
    main()
