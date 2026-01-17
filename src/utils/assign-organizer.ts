import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignDefaultOrganizer() {
    try {
        const defaultUser = await prisma.user.findFirst({
            where: {
                OR: [{ role: 'ADMIN' }, { role: 'ORGANIZER' }],
            },
        });

        if (!defaultUser) {
            console.log(
                'No admin or organizer users found. Please create one first.'
            );
            return;
        }

        const result = await prisma.event.updateMany({
            where: {
                organizerId: null,
            },
            data: {
                organizerId: defaultUser.id,
            },
        });

        console.log(
            `Assigned organizer ${defaultUser.name} to ${result.count} events`
        );

        if (!defaultUser.paymentApiKey) {
            console.log(
                'Warning: Default organizer has no payment API key set!'
            );
            console.log('Please set a paymentApiKey for user:', defaultUser.id);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

assignDefaultOrganizer();
