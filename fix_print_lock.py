import re

with open('client/src/hooks/usePaymentFlow.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { generatePrintableHtml } from '../utils/billingPrintUtils';",
    "import { generatePrintableHtml, triggerIframePrint } from '../utils/billingPrintUtils';"
)

start_idx = content.find('const handlePrintLocalInvoice = (invoice) => {')
end_idx = content.find('const handleDownloadLocalXml = (invoice) => {', start_idx)

replacement = '''const handlePrintLocalInvoice = (invoice) => {
        if (!invoice) return;
        
        const html = generatePrintableHtml(invoice, billingConfig, paymentMethod, successInvoice);
        triggerIframePrint(html);
    };

    '''

new_content = content[:start_idx] + replacement + content[end_idx:]

with open('client/src/hooks/usePaymentFlow.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
