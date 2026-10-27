import docx
import re
import zipfile
import os
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls


def apply_rtl_to_p(p):
    pPr = p._p.get_or_add_pPr()
    ins = len(pPr)
    for i, c in enumerate(pPr):
        tag = c.tag.split("}")[-1]
        if tag in [
            "adjustRightInd",
            "snapToGrid",
            "spacing",
            "ind",
            "contextualSpacing",
            "jc",
        ]:
            ins = i
            break
    pPr.insert(ins, parse_xml(f'<w:bidi {nsdecls("w")}/>'))
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT


def apply_run_rtl(r):
    rPr = r._r.get_or_add_rPr()
    rPr.append(parse_xml(f'<w:rtl {nsdecls("w")}/>'))


def create_styled_ar_document(md_path, docx_path):
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = docx.Document()

    # Page Margins (1 inch)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11)

        # Header & Footer
        header = section.header
        hp = header.paragraphs[0]
        apply_rtl_to_p(hp)
        hrun = hp.add_run(
            "بوداسيوم • دليل الإطلاق الرئيسي: الأسس الاستراتيجية والتعليمية"
        )
        hrun.font.name = "Arial"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(148, 163, 184)
        apply_run_rtl(hrun)

        footer = section.footer
        fp = footer.paragraphs[0]
        apply_rtl_to_p(fp)
        fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        frun1 = fp.add_run("سري للغاية — مخصص للقيادة والمؤسسين الشركاء فقط")
        frun1.font.name = "Arial"
        frun1.font.size = Pt(8.5)
        frun1.font.color.rgb = RGBColor(148, 163, 184)
        apply_run_rtl(frun1)

    # Styles Setup
    normal_style = doc.styles["Normal"]
    normal_style.font.name = "Arial"
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)  # Slate Navy
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(4)

    # Cover Page
    p_top = doc.add_paragraph()
    p_top.paragraph_format.space_before = Pt(36)
    apply_rtl_to_p(p_top)
    r_brand = p_top.add_run("شركة بوداسيوم للتقنيات والأنظمة السيادية")
    r_brand.font.name = "Arial"
    r_brand.font.size = Pt(14)
    r_brand.font.bold = True
    r_brand.font.color.rgb = RGBColor(15, 118, 110)  # Emerald
    apply_run_rtl(r_brand)

    p_subcat = doc.add_paragraph()
    p_subcat.paragraph_format.space_after = Pt(28)
    apply_rtl_to_p(p_subcat)
    r_subcat = p_subcat.add_run(
        "اقتصاديات المنصات السيادية • المخطط الاستراتيجي للتموضع القيادي في السوق"
    )
    r_subcat.font.name = "Arial"
    r_subcat.font.size = Pt(9.5)
    r_subcat.font.bold = True
    r_subcat.font.color.rgb = RGBColor(100, 116, 139)
    apply_run_rtl(r_subcat)

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(12)
    apply_rtl_to_p(p_title)
    r_title = p_title.add_run("دليل الإطلاق الرئيسي:\nالأسس الاستراتيجية والتعليمية")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(26)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 23, 42)
    apply_run_rtl(r_title)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(24)
    apply_rtl_to_p(p_sub)
    r_sub = p_sub.add_run(
        "نظام التشغيل السيادي للتعليم التقني، العمل الحر، وذكاء الأعمال في شمال إفريقيا"
    )
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(13)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(51, 65, 85)
    apply_run_rtl(r_sub)

    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_after = Pt(24)

    # Metadata Card Table
    meta_tbl = doc.add_table(rows=6, cols=2)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = meta_tbl._tbl.tblPr
    ins = 0
    for i, c in enumerate(tblPr):
        if c.tag.endswith("tblW"):
            ins = i
            break
    tblPr.insert(ins, parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))

    meta_data = [
        (
            "المؤلف والجهة المعدة",
            "الرئيس التنفيذي للتسويق واستراتيجية العلامة التجارية",
        ),
        (
            "تكامل الأطر والمرجعيات",
            "شوارتز · كريستنسن · سيالديني · كانمان · نسيم طالب · دانفورد · بايرون شارب · جيفري مور · أوجيلفي · هورموزي · فيتزباتريك",
        ),
        (
            "المنصة والتقنيات المستهدفة",
            "بوداسيوم (Next.js 15 App Router · FastAPI · Prisma ORM · PostgreSQL · Celery)",
        ),
        (
            "السوق المستهدف والنطاق",
            "الجمهورية الجزائرية (58 ولاية) · المغرب العربي وإفريقيا الفرانكوفونية",
        ),
        ("المحطة الزمنية للإطلاق", "يوم التعليم الرقمي الوطني — 23 سبتمبر 2026"),
        (
            "التوزيع والتصنيف الأمني",
            "سري للغاية — ملف التأسيس القيادي للمؤسسين الشركاء",
        ),
    ]
    col_widths = [Inches(2.2), Inches(4.3)]
    for r_idx, (k, v) in enumerate(meta_data):
        row = meta_tbl.rows[r_idx]
        for c_idx, cell in enumerate(row.cells):
            cell.width = col_widths[c_idx]
            tcPr = cell._tc.get_or_add_tcPr()
            bdr = parse_xml(
                f'<w:tcBorders {nsdecls("w")}><w:top w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:left w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:right w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tcBorders>'
            )
            tcPr.append(bdr)
            shd = parse_xml(
                f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="F8FAFC"/>'
            )
            tcPr.append(shd)
            tcMar = parse_xml(
                f'<w:tcMar {nsdecls("w")}><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>'
            )
            tcPr.append(tcMar)
            p = cell.paragraphs[0]
            apply_rtl_to_p(p)
            p.paragraph_format.space_after = Pt(2)
            if c_idx == 0:
                run = p.add_run(k)
                run.font.name = "Arial"
                run.font.bold = True
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(15, 118, 110)
                apply_run_rtl(run)
            else:
                run = p.add_run(v)
                run.font.name = "Arial"
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(51, 65, 85)
                apply_run_rtl(run)

    doc.add_page_break()

    # Helper function to parse inline formatting (bold, italic, code) with RTL runs
    def add_styled_text(
        paragraph, text, default_size=Pt(10.5), default_color=RGBColor(30, 41, 59)
    ):
        parts = re.split(
            r"(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))", text
        )
        for part in parts:
            if not part:
                continue
            if part.startswith("**") and part.endswith("**"):
                r = paragraph.add_run(part[2:-2])
                r.font.name = "Arial"
                r.font.bold = True
                r.font.size = default_size
                r.font.color.rgb = default_color
                apply_run_rtl(r)
            elif part.startswith("*") and part.endswith("*"):
                r = paragraph.add_run(part[1:-1])
                r.font.name = "Arial"
                r.font.italic = True
                r.font.size = default_size
                r.font.color.rgb = default_color
                apply_run_rtl(r)
            elif part.startswith("`") and part.endswith("`"):
                r = paragraph.add_run(part[1:-1])
                r.font.name = "Consolas"
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(15, 118, 110)
                apply_run_rtl(r)
            elif (
                part.startswith("[")
                and "]" in part
                and "(" in part
                and part.endswith(")")
            ):
                match = re.match(r"\[([^\]]+)\]\(([^)]+)\)", part)
                if match:
                    label, url = match.groups()
                    r = paragraph.add_run(label)
                    r.font.name = "Arial"
                    r.font.color.rgb = RGBColor(37, 99, 235)
                    r.font.underline = True
                    r.font.size = default_size
                    apply_run_rtl(r)
                else:
                    r = paragraph.add_run(part)
                    r.font.name = "Arial"
                    r.font.size = default_size
                    apply_run_rtl(r)
            else:
                r = paragraph.add_run(part)
                r.font.name = "Arial"
                r.font.size = default_size
                r.font.color.rgb = default_color
                apply_run_rtl(r)

    # Parse markdown line by line
    lines = md_text.split("\n")
    i = 0
    in_code_block = False
    code_block_lines = []

    # Skip original title and metadata up to Table of Contents
    while i < len(lines):
        if lines[i].startswith("# جدول المحتويات") or lines[i].startswith(
            "# الملخص التنفيذي"
        ):
            break
        i += 1

    while i < len(lines):
        line = lines[i]

        # Code block handler
        if line.startswith("```"):
            if in_code_block:
                in_code_block = False
                code_text = "\n".join(code_block_lines)
                code_block_lines = []

                # Render code box as single-cell table with border
                cb_tbl = doc.add_table(rows=1, cols=1)
                cb_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                tblPr = cb_tbl._tbl.tblPr
                ins = 0
                for c_i, c in enumerate(tblPr):
                    if c.tag.endswith("tblW"):
                        ins = c_i
                        break
                tblPr.insert(ins, parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))

                cell = cb_tbl.rows[0].cells[0]
                cell.width = Inches(6.5)
                tcPr = cell._tc.get_or_add_tcPr()
                tcPr.append(
                    parse_xml(
                        f'<w:tcBorders {nsdecls("w")}><w:top w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:left w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:right w:val="single" w:sz="18" w:space="0" w:color="0F766E"/></w:tcBorders>'
                    )
                )
                tcPr.append(
                    parse_xml(
                        f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="F1F5F9"/>'
                    )
                )
                tcPr.append(
                    parse_xml(
                        f'<w:tcMar {nsdecls("w")}><w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>'
                    )
                )

                p = cell.paragraphs[0]
                apply_rtl_to_p(p)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.05
                run = p.add_run(code_text)
                run.font.name = "Consolas"
                run.font.size = Pt(8.5)
                run.font.color.rgb = RGBColor(30, 41, 59)
                apply_run_rtl(run)

                p_spacer = doc.add_paragraph()
                p_spacer.paragraph_format.space_after = Pt(6)
            else:
                in_code_block = True
                code_block_lines = []
            i += 1
            continue

        if in_code_block:
            code_block_lines.append(line)
            i += 1
            continue

        # Markdown Table handler
        if line.strip().startswith("|") and "|" in line.strip()[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            # Parse table lines
            rows_data = []
            for t_line in table_lines:
                # ignore separator row like |---|---|
                if re.match(r"^\|[\s\-:|]+\|$", t_line):
                    continue
                cells = [c.strip() for c in t_line.strip("|").split("|")]
                rows_data.append(cells)

            if rows_data:
                num_cols = len(rows_data[0])
                table = doc.add_table(rows=len(rows_data), cols=num_cols)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                tblPr = table._tbl.tblPr
                ins = 0
                for c_i, c in enumerate(tblPr):
                    if c.tag.endswith("tblW"):
                        ins = c_i
                        break
                tblPr.insert(ins, parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))

                # Column widths allocation
                if num_cols == 3:  # Scripts table: Timecode, Visual/Foley, Spoken
                    widths = [Inches(1.0), Inches(2.75), Inches(2.75)]
                elif num_cols == 6:  # Master campaign matrix
                    widths = [
                        Inches(1.0),
                        Inches(1.3),
                        Inches(1.1),
                        Inches(1.0),
                        Inches(0.9),
                        Inches(1.2),
                    ]
                elif num_cols == 2:
                    widths = [Inches(2.5), Inches(4.0)]
                elif num_cols == 4:
                    widths = [Inches(1.5), Inches(1.7), Inches(1.7), Inches(1.6)]
                elif num_cols == 5:
                    widths = [
                        Inches(1.5),
                        Inches(1.2),
                        Inches(1.2),
                        Inches(1.3),
                        Inches(1.3),
                    ]
                else:
                    widths = [Inches(6.5 / num_cols)] * num_cols

                # Style Rows and Cells
                for r_idx, row_data in enumerate(rows_data):
                    row = table.rows[r_idx]

                    # Row XML attributes: cantSplit, tblHeader for first row
                    trPr = row._tr.get_or_add_trPr()
                    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
                    if r_idx == 0:
                        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

                    is_header = r_idx == 0
                    bg_color = (
                        "0F766E"
                        if is_header
                        else ("F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
                    )

                    for c_idx in range(min(num_cols, len(row_data))):
                        cell = row.cells[c_idx]
                        cell.width = widths[c_idx]
                        tcPr = cell._tc.get_or_add_tcPr()
                        bdr = parse_xml(
                            f'<w:tcBorders {nsdecls("w")}><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tcBorders>'
                        )
                        tcPr.append(bdr)
                        shd = parse_xml(
                            f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{bg_color}"/>'
                        )
                        tcPr.append(shd)
                        tcMar = parse_xml(
                            f'<w:tcMar {nsdecls("w")}><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>'
                        )
                        tcPr.append(tcMar)

                        cell_text = row_data[c_idx]
                        # Replace <br> with newlines
                        cell_text = cell_text.replace("<br>", "\n").replace(
                            "<br/>", "\n"
                        )

                        p = cell.paragraphs[0]
                        apply_rtl_to_p(p)
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.line_spacing = 1.1

                        # Add cell content with inline styling
                        sub_lines = cell_text.split("\n")
                        for sub_idx, s_line in enumerate(sub_lines):
                            if sub_idx > 0:
                                p = cell.add_paragraph()
                                apply_rtl_to_p(p)
                                p.paragraph_format.space_after = Pt(2)
                                p.paragraph_format.line_spacing = 1.1

                            f_size = Pt(9.5) if is_header else Pt(8.5)
                            f_color = (
                                RGBColor(255, 255, 255)
                                if is_header
                                else RGBColor(30, 41, 59)
                            )
                            add_styled_text(
                                p, s_line, default_size=f_size, default_color=f_color
                            )
                            if is_header:
                                for r in p.runs:
                                    r.font.bold = True

                p_after_tbl = doc.add_paragraph()
                p_after_tbl.paragraph_format.space_after = Pt(6)
            continue

        # Horizontal rule
        if line.strip() in ["---", "***", "___"]:
            p_hr = doc.add_paragraph()
            p_hr.paragraph_format.space_before = Pt(6)
            p_hr.paragraph_format.space_after = Pt(6)
            i += 1
            continue

        # Headings
        if line.startswith("# "):
            text = line[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(22)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            apply_rtl_to_p(p)
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(17)
            run.font.bold = True
            run.font.color.rgb = RGBColor(15, 118, 110)
            apply_run_rtl(run)
            i += 1
            continue

        if line.startswith("## "):
            text = line[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            apply_rtl_to_p(p)
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(13.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 41, 59)  # Slate Navy
            apply_run_rtl(run)
            i += 1
            continue

        if line.startswith("### "):
            text = line[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            apply_rtl_to_p(p)
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(12)
            run.font.bold = True
            run.font.color.rgb = RGBColor(13, 148, 136)  # Teal
            apply_run_rtl(run)
            i += 1
            continue

        if line.startswith("#### "):
            text = line[5:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            apply_rtl_to_p(p)
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.italic = True
            run.font.color.rgb = RGBColor(71, 85, 105)
            apply_run_rtl(run)
            i += 1
            continue

        # Blockquote handler (> )
        if line.startswith("> "):
            bq_text = line[2:].strip()
            bq_tbl = doc.add_table(rows=1, cols=1)
            bq_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            tblPr = bq_tbl._tbl.tblPr
            ins = 0
            for c_i, c in enumerate(tblPr):
                if c.tag.endswith("tblW"):
                    ins = c_i
                    break
            tblPr.insert(ins, parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))

            cell = bq_tbl.rows[0].cells[0]
            cell.width = Inches(6.5)
            tcPr = cell._tc.get_or_add_tcPr()
            tcPr.append(
                parse_xml(
                    f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="single" w:sz="18" w:space="0" w:color="0F766E"/></w:tcBorders>'
                )
            )
            tcPr.append(
                parse_xml(
                    f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="F8FAFC"/>'
                )
            )
            tcPr.append(
                parse_xml(
                    f'<w:tcMar {nsdecls("w")}><w:top w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>'
                )
            )
            p = cell.paragraphs[0]
            apply_rtl_to_p(p)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            add_styled_text(
                p, bq_text, default_size=Pt(10), default_color=RGBColor(51, 65, 85)
            )
            p_sp = doc.add_paragraph()
            p_sp.paragraph_format.space_after = Pt(4)
            i += 1
            continue

        # Bullet list items
        if line.strip().startswith(("* ", "- ")):
            bullet_text = line.strip()[2:].strip()
            p = doc.add_paragraph(style="List Bullet")
            apply_rtl_to_p(p)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            add_styled_text(p, bullet_text)
            i += 1
            continue

        # Numbered list items
        num_match = re.match(r"^\s*(\d+)\.\s+(.*)$", line)
        if num_match:
            num, item_text = num_match.groups()
            p = doc.add_paragraph(style="List Number")
            apply_rtl_to_p(p)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            add_styled_text(p, item_text)
            i += 1
            continue

        # Standard paragraph
        if line.strip():
            p = doc.add_paragraph()
            apply_rtl_to_p(p)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.15
            add_styled_text(p, line)

        i += 1

    # Save to temp docx
    temp_docx = docx_path + ".tmp.docx"
    doc.save(temp_docx)

    # Clean schema validation (fix w:zoom percent attribute in word/settings.xml)
    with zipfile.ZipFile(temp_docx, "r") as zin:
        with zipfile.ZipFile(docx_path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                content = zin.read(item.filename)
                if item.filename == "word/settings.xml":
                    content = re.sub(
                        b"<w:zoom[^>]*/>", b'<w:zoom w:percent="100"/>', content
                    )
                zout.writestr(item, content)

    if os.path.exists(temp_docx):
        os.remove(temp_docx)
    print(f"Successfully generated Arabic DOCX: {docx_path}")


if __name__ == "__main__":
    create_styled_ar_document(
        "docs/PODACIUM_MASTER_LAUNCH_PLAYBOOK_FOUNDATION_AR.md",
        "docs/PODACIUM_MASTER_LAUNCH_PLAYBOOK_AR.docx",
    )
