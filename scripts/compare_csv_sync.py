#!/usr/bin/env python3
"""
Compare RTM and TestCase_Detailed CSV files to find mismatches.
This script checks if TC IDs in RTM exist in TestCase_Detailed 
and if descriptions are similar.
"""

import csv
import os
from difflib import SequenceMatcher


def load_rtm(path):
    """Load RTM CSV and extract TC IDs and descriptions per requirement."""
    rtm_data = []
    with open(path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tc_ids = row.get('TC ID', '').strip()
            tc_desc = row.get('TC Desc', '').strip()
            req_id = row.get('Req ID', '').strip()
            req_desc = row.get('Req Desc', '').strip()
            
            if tc_ids:
                # Parse comma-separated TC IDs
                ids = [id.strip() for id in tc_ids.split(',')]
                rtm_data.append({
                    'req_id': req_id,
                    'req_desc': req_desc,
                    'tc_ids': ids,
                    'tc_desc': tc_desc,
                })
    return rtm_data


def load_testcase_detailed(path):
    """Load TestCase_Detailed CSV as a dict keyed by TC ID."""
    tc_data = {}
    with open(path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tc_id = row.get('Test Case ID', '').strip()
            tc_desc = row.get('Test Case Description', '').strip()
            if tc_id:
                tc_data[tc_id] = tc_desc
    return tc_data


def get_similarity(s1, s2):
    """Calculate similarity between two strings."""
    return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()


def compare_files(rtm_path, tc_path):
    """Compare the two files and report mismatches."""
    print("=" * 80)
    print("CSV SYNCHRONIZATION CHECK")
    print("=" * 80)
    print(f"\nRTM File: {rtm_path}")
    print(f"TestCase File: {tc_path}\n")
    
    rtm_data = load_rtm(rtm_path)
    tc_data = load_testcase_detailed(tc_path)
    
    print(f"RTM Requirements: {len(rtm_data)}")
    print(f"TestCase entries: {len(tc_data)}")
    print("-" * 80)
    
    # Track issues
    missing_in_tc = []
    total_tc_refs = 0
    matched = 0
    
    for rtm_row in rtm_data:
        for tc_id in rtm_row['tc_ids']:
            total_tc_refs += 1
            
            if tc_id not in tc_data:
                missing_in_tc.append({
                    'tc_id': tc_id,
                    'req_id': rtm_row['req_id'],
                    'req_desc': rtm_row['req_desc'],
                })
            else:
                matched += 1
    
    print(f"\n[SUMMARY]")
    print(f"  Total TC references in RTM: {total_tc_refs}")
    print(f"  Matched in TestCase_Detailed: {matched}")
    print(f"  Missing in TestCase_Detailed: {len(missing_in_tc)}")
    
    if missing_in_tc:
        print(f"\n[MISSING TEST CASES]")
        print("These TC IDs are referenced in RTM but NOT found in TestCase_Detailed.csv:")
        for item in missing_in_tc[:20]:
            print(f"  - {item['tc_id']} (Requirement {item['req_id']}: {item['req_desc'][:50]}...)")
        if len(missing_in_tc) > 20:
            print(f"  ... and {len(missing_in_tc) - 20} more")
    
    # Check description similarity for first TC in each RTM row
    print(f"\n[DESCRIPTION CHECK]")
    print("Comparing RTM TC Desc with TestCase_Detailed descriptions:")
    print("-" * 80)
    
    desc_issues = []
    for rtm_row in rtm_data:
        rtm_desc = rtm_row['tc_desc']
        first_tc_id = rtm_row['tc_ids'][0] if rtm_row['tc_ids'] else None
        
        if first_tc_id and first_tc_id in tc_data:
            tc_desc = tc_data[first_tc_id]
            similarity = get_similarity(rtm_desc, tc_desc)
            
            # If similarity is low, flag it
            if similarity < 0.4:
                desc_issues.append({
                    'req_id': rtm_row['req_id'],
                    'tc_id': first_tc_id,
                    'rtm_desc': rtm_desc,
                    'tc_desc': tc_desc,
                    'similarity': similarity,
                })
    
    if desc_issues:
        print(f"\nFound {len(desc_issues)} potential description mismatches (similarity < 40%):")
        for item in desc_issues[:15]:
            print(f"\n  Req {item['req_id']} - {item['tc_id']} (Similarity: {item['similarity']*100:.1f}%)")
            rtm_short = item['rtm_desc'][:60] + "..." if len(item['rtm_desc']) > 60 else item['rtm_desc']
            tc_short = item['tc_desc'][:60] + "..." if len(item['tc_desc']) > 60 else item['tc_desc']
            print(f"    RTM Desc: \"{rtm_short}\"")
            print(f"    TC Desc:  \"{tc_short}\"")
        if len(desc_issues) > 15:
            print(f"\n  ... and {len(desc_issues) - 15} more")
    else:
        print("  All descriptions appear to be in sync!")
    
    # Check TC IDs in TestCase that are NOT in RTM
    rtm_tc_ids = set()
    for rtm_row in rtm_data:
        for tc_id in rtm_row['tc_ids']:
            rtm_tc_ids.add(tc_id)
    
    orphan_in_tc = [tc_id for tc_id in tc_data.keys() if tc_id not in rtm_tc_ids]
    
    print(f"\n[ORPHAN TEST CASES]")
    print(f"TestCase_Detailed has {len(orphan_in_tc)} entries not referenced in RTM.")
    print("(These are likely detailed sub-tests that don't need RTM entries)")
    
    print("\n" + "=" * 80)
    print("CHECK COMPLETE")
    print("=" * 80)
    
    return {
        'total_tc_refs': total_tc_refs,
        'matched': matched,
        'missing_in_tc': missing_in_tc,
        'orphan_in_tc': orphan_in_tc,
        'desc_issues': desc_issues,
    }


if __name__ == "__main__":
    base_dir = r"c:\Sem1_Year3_Projects\auction-hub\QA_DOCUMENTATION"
    rtm_path = os.path.join(base_dir, "RTM_Requirements_Traceability_Matrix.csv")
    tc_path = os.path.join(base_dir, "TestCase_Detailed.csv")
    
    compare_files(rtm_path, tc_path)
