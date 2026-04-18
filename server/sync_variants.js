const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const Product = sequelize.define('Product', {
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL(10, 2),
    presentations: DataTypes.TEXT,
    isStockManaged: DataTypes.BOOLEAN
});

const ProductVariant = sequelize.define('ProductVariant', {
    ProductId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL(10, 2),
    stock: DataTypes.INTEGER
});

Product.hasMany(ProductVariant, { onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product);

async function syncVariants() {
    try {
        await sequelize.authenticate();
        console.log("DB Connected.");

        const products = await Product.findAll();
        for (const p of products) {
            if (p.presentations) {
                try {
                    const variants = JSON.parse(p.presentations);
                    if (Array.isArray(variants) && variants.length > 0) {
                        console.log(`Processing ${p.name}: ${variants.length} variants found in JSON.`);

                        for (const v of variants) {
                            const [pv, created] = await ProductVariant.findOrCreate({
                                where: {
                                    ProductId: p.id,
                                    name: v.name || v.size
                                },
                                defaults: {
                                    price: v.price || p.price,
                                    stock: 0
                                }
                            });
                            if (created) console.log(`  - Created Variant: ${pv.name}`);
                        }
                    }
                } catch (err) {
                    console.warn(`Error parsing presentations for ${p.name}:`, err.message);
                }
            }
        }
        console.log("Sync Complete.");

    } catch (e) {
        console.error(e);
    }
}

syncVariants();
