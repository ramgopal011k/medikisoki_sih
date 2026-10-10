import os
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")
DOC_FILES = [
    "TECHNICAL_REFERENCES",
    "WORKFLOW",
    "TOOLS_AND_TECHNOLOGIES",
    "DATASETS",
    "PROJECT_ANALYSIS_SUMMARY"
]

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_styled_table(doc, headers, rows):
    table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], "1E3A8A") # Dark blue
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=150, right=150)
        p = hdr_cells[i].paragraphs[0]
        for run in p.runs:
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            run.font.size = Pt(9.5)
            run.font.name = "Segoe UI"

    # Data Rows
    for r_idx, row_data in enumerate(rows):
        row_cells = table.rows[r_idx + 1].cells
        bg_color = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, cell_value in enumerate(row_data):
            if c_idx < len(row_cells):
                row_cells[c_idx].text = cell_value
                set_cell_background(row_cells[c_idx], bg_color)
                set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=150, right=150)
                p = row_cells[c_idx].paragraphs[0]
                for run in p.runs:
                    run.font.size = Pt(9.0)
                    run.font.name = "Segoe UI"
                    run.font.color.rgb = RGBColor(30, 41, 59)

    doc.add_paragraph() # Spacer

def parse_markdown_to_docx(md_path, docx_path):
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    doc = Document()

    # Page Margins (Normal 1 inch)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        # Empty line
        if not line:
            i += 1
            continue

        # Headings
        if line.startswith("# "):
            h = doc.add_heading(level=1)
            run = h.add_run(line[2:].strip())
            run.font.name = "Segoe UI"
            run.font.color.rgb = RGBColor(15, 23, 42)
            run.font.size = Pt(20)
            run.bold = True
            i += 1
            continue
        elif line.startswith("## "):
            h = doc.add_heading(level=2)
            run = h.add_run(line[3:].strip())
            run.font.name = "Segoe UI"
            run.font.color.rgb = RGBColor(30, 58, 138)
            run.font.size = Pt(14)
            run.bold = True
            i += 1
            continue
        elif line.startswith("### "):
            h = doc.add_heading(level=3)
            run = h.add_run(line[4:].strip())
            run.font.name = "Segoe UI"
            run.font.color.rgb = RGBColor(30, 64, 175)
            run.font.size = Pt(11.5)
            run.bold = True
            i += 1
            continue
        elif line.startswith("#### "):
            h = doc.add_heading(level=4)
            run = h.add_run(line[5:].strip())
            run.font.name = "Segoe UI"
            run.font.color.rgb = RGBColor(51, 65, 85)
            run.font.size = Pt(10.5)
            run.bold = True
            i += 1
            continue

        # Horizontal Rule
        if line.strip() == "---":
            p = doc.add_paragraph()
            p_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr>')
            p._element.get_or_add_pPr().append(p_border)
            i += 1
            continue

        # Code Block / Mermaid Block
        if line.startswith("```"):
            code_lines = []
            lang = line[3:].strip()
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1 # skip ending ```

            code_text = "\n".join(code_lines)
            table = doc.add_table(rows=1, cols=1)
            cell = table.cell(0, 0)
            bg = "0F172A" if lang != "mermaid" else "F8FAFC"
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            
            p = cell.paragraphs[0]
            r = p.add_run(code_text)
            r.font.name = "Consolas"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(248, 250, 252) if bg == "0F172A" else RGBColor(15, 23, 42)
            doc.add_paragraph()
            continue

        # Tables
        if line.startswith("|") and line.endswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            headers = [c.strip() for c in table_lines[0].split("|")[1:-1]]
            rows_data = []
            for tline in table_lines[1:]:
                if "---" in tline:
                    continue
                cells = [c.strip() for c in tline.split("|")[1:-1]]
                rows_data.append(cells)

            add_styled_table(doc, headers, rows_data)
            continue

        # Bullet lists
        if line.startswith("- ") or line.startswith("* "):
            p = doc.add_paragraph(style='List Bullet')
            text = line[2:].strip()
            # Clean bold markers
            parts = re.split(r'(\*\*.*?\*\*)', text)
            for part in parts:
                if part.startswith("**") and part.endswith("**"):
                    r = p.add_run(part[2:-2])
                    r.font.bold = True
                else:
                    r = p.add_run(part)
                r.font.name = "Segoe UI"
                r.font.size = Pt(10)
            i += 1
            continue

        # Regular Paragraph
        p = doc.add_paragraph()
        text = line
        parts = re.split(r'(\*\*.*?\*\*|`.*?`)', text)
        for part in parts:
            if part.startswith("**") and part.endswith("**"):
                r = p.add_run(part[2:-2])
                r.font.bold = True
                r.font.name = "Segoe UI"
            elif part.startswith("`") and part.endswith("`"):
                r = p.add_run(part[1:-1])
                r.font.name = "Consolas"
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(15, 23, 42)
            else:
                r = p.add_run(part)
                r.font.name = "Segoe UI"
            r.font.size = Pt(10)

        i += 1

    doc.save(docx_path)
    print(f"Generated DOCX: {docx_path}")

def main():
    print("Starting DOCX generation with python-docx...")
    for name in DOC_FILES:
        md_path = os.path.join(DOCS_DIR, f"{name}.md")
        docx_path = os.path.join(DOCS_DIR, f"{name}.docx")
        if os.path.exists(md_path):
            parse_markdown_to_docx(md_path, docx_path)
        else:
            print(f"File missing: {md_path}")
    print("DOCX generation complete!")

if __name__ == "__main__":
    main()
