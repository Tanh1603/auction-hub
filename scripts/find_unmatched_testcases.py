"""
Script to find unmatched test cases from TEST_RESULTS_OUTPUT.csv
and output them in the same format as the testcase alignment files.

This script:
1. Reads TEST_RESULTS_OUTPUT.csv to get all test results
2. Reads all three testcase alignment files to collect all Test Case IDs
3. Identifies test cases in the results that don't exist in the alignment files
4. Outputs unmatched test cases in the same CSV format as alignment files
"""

import csv
from pathlib import Path


def read_test_results(filepath: str) -> dict:
    """
    Read the TEST_RESULTS_OUTPUT.csv and extract all test data.
    Returns a dictionary mapping Test Case ID to full row data.
    """
    results = {}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tc_id = row.get('Test Case ID', '').strip()
            if tc_id:
                results[tc_id] = {
                    'category': row.get('Category', '').strip(),
                    'test_case_id': tc_id,
                    'test_case_description': row.get('Test Case Description', '').strip(),
                    'prerequisites': row.get('PreRequisites', '').strip(),
                    'steps': row.get('Steps to Perform', '').strip(),
                    'step_expected': row.get('Step Expected Result', '').strip(),
                    'expected_result': row.get('Test Case Expected Result', '').strip(),
                    'actual_result': row.get('Actual Result', '').strip(),
                    'status': row.get('Status', '').strip(),
                    'note': row.get('Note', '').strip(),
                }
    
    return results


def collect_alignment_tc_ids(alignment_dir: Path, files: list) -> set:
    """
    Collect all Test Case IDs from the alignment files.
    """
    all_tc_ids = set()
    
    for filename in files:
        filepath = alignment_dir / filename
        if not filepath.exists():
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        # Find header row and Test Case ID column
        header_row_idx = -1
        tc_id_col = -1
        
        for idx, row in enumerate(rows):
            row_str = ','.join(row)
            if 'Test Case ID' in row_str:
                header_row_idx = idx
                for col_idx, col in enumerate(row):
                    if 'Test Case ID' in col:
                        tc_id_col = col_idx
                        break
                break
        
        if header_row_idx == -1 or tc_id_col == -1:
            continue
        
        # Collect all Test Case IDs
        for idx, row in enumerate(rows):
            if idx <= header_row_idx:
                continue
            
            if tc_id_col < len(row):
                tc_id = row[tc_id_col].strip()
                if tc_id and tc_id.startswith('TC-'):
                    all_tc_ids.add(tc_id)
    
    return all_tc_ids


def write_unmatched_csv(output_path: Path, unmatched_results: dict):
    """
    Write unmatched test cases to CSV in the same format as alignment files.
    """
    # Create header rows matching the alignment file format
    rows = [
        ['Unmatched Test Cases from TEST_RESULTS_OUTPUT.csv', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', 'Passed', 0, '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', 'Failed', 0, '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', 'Not Run', 0, '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', 'Not Completed', 0, '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', 'Number of test cases', len(unmatched_results), '', '', '', '', '', '', ''],
        ['', 'Category', 'Test Case ID', 'Test Case Description', 'PreRequisites', 'Steps', 'Test Procedures', '', 'Test Case Expected Result', 'Actual Result', 'Status', 'Note', '', '', ''],
        ['', '', '', '', '', '', 'Steps to Perform', 'Step Expected Result', '', '', '', '', '', '', ''],
    ]
    
    # Count pass/fail
    pass_count = 0
    fail_count = 0
    
    # Group by category for better organization
    categorized = {}
    for tc_id, data in unmatched_results.items():
        category = data['category'] or 'Unknown'
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(data)
        
        if data['status'].lower() == 'pass':
            pass_count += 1
        elif data['status'].lower() == 'fail':
            fail_count += 1
    
    # Update counts
    rows[1][7] = pass_count
    rows[2][7] = fail_count
    
    # Add data rows
    for category in sorted(categorized.keys()):
        tests = categorized[category]
        for data in sorted(tests, key=lambda x: x['test_case_id']):
            row = [
                '',  # Empty first column
                category,
                data['test_case_id'],
                data['test_case_description'],
                data['prerequisites'],
                '',  # Steps column
                data['steps'],  # Steps to Perform in Test Procedures column
                data['step_expected'],  # Step Expected Result
                data['expected_result'],
                data['actual_result'],
                data['status'],
                data['note'],
                '',
                '',
                ''
            ]
            rows.append(row)
    
    # Write to file
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    return pass_count, fail_count


def main():
    # Define paths
    base_dir = Path(__file__).parent
    test_results_path = base_dir / 'TEST_RESULTS_OUTPUT.csv'
    alignment_dir = base_dir / 'testcase alignment'
    output_path = base_dir / 'testcase alignment' / 'unmatched_testcases.csv'
    
    alignment_files = [
        'functiontestcase.csv',
        'othertestcase.csv',
        'securitytestcase.csv'
    ]
    
    print("=" * 60)
    print("Unmatched Test Cases Finder Script")
    print("=" * 60)
    
    # Check if test results file exists
    if not test_results_path.exists():
        print(f"Error: TEST_RESULTS_OUTPUT.csv not found at {test_results_path}")
        return
    
    # Read test results
    print(f"\nReading test results from: {test_results_path}")
    test_results = read_test_results(test_results_path)
    print(f"Found {len(test_results)} test case results")
    
    # Collect all Test Case IDs from alignment files
    print(f"\nCollecting Test Case IDs from alignment files...")
    alignment_tc_ids = collect_alignment_tc_ids(alignment_dir, alignment_files)
    print(f"Found {len(alignment_tc_ids)} test cases in alignment files")
    
    # Find unmatched test cases
    unmatched = {}
    for tc_id, data in test_results.items():
        if tc_id not in alignment_tc_ids:
            unmatched[tc_id] = data
    
    print(f"\nUnmatched test cases: {len(unmatched)}")
    
    if not unmatched:
        print("All test cases are already in the alignment files!")
        return
    
    # Print some sample unmatched IDs
    print("\nSample unmatched Test Case IDs:")
    for i, (tc_id, data) in enumerate(list(unmatched.items())[:10]):
        print(f"  {tc_id}: {data['test_case_description'][:60]}...")
    
    if len(unmatched) > 10:
        print(f"  ... and {len(unmatched) - 10} more")
    
    # Write to CSV
    print(f"\nWriting unmatched test cases to: {output_path}")
    pass_count, fail_count = write_unmatched_csv(output_path, unmatched)
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total test cases in TEST_RESULTS_OUTPUT.csv: {len(test_results)}")
    print(f"Total test cases in alignment files: {len(alignment_tc_ids)}")
    print(f"Unmatched test cases (in results but not in alignment): {len(unmatched)}")
    print(f"  - Passed: {pass_count}")
    print(f"  - Failed: {fail_count}")
    print(f"\nOutput saved to: {output_path}")
    
    print("\nDone!")


if __name__ == '__main__':
    main()
