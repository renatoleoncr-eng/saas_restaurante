import re

with open('client/src/components/PaymentModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add isStaff declaration
content = content.replace(
    "const isPayDisabled = isConfirmingPayment || isProcessingPayment || isInvoiceDataMissing;",
    "const isPayDisabled = isConfirmingPayment || isProcessingPayment || isInvoiceDataMissing;\n    const isStaff = account?.type === 'staff';"
)

with open('client/src/components/PaymentModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
