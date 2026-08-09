import re

with open('client/src/components/PaymentModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix destructuring
content = content.replace(
    "evidenceFiles, setEvidenceFiles, handleFileChange,",
    "evidenceFiles, setEvidenceFiles,"
)

# Fix double condition
content = content.replace(
    "                showPaymentModal && (\n                    <div className=\"absolute inset-0",
    "                (\n                    <div className=\"absolute inset-0"
)

with open('client/src/components/PaymentModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
