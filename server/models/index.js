const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

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
        allowNull: false,
        unique: true
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
        allowNull: true // FK to Product table (optional)
    }
});

DrinkPromotion.hasMany(DrinkPromotionItem, { onDelete: 'CASCADE' });
DrinkPromotionItem.belongsTo(DrinkPromotion);

module.exports = {
    sequelize,
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
    DrinkPromotionItem
};
