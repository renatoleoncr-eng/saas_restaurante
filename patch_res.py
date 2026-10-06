import sys
import re

file_path = 'client/src/components/InvoiceManagementModal.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await axios.post(`/api/billing/invoices/${annulTarget.id}/anular`, { reason: annulReason, sync_only: true });", "await axios.post(`/api/billing/invoices/${annulTarget.id}/mark-voided`, { reason: annulReason });")

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
