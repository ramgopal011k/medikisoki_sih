import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PIL import Image, ImageDraw, ImageFont

def create_doc_a(path):
    c = canvas.Canvas(path, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Laboratory Report - Clean Text")
    
    c.setFont("Helvetica", 12)
    c.drawString(50, 720, "Patient: John Doe")
    c.drawString(50, 700, "Date: 2026-09-20")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 660, "CBC Panel")
    c.setFont("Helvetica", 12)
    c.drawString(50, 640, "WBC: 11.8 H (Reference: 4.5 - 11.0)")
    c.drawString(50, 620, "Hemoglobin: 13.1 L (Reference: 13.5 - 17.5)")
    c.drawString(50, 600, "Platelet: 268 (Reference: 150 - 400)")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 560, "CMP Panel")
    c.setFont("Helvetica", 12)
    c.drawString(50, 540, "Glucose: 112 H (Reference: 70 - 99)")
    c.drawString(50, 520, "Creatinine: 1.05 (Reference: 0.70 - 1.30)")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 480, "Lipid Panel")
    c.setFont("Helvetica", 12)
    c.drawString(50, 460, "Cholesterol: 228 H (Reference: < 200)")
    c.drawString(50, 440, "HDL: 38 L (Reference: > 40)")
    
    c.save()

def create_doc_b(path):
    # Create an image first
    img = Image.new('RGB', (850, 1100), color='white')
    d = ImageDraw.Draw(img)
    # Using default font as loading ttf might fail
    
    d.text((50, 50), "Laboratory Report - Image Only", fill='black')
    d.text((50, 100), "Patient: John Doe\nDate: 2026-09-20", fill='black')
    
    d.text((50, 160), "CBC Panel", fill='black')
    d.text((50, 180), "WBC: 11.8 H (Reference: 4.5 - 11.0)", fill='black')
    d.text((50, 200), "Hemoglobin: 13.1 L (Reference: 13.5 - 17.5)", fill='black')
    d.text((50, 220), "Platelet: 268 (Reference: 150 - 400)", fill='black')
    
    d.text((50, 280), "CMP Panel", fill='black')
    d.text((50, 300), "Glucose: 112 H (Reference: 70 - 99)", fill='black')
    d.text((50, 320), "Creatinine: 1.05 (Reference: 0.70 - 1.30)", fill='black')
    
    d.text((50, 380), "Lipid Panel", fill='black')
    d.text((50, 400), "Cholesterol: 228 H (Reference: < 200)", fill='black')
    d.text((50, 420), "HDL: 38 L (Reference: > 40)", fill='black')
    
    img_path = "temp_doc_b.jpg"
    img.save(img_path)
    
    # Wrap in PDF
    c = canvas.Canvas(path, pagesize=letter)
    c.drawImage(img_path, 0, 0, width=letter[0], height=letter[1])
    c.save()
    os.remove(img_path)

def create_doc_c(path):
    c = canvas.Canvas(path, pagesize=letter)
    
    # Page 1 - Slightly rotated
    c.saveState()
    c.translate(50, 100)
    c.rotate(2)
    c.translate(-50, -100)
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(70, 750, "Laboratory Report - Messy Multi-page")
    c.setFont("Helvetica", 12)
    c.drawString(70, 720, "Patient: John Doe")
    c.drawString(70, 700, "Date: 2026-09-20")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(70, 660, "CBC Panel")
    c.setFont("Helvetica", 12)
    c.drawString(70, 640, "WBC: 11.8 H (4.5-11.0)")
    c.drawString(70, 620, "Hemoglobin: 13.1 L (13.5-17.5)")
    c.drawString(70, 600, "Platelet: 268 (150-400)")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(70, 560, "CMP Panel")
    c.setFont("Helvetica", 12)
    c.drawString(70, 540, "Glucose: 112 H (70-99)")
    c.drawString(70, 520, "Creatinine: 1.05 (0.70-1.30)")
    
    c.restoreState()
    c.showPage()
    
    # Page 2 - Off center
    c.setFont("Helvetica-Bold", 14)
    c.drawString(200, 750, "Lipid Panel")
    c.setFont("Helvetica", 12)
    c.drawString(200, 730, "Cholesterol: 228 H (<200)")
    c.drawString(200, 710, "HDL: 38 L (>40)")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(200, 660, "Endocrine Panel")
    c.setFont("Helvetica", 12)
    c.drawString(200, 640, "HbA1c: 5.9 H (4.0-5.6)")
    c.drawString(200, 620, "Vitamin D: 24.6 L (30-100)")
    
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(100, 100, "Comments: Patient advised to reduce sugar intake and take Vitamin D supplements.")
    
    c.save()

if __name__ == "__main__":
    create_doc_a("test-docs/clean-text-lab-report.pdf")
    create_doc_b("test-docs/image-only-lab-report.pdf")
    create_doc_c("test-docs/messy-multi-page-report.pdf")
    print("Documents generated successfully.")
