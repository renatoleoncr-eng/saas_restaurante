const { Order, User } = require('./models');

(async () => {
    try {
        console.log("Checking Order associations...");
        console.log("Order associations:", Object.keys(Order.associations));

        if (Order.associations.User) {
            console.log("User association FOUND:", Order.associations.User.associationType);
        } else {
            console.log("User association NOT FOUND.");
        }

        console.log("Attempting query...");
        const order = await Order.findOne({
            include: [{ model: User }]
        });
        console.log("Query successful.");

    } catch (err) {
        console.error("Error:", err.message);
    }
})();
