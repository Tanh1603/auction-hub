"""
Add the 8 new unmatched test cases to their corresponding alignment files.
"""

import csv
from pathlib import Path


def read_test_results(filepath: str) -> dict:
    """Read the TEST_RESULTS_OUTPUT.csv and extract all test data."""
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
                    'steps_to_perform': row.get('Steps to Perform', '').strip(),
                    'step_expected': row.get('Step Expected Result', '').strip(),
                    'expected_result': row.get('Test Case Expected Result', '').strip(),
                    'actual_result': row.get('Actual Result', '').strip(),
                    'status': row.get('Status', '').strip(),
                    'note': row.get('Note', '').strip(),
                }
    return results


def find_insertion_point(rows, category_pattern):
    """Find the best row index to insert new test cases for a category."""
    # Find the last data row (before empty rows at the end)
    last_data_row = len(rows) - 1
    while last_data_row > 0 and all(not cell.strip() for cell in rows[last_data_row]):
        last_data_row -= 1
    
    # Look for matching category or related section
    for i in range(last_data_row, 7, -1):
        if len(rows[i]) > 1 and category_pattern in rows[i][1]:
            return i + 1  # Insert after this row
    
    # Default: insert after last data row
    return last_data_row + 1


def add_test_to_file(filepath: Path, test_data: dict, category: str):
    """Add a test case to the specified file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    # Create the new row in the same format as existing rows
    # Format: ,Category,Test Case ID,Test Case Description,PreRequisites,Steps,Test Procedures(Steps to Perform),Step Expected Result,Test Case Expected Result,Actual Result,Status,Note,,,
    
    new_row = [
        '',  # Empty first column
        category,  # Category
        test_data['test_case_id'],  # Test Case ID
        test_data['test_case_description'],  # Test Case Description
        test_data['prerequisites'],  # PreRequisites
        '',  # Steps column (empty)
        test_data['steps_to_perform'],  # Test Procedures / Steps to Perform
        test_data['step_expected'],  # Step Expected Result  
        test_data['expected_result'],  # Test Case Expected Result
        test_data['actual_result'],  # Actual Result
        test_data['status'],  # Status
        test_data['note'],  # Note
        '',  # Extra columns
        '',
        ''
    ]
    
    # Find insertion point
    insertion_idx = find_insertion_point(rows, category.split()[0] if category else '')
    
    # Insert the new row
    rows.insert(insertion_idx, new_row)
    
    # Update the count in header (row index 5, column 7)
    if len(rows) > 5 and len(rows[5]) > 7:
        try:
            current_count = int(rows[5][7])
            rows[5][7] = str(current_count + 1)
        except (ValueError, IndexError):
            pass
    
    # Write back
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    return insertion_idx


def main():
    base_dir = Path(__file__).parent
    test_results_path = base_dir / 'TEST_RESULTS_OUTPUT.csv'
    
    # New test cases to add
    new_tests = {
        'functiontestcase.csv': [
            'TC-2.6.9-01',
            'TC-2.6.9-02', 
            'TC-2.6.9-03',
            'TC-2.6.9-04',
            'TC-2.6.9-05',
            'TC-2.6.9-06',
        ],
        'securitytestcase.csv': [
            'TC-4.1.3-06',
        ],
        'othertestcase.csv': [
            'TC-5.1.4-04',
        ],
    }
    
    # Categories for each test
    categories = {
        'TC-2.6.9-01': '2.6.9 Winner Payment Default Handling',
        'TC-2.6.9-02': '2.6.9 Winner Payment Default Handling',
        'TC-2.6.9-03': '2.6.9 Winner Payment Default Handling',
        'TC-2.6.9-04': '2.6.9 Winner Payment Default Handling',
        'TC-2.6.9-05': '2.6.9 Winner Payment Default Handling',
        'TC-2.6.9-06': '2.6.9 Winner Payment Default Handling',
        'TC-4.1.3-06': '4.1 Security Testing',
        'TC-5.1.4-04': '5.1 Non-Functional',
    }
    
    print("=" * 70)
    print("Adding New Test Cases to Alignment Files")
    print("=" * 70)
    
    # Read test results
    test_results = read_test_results(test_results_path)
    print(f"\nLoaded {len(test_results)} test results")
    
    # Process each file
    for filename, tc_ids in new_tests.items():
        filepath = base_dir / 'testcase alignment' / filename
        print(f"\n{filename}:")
        print("-" * 50)
        
        for tc_id in tc_ids:
            if tc_id in test_results:
                test_data = test_results[tc_id]
                category = categories.get(tc_id, '')
                
                row_idx = add_test_to_file(filepath, test_data, category)
                print(f"  Added {tc_id} at row {row_idx}")
                print(f"    Description: {test_data['test_case_description'][:50]}...")
                print(f"    Status: {test_data['status']}")
            else:
                print(f"  WARNING: {tc_id} not found in test results!")
    
    print("\n" + "=" * 70)
    print("Done! Added 8 new test cases to alignment files.")
    print("=" * 70)


if __name__ == '__main__':
    main()
