const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, '../visual-tests/reports');
const outputReport = path.join(__dirname, '../visual-tests/REPORT.md');
const buttonMatrix = path.join(reportsDir, 'button-matrix.md');
const consoleErrorsFile = path.join(reportsDir, 'console-errors.json');
const a11yQuick = path.join(reportsDir, 'a11y-quick.json');

function parseReports() {
  const viewports = ['desktop', 'mobile', 'tablet'];
  let totalRoutes = 0;
  let totalButtons = 0;
  let totalBrokenButtons = 0;
  let allConsoleErrors = [];
  let brokenRoutes = [];

  let matrixContent = '| Route | Button Text | Viewport | Disabled | Clicks Cleanly | Console Error | Screenshot |\n';
  matrixContent += '|-------|-------------|----------|----------|---------------|---------------|------------|\n';

  let summaryData = {};

  viewports.forEach(vp => {
    const file = path.join(reportsDir, `${vp}-report.json`);
    if (!fs.existsSync(file)) return;

    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let vpRoutes = 0;
    let vpButtons = 0;
    let vpBrokenButtons = 0;
    let vpConsoleErrorsCount = 0;

    data.routes.forEach(route => {
      vpRoutes++;
      if (route.broken) {
        brokenRoutes.push({ route: route.path, viewport: vp, status: route.status });
      }

      route.consoleErrors.forEach(err => {
        vpConsoleErrorsCount++;
        allConsoleErrors.push({
          message: err.text,
          route: route.path,
          viewport: vp
        });
      });

      route.buttons.forEach(btn => {
        vpButtons++;
        const clickFailed = btn.clickWorked === false && btn.disabled === false;
        if (clickFailed) vpBrokenButtons++;

        matrixContent += `| ${route.path} | ${btn.text.replace(/\|/g, '-')} | ${vp} | ${btn.disabled ? 'Yes' : 'No'} | ${btn.clickWorked ? 'Yes' : (btn.disabled ? 'N/A' : 'No')} | ${clickFailed ? 'Yes' : 'No'} | ${btn.screenshot} |\n`;
      });
    });

    summaryData[vp] = {
      routes: vpRoutes,
      buttons: vpButtons,
      brokenButtons: vpBrokenButtons,
      consoleErrors: vpConsoleErrorsCount
    };

    totalRoutes += vpRoutes;
    totalButtons += vpButtons;
    totalBrokenButtons += vpBrokenButtons;
  });

  fs.writeFileSync(buttonMatrix, matrixContent);

  // Deduplicate console errors
  const uniqueErrors = {};
  allConsoleErrors.forEach(e => {
    const key = `${e.message}-${e.route}-${e.viewport}`;
    if (!uniqueErrors[key]) {
      uniqueErrors[key] = { ...e, count: 1 };
    } else {
      uniqueErrors[key].count++;
    }
  });

  const finalConsoleErrors = {
    total_errors: allConsoleErrors.length,
    unique_errors: Object.values(uniqueErrors)
  };
  fs.writeFileSync(consoleErrorsFile, JSON.stringify(finalConsoleErrors, null, 2));

  // Write final REPORT.md
  let reportContent = `# MediKiosk Visual Test Report\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n\n`;
  reportContent += `| Viewport | Routes Tested | Buttons Tested | Broken Buttons | Console Errors | Screenshots |\n`;
  reportContent += `|----------|--------------|---------------|----------------|----------------|-------------|\n`;

  viewports.forEach(vp => {
    const s = summaryData[vp];
    if (s) {
      reportContent += `| ${vp} | ${s.routes} | ${s.buttons} | ${s.brokenButtons} | ${s.consoleErrors} | ${s.routes + s.buttons} |\n`;
    }
  });

  reportContent += `\n## Broken Buttons\nCheck \`reports/button-matrix.md\` for full matrix. ${totalBrokenButtons} broken buttons found.\n`;

  reportContent += `\n## Console Errors\n`;
  if (finalConsoleErrors.unique_errors.length === 0) {
    reportContent += `None\n`;
  } else {
    finalConsoleErrors.unique_errors.forEach(e => {
      reportContent += `- **[${e.viewport}] ${e.route}**: \`${e.message.replace(/\n/g, ' ')}\` (${e.count} times)\n`;
    });
  }

  reportContent += `\n## Routes That Failed to Load\n`;
  if (brokenRoutes.length === 0) {
    reportContent += `None\n`;
  } else {
    brokenRoutes.forEach(r => {
      reportContent += `- **[${r.viewport}] ${r.route}**: HTTP ${r.status}\n`;
    });
  }

  reportContent += `\n## Screenshots\nAll screenshots saved to \`frontend/visual-tests/screenshots/\`\n`;

  fs.writeFileSync(outputReport, reportContent);
  console.log('Report generated at frontend/visual-tests/REPORT.md');
}

parseReports();
