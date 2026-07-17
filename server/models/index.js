const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// =============================================
// TENANT MODEL (Multi-SaaS Foundation)
// =============================================
const Tenant = sequelize.define('Tenant', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // Restaurant business name
    },
    slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true // Used as subdomain: slug.maksuites.com.pe
    },
    ownerEmail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    plan: {
        type: DataTypes.ENUM('demo', 'pago'),
        defaultValue: 'demo'
    },
    status: {
        type: DataTypes.ENUM('active', 'suspended'),
        defaultValue: 'active'
    },
    settings: {
        type: DataTypes.TEXT, // JSON string for flexible tenant-level settings
        defaultValue: '{}'
    },
    logoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    storageLimitMb: {
        type: DataTypes.INTEGER,
        defaultValue: 50 // 50 MB for demo, 500 MB for paid plans
    },
    internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true // Private notes visible only to super admin
    },
    ownerPhone: {
        type: DataTypes.STRING,
        allowNull: true // Owner's phone number collected at registration
    },
    onboardingCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false // True once the tenant opens their first cash session
    }
});

const RestaurantConfig = sequelize.define('RestaurantConfig', {
    name: {
        type: DataTypes.STRING,
        defaultValue: 'Mi Restaurante'
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, { timestamps: false });

const Area = sequelize.define('Area', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // e.g., "Terraza", "Salón A"
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

const Table = sequelize.define('Table', {
    number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('free', 'occupied', 'pre-bill', 'released', 'cleaning'),
        defaultValue: 'free'
    },
    x: { // For visual positioning later if needed
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    y: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

const Account = sequelize.define('Account', {
    status: {
        type: DataTypes.ENUM('open', 'closed', 'cancelled'),
        defaultValue: 'open'
    },
    customerName: {
        type: DataTypes.STRING,
        defaultValue: 'Cliente'
    },
    clientDni: {
        type: DataTypes.STRING,
        allowNull: true
    },
    clientAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    openedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    closedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paymentEvidence: {
        type: DataTypes.TEXT, // Path to uploaded image or JSON array of paths
        allowNull: true
    },
    accountType: {
        type: DataTypes.ENUM('standard', 'staff'),
        defaultValue: 'standard'
    },
    roulette_interaction: {
        type: DataTypes.STRING,
        defaultValue: 'none'
    },
    roulette_prize: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

const Product = sequelize.define('Product', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('dish', 'drink', 'menu', 'daily_entry', 'daily_main', 'other'),
        defaultValue: 'dish'
    },
    isStockManaged: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    requiresPreparation: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    presentations: {
        type: DataTypes.TEXT, // JSON string: [{ name: 'Personal', price: 30 }, { name: 'Familiar', price: 50 }]
        defaultValue: '[]'
    },
    category: {
        type: DataTypes.STRING, // 'Entrada', 'Segundo', or generic category
        allowNull: true
    },
    linkedProductId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID of the finished product this menu option draws stock from'
    },
    happyHourPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    happyHourStart: {
        type: DataTypes.TIME, // e.g., '14:00:00'
        allowNull: true
    },
    happyHourEnd: {
        type: DataTypes.TIME, // e.g., '17:00:00'
        allowNull: true
    }
}, { paranoid: true });

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false
        // unique per tenant — enforced via compound index in sync.js
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true // Optional for staff, required for owners
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('admin', 'waiter', 'kitchen', 'cashier'),
        defaultValue: 'waiter'
    },
    displayName: {
        type: DataTypes.STRING,
        defaultValue: 'Staff'
    },
    pin: {
        type: DataTypes.STRING(4),
        allowNull: true
        // unique per tenant — enforced via compound index in sync.js
    },
    requirePinPrompt: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    }
});

