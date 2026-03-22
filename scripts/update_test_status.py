#!/usr/bin/env python3
"""
Update TestCase_Detailed.csv and RTM to mark unimplemented tests as 'Not Started'.
"""

import csv
import os
import re
from pathlib import Path


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


def update_testcase_detailed(csv_path, implemented_ids):
    """Update Status column in TestCase_Detailed.csv"""
    rows = []
    updated_count = 0
    
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            tc_id = row.get('Test Case ID', '').strip()
            current_status = row.get('Status', '').strip()
            
            if tc_id and tc_id not in implemented_ids:
                # Mark as Not Started if it was "New"
                if current_status == 'New':
                    row['Status'] = 'Not Started'
                    updated_count += 1
            elif tc_id and tc_id in implemented_ids:
                # Mark as Implemented if it was "New" or "Not Started"
                if current_status in ['New', 'Not Started', '']:
                    row['Status'] = 'Implemented'
                    updated_count += 1
            
            rows.append(row)
    
    # Write back
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    return updated_count


def update_rtm(rtm_path, implemented_ids):
    """Update Test Execution column in RTM based on implementation status"""
    rows = []
    updated_count = 0
    
    with open(rtm_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            tc_ids_str = row.get('TC ID', '').strip()
            if tc_ids_str:
                tc_ids = [id.strip() for id in tc_ids_str.split(',')]
                
                # Check how many are implemented
                implemented = sum(1 for tc in tc_ids if tc in implemented_ids)
                total = len(tc_ids)
                
                # Update Test Execution status
                current_status = row.get('Test Execution', '').strip()
                if implemented == 0:
                    new_status = 'Not Started'
                elif implemented < total:
                    new_status = f'Partial ({implemented}/{total})'
                else:
                    new_status = 'Complete'
                
                if current_status != new_status:
                    row['Test Execution'] = new_status
                    updated_count += 1
            
            rows.append(row)
    
    # Write back
    with open(rtm_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    return updated_count


if __name__ == "__main__":
    base_dir = r"c:\Sem1_Year3_Projects\auction-hub"
    
    csv_path = os.path.join(base_dir, "QA_DOCUMENTATION", "TestCase_Detailed.csv")
    rtm_path = os.path.join(base_dir, "QA_DOCUMENTATION", "RTM_Requirements_Traceability_Matrix.csv")
    
    test_dirs = [
        os.path.join(base_dir, "test", "integration"),
        os.path.join(base_dir, "server-e2e", "src", "server"),
    ]
    
    print("=" * 80)
    print("UPDATING CSV FILES WITH IMPLEMENTATION STATUS")
    print("=" * 80)
    
    # Get implemented test IDs
    implemented_ids = extract_tc_ids_from_tests(test_dirs)
    print(f"\nFound {len(implemented_ids)} implemented test cases in code.")
    
    # Update TestCase_Detailed.csv
    print(f"\nUpdating TestCase_Detailed.csv...")
    tc_updated = update_testcase_detailed(csv_path, implemented_ids)
    print(f"  Updated {tc_updated} rows in TestCase_Detailed.csv")
    
    # Update RTM
    print(f"\nUpdating RTM_Requirements_Traceability_Matrix.csv...")
    rtm_updated = update_rtm(rtm_path, implemented_ids)
    print(f"  Updated {rtm_updated} rows in RTM")
    
    print("\n" + "=" * 80)
    print("UPDATE COMPLETE")
    print("=" * 80)
    
    # Summary
    print("\nStatus Legend:")
    print("  TestCase_Detailed.csv:")
    print("    - 'Implemented': Test case has corresponding .spec.ts test")
    print("    - 'Not Started': Test case documented but not implemented")
    print("  RTM:")
    print("    - 'Complete': All TCs for requirement are implemented")
    print("    - 'Partial (X/Y)': X out of Y TCs implemented")
    print("    - 'Not Started': No TCs implemented for requirement")
