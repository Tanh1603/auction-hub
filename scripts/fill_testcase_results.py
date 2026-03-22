"""
Script to fill test case results from TEST_RESULTS_OUTPUT.csv to the 
testcase alignment folder CSVs.

This script:
1. Reads the TEST_RESULTS_OUTPUT.csv file to get test results
2. Reads the three files in the testcase alignment folder
3. Matches Test Case IDs and fills in the Actual Result and Status columns
"""

import csv
import os
import re
from pathlib import Path


def read_test_results(filepath: str) -> dict:
    """
    Read the TEST_RESULTS_OUTPUT.csv and extract Test Case ID, Actual Result, and Status.
    Returns a dictionary mapping Test Case ID to (Actual Result, Status).
    """
    results = {}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tc_id = row.get('Test Case ID', '').strip()
            actual_result = row.get('Actual Result', '').strip()
            status = row.get('Status', '').strip()
            
            if tc_id:
                # Store the result (if multiple tests have the same ID, keep the last one)
                # or you could store all results and pick the first/most relevant
                results[tc_id] = {
                    'actual_result': actual_result,
                    'status': status
                }
    
    return results


def find_test_case_id_column(header: list) -> int:
    """
    Find the column index that contains 'Test Case ID'.
    """
    for idx, col in enumerate(header):
        if 'Test Case ID' in col:
            return idx
    return -1


def find_column_index(header: list, column_name: str) -> int:
    """
    Find the column index by name.
    """
    for idx, col in enumerate(header):
        if column_name in col:
            return idx
    return -1


def process_alignment_file(filepath: str, test_results: dict) -> tuple:
    """
    Process a testcase alignment file and update it with test results.
    Returns (updated_rows, match_count, total_tests).
    """
    updated_rows = []
    match_count = 0
    total_tests = 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    if not rows:
        return rows, 0, 0
    
    # Find the header row (usually contains "Test Case ID")
    header_row_idx = -1
    tc_id_col = -1
    actual_result_col = -1
    status_col = -1
    
    for idx, row in enumerate(rows):
        row_str = ','.join(row)
        if 'Test Case ID' in row_str:
            header_row_idx = idx
            tc_id_col = find_column_index(row, 'Test Case ID')
            actual_result_col = find_column_index(row, 'Actual Result')
            status_col = find_column_index(row, 'Status')
            break
    
    if header_row_idx == -1 or tc_id_col == -1:
        print(f"  Warning: Could not find Test Case ID column in {filepath}")
        return rows, 0, 0
    
    print(f"  Header row index: {header_row_idx}")
    print(f"  Test Case ID column: {tc_id_col}")
    print(f"  Actual Result column: {actual_result_col}")
    print(f"  Status column: {status_col}")
    
    # Process each data row
    for idx, row in enumerate(rows):
        # Skip header rows and before
        if idx <= header_row_idx:
            updated_rows.append(row)
            continue
        
        # Ensure row has enough columns
        while len(row) <= max(tc_id_col, actual_result_col, status_col):
            row.append('')
        
        tc_id = row[tc_id_col].strip() if tc_id_col < len(row) else ''
        
        if tc_id and tc_id.startswith('TC-'):
            total_tests += 1
            
            if tc_id in test_results:
                match_count += 1
                result = test_results[tc_id]
                
                # Update Actual Result column
                if actual_result_col != -1:
                    row[actual_result_col] = result['actual_result']
                
                # Update Status column
                if status_col != -1:
                    row[status_col] = result['status']
        
        updated_rows.append(row)
    
    return updated_rows, match_count, total_tests


def save_file(filepath: str, rows: list):
    """
    Save the updated rows back to the CSV file.
    """
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def main():
    # Define paths
    base_dir = Path(__file__).parent
    test_results_path = base_dir / 'TEST_RESULTS_OUTPUT.csv'
    alignment_dir = base_dir / 'testcase alignment'
    
    # Files to process
    alignment_files = [
        'functiontestcase.csv',
        'othertestcase.csv',
        'securitytestcase.csv'
    ]
    
    print("=" * 60)
    print("Test Case Results Filler Script")
    print("=" * 60)
    
    # Check if test results file exists
    if not test_results_path.exists():
        print(f"Error: TEST_RESULTS_OUTPUT.csv not found at {test_results_path}")
        return
    
    # Read test results
    print(f"\nReading test results from: {test_results_path}")
    test_results = read_test_results(test_results_path)
    print(f"Found {len(test_results)} unique test case results")
    
    # Print some sample IDs
    print("\nSample Test Case IDs from results:")
    for i, tc_id in enumerate(list(test_results.keys())[:5]):
        result = test_results[tc_id]
        print(f"  {tc_id}: Status={result['status']}")
    
    # Process each alignment file
    total_matches = 0
    total_tests_found = 0
    
    print("\n" + "=" * 60)
    print("Processing alignment files...")
    print("=" * 60)
    
    for filename in alignment_files:
        filepath = alignment_dir / filename
        
        if not filepath.exists():
            print(f"\nWarning: {filename} not found, skipping...")
            continue
        
        print(f"\nProcessing: {filename}")
        updated_rows, match_count, tests_in_file = process_alignment_file(
            str(filepath), test_results
        )
        
        total_matches += match_count
        total_tests_found += tests_in_file
        
        print(f"  Test cases in file: {tests_in_file}")
        print(f"  Matched and updated: {match_count}")
        
        # Save the updated file
        save_file(str(filepath), updated_rows)
        print(f"  Saved: {filepath}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total test cases in alignment files: {total_tests_found}")
    print(f"Total matches found and updated: {total_matches}")
    print(f"Test results from TEST_RESULTS_OUTPUT.csv: {len(test_results)}")
    
    if total_tests_found > 0:
        coverage = (total_matches / total_tests_found) * 100
        print(f"Coverage: {coverage:.1f}%")
    
    print("\nDone!")


if __name__ == '__main__':
    main()
