#!/usr/bin/env python3
"""
Export all tabulated space-group settings to JSON.

Design goals
------------
- Treat each *setting* as a distinct entry.
- Use Gemmi's space-group table to enumerate settings.
- Use spglib to recover Hall-number-based metadata when possible.
- Derive quiz-friendly properties from the symmetry operations themselves.

Install
-------
    pip install gemmi spglib numpy

Usage
-----
    python spacegroup_settings_to_json.py
    python spacegroup_settings_to_json.py --output spacegroup_settings.json
    python spacegroup_settings_to_json.py --itb-only

Notes
-----
- Gemmi tabulates 560+ settings. Some of these are not present in spglib / ITB-B.
- When a setting can be identified by symmetry with spglib, the JSON includes
  hall_number, choice, point-group labels, arithmetic crystal class, etc.
- For Gemmi-only settings, those spglib-specific fields are left null.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from typing import Any, Iterable

import numpy as np
import gemmi
import spglib

DEN = 24  # gemmi.Op stores translations/rotations as integers scaled by 24
EPS = 1e-8


@dataclass
class SettingEntry:
    gemmi_index: int
    international_number: int
    hm: str
    xhm: str
    short_name: str
    hall: str
    qualifier: str
    ext: str
    centring_type: str
    crystal_system: str
    point_group_hm: str
    is_centrosymmetric: bool
    is_enantiomorphic: bool
    is_sohncke: bool
    is_symmorphic: bool
    has_mirror: bool
    has_glide: bool
    has_screw: bool
    n_operations: int
    operations_xyz: list[str]
    basisop_xyz: str
    spglib_identified: bool
    hall_number: int | None
    spglib_international: str | None
    spglib_international_full: str | None
    spglib_hall_symbol: str | None
    spglib_choice: str | None
    pointgroup_international: str | None
    pointgroup_schoenflies: str | None
    arithmetic_crystal_class_number: int | None
    arithmetic_crystal_class_symbol: str | None


def frac_mod1(v: np.ndarray) -> np.ndarray:
    """Wrap vector into [0, 1)."""
    return np.mod(v, 1.0)


def is_zero_translation(t: np.ndarray, tol: float = EPS) -> bool:
    tt = frac_mod1(t)
    return np.allclose(tt, 0.0, atol=tol) or np.allclose(tt, 1.0, atol=tol)


def rotation_order(R: np.ndarray, max_order: int = 12) -> int | None:
    """Return the smallest n with R^n = I, if found."""
    I = np.eye(3, dtype=int)
    P = np.eye(3, dtype=int)
    for n in range(1, max_order + 1):
        P = P @ R
        if np.array_equal(P, I):
            return n
    return None


def mirror_or_glide_from_op(R: np.ndarray, t: np.ndarray) -> tuple[bool, bool]:
    """
    Detect whether an operation is a mirror/glide type.

    A mirror or glide has det(R) = -1 and order 2.
    If the translational part is zero modulo lattice translations -> mirror.
    Otherwise -> glide.
    """
    if round(np.linalg.det(R)) != -1:
        return False, False
    if rotation_order(R, max_order=6) != 2:
        return False, False
    if is_zero_translation(t):
        return True, False
    return False, True


def screw_from_op(R: np.ndarray, t: np.ndarray) -> bool:
    """
    Detect whether an operation is a screw-axis type.

    A screw is a proper rotation (det=+1), not identity, with non-zero
    translational part modulo lattice translations.
    """
    I = np.eye(3, dtype=int)
    if round(np.linalg.det(R)) != 1:
        return False
    if np.array_equal(R, I):
        return False
    return not is_zero_translation(t)


def gemmi_op_to_spglib(op: gemmi.Op) -> tuple[np.ndarray, np.ndarray]:
    """Convert a gemmi operation to spglib-compatible arrays."""
    R = np.array(op.rot, dtype=int) // DEN
    t = np.array(op.tran, dtype=float) / DEN
    return R, frac_mod1(t)


def classify_operations(ops: gemmi.GroupOps) -> tuple[bool, bool, bool, list[str], list[np.ndarray], list[np.ndarray]]:
    """Inspect full symmetry operations and derive quiz-friendly properties."""
    has_mirror = False
    has_glide = False
    has_screw = False

    op_strings: list[str] = []
    rotations: list[np.ndarray] = []
    translations: list[np.ndarray] = []

    for op in ops:
        op_strings.append(op.triplet())
        R, t = gemmi_op_to_spglib(op)
        rotations.append(R)
        translations.append(t)

        m, g = mirror_or_glide_from_op(R, t)
        has_mirror = has_mirror or m
        has_glide = has_glide or g
        has_screw = has_screw or screw_from_op(R, t)

    return has_mirror, has_glide, has_screw, op_strings, rotations, translations


def crystal_system_from_number(n: int) -> str:
    if 1 <= n <= 2:
        return "triclinic"
    if 3 <= n <= 15:
        return "monoclinic"
    if 16 <= n <= 74:
        return "orthorhombic"
    if 75 <= n <= 142:
        return "tetragonal"
    if 143 <= n <= 167:
        return "trigonal"
    if 168 <= n <= 194:
        return "hexagonal"
    if 195 <= n <= 230:
        return "cubic"
    raise ValueError(f"Invalid international number: {n}")


def identify_with_spglib(rotations: list[np.ndarray], translations: list[np.ndarray]) -> dict[str, Any]:
    """
    Identify a setting using spglib from explicit symmetry operations.

    Returns a dict with spglib metadata when identified, otherwise a dict with
    nulls and spglib_identified=False.
    """
    result = {
        "spglib_identified": False,
        "hall_number": None,
        "spglib_international": None,
        "spglib_international_full": None,
        "spglib_hall_symbol": None,
        "spglib_choice": None,
        "pointgroup_international": None,
        "pointgroup_schoenflies": None,
        "arithmetic_crystal_class_number": None,
        "arithmetic_crystal_class_symbol": None,
    }

    if not rotations:
        return result

    lattice = np.eye(3, dtype=float)
    try:
        sg_type = spglib.get_spacegroup_type_from_symmetry(
            np.array(rotations, dtype=np.int32),
            np.array(translations, dtype=np.float64),
            lattice,
            1e-5,
        )
    except Exception:
        return result

    if sg_type is None:
        return result

    # spglib may return either a dataclass-like object or a dict-like object,
    # depending on version. Support both.
    def get_field(obj: Any, name: str, default: Any = None) -> Any:
        if hasattr(obj, name):
            return getattr(obj, name)
        if isinstance(obj, dict):
            return obj.get(name, default)
        return default

    result.update(
        {
            "spglib_identified": True,
            "hall_number": get_field(sg_type, "hall_number"),
            "spglib_international": get_field(sg_type, "international"),
            "spglib_international_full": get_field(sg_type, "international_full"),
            "spglib_hall_symbol": get_field(sg_type, "hall_symbol") or get_field(sg_type, "hall"),
            "spglib_choice": get_field(sg_type, "choice"),
            "pointgroup_international": get_field(sg_type, "pointgroup_international"),
            "pointgroup_schoenflies": get_field(sg_type, "pointgroup_schoenflies"),
            "arithmetic_crystal_class_number": get_field(sg_type, "arithmetic_crystal_class_number"),
            "arithmetic_crystal_class_symbol": get_field(sg_type, "arithmetic_crystal_class_symbol"),
        }
    )
    return result


def iter_spacegroups(itb_only: bool) -> Iterable[gemmi.SpaceGroup]:
    return gemmi.spacegroup_table_itb() if itb_only else gemmi.spacegroup_table()


def build_entries(itb_only: bool = False) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    for idx, sg in enumerate(iter_spacegroups(itb_only), start=1):
        ops = sg.operations()
        has_mirror, has_glide, has_screw, op_strings, rotations, translations = classify_operations(ops)
        spg = identify_with_spglib(rotations, translations)

        entry = SettingEntry(
            gemmi_index=idx,
            international_number=sg.number,
            hm=sg.hm,
            xhm=sg.xhm(),
            short_name=sg.short_name(),
            hall=sg.hall,
            qualifier=sg.qualifier,
            ext=sg.ext,
            centring_type=sg.centring_type(),
            crystal_system=crystal_system_from_number(sg.number),
            point_group_hm=sg.point_group_hm(),
            is_centrosymmetric=sg.is_centrosymmetric(),
            is_enantiomorphic=sg.is_enantiomorphic(),
            is_sohncke=sg.is_sohncke(),
            is_symmorphic=sg.is_symmorphic(),
            has_mirror=has_mirror,
            has_glide=has_glide,
            has_screw=has_screw,
            n_operations=len(ops),
            operations_xyz=op_strings,
            basisop_xyz=sg.basisop.triplet(),
            spglib_identified=spg["spglib_identified"],
            hall_number=spg["hall_number"],
            spglib_international=spg["spglib_international"],
            spglib_international_full=spg["spglib_international_full"],
            spglib_hall_symbol=spg["spglib_hall_symbol"],
            spglib_choice=spg["spglib_choice"],
            pointgroup_international=spg["pointgroup_international"],
            pointgroup_schoenflies=spg["pointgroup_schoenflies"],
            arithmetic_crystal_class_number=spg["arithmetic_crystal_class_number"],
            arithmetic_crystal_class_symbol=spg["arithmetic_crystal_class_symbol"],
        )
        entries.append(asdict(entry))

    return entries


def build_payload(itb_only: bool = False) -> dict[str, Any]:
    entries = build_entries(itb_only=itb_only)
    return {
        "meta": {
            "enumeration_source": "gemmi.spacegroup_table_itb" if itb_only else "gemmi.spacegroup_table",
            "itb_only": itb_only,
            "n_entries": len(entries),
            "description": (
                "Each entry is one tabulated space-group setting. "
                "Gemmi is used for setting enumeration; spglib is used to identify Hall-number-based "
                "metadata when possible."
            ),
        },
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Export all tabulated space-group settings to JSON.")
    parser.add_argument(
        "--output",
        default="spacegroup_settings.json",
        help="Output JSON filename (default: spacegroup_settings.json)",
    )
    parser.add_argument(
        "--itb-only",
        action="store_true",
        help="Use gemmi.spacegroup_table_itb() instead of the full Gemmi table.",
    )
    args = parser.parse_args()

    payload = build_payload(itb_only=args.itb_only)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    n_total = payload["meta"]["n_entries"]
    n_spglib = sum(1 for e in payload["entries"] if e["spglib_identified"])
    print(f"Wrote {n_total} settings to {args.output}")
    print(f"spglib identified {n_spglib}/{n_total} settings")


if __name__ == "__main__":
    main()
