
import pytest


@pytest.fixture
def sample_pdf_path(tmp_path):
    # Create a minimal valid PDF for testing
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (John Doe Resume) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF"""
    pdf_file = tmp_path / "test_resume.pdf"
    pdf_file.write_bytes(pdf_content)
    return str(pdf_file)


@pytest.fixture
def sample_docx_path(tmp_path):
    from docx import Document
    doc = Document()
    doc.add_heading("John Doe", 0)
    doc.add_paragraph("john.doe@email.com | +1-555-0100 | New York, NY")
    doc.add_heading("Experience", 1)
    doc.add_paragraph("Software Engineer at Acme Corp (2020-2023)")
    doc.add_heading("Skills", 1)
    doc.add_paragraph("Python, JavaScript, React, PostgreSQL")
    path = tmp_path / "test_resume.docx"
    doc.save(str(path))
    return str(path)


@pytest.fixture
def sample_text_path(tmp_path):
    content = """John Doe
john.doe@email.com
+1-555-0100
New York, NY

EXPERIENCE
Software Engineer - Acme Corp (Jan 2020 - Dec 2023)
- Built REST APIs with Python and FastAPI
- Led team of 3 engineers

EDUCATION
B.S. Computer Science - State University (2019)

SKILLS
Python, JavaScript, React, PostgreSQL, Docker
"""
    path = tmp_path / "test_resume.txt"
    path.write_text(content)
    return str(path)


class TestTextParser:
    def test_parse_text_file(self, sample_text_path):
        from app.ml.parsers.text_parser import parse_text
        result = parse_text(sample_text_path)
        assert "John Doe" in result
        assert "Python" in result
        assert "Software Engineer" in result

    def test_parse_text_preserves_structure(self, sample_text_path):
        from app.ml.parsers.text_parser import parse_text
        result = parse_text(sample_text_path)
        assert "EXPERIENCE" in result
        assert "EDUCATION" in result
        assert "SKILLS" in result


class TestDocxParser:
    def test_parse_docx(self, sample_docx_path):
        from app.ml.parsers.docx_parser import parse_docx
        result = parse_docx(sample_docx_path)
        assert "John Doe" in result
        assert "Python" in result

    def test_parse_docx_extracts_headings(self, sample_docx_path):
        from app.ml.parsers.docx_parser import parse_docx
        result = parse_docx(sample_docx_path)
        assert "Experience" in result or "EXPERIENCE" in result


class TestParserRouter:
    def test_routes_to_text_parser(self, sample_text_path):
        from app.ml.parsers.router import parse_file
        result = parse_file(sample_text_path, "txt")
        assert len(result) > 0
        assert "John Doe" in result

    def test_routes_to_docx_parser(self, sample_docx_path):
        from app.ml.parsers.router import parse_file
        result = parse_file(sample_docx_path, "docx")
        assert len(result) > 0

    def test_raises_on_unknown_type(self, tmp_path):
        from app.ml.parsers.router import parse_file
        dummy = tmp_path / "file.xyz"
        dummy.write_text("content")
        with pytest.raises(ValueError, match="Unsupported"):
            parse_file(str(dummy), "xyz")
