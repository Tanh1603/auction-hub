#!/usr/bin/env python3
"""
Compare TestCase_Detailed.csv with actual test implementations.
Find which test cases are documented but not implemented.
"""

import csv
import os
import re
from pathlib import Path


def extract_tc_ids_from_csv(csv_path):
    """Extract all TC IDs from TestCase_Detailed.csv"""
    tc_ids = {}
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            tc_id = row.get('Test Case ID', '').strip()
            if tc_id:
                tc_ids[tc_id] = {
                    'description': row.get('Test Case Description', '').strip(),
                    'status': row.get('Status', '').strip(),
                    'row': row_num,
                }
    return tc_ids


def extract_tc_ids_from_tests(test_dirs):
    """Extract all TC IDs from test files"""
    tc_ids = set()
    tc_pattern = re.compile(r"['\"]?(TC-[\d.]+-\d+)")
    
    for test_dir in test_dirs:
        if not os.path.exists(test_dir):
            continue
            
        for root, dirs, files in os.walk(test_dir):
            for file in files:
                if file.endswith('.spec.ts'):
                    filepath = os.path.join(root, file)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                            matches = tc_pattern.findall(content)
                            for match in matches:
                                tc_ids.add(match)
                    except Exception as e:
                        print(f"Error reading {filepath}: {e}")
    
    return tc_ids


def compare_and_report(csv_tc_ids, impl_tc_ids):
    """Compare CSV TCs with implemented TCs"""
    print("=" * 80)
    print("TEST CASE IMPLEMENTATION STATUS")
    print("=" * 80)
    
    csv_set = set(csv_tc_ids.keys())
    
    # TCs in CSV but not implemented
    not_implemented = csv_set - impl_tc_ids
    
    # TCs implemented but not in CSV (orphan tests)
    orphan_tests = impl_tc_ids - csv_set
    
    # Implemented
    implemented = csv_set & impl_tc_ids
    
    print(f"\n[SUMMARY]")
    print(f"  Test Cases in CSV: {len(csv_set)}")
    print(f"  Test Cases Implemented: {len(impl_tc_ids)}")
    print(f"  Matched (documented & implemented): {len(implemented)}")
    print(f"  Not Implemented (in CSV, no test): {len(not_implemented)}")
    print(f"  Orphan Tests (implemented, not in CSV): {len(orphan_tests)}")
    
    if not_implemented:
        print(f"\n[NOT IMPLEMENTED - Need test implementation]")
        print("-" * 80)
        # Group by category
        by_category = {}
        for tc_id in sorted(not_implemented):
            # Extract category from TC ID (e.g., TC-2.4.1-01 -> 2.4)
            parts = tc_id.replace('TC-', '').split('-')[0]
            category = '.'.join(parts.split('.')[:2])
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(tc_id)
        
        for category in sorted(by_category.keys()):
            tcs = by_category[category]
            print(f"\n  Category {category}: ({len(tcs)} missing)")
            for tc_id in sorted(tcs)[:10]:
                desc = csv_tc_ids[tc_id]['description'][:50]
                status = csv_tc_ids[tc_id]['status']
                print(f"    - {tc_id}: {desc}... [Status: {status}]")
            if len(tcs) > 10:
                print(f"    ... and {len(tcs) - 10} more")
    
    if orphan_tests:
        print(f"\n[ORPHAN TESTS - Implemented but not in CSV]")
        print("-" * 80)
        for tc_id in sorted(orphan_tests)[:20]:
            print(f"  - {tc_id}")
        if len(orphan_tests) > 20:
            print(f"  ... and {len(orphan_tests) - 20} more")
    
    print("\n" + "=" * 80)
    
    return {
        'not_implemented': sorted(not_implemented),
        'orphan_tests': sorted(orphan_tests),
        'implemented': sorted(implemented),
    }


if __name__ == "__main__":
    base_dir = r"c:\Sem1_Year3_Projects\auction-hub"
    
    csv_path = os.path.join(base_dir, "QA_DOCUMENTATION", "TestCase_Detailed.csv")
    test_dirs = [
        os.path.join(base_dir, "test", "integration"),
        os.path.join(base_dir, "server-e2e", "src", "server"),
    ]
    
    print(f"CSV: {csv_path}")
    print(f"Test Dirs: {test_dirs}")
    
    csv_tc_ids = extract_tc_ids_from_csv(csv_path)
    impl_tc_ids = extract_tc_ids_from_tests(test_dirs)
    
    results = compare_and_report(csv_tc_ids, impl_tc_ids)
    
    # Output the list for updating
    print(f"\n\nNot implemented TCs for update ({len(results['not_implemented'])}):")
    for tc in results['not_implemented']:
        print(tc)
