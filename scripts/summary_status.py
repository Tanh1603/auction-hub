#!/usr/bin/env python3
"""Generate summary of test implementation status."""

import csv

# Count statuses in TestCase_Detailed.csv
tc_stats = {'Implemented': 0, 'Not Started': 0, 'Other': 0}
with open('QA_DOCUMENTATION/TestCase_Detailed.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        status = row.get('Status', '').strip()
        if status == 'Implemented':
            tc_stats['Implemented'] += 1
        elif status == 'Not Started':
            tc_stats['Not Started'] += 1
        else:
            tc_stats['Other'] += 1

# Count statuses in RTM
rtm_stats = {'Complete': 0, 'Partial': 0, 'Not Started': 0}
with open('QA_DOCUMENTATION/RTM_Requirements_Traceability_Matrix.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        status = row.get('Test Execution', '').strip()
        if status == 'Complete':
            rtm_stats['Complete'] += 1
        elif status.startswith('Partial'):
            rtm_stats['Partial'] += 1
        elif status == 'Not Started':
            rtm_stats['Not Started'] += 1

total_tc = sum(tc_stats.values())
total_rtm = sum(rtm_stats.values())

print('=' * 60)
print('TEST IMPLEMENTATION STATUS SUMMARY')
print('=' * 60)
print()
print('TestCase_Detailed.csv:')
print(f"  Implemented:  {tc_stats['Implemented']:>4} tests")
print(f"  Not Started:  {tc_stats['Not Started']:>4} tests")
print(f"  Total:        {total_tc:>4} tests")
print(f"  Coverage:     {tc_stats['Implemented']/total_tc*100:.1f}%")
print()
print('RTM Requirements:')
print(f"  Complete:     {rtm_stats['Complete']:>4} requirements")
print(f"  Partial:      {rtm_stats['Partial']:>4} requirements")
print(f"  Not Started:  {rtm_stats['Not Started']:>4} requirements")
print(f"  Total:        {total_rtm:>4} requirements")
print('=' * 60)
