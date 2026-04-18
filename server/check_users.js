const { User } = require('./models');

async function checkUsers() {
    try {
        const users = await User.findAll();
        console.log("Found " + users.length + " users.");
        users.forEach(u => {
            console.log(`User: ${u.username}, Role: ${u.role}, Pwd: ${u.password}`);
        });
    } catch (e) {
        console.error(e);
    }
}

checkUsers();
