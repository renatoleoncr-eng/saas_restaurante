import re

with open('client/src/components/TableControl.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('{/* PAYMENT MODAL */}')
end_idx = content.find('        </div >,\n        document.body\n    );\n}')

if start_idx != -1 and end_idx != -1:
    replacement = '''{/* PAYMENT MODAL */}
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
'''
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('client/src/components/TableControl.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Failed to find boundaries")
