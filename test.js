const text = 'WBC: 11.8 H (4.5-11.0\ Hemoglobin: 13.1 L (13.5-17.5\ Platelet: 268 (150-400\ Glucose: 112 H (70-99\ Cholesterol: 228 H (<200\ HDL: 38 L (>40\ HbA1c: 5.9 H (4.0-5.6\ Vitamin D: 24.6 L (30-100\ ';
const testNamesPattern = 'WBC|Hemoglobin|Platelet|Glucose|Cholesterol|HDL|HbA1c|Vitamin D';
const regex = new RegExp(\\b()\\b\\s*[:=]?\\s*([\\d.]+)\\s*([A-Za-z]+)?\\s*(?:\\(?(?:Reference:)?\\s*([<>=]*\\s*[\\d.]+(?:\\s*-\\s*[\\d.]+)?)\\)?)?\\s*([a-zA-Z%\\/]+)?, 'gi');
let match;
while ((match = regex.exec(text)) !== null) {
  console.log(match[1], '|', match[2], '|', match[3], '|', match[4], '|', match[5]);
}