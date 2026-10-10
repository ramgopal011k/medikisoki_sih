const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'backend/node_modules/playwright'));

const docsDir = path.join(__dirname, '../docs');

function formatInline(text) {
  if (!text) return '';
  let s = text;
  // Markdown images
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="doc-img-container"><img src="$2" alt="$1" class="doc-img"/><div class="doc-img-caption">$1</div></div>');
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let inMermaid = false;
  let mermaidLines = [];
  let listStack = [];
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  function closeLists() {
    while (listStack.length > 0) {
      const top = listStack.pop();
      out.push(`</${top.type}>`);
    }
  }

  function closeTable() {
    if (inTable) {
      let t = '<div class="table-wrapper"><table><thead><tr>';
      t += tableHeaders.map(c => `<th>${c}</th>`).join('');
      t += '</tr></thead><tbody>';
      for (const row of tableRows) {
        t += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>';
      }
      t += '</tbody></table></div>';
      out.push(t);
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block check
    if (line.trim().startsWith('```')) {
      closeLists();
      closeTable();
      if (!inCode && !inMermaid) {
        const lang = line.trim().substring(3).trim();
        if (lang === 'mermaid') {
          inMermaid = true;
          mermaidLines = [];
        } else {
          inCode = true;
          codeLang = lang || 'CODE';
          codeLines = [];
        }
      } else if (inMermaid) {
        inMermaid = false;
        out.push(`<div class="mermaid-container"><div class="mermaid-title">📊 ARCHITECTURE / WORKFLOW DIAGRAM</div><pre class="mermaid">${mermaidLines.join('\n')}</pre></div>`);
        mermaidLines = [];
      } else if (inCode) {
        inCode = false;
        out.push(`<div class="code-box"><div class="code-header"><span class="code-lang">${codeLang}</span><span class="code-dots"><span></span><span></span><span></span></span></div><pre><code>${codeLines.join('\n')}</code></pre></div>`);
        codeLines = [];
      }
      continue;
    }

    if (inMermaid) {
      mermaidLines.push(line);
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      closeLists();
      closeTable();
      out.push('<hr/>');
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      closeLists();
      closeTable();
      out.push(`<h1>${formatInline(line.substring(2).trim())}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeLists();
      closeTable();
      const hText = formatInline(line.substring(3).trim());
      // Add section class for page-breaking if Section 2 or 3
      const isMajorSection = line.includes('2. System Sub-Workflows') || line.includes('3. Local & Containerized');
      out.push(`<h2 class="${isMajorSection ? 'section-page-break' : ''}">${hText}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeLists();
      closeTable();
      const hText = formatInline(line.substring(4).trim());
      const isPhaseBreak = line.includes('Phase 2:') || line.includes('Phase 3:');
      out.push(`<h3 class="${isPhaseBreak ? 'phase-page-break' : ''}">${hText}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      closeLists();
      closeTable();
      out.push(`<h4>${formatInline(line.substring(5).trim())}</h4>`);
      continue;
    }

    // Metadata items at top
    if (line.startsWith('- **Last Analyzed**:')) {
      closeLists();
      closeTable();
      out.push(`<span class="badge badge-date">📅 Last Analyzed: ${line.split(':')[1].trim()}</span>`);
      continue;
    }
    if (line.startsWith('- **Git Commit Hash**:')) {
      closeLists();
      closeTable();
      const hash = line.split('`')[1] || line.split(':')[1].trim();
      out.push(`<span class="badge badge-commit">🔑 Commit: <code>${hash}</code></span>`);
      continue;
    }

    // Blockquotes / Alerts
    if (line.startsWith('> [!IMPORTANT]')) {
      closeLists();
      closeTable();
      out.push(`<div class="alert alert-important"><div class="alert-icon">⚠️</div><div class="alert-content"><strong>IMPORTANT</strong><p>${formatInline(line.substring(14).trim())}</p></div></div>`);
      continue;
    }
    if (line.startsWith('> [!NOTE]')) {
      closeLists();
      closeTable();
      out.push(`<div class="alert alert-note"><div class="alert-icon">ℹ️</div><div class="alert-content"><strong>NOTE</strong><p>${formatInline(line.substring(9).trim())}</p></div></div>`);
      continue;
    }
    if (line.startsWith('> ')) {
      closeLists();
      closeTable();
      out.push(`<blockquote>${formatInline(line.substring(2).trim())}</blockquote>`);
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      closeLists();
      const cells = line.trim().split('|').slice(1, -1).map(c => c.trim());
      if (line.includes('---')) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeaders = cells.map(c => formatInline(c));
      } else {
        tableRows.push(cells.map(c => formatInline(c)));
      }
      continue;
    } else {
      closeTable();
    }

    // Lists
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      closeTable();
      const indent = listMatch[1].length;
      const marker = listMatch[2];
      const content = formatInline(listMatch[3]);
      const listType = /^\d+\.$/.test(marker) ? 'ol' : 'ul';

      if (listStack.length === 0) {
        listStack.push({ type: listType, indent: indent });
        out.push(`<${listType}>`);
      } else {
        const top = listStack[listStack.length - 1];
        if (indent > top.indent) {
          listStack.push({ type: listType, indent: indent });
          out.push(`<${listType}>`);
        } else {
          while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
            const popped = listStack.pop();
            out.push(`</${popped.type}>`);
          }
          if (listStack.length === 0 || listStack[listStack.length - 1].type !== listType) {
            if (listStack.length > 0) {
              const popped = listStack.pop();
              out.push(`</${popped.type}>`);
            }
            listStack.push({ type: listType, indent: indent });
            out.push(`<${listType}>`);
          }
        }
      }
      out.push(`<li>${content}</li>`);
      continue;
    } else {
      closeLists();
    }

    // Empty line
    if (!line.trim()) {
      continue;
    }

    // Paragraph
    out.push(`<p>${formatInline(line.trim())}</p>`);
  }

  closeLists();
  closeTable();

  return out.join('\n');
}

