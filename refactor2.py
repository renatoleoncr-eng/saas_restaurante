import re
with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the state vars
vars_to_remove = [
    r"const \[successInvoice, setSuccessInvoice\] = useState\(null\);\s*",
    r"const \[billingConfig, setBillingConfig\] = useState\(null\);\s*",
    r"const \[whatsappPhone, setwhatsappPhone\] = useState\(''\);\s*",
    r"const \[showWhatsappInput, setShowWhatsappInput\] = useState\(false\);\s*"
]
for v in vars_to_remove:
    content = re.sub(v, '', content)

# Remove fetchBillingConfig
content = re.sub(r'const fetchBillingConfig = async \(\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# Remove fetchQrs
content = re.sub(r'const fetchQrs = async \(\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# Remove handlePrintLocalInvoice
content = re.sub(r'const handlePrintLocalInvoice = \(invoice\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# Remove handleDownloadLocalXml
content = re.sub(r'const handleDownloadLocalXml = \(invoice\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# Remove handleShareWhatsapp
content = re.sub(r'const handleShareWhatsapp = \(\) => \{.*?\};\s*', '', content, flags=re.DOTALL)

# Remove confirmPayment
content = re.sub(r'const confirmPayment = async \(\) => \{.*?\};\s*(?=// === MENU DATA PARSING ===)', '', content, flags=re.DOTALL)

with open('client/src/components/TableControl.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
