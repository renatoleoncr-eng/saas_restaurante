import re

with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('{/* PAYMENT MODAL */}')
# Find the end of the PaymentModal block. 
# It ends at:                 showPaymentModal && ( ... )
# Let's find the text that comes AFTER the payment modal.
# Is it TableTransferModal? 
print(content[start_idx:start_idx+200])

