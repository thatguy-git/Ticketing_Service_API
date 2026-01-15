import nodemailer from 'nodemailer';
if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_PORT ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
) {
    throw new Error(
        'Email configuration variables are not defined in environment variables'
    );
}

const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async (to: string, subject: string, text: string) => {
    try {
        const info = await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
        });
        console.log('Email sent:', info.response);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Email could not be sent');
    }
};
