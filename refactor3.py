import re

with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''            {/* PAYMENT MODAL */}
            <PaymentModal 
                showPaymentModal={showPaymentModal}
                paymentFlow={paymentFlow}
                account={account}
                tableData={tableData}
                clientForm={clientForm}
                setClientForm={setClientForm}
                isSearchingClient={isSearchingClient}
                searchClientData={searchClientData}
                printingEnabled={printingEnabled}
                onClose={onClose}
            />
            
            {/* Custom Confirmation Modal for Staff Consumption */'''

# Use regex to replace the block
new_content = re.sub(r'\{\/\* PAYMENT MODAL \*\/\}.*?\{\/\* Custom Confirmation Modal for Staff Consumption \*\/', replacement, content, flags=re.DOTALL)

with open('client/src/components/TableControl.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
