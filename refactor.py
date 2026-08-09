import sys
import re

with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if 'import PaymentModal from' not in content:
    content = content.replace("import PrintConfirmModal from './PrintConfirmModal';", "import PrintConfirmModal from './PrintConfirmModal';\nimport PaymentModal from './PaymentModal';\nimport { usePaymentFlow } from '../hooks/usePaymentFlow';")

# 2. Remove state variables
vars_to_remove = [
    r"const \[showPaymentModal, setShowPaymentModal\] = useState\(false\);\s*",
    r"const \[paymentMethod, setPaymentMethod\] = useState\('efectivo'\);\s*",
    r"const \[qrsList, setQrsList\] = useState\(\[\]\);\s*",
    r"const \[selectedQrId, setSelectedQrId\] = useState\(''\);\s*",
    r"const \[evidenceFiles, setEvidenceFiles\] = useState\(\[\]\);\s*",
    r"const \[payAmount, setPayAmount\] = useState\(''\);\s*",
    r"const \[isLastPaymentPartial, setIsLastPaymentPartial\] = useState\(false\);\s*",
    r"const \[isConfirmingPayment, setIsConfirmingPayment\] = useState\(false\);\s*",
    r"const \[issueInvoice, setIssueInvoice\] = useState\(false\);\s*",
    r"const \[invoiceType, setInvoiceType\] = useState\('boleta'\);\s*",
    r"const \[isProcessingPayment, setIsProcessingPayment\] = useState\(false\);\s*",
    r"const \[successInvoice, setSuccessInvoice\] = useState\(null\);\s*",
    r"const \[billingConfig, setBillingConfig\] = useState\(null\);\s*",
    r"const \[whatsappPhone, setwhatsappPhone\] = useState\(''\);\s*",
    r"const \[showWhatsappInput, setShowWhatsappInput\] = useState\(false\);\s*"
]
for v in vars_to_remove:
    content = re.sub(v, '', content)

# 3. Add usePaymentFlow
payment_flow_init = '''
    const paymentFlow = usePaymentFlow({
        account,
        clientForm,
        user,
        tableData,
        groupedOrders: parsedEntries ? [...parsedEntries, ...parsedMains] : [], // Just pass groupedOrders if available. Wait, TableControl defines groupedOrders. Let's put this after groupedOrders!
    });
'''
# Actually we must inject usePaymentFlow after groupedOrders is defined, OR we can just pass groupedOrders to PaymentModal directly as a prop and remove it from usePaymentFlow.