function buildFullDocumentHtml(title, bodyHtml) {
  const displayTitle = title.replace(/_/g, ' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${displayTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1E293B;
      line-height: 1.55;
      font-size: 9.2pt;
      background: #FFFFFF;
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact;
    }

    /* Cover / Document Banner */
    .doc-banner {
      background: linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%);
      color: #FFFFFF;
      padding: 18px 22px;
      border-radius: 8px;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(49, 46, 129, 0.15);
      position: relative;
      overflow: hidden;
    }
    .doc-banner::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 250px;
      height: 100%;
      background: radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .doc-banner-subtitle {
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #818CF8;
      margin-bottom: 3px;
    }
    .doc-banner-title {
      font-size: 18pt;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0;
      line-height: 1.2;
      letter-spacing: -0.4px;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 16px;
      font-size: 7.8pt;
      font-weight: 500;
      background: #F1F5F9;
      color: #334155;
      border: 1px solid #E2E8F0;
      margin-right: 6px;
      margin-bottom: 10px;
    }
    .badge-date {
      background: #EEF2FF;
      color: #4338CA;
      border-color: #C7D2FE;
    }
    .badge-commit {
      background: #F0FDF4;
      color: #166534;
      border-color: #BBF7D0;
    }
    .badge code {
      background: transparent;
      border: none;
      color: inherit;
      font-weight: 600;
      padding: 0;
    }

    /* Headings */
    h1 {
      font-size: 15pt;
      color: #0F172A;
      border-bottom: 2px solid #6366F1;
      padding-bottom: 5px;
      margin-top: 16px;
      margin-bottom: 10px;
      font-weight: 700;
      letter-spacing: -0.3px;
      page-break-after: avoid;
      break-after: avoid;
    }
    h2 {
      font-size: 12pt;
      color: #1E1B4B;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 8px;
      font-weight: 600;
      page-break-after: avoid;
      break-after: avoid;
    }
    h3 {
      font-size: 10pt;
      color: #312E81;
      margin-top: 12px;
      margin-bottom: 6px;
      font-weight: 600;
      page-break-after: avoid;
      break-after: avoid;
    }
    h4 {
      font-size: 9.2pt;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 600;
      page-break-after: avoid;
      break-after: avoid;
    }

    .section-page-break {
      page-break-before: always;
      break-before: page;
    }
    .phase-page-break {
      page-break-before: always;
      break-before: page;
    }

    p {
      margin-top: 0;
      margin-bottom: 8px;
      color: #334155;
      line-height: 1.55;
    }

    /* Lists */
    ul, ol {
      margin-top: 3px;
      margin-bottom: 10px;
      padding-left: 20px;
    }
    ol { list-style-type: decimal; }
    ul { list-style-type: disc; }
    ul ul { list-style-type: circle; margin-bottom: 3px; }
    li {
      margin-bottom: 4px;
      color: #334155;
      line-height: 1.5;
    }

    strong {
      color: #0F172A;
      font-weight: 600;
    }

    /* Code & Code Blocks */
    code {
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      background-color: #F1F5F9;
      color: #0F172A;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 8pt;
      border: 1px solid #CBD5E1;
      word-break: break-word;
    }

    .code-box {
      background-color: #0F172A;
      color: #F8FAFC;
      border-radius: 6px;
      margin: 10px 0;
      overflow: hidden;
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.12);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .code-header {
      background-color: #1E293B;
      padding: 5px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
    }
    .code-lang {
      color: #818CF8;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .code-dots span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-left: 4px;
    }
    .code-dots span:nth-child(1) { background: #EF4444; }
    .code-dots span:nth-child(2) { background: #F59E0B; }
    .code-dots span:nth-child(3) { background: #10B981; }

    .code-box pre {
      margin: 0;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 7.8pt;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Mermaid Container */
    .mermaid-container {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid #4338CA;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 10px 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .mermaid-title {
      font-size: 7pt;
      font-weight: 700;
      color: #4338CA;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: center;
      background: #FFFFFF;
      padding: 8px;
      border-radius: 6px;
      overflow: hidden;
    }
    .mermaid svg {
      max-height: 480px !important;
      max-width: 100% !important;
      width: auto !important;
      height: auto !important;
      display: block;
      margin: 0 auto;
    }

    /* Images */
    .doc-img-container {
      text-align: center;
      margin: 12px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-img {
      max-width: 100%;
      max-height: 440px;
      border-radius: 6px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 3px 10px rgba(0,0,0,0.06);
    }
    .doc-img-caption {
      font-size: 7.5pt;
      color: #64748B;
      font-style: italic;
      margin-top: 4px;
    }

    /* Tables */
    .table-wrapper {
      margin: 10px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #E2E8F0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    th {
      background-color: #1E1B4B;
      color: #FFFFFF;
      text-align: left;
      padding: 6px 9px;
      font-weight: 600;
      border: 1px solid #1E1B4B;
    }
    td {
      padding: 6px 9px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
      color: #334155;
    }
    tr:nth-child(even) {
      background-color: #F8FAFC;
    }

    /* Alerts & Blockquotes */
    blockquote {
      border-left: 4px solid #4F46E5;
      background-color: #EEF2FF;
      margin: 10px 0;
      padding: 6px 12px;
      color: #312E81;
      border-radius: 0 4px 4px 0;
    }
    .alert {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 5px;
      margin: 10px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .alert-important {
      background-color: #FEF2F2;
      border-left: 4px solid #EF4444;
      color: #991B1B;
    }
    .alert-note {
      background-color: #F0F9FF;
      border-left: 4px solid #0EA5E9;
      color: #0C4A6E;
    }
    .alert-icon { font-size: 12pt; }
    .alert-content p { margin: 2px 0 0 0; font-size: 8.5pt; }

    hr {
      border: none;
      border-top: 1px dashed #CBD5E1;
      margin: 14px 0;
    }
    a {
      color: #4F46E5;
      text-decoration: none;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="doc-banner">
    <div class="doc-banner-subtitle">MEDIKIOSK CLINICAL PLATFORM DOCUMENTATION</div>
    <div class="doc-banner-title">${displayTitle}</div>
  </div>
  ${bodyHtml}

  <script>
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' }
      });
    }
  </script>
</body>
</html>`;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const mdContent = fs.readFileSync(path.join(docsDir, 'WORKFLOW.md'), 'utf8');
  const bodyHtml = markdownToHtml(mdContent);
  const fullHtml = buildFullDocumentHtml('WORKFLOW', bodyHtml);

  await page.setContent(fullHtml, { waitUntil: 'networkidle' });
  
  // Ensure mermaid diagrams have rendered
  await page.evaluate(async () => {
    if (window.mermaid) {
      await mermaid.run();
    }
  });
  await page.waitForTimeout(1500);

  const pdfPath = path.join(docsDir, 'WORKFLOW.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size: 7.5pt; font-family: 'Inter', sans-serif; font-weight: 500; width: 100%; text-align: right; padding-right: 14mm; color: #64748B; border-bottom: 1px solid #F1F5F9; padding-bottom: 3px;">MediKiosk Technical Suite &nbsp;|&nbsp; <strong>WORKFLOW</strong></div>`,
    footerTemplate: `<div style="font-size: 7.5pt; font-family: 'Inter', sans-serif; width: 100%; display: flex; justify-content: space-between; padding-left: 14mm; padding-right: 14mm; color: #94A3B8;"><span style="color: #64748B;">Confidential &nbsp;•&nbsp; All India Institute of Ayurveda / MediKiosk</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
  });

  console.log('Successfully written to:', pdfPath);
  await browser.close();
}

run().catch(console.error);
