import re

with open('client/src/hooks/usePaymentFlow.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the import at the top
content = content.replace("import axios from 'axios';", "import axios from 'axios';\nimport { generatePrintableHtml } from '../utils/billingPrintUtils';")

# Find handlePrintLocalInvoice and replace its body
# It starts at: const handlePrintLocalInvoice = (invoice) => {
# and ends at: }; right before const handleDownloadLocalXml
start_idx = content.find('const handlePrintLocalInvoice = (invoice) => {')
end_idx = content.find('const handleDownloadLocalXml = (invoice) => {', start_idx)

replacement = '''const handlePrintLocalInvoice = (invoice) => {
        if (!invoice) return;
        
        const html = generatePrintableHtml(invoice, billingConfig, paymentMethod, successInvoice);
        
        const iframe = document.getElementById('print-iframe');
        if (iframe) {
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
        }
    };

    '''

new_content = content[:start_idx] + replacement + content[end_idx:]

with open('client/src/hooks/usePaymentFlow.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
