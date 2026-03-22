"""
Align RTM (Requirements Traceability Matrix) with actual test case data from testcase files.

This script:
1. Reads all test case IDs/descriptions from functiontestcase.csv, securitytestcase.csv, othertestcase.csv
2. Cross-references them with RTM-online-auction-website.csv
3. Updates the RTM with correct TC IDs based on Req ID matching
"""

import csv
import re
from pathlib import Path
from collections import defaultdict


def read_testcase_file(filepath: Path) -> dict:
    """
    Read a testcase file and extract TC ID -> (Category, Description) mapping.
    Also extracts Category patterns for Req ID matching.
    """
    test_cases = {}  # tc_id -> {category, description}
    category_tests = defaultdict(list)  # category -> list of tc_ids
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    # Find header row
    header_row_idx = -1
    for idx, row in enumerate(rows):
        if len(row) > 2 and 'Test Case ID' in ','.join(row):
            header_row_idx = idx
            break
    
    if header_row_idx == -1:
        return test_cases, category_tests
    
    # Process data rows
    for row in rows[header_row_idx + 2:]:  # Skip header + "Steps to Perform" row
        if len(row) > 3 and row[2].strip().startswith('TC-'):
            tc_id = row[2].strip()
            category = row[1].strip() if len(row) > 1 else ''
            description = row[3].strip() if len(row) > 3 else ''
            
            test_cases[tc_id] = {
                'category': category,
                'description': description
            }
            
            # Extract the requirement ID pattern (e.g., 2.1.1, 4.1.3, etc.)
            match = re.match(r'TC-(\d+\.\d+\.\d+)-', tc_id)
            if match:
                req_pattern = match.group(1)
                category_tests[req_pattern].append(tc_id)
    
    return test_cases, category_tests


def parse_tc_ids(tc_id_string: str) -> list:
    """Parse a comma-separated string of TC IDs into a list."""
    if not tc_id_string:
        return []
    
    # Split by comma and clean up
    tc_ids = []
    for part in tc_id_string.split(','):
        part = part.strip()
        if part.startswith('TC-'):
            tc_ids.append(part)
    
    return tc_ids


def format_tc_ids(tc_ids: list) -> str:
    """Format a list of TC IDs into a comma-separated string."""
    # Sort by test case number
    def sort_key(tc_id):
        match = re.match(r'TC-(\d+)\.(\d+)\.(\d+)-(\d+)', tc_id)
        if match:
            return (int(match.group(1)), int(match.group(2)), int(match.group(3)), int(match.group(4)))
        return (999, 999, 999, 999)
    
    sorted_ids = sorted(set(tc_ids), key=sort_key)
    return ', '.join(sorted_ids)


def align_rtm(rtm_path: Path, all_test_cases: dict, category_tests: dict) -> list:
    """
    Align the RTM with actual test case data.
    Returns the updated rows.
    """
    with open(rtm_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    updated_rows = []
    changes_made = []
    
    for idx, row in enumerate(rows):
        # Skip empty rows and header rows (first 3 rows)
        if idx < 3:
            updated_rows.append(row)
            continue
        
        # Check if this is a data row with Req ID
        if len(row) < 5 or not row[1].strip():
            updated_rows.append(row)
            continue
        
        req_id = row[1].strip()
        current_tc_ids_str = row[3].strip() if len(row) > 3 else ''
        current_tc_desc = row[4].strip() if len(row) > 4 else ''
        
        # Get actual test cases for this requirement
        actual_tc_ids = category_tests.get(req_id, [])
        
        if actual_tc_ids:
            # Build proper TC ID list and description
            proper_tc_ids_str = format_tc_ids(actual_tc_ids)
            
            # Build description from test case descriptions
            tc_descriptions = []
            for tc_id in actual_tc_ids:
                if tc_id in all_test_cases:
                    desc = all_test_cases[tc_id]['description']
                    # Simplify description - remove TC ID prefix if present
                    desc = re.sub(r'^TC-[\d\.]+-\d+:\s*', '', desc)
                    if desc:
                        tc_descriptions.append(desc)
            
            # Create a summary description
            if tc_descriptions:
                # Take first 2-3 descriptions and join them
                unique_descs = list(dict.fromkeys(tc_descriptions[:3]))
                summary_desc = '; '.join(unique_descs)
                if len(tc_descriptions) > 3:
                    summary_desc += f' (+{len(tc_descriptions) - 3} more)'
            else:
                summary_desc = current_tc_desc
            
            # Check if update is needed
            if proper_tc_ids_str != current_tc_ids_str:
                changes_made.append({
                    'row': idx + 1,
                    'req_id': req_id,
                    'old_tc_ids': current_tc_ids_str,
                    'new_tc_ids': proper_tc_ids_str,
                    'count_change': f'{len(parse_tc_ids(current_tc_ids_str))} -> {len(actual_tc_ids)}'
                })
            
            # Update the row
            while len(row) < 5:
                row.append('')
            
            row[3] = proper_tc_ids_str
            # Only update description if the old one doesn't match
            if summary_desc and not current_tc_desc:
                row[4] = summary_desc
        
        updated_rows.append(row)
    
    return updated_rows, changes_made


def main():
    base_dir = Path(__file__).parent
    alignment_dir = base_dir / 'testcase alignment'
    
    testcase_files = [
        'functiontestcase.csv',
        'securitytestcase.csv',
        'othertestcase.csv'
    ]
    
    rtm_path = alignment_dir / 'RTM-online-auction-website.csv'
    
    print("=" * 80)
    print("RTM Alignment Script")
    print("=" * 80)
    
    # Read all test cases from the three files
    all_test_cases = {}
    all_category_tests = defaultdict(list)
    
    print("\nReading testcase files...")
    for filename in testcase_files:
        filepath = alignment_dir / filename
        if filepath.exists():
            test_cases, category_tests = read_testcase_file(filepath)
            print(f"  {filename}: {len(test_cases)} test cases")
            
            all_test_cases.update(test_cases)
            for category, tc_ids in category_tests.items():
                all_category_tests[category].extend(tc_ids)
    
    print(f"\nTotal test cases loaded: {len(all_test_cases)}")
    print(f"Unique requirement patterns: {len(all_category_tests)}")
    
    # Print requirement coverage
    print("\nRequirement -> Test Case Count:")
    for req_id in sorted(all_category_tests.keys()):
        tc_count = len(all_category_tests[req_id])
        tc_list = format_tc_ids(all_category_tests[req_id])
        print(f"  {req_id}: {tc_count} tests")
    
    # Align RTM
    print("\n" + "=" * 80)
    print("Aligning RTM...")
    print("=" * 80)
    
    updated_rows, changes_made = align_rtm(rtm_path, all_test_cases, all_category_tests)
    
    # Report changes
    if changes_made:
        print(f"\nChanges to be made: {len(changes_made)}")
        for change in changes_made[:20]:  # Show first 20
            print(f"\nRow {change['row']}: Req {change['req_id']}")
            print(f"  Old TC IDs: {change['old_tc_ids']}")
            print(f"  New TC IDs: {change['new_tc_ids']}")
            print(f"  Count: {change['count_change']}")
        
        if len(changes_made) > 20:
            print(f"\n... and {len(changes_made) - 20} more changes")
    else:
        print("\nNo changes needed - RTM is already aligned!")
    
    # Save updated RTM
    print("\n" + "=" * 80)
    print("Saving updated RTM...")
    
    with open(rtm_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(updated_rows)
    
    print(f"Saved to: {rtm_path}")
    print("\nDone!")


if __name__ == '__main__':
    main()