const Order = sequelize.define('Order', {
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'served', 'cancelled'),
        defaultValue: 'pending'
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    notes: {
        type: DataTypes.STRING,
        allowNull: true
    },
    presentation: { // Stores the selected variant name (e.g., 'Familiar')
        type: DataTypes.STRING,
        allowNull: true
    },
    subItemsData: {
        type: DataTypes.TEXT, // JSON string for stock restoration
        allowNull: true
    },
    priceAtOrder: { // Store the price at the time of order (snapshot)
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    priceAtOrderAtCreation: { // Store original resolved price (snapshot at creation)
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    batchId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Idempotency key for preventing duplicate order submissions due to network issues'
    }
});

const Attendance = sequelize.define('Attendance', {
    checkIn: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    checkOut: {
        type: DataTypes.DATE,
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
});

// Relationships
// -----------------
// ASSOCIATIONS
// -----------------

// Areas → Tables
Area.hasMany(Table);
Table.belongsTo(Area);

// Tables → Accounts (Explicit Foreign Key Definition)
Table.hasMany(Account, { foreignKey: 'TableId' });
Account.belongsTo(Table, { foreignKey: 'TableId' });

// Accounts → Orders
Account.hasMany(Order);
Order.belongsTo(Account);

// Order belongs to Product
Product.hasMany(Order);
Order.belongsTo(Product);

// User has many Orders
User.hasMany(Order);
Order.belongsTo(User);

// User has many Attendances
User.hasMany(Attendance);
Attendance.belongsTo(User);

const Reservation = sequelize.define('Reservation', {
    customerName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contactInfo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reservationTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'fulfilled', 'cancelled', 'no_show'),
        defaultValue: 'pending'
    },
    notes: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

Table.hasMany(Reservation);
Reservation.belongsTo(Table);

// STOCK & RECIPE SYSTEM
const Ingredient = sequelize.define('Ingredient', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // e.g., "Limón", "Pisco"
    },
    unit: {
        type: DataTypes.STRING,
        defaultValue: 'und' // kg, lt, und, gr
    },
    stock: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    }
});

