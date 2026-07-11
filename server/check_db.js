const { Product } = require('./models');
Product.findAll().then(p => {
    const agua = p.filter(x => String(x.name).toLowerCase().includes('agua'));
    console.log(JSON.stringify(agua, null, 2));
}).catch(console.error);
