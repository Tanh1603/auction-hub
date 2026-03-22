#!/usr/bin/env python3
"""
Bi-Directional Test Case Synchronization Script
================================================
This script synchronizes test IDs and descriptions between:
- Jest test files (.spec.ts / .test.js)
- TestCase_Detailed.csv (Source of correct IDs)
- RTM_Requirements_Traceability_Matrix.csv

Logic:
1. Code descriptions are CORRECT (source of truth for descriptions)
2. CSV Test Case IDs are CORRECT (source of truth for IDs)
3. Fuzzy matching is used to match code descriptions to CSV descriptions
4. Updates are applied bi-directionally

Author: QA Automation Script
Date: 2024-12-28

NOTE: Uses only Python standard library (no pandas required)
"""

import os
import re
import csv
from pathlib import Path
from difflib import SequenceMatcher
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class TestCaseMatch:
    """Represents a matched test case between code and CSV"""
    code_file: str
    code_line_number: int
    code_old_id: str
    code_description: str
    csv_target_id: str
    csv_old_description: str
    similarity_score: float


def get_similarity(str1: str, str2: str) -> float:
    """Calculate similarity score between two strings using SequenceMatcher"""
    # Normalize strings for comparison
    s1 = str1.lower().strip() if str1 else ""
    s2 = str2.lower().strip() if str2 else ""
    
    # Remove common prefixes like TC-X.X.X-XX:
    s1 = re.sub(r'^tc-[\d\.]+[-\d]+:\s*', '', s1)
    s2 = re.sub(r'^tc-[\d\.]+[-\d]+:\s*', '', s2)
    
    return SequenceMatcher(None, s1, s2).ratio()