const IngredientMovement = sequelize.define('IngredientMovement', {
    type: {
        type: DataTypes.ENUM('add', 'remove', 'sale', 'correction', 'audit'),
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true // "Purchase", "Waste", "Order #123"
    },
    previousStock: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    newStock: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

const ProductMovement = sequelize.define('ProductMovement', {
    type: {
        type: DataTypes.ENUM('add', 'remove', 'sale', 'correction', 'audit'),
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true
    },
    previousStock: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    newStock: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

const Recipe = sequelize.define('Recipe', {
    quantity: { // Quantity of ingredient needed for 1 unit of Product
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    presentation: { // If null, applies to base product. If set, applies to variant.
        type: DataTypes.STRING,
        allowNull: true
    }
});

// Relationships for Recipe
Product.hasMany(Recipe);
Recipe.belongsTo(Product);

Ingredient.hasMany(Recipe);
Recipe.belongsTo(Ingredient);

// AUDIT LOGGING
const AuditLog = sequelize.define('AuditLog', {
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    entity: {
        type: DataTypes.STRING,
        allowNull: false
    },
    entityId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    details: {
        type: DataTypes.TEXT, // Using TEXT for longer JSON strings
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

// DAILY MENU SYSTEM
const DailyMenu = sequelize.define('DailyMenu', {
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    entries: {
        type: DataTypes.TEXT, // JSON string
        defaultValue: '[]'
    },
    mains: {
        type: DataTypes.TEXT, // JSON string
        defaultValue: '[]'
    }
});

const Expense = sequelize.define('Expense', {
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    category: { // 'proveedores', 'servicios', 'personal', 'otros'
        type: DataTypes.STRING,
        defaultValue: 'otros'
    },
    paymentMethod: { // 'efectivo', 'yape', 'transferencia'
        type: DataTypes.STRING,
        defaultValue: 'efectivo'
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

// User Relationships
User.hasMany(AuditLog);
AuditLog.belongsTo(User);

// User has many Expenses
User.hasMany(Expense);
Expense.belongsTo(User);

// Ingredient Movements
Ingredient.hasMany(IngredientMovement);
IngredientMovement.belongsTo(Ingredient);

User.hasMany(IngredientMovement);
IngredientMovement.belongsTo(User);

// Product Movements
Product.hasMany(ProductMovement);
ProductMovement.belongsTo(Product);

User.hasMany(ProductMovement);
ProductMovement.belongsTo(User);

Account.hasMany(ProductMovement);
ProductMovement.belongsTo(Account);

Account.hasMany(IngredientMovement);
IngredientMovement.belongsTo(Account);

// PAYMENTS (Multiple payments per account)
const Payment = sequelize.define('Payment', {
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    method: {
        type: DataTypes.STRING, // 'efectivo', 'yape', 'tarjeta', 'transferencia'
        defaultValue: 'efectivo'
    },
    evidence: {
        type: DataTypes.TEXT, // JSON array of paths to uploaded images
        allowNull: true
    },
    qr_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

Account.hasMany(Payment, { onDelete: 'CASCADE' });
Payment.belongsTo(Account);

User.hasMany(Payment);
Payment.belongsTo(User);

// PRODUCT VARIANTS (New for independent stock)
const ProductVariant = sequelize.define('ProductVariant', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // e.g., "Personal", "1L"
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    happyHourPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    happyHourStart: {
        type: DataTypes.TIME, // e.g., '14:00:00'
        allowNull: true
    },
    happyHourEnd: {
        type: DataTypes.TIME, // e.g., '17:00:00'
        allowNull: true
    },
    sortIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, { paranoid: true });

Product.hasMany(ProductVariant, { onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product);

ProductMovement.belongsTo(ProductVariant); // Optional association
ProductVariant.hasMany(ProductMovement);

// DRINK PROMOTIONS (2x1 System)
const DrinkPromotion = sequelize.define('DrinkPromotion', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // e.g. "2x S/ 34.90"
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false // combo price
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

const DrinkPromotionItem = sequelize.define('DrinkPromotionItem', {
    name: {
        type: DataTypes.STRING,
        allowNull: false // e.g. "Pilsen Turno Noche"
    },
    individualPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    type: {
        type: DataTypes.ENUM('free', 'finished', 'prepared'),
        defaultValue: 'free'
    },
    linkedProductId: {
        type: DataTypes.INTEGER,
        allowNull: true // Legacy FK (no longer used actively)
    },
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true // Only relevant for type='finished'
    }
});

DrinkPromotion.hasMany(DrinkPromotionItem, { onDelete: 'CASCADE' });
DrinkPromotionItem.belongsTo(DrinkPromotion);

// Recipes for prepared 2x1 items (mirrors the Recipe model but for DrinkPromotionItem)
const DrinkItemRecipe = sequelize.define('DrinkItemRecipe', {
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    presentation: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

DrinkPromotionItem.hasMany(DrinkItemRecipe, { onDelete: 'CASCADE' });
DrinkItemRecipe.belongsTo(DrinkPromotionItem);

Ingredient.hasMany(DrinkItemRecipe);
DrinkItemRecipe.belongsTo(Ingredient);

// CASH SESSIONS (Shift Management)
const CashSession = sequelize.define('CashSession', {
    status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open'
    },
    openingCash: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    closingNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    openedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    closedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    closingDetails: {
        type: DataTypes.TEXT, // Store JSON string: { expected: {}, counted: {}, difference: {} }
        allowNull: true
    }
});

// Relationships for CashSession
User.hasMany(CashSession, { as: 'OpenedSessions', foreignKey: 'openedBy' });
CashSession.belongsTo(User, { as: 'Opener', foreignKey: 'openedBy' });
User.hasMany(CashSession, { as: 'ClosedSessions', foreignKey: 'closedBy' });
CashSession.belongsTo(User, { as: 'Closer', foreignKey: 'closedBy' });

CashSession.hasMany(Payment);
Payment.belongsTo(CashSession);

CashSession.hasMany(Expense);
Expense.belongsTo(CashSession);


// BILLING CONFIG (Configuración única de facturación)
const BillingConfig = sequelize.define('BillingConfig', {
    ruc: { type: DataTypes.STRING(11), allowNull: true },
    razonSocial: { type: DataTypes.STRING, allowNull: true },
    direccion: { type: DataTypes.STRING, allowNull: true },
    facturacionElectronica: { type: DataTypes.BOOLEAN, defaultValue: false },
    igvTasa: { type: DataTypes.DECIMAL(5, 2), defaultValue: 10.50 }, // Valor por defecto restaurante
    operacionesExoneradas: { type: DataTypes.BOOLEAN, defaultValue: false },
    serieFactura: { type: DataTypes.STRING(10), defaultValue: 'F001' },
    serieBoleta: { type: DataTypes.STRING(10), defaultValue: 'B001' },
    apiToken: { type: DataTypes.STRING, allowNull: true },
    billingMode: { type: DataTypes.STRING, defaultValue: 'libre' },
    habilitarImpresion: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: false });

// INVOICE (Comprobante emitido)
const Invoice = sequelize.define('Invoice', {
    tipo: { type: DataTypes.ENUM('boleta', 'factura'), allowNull: false },
    serie: { type: DataTypes.STRING(10), allowNull: false },
    correlativo: { type: DataTypes.INTEGER, allowNull: false },
    clienteDocumento: { type: DataTypes.STRING(11), allowNull: true },
    clienteNombre: { type: DataTypes.STRING, allowNull: true },
    clienteDireccion: { type: DataTypes.STRING, allowNull: true },
    subtotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    igv: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    items: { type: DataTypes.TEXT, defaultValue: '[]' }, // JSON string
    status: { type: DataTypes.ENUM('emitido', 'anulado'), defaultValue: 'emitido' },
    sunatResponse: { type: DataTypes.TEXT, allowNull: true }, // JSON response del Hub
    notaCredito: { type: DataTypes.STRING, allowNull: true }, // Referencia a nota de credito si existe
    notaCreditoUrl: { type: DataTypes.STRING, allowNull: true }, // URL de nota de credito
    emitidoAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    AccountId: { type: DataTypes.INTEGER, allowNull: true },
});

User.hasMany(Invoice);
Invoice.belongsTo(User);

Account.hasMany(Invoice);
Invoice.belongsTo(Account);

// --- NEW CLIENT SCREEN MODELS ---

const QrAccount = sequelize.define('QrAccount', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    limitAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    isUnlimited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    accumulated_month_sum: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    accumulated_month_key: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true
});

const PromotionGroup = sequelize.define('PromotionGroup', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: true
});

const Promotion = sequelize.define('Promotion', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    timestamps: true
});

const Setting = sequelize.define('Setting', {
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true
});

// =============================================
// PRINT JOB MODEL (Persistent Print Queue)
// =============================================
const PrintJob = sequelize.define('PrintJob', {
    printerKey: {
        type: DataTypes.STRING(20),  // 'caja', 'cocina', 'barra'
        allowNull: false
    },
    printerConfig: {
        type: DataTypes.TEXT,        // JSON: { type, path, printerName, agentId }
        allowNull: false
    },
    hexData: {
        type: DataTypes.TEXT('long'), // ESC/POS hex string
        allowNull: false
    },
    targetAgentId: {
        type: DataTypes.STRING,      // hostname of the PC that should print this
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'done', 'failed'),
        defaultValue: 'pending'
    },
    errorMessage: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['status', 'targetAgentId'] },  // fast agent polling
        { fields: ['status', 'createdAt'] }        // fast cleanup
    ]
});

// --- ASSOCIATIONS FOR NEW MODELS ---

QrAccount.hasMany(Payment, { foreignKey: 'qr_id', as: 'Payments' });
Payment.belongsTo(QrAccount, { foreignKey: 'qr_id', as: 'QrAccount' });

// =============================================
// TENANT ASSOCIATIONS (Multi-SaaS)
// =============================================
// Every tenant-scoped model gets a TenantId foreign key.
// This enables row-level data isolation between restaurants.

const tenantScopedModels = [
    RestaurantConfig, Area, Table, Account, Product, User, Order,
    Attendance, Reservation, Ingredient, IngredientMovement,
    ProductMovement, Recipe, AuditLog, DailyMenu, Expense,
    ProductVariant, Payment, DrinkPromotion, DrinkPromotionItem,
    DrinkItemRecipe, CashSession, BillingConfig, Invoice,
    QrAccount, PromotionGroup, Promotion, Setting, PrintJob
];

tenantScopedModels.forEach(Model => {
    Tenant.hasMany(Model, { foreignKey: 'TenantId' });
    Model.belongsTo(Tenant, { foreignKey: 'TenantId' });
});

PromotionGroup.hasMany(Promotion, { foreignKey: 'groupId', as: 'Images', onDelete: 'CASCADE' });
Promotion.belongsTo(PromotionGroup, { foreignKey: 'groupId', as: 'Group' });

// --- HOOKS FOR PAYMENT MODEL ---

Payment.beforeCreate(async (payment, options) => {
    if (payment.method === 'qr_adjustment') return;

    const methodLower = (payment.method || '').toLowerCase();
    const isQrPayment = methodLower.includes('yape') || methodLower.includes('plin');

    if (isQrPayment) {
        if (!payment.qr_id) {
            try {
                const { consumeQrLimit } = require('../routes/qr.routes');
                const qrId = await consumeQrLimit(payment.amount, payment.TenantId, options.transaction);
                payment.qr_id = qrId;
            } catch (err) {
                console.error("[Payment Hook] Error consuming QR limit:", err);
            }
        }
    }
});

Payment.afterCreate(async (payment, options) => {
    if (payment.qr_id) {
        try {
            const { syncQrSum } = require('../routes/qr.routes');
            await syncQrSum(payment.qr_id, options.transaction);
        } catch (err) {
            console.error("[Payment Hook] Error in afterCreate:", err);
        }
    }
});

Payment.afterUpdate(async (payment, options) => {
    try {
        const { syncQrSum } = require('../routes/qr.routes');
        if (payment.changed('qr_id')) {
            const oldQrId = payment.previous('qr_id');
            if (oldQrId) await syncQrSum(oldQrId, options.transaction);
            if (payment.qr_id) await syncQrSum(payment.qr_id, options.transaction);
        } else if (payment.qr_id && (
            payment.changed('amount') ||
            payment.changed('method')
        )) {
            await syncQrSum(payment.qr_id, options.transaction);
        }
    } catch (err) {
        console.error("[Payment Hook] Error in afterUpdate:", err);
    }
});

Payment.afterDestroy(async (payment, options) => {
    if (payment.qr_id) {
        try {
            const { syncQrSum } = require('../routes/qr.routes');
            await syncQrSum(payment.qr_id, options.transaction);
        } catch (err) {
            console.error("[Payment Hook] Error in afterDestroy:", err);
        }
    }
});

module.exports = {
    sequelize,
    Tenant,
    RestaurantConfig,
    Area,
    Table,
    Account,
    Product,
    ProductMovement,
    Order,
    User,
    Attendance,
    Reservation,
    Ingredient,
    IngredientMovement,
    Recipe,
    AuditLog,
    DailyMenu,
    Expense,
    ProductVariant,
    Payment,
    DrinkPromotion,
    DrinkPromotionItem,
    DrinkItemRecipe,
    CashSession,
    BillingConfig,
    Invoice,
    QrAccount,
    PromotionGroup,
    Promotion,
    Setting,
    PrintJob
};
