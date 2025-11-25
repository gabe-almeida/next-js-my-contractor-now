/**
 * End-to-End Contractor Signup Flow Tests
 * Tests the complete signup journey from UI form submission to database persistence
 */

import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';

const prisma = new PrismaClient();

// Test data fixtures
const validContractorData = {
  name: 'John Smith',
  email: 'john.smith@contractor.com',
  phone: '(555) 123-4567',
  company: 'Smith Construction LLC',
  description: 'Professional contracting services with 15 years of experience in residential and commercial construction',
  apiUrl: 'https://api.smithconstruction.com/leads',
  authConfig: JSON.stringify({
    apiKey: 'test-key-12345',
    secret: 'test-secret-67890'
  })
};

const invalidContractorData = {
  name: 'A', // Too short
  email: 'invalid-email', // Invalid format
  phone: '123', // Too short
  company: 'B', // Too short
  description: 'Too short', // Too short
  apiUrl: 'not-a-url', // Invalid URL
  authConfig: 'invalid-json'
};

test.describe('1. End-to-End Signup Flow from UI to Database', () => {
  test.beforeEach(async () => {
    // Clean up test data
    await prisma.buyer.deleteMany({
      where: {
        name: { contains: 'Smith Construction' }
      }
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should complete successful contractor signup flow', async ({ page }: { page: Page }) => {
    // 1. Navigate to contractor signup page
    await page.goto('/contractors');
    
    // 2. Verify page loads correctly
    await expect(page).toHaveTitle(/Join Our Contractor Network/);
    await expect(page.locator('h1')).toContainText('Join Our Contractor Network');

    // 3. Fill out the form with valid data
    await page.fill('[name="name"]', validContractorData.name);
    await page.fill('[name="email"]', validContractorData.email);
    await page.fill('[name="phone"]', validContractorData.phone);
    await page.fill('[name="company"]', validContractorData.company);
    await page.fill('[name="description"]', validContractorData.description);
    await page.fill('[name="apiUrl"]', validContractorData.apiUrl);
    await page.fill('[name="authConfig"]', validContractorData.authConfig);

    // 4. Submit the form
    await page.click('button[type="submit"]');

    // 5. Wait for success message
    await expect(page.locator('[class*="bg-green"]')).toBeVisible();
    await expect(page.locator('[class*="bg-green"]')).toContainText('Registration Successful');

    // 6. Verify database entry was created
    const createdBuyer = await prisma.buyer.findFirst({
      where: {
        name: validContractorData.company,
        type: BuyerType.CONTRACTOR
      }
    });

    expect(createdBuyer).not.toBeNull();
    expect(createdBuyer?.name).toBe(validContractorData.company);
    expect(createdBuyer?.type).toBe(BuyerType.CONTRACTOR);
    expect(createdBuyer?.active).toBe(false); // Should be inactive pending review
    expect(createdBuyer?.apiUrl).toContain('smithconstruction');

    // 7. Verify authConfig contains contact information
    const authConfig = JSON.parse(createdBuyer?.authConfig || '{}');
    expect(authConfig.contactEmail).toBe(validContractorData.email);
    expect(authConfig.contactPhone).toBe(validContractorData.phone);
    expect(authConfig.contactName).toBe(validContractorData.name);
    expect(authConfig.businessDescription).toBe(validContractorData.description);

    // 8. Verify form resets after successful submission
    await expect(page.locator('[name="name"]')).toHaveValue('');
    await expect(page.locator('[name="email"]')).toHaveValue('');
    await expect(page.locator('[name="company"]')).toHaveValue('');
  });

  test('should handle form validation errors', async ({ page }: { page: Page }) => {
    await page.goto('/contractors');

    // Fill form with invalid data
    await page.fill('[name="name"]', invalidContractorData.name);
    await page.fill('[name="email"]', invalidContractorData.email);
    await page.fill('[name="phone"]', invalidContractorData.phone);
    await page.fill('[name="company"]', invalidContractorData.company);
    await page.fill('[name="description"]', invalidContractorData.description);
    await page.fill('[name="apiUrl"]', invalidContractorData.apiUrl);
    await page.fill('[name="authConfig"]', invalidContractorData.authConfig);

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[class*="bg-red"]')).toBeVisible();
    await expect(page.locator('[class*="bg-red"]')).toContainText('Registration Failed');

    // Verify no database entry was created
    const buyerCount = await prisma.buyer.count({
      where: { name: invalidContractorData.company }
    });
    expect(buyerCount).toBe(0);
  });

  test('should prevent duplicate registrations', async ({ page }: { page: Page }) => {
    // First, create a contractor with this company name
    await prisma.buyer.create({
      data: {
        name: validContractorData.company,
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://test.com',
        active: false
      }
    });

    await page.goto('/contractors');

    // Try to register with same company name
    await page.fill('[name="name"]', validContractorData.name);
    await page.fill('[name="email"]', validContractorData.email);
    await page.fill('[name="phone"]', validContractorData.phone);
    await page.fill('[name="company"]', validContractorData.company);
    await page.fill('[name="description"]', validContractorData.description);

    await page.click('button[type="submit"]');

    // Should show error message about duplicate
    await expect(page.locator('[class*="bg-red"]')).toBeVisible();
    await expect(page.locator('[class*="bg-red"]')).toContainText('already exists');

    // Verify only one entry exists
    const buyerCount = await prisma.buyer.count({
      where: { name: validContractorData.company }
    });
    expect(buyerCount).toBe(1);
  });

  test('should handle network errors gracefully', async ({ page }: { page: Page }) => {
    // Mock network failure
    await page.route('/api/contractors/signup', route => route.abort());

    await page.goto('/contractors');

    // Fill valid form data
    await page.fill('[name="name"]', validContractorData.name);
    await page.fill('[name="email"]', validContractorData.email);
    await page.fill('[name="phone"]', validContractorData.phone);
    await page.fill('[name="company"]', validContractorData.company);
    await page.fill('[name="description"]', validContractorData.description);

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[class*="bg-red"]')).toBeVisible();

    // Verify no database entry was created
    const buyerCount = await prisma.buyer.count({
      where: { name: validContractorData.company }
    });
    expect(buyerCount).toBe(0);
  });

  test('should maintain form state during submission', async ({ page }: { page: Page }) => {
    await page.goto('/contractors');

    // Fill form
    await page.fill('[name="name"]', validContractorData.name);
    await page.fill('[name="email"]', validContractorData.email);
    await page.fill('[name="phone"]', validContractorData.phone);
    await page.fill('[name="company"]', validContractorData.company);
    await page.fill('[name="description"]', validContractorData.description);

    // Verify submit button changes state
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toContainText('Register as Contractor');

    // Start form submission
    await submitButton.click();

    // During submission, button should show loading state
    await expect(submitButton).toContainText('Submitting...');
    await expect(submitButton).toBeDisabled();

    // Wait for completion
    await expect(page.locator('[class*="bg-green"]')).toBeVisible();
    
    // Button should return to normal state
    await expect(submitButton).toContainText('Register as Contractor');
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('UI Accessibility and Usability', () => {
  test('should be accessible with screen readers', async ({ page }: { page: Page }) => {
    await page.goto('/contractors');

    // Check for proper ARIA labels and roles
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Check all inputs have proper labels
    const nameInput = page.locator('[name="name"]');
    const nameLabel = page.locator('label[for="name"]');
    await expect(nameLabel).toBeVisible();
    await expect(nameLabel).toContainText('Full Name');

    // Check required field indicators
    await expect(nameLabel).toContainText('*');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(nameInput).toBeFocused();
  });

  test('should display proper field validation feedback', async ({ page }: { page: Page }) => {
    await page.goto('/contractors');

    // Test email validation
    await page.fill('[name="email"]', 'invalid');
    await page.blur('[name="email"]');
    
    // HTML5 validation should trigger
    const emailInput = page.locator('[name="email"]');
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });
});