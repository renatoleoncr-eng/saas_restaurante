const { User } = require('./server/models');
User.findAll({ attributes: ['id', 'username', 'role'] })
    .then(users => {
        console.log("USERS IN DB:");
        console.table(users.map(u => u.toJSON()));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
