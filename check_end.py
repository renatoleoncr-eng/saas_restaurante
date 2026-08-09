import re

with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('{/* PAYMENT MODAL */}')

# The end of TableControl return statement is around line 2545.
# Let's find the TableTransferModal or PinPadModal which might be below it? 
# Wait, let's look at the end of the file.
print(content[-500:])