def extract_tests_from_code(test_dir: str) -> List[Dict]:
    """
    Extract test case IDs and descriptions from Jest test files.
    
    Returns: List of dicts with keys: file, line_number, current_id, description, full_match
    """
    tests = []
    test_patterns = [
        # Pattern: it('TC-X.X.X-XX: Description', ...)
        r"it\s*\(\s*['\"]((TC-[\d\.]+[\-\d]+):\s*(.+?))['\"]",
        # Pattern: test('TC-X.X.X-XX: Description', ...)
        r"test\s*\(\s*['\"]((TC-[\d\.]+[\-\d]+):\s*(.+?))['\"]",
    ]
    
    for root, dirs, files in os.walk(test_dir):
        # Skip node_modules
        if 'node_modules' in root:
            continue
            
        for file in files:
            if file.endswith('.spec.ts') or file.endswith('.test.js') or file.endswith('.test.ts'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                        for pattern in test_patterns:
                            for match in re.finditer(pattern, content):
                                full_match = match.group(1)  # Full: "TC-X.X.X-XX: Description"
                                test_id = match.group(2)      # ID: "TC-X.X.X-XX"
                                description = match.group(3)  # Description text
                                
                                # Find line number
                                pos = match.start()
                                line_number = content[:pos].count('\n') + 1
                                
                                tests.append({
                                    'file': file_path,
                                    'line_number': line_number,
                                    'current_id': test_id,
                                    'description': description,
                                    'full_match': full_match,
                                })
                except Exception as e:
                    print(f"  Warning: Could not read {file_path}: {e}")
    
    return tests


def load_csv_file(csv_path: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Load a CSV file and return headers and rows as list of dicts"""
    try:
        with open(csv_path, 'r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames if reader.fieldnames else []
            rows = list(reader)
            print(f"  Loaded {len(rows)} rows from {os.path.basename(csv_path)}")
            print(f"  Columns: {headers}")
            return headers, rows
    except Exception as e:
        print(f"  Error loading CSV: {e}")
        return [], []


def save_csv_file(csv_path: str, headers: List[str], rows: List[Dict[str, str]]) -> bool:
    """Save rows to a CSV file"""
    try:
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        return True
    except Exception as e:
        print(f"  Error saving CSV: {e}")
        return False


def find_best_match(code_desc: str, csv_rows: List[Dict], 
                    id_col: str = 'Test Case ID', 
                    desc_col: str = 'Test Case Description',
                    min_similarity: float = 0.6) -> Optional[Tuple[str, str, float, int]]:
    """
    Find the best matching row in CSV for a code description.
    
    Returns: (target_id, old_description, similarity_score, row_index) or None
    """
    if not csv_rows:
        return None
    
    best_match = None
    best_score = 0
    best_idx = -1
    
    for idx, row in enumerate(csv_rows):
        csv_desc = row.get(desc_col, '')
        csv_id = row.get(id_col, '')
        
        score = get_similarity(code_desc, csv_desc)
        
        if score > best_score:
            best_score = score
            best_match = (csv_id, csv_desc, score, idx)
            best_idx = idx
    
    if best_match and best_score >= min_similarity:
        return best_match
    
    return None


def update_code_file(file_path: str, old_id: str, new_id: str, description: str) -> bool:
    """Update a test file by replacing old ID with new ID"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to find the specific test with old ID
        old_pattern = f'{old_id}: {description}'
        new_replacement = f'{new_id}: {description}'
        
        if old_pattern in content:
            new_content = content.replace(old_pattern, new_replacement)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        else:
            # Try with escaped quotes around the pattern
            patterns_to_try = [
                (f"'{old_id}: {description}'", f"'{new_id}: {description}'"),
                (f'"{old_id}: {description}"', f'"{new_id}: {description}"'),
            ]
            for old_p, new_p in patterns_to_try:
                if old_p in content:
                    new_content = content.replace(old_p, new_p)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    return True
        
        return False
    except Exception as e:
        print(f"    Error updating {file_path}: {e}")
        return False


def synchronize_tests(base_dir: str, min_similarity: float = 0.6, dry_run: bool = False):
    """
    Main synchronization function.
    
    Args:
        base_dir: Root directory of the project
        min_similarity: Minimum similarity threshold for matching (0.0 - 1.0)
        dry_run: If True, only print what would be done without making changes
    """
    print("=" * 80)
    print("TEST CASE SYNCHRONIZATION SCRIPT")
    print("=" * 80)
    print(f"\nBase Directory: {base_dir}")
    print(f"Minimum Similarity Threshold: {min_similarity * 100}%")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE - Changes will be applied'}")
    print("-" * 80)
    
    # Paths
    test_dir = os.path.join(base_dir, 'test', 'integration')
    qa_doc_dir = os.path.join(base_dir, 'QA_DOCUMENTATION')
    testcase_csv_path = os.path.join(qa_doc_dir, 'TestCase_Detailed.csv')
    rtm_csv_path = os.path.join(qa_doc_dir, 'RTM_Requirements_Traceability_Matrix.csv')
    
    # Step 1: Extract tests from code
    print("\n[Step 1] Scanning test files...")
    code_tests = extract_tests_from_code(test_dir)
    print(f"  Found {len(code_tests)} test cases in code")
    
    if not code_tests:
        print("  ERROR: No test cases found in code. Exiting.")
        return
    
    # Step 2: Load CSVs
    print("\n[Step 2] Loading CSV files...")
    tc_headers, testcase_rows = load_csv_file(testcase_csv_path)
    rtm_headers, rtm_rows = load_csv_file(rtm_csv_path)
    
    if not testcase_rows:
        print("  ERROR: TestCase_Detailed.csv is empty or could not be loaded. Exiting.")
        return
    
    # Step 3: Perform fuzzy matching
    print("\n[Step 3] Performing fuzzy matching...")
    matches: List[TestCaseMatch] = []
    no_match: List[Dict] = []
    
    for test in code_tests:
        match_result = find_best_match(test['description'], testcase_rows, min_similarity=min_similarity)
        
        if match_result:
            target_id, old_csv_desc, score, _ = match_result
            
            # Only process if IDs are different
            if test['current_id'] != target_id:
                matches.append(TestCaseMatch(
                    code_file=test['file'],
                    code_line_number=test['line_number'],
                    code_old_id=test['current_id'],
                    code_description=test['description'],
                    csv_target_id=target_id,
                    csv_old_description=old_csv_desc,
                    similarity_score=score,
                ))
        else:
            no_match.append(test)
    
    print(f"  Matches found (IDs need update): {len(matches)}")
    print(f"  Tests with no match or already synced: {len(no_match)}")
    
    # Step 4: Display matches and apply updates
    print("\n[Step 4] Processing matches...")
    print("-" * 80)
    
    code_updates = 0
    csv_updates = 0
    rtm_updates = 0
    
    # Group matches by file for cleaner output
    matches_by_file: Dict[str, List[TestCaseMatch]] = {}
    for match in matches:
        file_key = os.path.basename(match.code_file)
        if file_key not in matches_by_file:
            matches_by_file[file_key] = []
        matches_by_file[file_key].append(match)
    
    for file_name, file_matches in matches_by_file.items():
        print(f"\n[MATCH FOUND] Code File: \"{file_name}\"")
        
        for match in file_matches:
            print(f"   Line {match.code_line_number}:")
            print(f"   Old ID (Code): {match.code_old_id} -> New ID (CSV): {match.csv_target_id}")
            print(f"   Similarity: {match.similarity_score * 100:.1f}%")
            
            # Truncate descriptions for display
            code_desc_short = match.code_description[:60] + "..." if len(match.code_description) > 60 else match.code_description
            csv_desc_short = match.csv_old_description[:60] + "..." if len(match.csv_old_description) > 60 else match.csv_old_description
            
            print(f"   Code Desc: \"{code_desc_short}\"")
            print(f"   CSV Desc:  \"{csv_desc_short}\"")
            
            if not dry_run:
                # A) Update the code file
                if update_code_file(match.code_file, match.code_old_id, match.csv_target_id, match.code_description):
                    print(f"   [OK] Updated code file with new ID")
                    code_updates += 1
                else:
                    print(f"   [FAIL] Failed to update code file")
                
                # B) Update TestCase_Detailed.csv - replace description
                for row in testcase_rows:
                    if row.get('Test Case ID') == match.csv_target_id:
                        row['Test Case Description'] = match.code_description
                        csv_updates += 1
                        print(f"   [OK] Updated CSV description")
                        break
                
                # C) Update RTM - only if single TC ID in row
                for row in rtm_rows:
                    tc_ids = row.get('TC ID', '')
                    # Only update if this is a single ID match (not comma-separated)
                    if match.csv_target_id == tc_ids.strip():
                        row['TC Desc'] = match.code_description
                        rtm_updates += 1
                        print(f"   [OK] Updated RTM description")
                        break
                    elif ',' in tc_ids and match.csv_target_id in tc_ids:
                        print(f"   [WARN] RTM has multiple IDs ({tc_ids}), skipping description update")
            else:
                print("   [DRY RUN] No changes made")
            
            print()
    
    # Step 5: Save updated CSVs
    if not dry_run and (csv_updates > 0 or rtm_updates > 0):
        print("\n[Step 5] Saving updated CSV files...")
        
        if csv_updates > 0:
            if save_csv_file(testcase_csv_path, tc_headers, testcase_rows):
                print(f"  [OK] Saved TestCase_Detailed.csv with {csv_updates} description updates")
            else:
                print(f"  [FAIL] Failed to save TestCase_Detailed.csv")
        
        if rtm_updates > 0:
            if save_csv_file(rtm_csv_path, rtm_headers, rtm_rows):
                print(f"  [OK] Saved RTM.csv with {rtm_updates} description updates")
            else:
                print(f"  [FAIL] Failed to save RTM.csv")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total test cases in code: {len(code_tests)}")
    print(f"Matches requiring ID update: {len(matches)}")
    
    if not dry_run:
        print(f"Code files updated: {code_updates}")
        print(f"CSV descriptions updated: {csv_updates}")
        print(f"RTM descriptions updated: {rtm_updates}")
    else:
        print("(DRY RUN - No actual changes made)")
    
    # Report unmatched tests
    if no_match:
        print(f"\nTests without CSV match (may need manual review): {len(no_match)}")
        for test in no_match[:10]:  # Show first 10
            short_file = os.path.basename(test['file'])
            print(f"  - {test['current_id']}: {test['description'][:50]}... ({short_file})")
        if len(no_match) > 10:
            print(f"  ... and {len(no_match) - 10} more")
    
    print("\n" + "=" * 80)
    print("Synchronization complete!")
    print("=" * 80)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Synchronize test case IDs between code and CSV documentation')
    parser.add_argument('--base-dir', '-d', default=None, 
                        help='Base directory of the project (default: auto-detect)')
    parser.add_argument('--similarity', '-s', type=float, default=0.6,
                        help='Minimum similarity threshold (0.0-1.0, default: 0.6)')
    parser.add_argument('--dry-run', '-n', action='store_true',
                        help='Dry run mode - show what would be done without making changes')
    
    args = parser.parse_args()
    
    # Auto-detect base directory
    if args.base_dir:
        base_dir = args.base_dir
    else:
        # Try to find the project root (look for QA_DOCUMENTATION folder)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)  # Go up one level from scripts/
        
        if not os.path.exists(os.path.join(base_dir, 'QA_DOCUMENTATION')):
            # Try current working directory
            base_dir = os.getcwd()
        
        if not os.path.exists(os.path.join(base_dir, 'QA_DOCUMENTATION')):
            print(f"ERROR: Could not find QA_DOCUMENTATION folder. Please specify --base-dir")
            exit(1)
    
    synchronize_tests(base_dir, args.similarity, args.dry_run)
