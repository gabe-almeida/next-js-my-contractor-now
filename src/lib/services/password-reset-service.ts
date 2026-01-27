/**
 * Password Reset Service - AWS SES Integration
 *
 * WHY: Allow users to reset their password via email link.
 * WHEN: User requests password reset from login page.
 * HOW: Generates secure token, stores in DB, sends email via AWS SES.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Check if AWS SES is configured
const AWS_CONFIGURED = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: AWS_CONFIGURED ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'notifications@mycontractornow.com';
const FROM_NAME = 'My Contractor Now';
const FROM_ADDRESS = `${FROM_NAME} <${FROM_EMAIL}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mycontractornow.com';

type UserType = 'admin' | 'affiliate' | 'contractor';

interface UserLookupResult {
  found: boolean;
  userType?: UserType;
  email?: string;
  name?: string;
}

/**
 * Find user by email across all user tables
 *
 * WHY: Need to determine which table the user exists in
 * WHEN: User requests password reset
 * HOW: Check admin_users, affiliates, buyers in order
 */
async function findUserByEmail(email: string): Promise<UserLookupResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check admin_users
  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail }
  });
  if (admin && admin.active) {
    return { found: true, userType: 'admin', email: admin.email, name: admin.name };
  }

  // Check affiliates
  const affiliate = await prisma.affiliate.findUnique({
    where: { email: normalizedEmail }
  });
  if (affiliate && affiliate.status === 'ACTIVE') {
    return {
      found: true,
      userType: 'affiliate',
      email: affiliate.email,
      name: `${affiliate.firstName} ${affiliate.lastName}`
    };
  }

  // Check contractors (buyers with login enabled)
  const contractor = await prisma.buyer.findFirst({
    where: {
      OR: [
        { contactEmail: normalizedEmail },
        { businessEmail: normalizedEmail }
      ],
      type: 'CONTRACTOR',
      loginEnabled: true,
      active: true
    }
  });
  if (contractor) {
    return {
      found: true,
      userType: 'contractor',
      email: contractor.contactEmail || contractor.businessEmail || normalizedEmail,
      name: contractor.displayName || contractor.name
    };
  }

  return { found: false };
}

/**
 * Request password reset - generates token and sends email
 *
 * WHY: First step of password reset flow
 * WHEN: User submits email on forgot password page
 * HOW: Find user, generate token, store token, send email
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const userResult = await findUserByEmail(normalizedEmail);

    // Always return success to prevent email enumeration
    if (!userResult.found) {
      logger.info('[PasswordReset] Reset requested for non-existent email', { email: normalizedEmail });
      return { success: true };
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail }
    });

    // Store new token
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        userType: userResult.userType!,
        expiresAt
      }
    });

    // Send email
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(userResult.email!, userResult.name!, resetUrl);

    logger.info('[PasswordReset] Reset email sent', {
      email: normalizedEmail,
      userType: userResult.userType
    });

    return { success: true };

  } catch (error) {
    captureApiError(error, { action: 'requestPasswordReset', extra: { email } });
    logger.error('[PasswordReset] Failed to request reset', { error: (error as Error).message });
    return { success: false, error: 'Failed to process request' };
  }
}

/**
 * Verify reset token is valid
 *
 * WHY: Validate token before showing reset form
 * WHEN: User clicks reset link
 * HOW: Check token exists, not expired, not used
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return { valid: false };
    }

    if (resetToken.usedAt) {
      return { valid: false };
    }

    if (resetToken.expiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true, email: resetToken.email };

  } catch (error) {
    logger.error('[PasswordReset] Token verification failed', { error: (error as Error).message });
    return { valid: false };
  }
}

/**
 * Complete password reset - update password in database
 *
 * WHY: Final step of password reset flow
 * WHEN: User submits new password
 * HOW: Verify token, hash password, update correct table
 */
export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find and validate token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return { success: false, error: 'Invalid or expired reset link' };
    }

    if (resetToken.usedAt) {
      return { success: false, error: 'Reset link already used' };
    }

    if (resetToken.expiresAt < new Date()) {
      return { success: false, error: 'Reset link has expired' };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password in correct table
    const userType = resetToken.userType as UserType;
    const email = resetToken.email;

    if (userType === 'admin') {
      await prisma.adminUser.update({
        where: { email },
        data: { passwordHash }
      });
    } else if (userType === 'affiliate') {
      await prisma.affiliate.update({
        where: { email },
        data: { passwordHash }
      });
    } else if (userType === 'contractor') {
      // Find contractor by email
      const contractor = await prisma.buyer.findFirst({
        where: {
          OR: [
            { contactEmail: email },
            { businessEmail: email }
          ]
        }
      });
      if (contractor) {
        await prisma.buyer.update({
          where: { id: contractor.id },
          data: { passwordHash }
        });
      }
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() }
    });

    logger.info('[PasswordReset] Password reset completed', {
      email,
      userType
    });

    return { success: true };

  } catch (error) {
    captureApiError(error, { action: 'completePasswordReset' });
    logger.error('[PasswordReset] Failed to complete reset', { error: (error as Error).message });
    return { success: false, error: 'Failed to reset password' };
  }
}

/**
 * Send password reset email via AWS SES
 */
async function sendPasswordResetEmail(email: string, name: string, resetUrl: string): Promise<void> {
  if (!AWS_CONFIGURED) {
    logger.warn('[PasswordReset] AWS SES not configured - email not sent', { email });
    return;
  }

  const subject = 'Reset Your Password - My Contractor Now';
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(to right, #f97316, #ea580c); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">My Contractor Now</h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">Password Reset Request</h2>
                  <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Hi ${name},
                  </p>
                  <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">Reset Password</a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                    This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    &copy; 2025 My Contractor Now. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textBody = `
Password Reset Request

Hi ${name},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.

- My Contractor Now
  `;

  const command = new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlBody, Charset: 'UTF-8' },
        Text: { Data: textBody, Charset: 'UTF-8' }
      }
    }
  });

  await sesClient.send(command);
}
