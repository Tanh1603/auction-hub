"""
Analyze unmatched test cases to determine if they are new or have different IDs.
"""

import csv
from pathlib import Path


def main():
    base_dir = Path(__file__).parent
    
    # Read unmatched test cases
    unmatched = {}
    with open(base_dir / 'testcase alignment/unmatched_testcases.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        for row in rows[8:]:  # Skip header rows
            if len(row) > 2 and row[2].startswith('TC-'):
                tc_id = row[2]
                desc = row[3] if len(row) > 3 else ''
                unmatched[tc_id] = desc
    
    # Read all test case IDs from alignment files
    alignment_tcs = {}  # tc_id -> description
    for filename in ['functiontestcase.csv', 'othertestcase.csv', 'securitytestcase.csv']:
        filepath = base_dir / 'testcase alignment' / filename
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
            for row in rows[8:]:  # Skip header rows
                if len(row) > 2 and row[2].startswith('TC-'):
                    tc_id = row[2]
                    desc = row[3] if len(row) > 3 else ''
                    alignment_tcs[tc_id] = (desc, filename)
    
    print("=" * 100)
    print("ANALYSIS: Unmatched Test Cases")
    print("=" * 100)
    print()
    
    print(f"Total unmatched test cases: {len(unmatched)}")
    print()
    
    print("Unmatched Test Case Details:")
    print("-" * 100)
    
    for tc_id, desc in sorted(unmatched.items()):
        print(f"\n{tc_id}")
        print(f"  Description: {desc}")
        
        # Check if a similar ID exists by modifying the pattern
        # e.g., TC-2.2.6-03 might exist as TC-2.3.6-03
        parts = tc_id.split('-')
        if len(parts) >= 3:
            # Try to find similar patterns
            similar = []
            for align_id, (align_desc, filename) in alignment_tcs.items():
                # Check if descriptions match
                if desc and align_desc:
                    # Extract core description (after the TC ID prefix in description)
                    unmatched_core = desc.replace(f'{tc_id}:', '').strip().lower() if tc_id in desc else desc.lower()
                    align_core = align_desc.replace(f'{align_id}:', '').strip().lower() if align_id in align_desc else align_desc.lower()
                    
                    if unmatched_core and unmatched_core in align_core or align_core in unmatched_core:
                        similar.append((align_id, align_desc, filename))
            
            if similar:
                print(f"  FOUND SIMILAR in alignment files:")
                for align_id, align_desc, filename in similar:
                    print(f"    -> {align_id} in {filename}")
                    print(f"       Description: {align_desc}")
            else:
                # Check if the same test case pattern exists with different middle number
                base_pattern = f"TC-2.{parts[1].split('.')[1] if '.' in parts[1] else ''}"
                print(f"  Status: NEW (no similar description found in alignment files)")
    
    print()
    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)
    
    # Categorize
    new_tests = []
    different_ids = []
    
    for tc_id, desc in sorted(unmatched.items()):
        found = False
        for align_id, (align_desc, filename) in alignment_tcs.items():
            # Direct description match
            unmatched_core = desc.split(':')[-1].strip().lower() if ':' in desc else desc.lower()
            align_core = align_desc.split(':')[-1].strip().lower() if ':' in align_desc else align_desc.lower()
            
            if unmatched_core and len(unmatched_core) > 10 and unmatched_core == align_core:
                different_ids.append((tc_id, desc, align_id, align_desc, filename))
                found = True
                break
        
        if not found:
            new_tests.append((tc_id, desc))
    
    print(f"\nTest cases with DIFFERENT IDs (same description found): {len(different_ids)}")
    for tc_id, desc, align_id, align_desc, filename in different_ids:
        print(f"  {tc_id} -> Already exists as {align_id} in {filename}")
    
    print(f"\nNEW test cases (not in alignment files): {len(new_tests)}")
    for tc_id, desc in new_tests:
        print(f"  {tc_id}: {desc[:70]}...")


if __name__ == '__main__':
    main()
