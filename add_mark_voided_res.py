import sys
import re

file_path = 'server/routes/billing.routes.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_route = """
// POST /api/billing/invoices/:id/mark-voided
router.post('/billing/invoices/:id/mark-voided', async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, TenantId: req.tenant.id } });
        if (!invoice) return res.status(404).json({ error: 'Comprobante no encontrado' });

        await invoice.update({ status: 'anulada' });
        
        // Return order status
        if (invoice.orderId) {
            const Order = require('../models/Order');
            const order = await Order.findOne({ where: { id: invoice.orderId } });
            if (order) {
                await order.update({ status: 'delivered' }); // Revert back to delivered instead of paid/billed
            }
        }
        
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
"""

if '/mark-voided' not in content:
    content = content.replace('module.exports = router;', new_route + '\nmodule.exports = router;')
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
