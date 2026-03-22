/**
 * Custom Jest Bug Reporter with CSV Output & Defect Registry
 *
 * This reporter hooks into Jest's test lifecycle and generates THREE files:
 *
 * 1. TEST_RESULTS_OUTPUT.csv - All test results with Actual Result (evidence)
 * 2. BUG_REPORT_GENERATED.txt - Detailed bug reports for failed tests
 * 3. DEFECT_REGISTRY.csv - Links Defect ID to Test Case ID for RTM integration
 *
 * Flow:
 * - Failed test → Bug Report (Bug ID = Defect ID)
 * - Defect Registry links Bug ID → Test Case ID → RTM Defect ID column
 * - TEST_RESULTS_OUTPUT provides Actual Result as evidence
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class CustomBugReporter {
  constructor(globalConfig, reporterOptions, reporterContext) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions || {};
    this._context = reporterContext;
    this._defects = []; // Store defects for cross-file linking
  }

  /**
   * Called when all tests have finished running
   * @param {object} testContexts - Set of test contexts
   * @param {object} results - Aggregated test results
   */
  onRunComplete(testContexts, results) {
    // Collect all tests first
    const allTests = this._collectAllTests(results);
    const failedTests = allTests.filter((t) => t.status === 'failed');

    // Generate defects with IDs for failed tests
    this._defects = this._generateDefects(failedTests);

    // 1. Always generate TEST_RESULTS_OUTPUT.csv with all test results
    this._generateTestResultsCsv(allTests);

    // 2. Generate DEFECT_REGISTRY.csv (links defects to test cases for RTM)
    this._generateDefectRegistry();

    // 3. Generate BUG_REPORT_GENERATED.txt only if there are failures
    if (failedTests.length > 0) {
      this._generateBugReport();
    } else {
      console.log('\n✅ All tests passed! No bug report generated.\n');
    }

    // Print summary
    this._printSummary(allTests);
  }

  /**
   * Generate defect objects with IDs for each failed test
   * @param {Array} failedTests - Array of failed test objects
   * @returns {Array} Array of defect objects
   */
  _generateDefects(failedTests) {
    const currentDate = this._formatDate(new Date());

    return failedTests.map((test, index) => {
      const defectId = this._generateDefectId(index);
      const testCaseId = this._extractTestCaseId(test.title);

      return {
        defectId: defectId,
        testCaseId: testCaseId,
        testTitle: test.title,
        category: test.category,
        filePath: test.filePath,
        status: 'Open', // Default status for new defects
        severity: 'Critical (S1)',
        priority: 'High (P1)',
        assignedTo: 'Developer-TEAM1016',
        reportedDate: currentDate,
        failureMessages: test.failureMessages,
        duration: test.duration,
        summary: this._getFirstLine(test.failureMessages[0] || 'Unknown error'),
        actualResult: this._formatActualResultForCsv(test.failureMessages),
      };
    });
  }

  /**
   * Generate defect ID based on index
   * @param {number} index - Zero-based index
   * @returns {string} Defect ID like BUG-001
   */
  _generateDefectId(index) {
    const number = (index + 1).toString().padStart(3, '0');
    return `BUG-${number}`;
  }

  /**
   * Extract Test Case ID from test title
   * @param {string} title - Test title
   * @returns {string} Test Case ID or empty string
   */
  _extractTestCaseId(title) {
    const match = title.match(/TC-[\d.]+[-\d]+/i);
    return match ? match[0] : '';
  }

  // ============================================================
  // FILE 1: TEST_RESULTS_OUTPUT.csv - All Test Results with Evidence
  // ============================================================

  /**
   * Generate TEST_RESULTS_OUTPUT.csv with all test results
   * @param {Array} allTests - Array of all test objects
   */
  _generateTestResultsCsv(allTests) {
    const headers = [
      'Category',
      'Test Case ID',
      'Test Case Description',
      'PreRequisites',
      'Steps to Perform',
      'Step Expected Result',
      'Test Case Expected Result',
      'Actual Result',
      'Status',
      'Defect ID',
      'Note',
    ];

    const rows = [headers.join(',')];

    allTests.forEach((test) => {
      // Find defect if this test failed
      const defect = this._defects.find(
        (d) => d.testTitle === test.title && d.filePath === test.filePath
      );

      // Map Jest status to CSV status
      let csvStatus;
      switch (test.status) {
        case 'passed':
          csvStatus = 'Pass';
          break;
        case 'failed':
          csvStatus = 'Fail';
          break;
        case 'pending':
        case 'skipped':
          csvStatus = 'Skipped';
          break;
        default:
          csvStatus = 'Unknown';
      }

      // Format actual result based on status
      let actualResult = '';
      if (test.status === 'passed') {
        actualResult =
          'Test passed successfully. All assertions matched expected values.';
      } else if (test.status === 'failed') {
        actualResult = defect
          ? defect.actualResult
          : this._formatActualResultForCsv(test.failureMessages);
      } else {
        actualResult = 'Test was skipped or pending.';
      }

      // Note includes execution metadata
      const note = `Executed: ${new Date().toISOString()}; Duration: ${
        test.duration || 0
      }ms`;

      const row = [
        this._escapeCsv(test.category),
        this._escapeCsv(test.testCaseId),
        this._escapeCsv(test.title),
        '', // PreRequisites
        this._escapeCsv(`Run test: ${this._getRelativePath(test.filePath)}`),
        '', // Step Expected Result
        '', // Test Case Expected Result
        this._escapeCsv(actualResult),
        csvStatus,
        defect ? defect.defectId : '', // Link to Defect ID
        this._escapeCsv(note),
      ];

      rows.push(row.join(','));
    });

    // rootDir is now the project root, so output files go directly there
    const csvPath = path.resolve(
      this._globalConfig.rootDir,
      'TEST_RESULTS_OUTPUT.csv'
    );

    try {
      fs.writeFileSync(csvPath, rows.join('\n'), 'utf-8');
      console.log(`\n📊 Test Results CSV: ${csvPath}`);
    } catch (error) {
      console.error(
        `\n❌ Failed to write TEST_RESULTS_OUTPUT.csv: ${error.message}\n`
      );
    }
  }

  // ============================================================
  // FILE 2: DEFECT_REGISTRY.csv - Links Defect ID to Test Case ID
  // ============================================================

  /**
   * Generate DEFECT_REGISTRY.csv linking defects to test cases
   * This file is used to update RTM's Defect ID and Defect Status columns
   */
  _generateDefectRegistry() {
    const headers = [
      'Defect ID',
      'Test Case ID',
      'Test Case Description',
      'Category',
      'Defect Status',
      'Severity',
      'Priority',
      'Assigned To',
      'Reported Date',
      'Summary',
      'Actual Result (Evidence)',
      'Test File Path',
      'Duration (ms)',
    ];

    const rows = [headers.join(',')];

    this._defects.forEach((defect) => {
      const row = [
        defect.defectId,
        this._escapeCsv(defect.testCaseId),
        this._escapeCsv(defect.testTitle),
        this._escapeCsv(defect.category),
        defect.status,
        defect.severity,
        defect.priority,
        defect.assignedTo,
        defect.reportedDate,
        this._escapeCsv(defect.summary),
        this._escapeCsv(defect.actualResult),
        this._escapeCsv(this._getRelativePath(defect.filePath)),
        defect.duration || 0,
      ];

      rows.push(row.join(','));
    });

    // rootDir is now the project root, so output files go directly there
    const csvPath = path.resolve(
      this._globalConfig.rootDir,
      'DEFECT_REGISTRY.csv'
    );

    try {
      fs.writeFileSync(csvPath, rows.join('\n'), 'utf-8');
      console.log(`📋 Defect Registry CSV: ${csvPath}`);
    } catch (error) {
      console.error(
        `\n❌ Failed to write DEFECT_REGISTRY.csv: ${error.message}\n`
      );
    }
  }

  // ============================================================
  // FILE 3: BUG_REPORT_GENERATED.txt - Detailed Bug Reports
  // ============================================================

  /**
   * Generate BUG_REPORT_GENERATED.txt with detailed bug reports
   */
  _generateBugReport() {
    const projectName = this._getProjectName();
    const osInfo = this._getOsInfo();
    const nodeVersion = process.version;

    let report = '';
    report += '==================================================\n';
    report += 'BUG REPORTS\n';
    report += `Project: ${projectName}\n`;
    report += 'Reported by: Automated Jest Reporter\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Defects: ${this._defects.length}\n`;
    report += '==================================================\n\n';
    report += 'QUICK REFERENCE TABLE:\n';
    report += '-'.repeat(80) + '\n';
    report += 'Defect ID  | Test Case ID     | Status | Severity\n';
    report += '-'.repeat(80) + '\n';

    this._defects.forEach((defect) => {
      const defectIdPadded = defect.defectId.padEnd(10);
      const tcIdPadded = (defect.testCaseId || 'N/A').padEnd(16);
      const statusPadded = defect.status.padEnd(6);
      report += `${defectIdPadded} | ${tcIdPadded} | ${statusPadded} | ${defect.severity}\n`;
    });

    report += '-'.repeat(80) + '\n\n';

    // Detailed bug reports
    this._defects.forEach((defect) => {
      const fullErrorMessage = this._formatErrorMessage(defect.failureMessages);
      const relativePath = this._getRelativePath(defect.filePath);

      report += '--------------------------------------------------\n';
      report += `§  Bug Name: ${defect.testTitle}\n`;
      report += `Bug ID: ${defect.defectId}\n`;
      report += `§  Test Case ID: ${defect.testCaseId || 'Not Mapped'}\n`;
      report += `§  Date: ${defect.reportedDate}\n`;
      report += `§  Assigned to: ${defect.assignedTo}\n`;
      report += `§  Status: ${defect.status}\n`;
      report += `§  Summary/Description:\n`;
      report += `    ${defect.summary}\n`;
      report += `§  Environments (OS/Browser): ${osInfo} / Node ${nodeVersion}\n`;
      report += `§  Step to reproduce:\n`;
      report += `    1. Run test file: ${relativePath}\n`;
      report += `    2. Test case failed: "${defect.testTitle}"\n`;
      report += `§  Actual results:\n`;
      report += `    ${this._indentMultiline(fullErrorMessage, '    ')}\n`;
      report += `§  Expected results:\n`;
      report += `    Test assertion should pass (Expected value should match received value).\n`;
      report += `§  Severity: ${defect.severity}\n`;
      report += `Priority: ${defect.priority}\n`;
      report += `§  Attachment:\n`;
      report += `    - See TEST_RESULTS_OUTPUT.csv for evidence\n`;
      report += `    - See DEFECT_REGISTRY.csv for RTM mapping\n`;
      report += `    - See coverage/ folder for technical logs\n`;
      report += '--------------------------------------------------\n\n';
    });

    // rootDir is now the project root, so output files go directly there
    const outputPath = path.resolve(
      this._globalConfig.rootDir,
      'BUG_REPORT_GENERATED.txt'
    );

    try {
      fs.writeFileSync(outputPath, report, 'utf-8');
      console.log(`🐛 Bug Report TXT: ${outputPath}`);
    } catch (error) {
      console.error(
        `\n❌ Failed to write BUG_REPORT_GENERATED.txt: ${error.message}\n`
      );
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Print summary of test execution
   * @param {Array} allTests - All test objects
   */
  _printSummary(allTests) {
    const passed = allTests.filter((t) => t.status === 'passed').length;
    const failed = allTests.filter((t) => t.status === 'failed').length;
    const skipped = allTests.filter(
      (t) => t.status === 'pending' || t.status === 'skipped'
    ).length;

    console.log('\n' + '='.repeat(60));
    console.log('JEST CUSTOM REPORTER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:     ${allTests.length}`);
    console.log(`✅ Passed:       ${passed}`);
    console.log(`❌ Failed:       ${failed}`);
    console.log(`⏭️  Skipped:      ${skipped}`);
    console.log(`🐛 Defects:      ${this._defects.length}`);
    console.log('='.repeat(60));
    console.log('Generated Files:');
    console.log('  1. TEST_RESULTS_OUTPUT.csv  → Actual Results (Evidence)');
    console.log(
      '  2. DEFECT_REGISTRY.csv      → Defect ID ↔ Test Case ID mapping'
    );
    if (this._defects.length > 0) {
      console.log('  3. BUG_REPORT_GENERATED.txt → Detailed Bug Reports');
    }
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Collect ALL tests (passed, failed, skipped) from results
   * @param {object} results - Jest aggregated results
   * @returns {Array} Array of all test objects
   */
  _collectAllTests(results) {
    const allTests = [];

    results.testResults.forEach((testFileResult) => {
      const testFilePath = testFileResult.testFilePath;

      testFileResult.testResults.forEach((testResult) => {
        const testCaseId = this._extractTestCaseId(testResult.title);

        // Extract category from ancestor titles
        const category =
          testResult.ancestorTitles.length > 0
            ? testResult.ancestorTitles[0]
            : this._extractCategoryFromPath(testFilePath);

        allTests.push({
          category: category,
          testCaseId: testCaseId,
          title: testResult.title,
          fullName: testResult.fullName,
          ancestorTitles: testResult.ancestorTitles,
          filePath: testFilePath,
          status: testResult.status,
          failureMessages: testResult.failureMessages || [],
          duration: testResult.duration,
        });
      });
    });

    return allTests;
  }

  /**
   * Extract category from file path
   * @param {string} filePath - Test file path
   * @returns {string} Category extracted from path
   */
  _extractCategoryFromPath(filePath) {
    const fileName = path.basename(filePath, '.spec.ts');
    // Try to extract category from filename like "2.1.1-registration" -> "2.1 User Management"
    const match = fileName.match(/^(\d+)\.(\d+)/);
    if (match) {
      return `${match[1]}.${match[2]}`;
    }
    return fileName;
  }

  /**
   * Format actual result for CSV (clean and truncate)
   * @param {Array} messages - Failure messages array
   * @returns {string} Formatted actual result
   */
  _formatActualResultForCsv(messages) {
    if (!messages || messages.length === 0) {
      return 'Test failed with unknown error';
    }

    // Get the first failure message and clean it
    let result = this._stripAnsiCodes(messages[0]);

    // Extract key error info
    const lines = result.split('\n').filter((line) => line.trim());

    // Find the most relevant lines
    const relevantInfo = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip stack trace lines
      if (trimmed.startsWith('at ') || trimmed.startsWith('Error:')) continue;

      // Check for assertion patterns
      if (
        trimmed.includes('expect') ||
        trimmed.includes('Expected') ||
        trimmed.includes('Received') ||
        trimmed.includes('toB') ||
        trimmed.includes('toEqual') ||
        trimmed.includes('toMatch') ||
        trimmed.includes('toHave') ||
        trimmed.includes('Status') ||
        trimmed.match(/\d{3}/) // HTTP status codes
      ) {
        relevantInfo.push(trimmed);
      }
    }

    // If we found relevant info, use it; otherwise use first few lines
    if (relevantInfo.length > 0) {
      result = relevantInfo.slice(0, 5).join(' | ');
    } else {
      result = lines.slice(0, 3).join(' | ');
    }

    // Truncate if too long (CSV cell limit)
    const maxLength = 500;
    if (result.length > maxLength) {
      result = result.substring(0, maxLength) + '... [truncated]';
    }

    return result;
  }

  /**
   * Escape value for CSV (handle commas, quotes, newlines)
   * @param {string} value - Value to escape
   * @returns {string} CSV-safe value
   */
  _escapeCsv(value) {
    if (value === null || value === undefined) {
      return '';
    }

    let str = String(value);

    // Replace newlines with spaces
    str = str.replace(/[\r\n]+/g, ' ');

    // If contains comma, quote, or special chars, wrap in quotes
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      // Escape double quotes by doubling them
      str = str.replace(/"/g, '""');
      str = `"${str}"`;
    }

    return str;
  }

  /**
   * Format date as DD-MMM-YY
   * @param {Date} date - Date object
   * @returns {string} Formatted date
   */
  _formatDate(date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }

  /**
   * Get OS information
   * @returns {string} OS type and platform
   */
  _getOsInfo() {
    const osType = os.type();
    const osRelease = os.release();
    const platform = os.platform();

    // Map os.type() to friendly names
    const osNames = {
      Windows_NT: 'Windows',
      Linux: 'Linux',
      Darwin: 'macOS',
    };

    const friendlyName = osNames[osType] || osType;
    return `${friendlyName} ${osRelease} (${platform})`;
  }

  /**
   * Get project name from package.json
   * @returns {string} Project name
   */
  _getProjectName() {
    try {
      // rootDir is now the project root
      const packageJsonPath = path.resolve(
        this._globalConfig.rootDir,
        'package.json'
      );
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.name || 'Unknown Project';
    } catch {
      return 'auction-hub';
    }
  }

  /**
   * Get relative path from root directory
   * @param {string} absolutePath - Absolute file path
   * @returns {string} Relative path
   */
  _getRelativePath(absolutePath) {
    try {
      // rootDir is now the project root
      const rootDir = this._globalConfig.rootDir;
      return path.relative(rootDir, absolutePath).replace(/\\/g, '/');
    } catch {
      return absolutePath;
    }
  }

  /**
   * Get the first line of an error message
   * @param {string} message - Full error message
   * @returns {string} First line
   */
  _getFirstLine(message) {
    if (!message) return 'Unknown error';
    const cleaned = this._stripAnsiCodes(message);
    const lines = cleaned.split('\n').filter((line) => line.trim());
    return lines[0] || 'Unknown error';
  }

  /**
   * Format error messages array into a single string
   * @param {Array} messages - Array of failure messages
   * @returns {string} Formatted error message
   */
  _formatErrorMessage(messages) {
    if (!messages || messages.length === 0) {
      return 'Test failed with error: Unknown';
    }

    const combined = messages.join('\n---\n');
    const cleaned = this._stripAnsiCodes(combined);

    // Truncate if too long (keep first 1000 chars)
    const maxLength = 1000;
    if (cleaned.length > maxLength) {
      return cleaned.substring(0, maxLength) + '\n    ... [truncated]';
    }

    return `Test failed with error:\n${cleaned}`;
  }

  /**
   * Strip ANSI color codes from string
   * @param {string} str - String with ANSI codes
   * @returns {string} Clean string
   */
  _stripAnsiCodes(str) {
    if (!str) return '';
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * Indent multiline text
   * @param {string} text - Text to indent
   * @param {string} indent - Indent string
   * @returns {string} Indented text
   */
  _indentMultiline(text, indent) {
    if (!text) return '';
    return text
      .split('\n')
      .map((line, i) => {
        // Don't indent the first line (it's already after the label)
        return i === 0 ? line : indent + line;
      })
      .join('\n');
  }
}

module.exports = CustomBugReporter;
