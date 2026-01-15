import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../configs/db';
import { redis } from '../configs/redis';
import { AppError } from '../utils/AppError';
import { sendEmail } from '../configs/email';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d';

export class AuthService {
    async register(name: string, email: string, password: string) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        const tempData = await redis.get(`temp_reg:${email}`);
        if (tempData) {
            throw new AppError(
                'Registration already in progress. Please check your email for OTP.',
                400
            );
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await redis.set(
            `temp_reg:${email}`,
            JSON.stringify({ name, email, hashedPassword }),
            'EX',
            600
        );

        await this.sendOtp(email);

        return {
            message:
                'Registration initiated. Please check your email for OTP to complete.',
        };
    }

    async verifyEmail(email: string, otp: string) {
        const storedOtp = await redis.get(`otp:${email}`);
        if (!storedOtp) {
            throw new AppError('OTP expired or invalid', 400);
        }
        if (storedOtp !== otp) {
            throw new AppError('Invalid OTP', 400);
        }

        const tempDataStr = await redis.get(`temp_reg:${email}`);
        if (!tempDataStr) {
            throw new AppError('No ongoing registration for this email', 400);
        }
        const { name, hashedPassword } = JSON.parse(tempDataStr);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                isVerified: true,
            },
        });

        await redis.del(`otp:${email}`);
        await redis.del(`temp_reg:${email}`);

        const token = this.generateToken(user.id, user.role);
        return { user, token };
    }

    async login(email: string, password: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError('Invalid credentials', 401);
        }

        if (!user.isVerified) {
            throw new AppError('Please verify your email first', 403);
        }

        const token = this.generateToken(user.id, user.role);
        return { user, token };
    }

    async sendOtp(email: string) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`🔥 [DEBUG MODE] OTP for ${email} is: ${otp}`);
        await redis.set(`otp:${email}`, otp, 'EX', 600);

        const message = `
        <h1>Verify your account</h1>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
        `;

        // await sendEmail(email, 'Your Verification Code', message);
    }

    private generateToken(userId: string, role: string): string {
        return jwt.sign({ id: userId, role }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
    }
}

export const authService = new AuthService();
