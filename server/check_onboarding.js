const { Tenant } = require('./models');

async function run() {
    const tenant = await Tenant.findByPk(1);
    console.log("Tenant 1 onboardingCompleted:", tenant.onboardingCompleted);
}
run();
