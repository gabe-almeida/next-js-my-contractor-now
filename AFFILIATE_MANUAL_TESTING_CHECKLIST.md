# Affiliate System - Manual Testing Checklist

## Overview
This document provides a comprehensive manual testing checklist for the Affiliate System. Complete these tests to ensure all features work correctly in a real browser environment.

**Prerequisite:** Ensure the application is running (`npm run dev`) and you have admin credentials.

---

## 1. Complete Signup Flow

- [ ] Navigate to `/affiliate/signup`
- [ ] Fill in form with valid data:
  - Email: `testaff@example.com`
  - Password: `TestPassword123` (meets requirements)
  - First Name: `John`
  - Last Name: `Affiliate`
- [ ] Click "Sign Up" button
- [ ] Verify: Success message appears ("Awaiting approval")
- [ ] Verify: Page stays on signup or redirects to login
- [ ] Check database: Affiliate created with `status=PENDING`
- [ ] Check email: Confirmation email sent (if email service configured)

### Test Invalid Inputs
- [ ] Try signup with missing email → Error message shown
- [ ] Try signup with invalid email format → Error message shown
- [ ] Try signup with password less than 8 characters → Error shown ("At least 8 characters")
- [ ] Try signup with password missing uppercase → Error shown ("At least one uppercase")
- [ ] Try signup with password missing number → Error shown ("At least one number")
- [ ] Try signup with duplicate email → Error message ("Email already registered")

---

## 2. Affiliate Approval (Admin)

### Locate Pending Affiliate
- [ ] Login as admin
- [ ] Navigate to `/admin/affiliates`
- [ ] Verify: Newly created affiliate from Step 1 appears in list
- [ ] Verify: Status badge shows "PENDING" (yellow/orange color)
- [ ] Click on affiliate name or row to view details

### Approve Affiliate
- [ ] On affiliate detail page (`/admin/affiliates/[id]`), verify:
  - Email: `testaff@example.com`
  - Name: `John Affiliate`
  - Status: `PENDING`
  - Commission Rate: `10%` (or configured default)
- [ ] Click "Approve" button (or change status dropdown to "ACTIVE")
- [ ] Verify: Status changes to "ACTIVE"
- [ ] Verify: Success message shown
- [ ] Navigate back to affiliates list
- [ ] Verify: Affiliate now shows status "ACTIVE"

### Test Status Changes
- [ ] Click affiliate again
- [ ] Change status to "SUSPENDED"
- [ ] Verify: Status updated to "SUSPENDED"
- [ ] Change status back to "ACTIVE"
- [ ] Verify: Status updated back to "ACTIVE"

---

## 3. Affiliate Login Flow

### Test PENDING Affiliate Cannot Login
- [ ] Create another affiliate for testing (if needed)
- [ ] Navigate to `/affiliate/login`
- [ ] Try to login with PENDING affiliate credentials
- [ ] Verify: Error message ("Your account is pending approval")
- [ ] Verify: Not redirected to dashboard

### Test ACTIVE Affiliate Can Login
- [ ] Navigate to `/affiliate/login`
- [ ] Login with ACTIVE affiliate credentials:
  - Email: `testaff@example.com`
  - Password: `TestPassword123`
- [ ] Click "Login" button
- [ ] Verify: Success message appears
- [ ] Verify: Redirected to `/affiliate/dashboard`
- [ ] Verify: Dashboard shows affiliate name
- [ ] Check browser console: No authentication errors

### Test Dashboard After Login
- [ ] On dashboard, verify display:
  - Affiliate name in header/sidebar
  - Statistics cards visible
  - Navigation menu with: Links, Leads, Commissions, Withdrawals, Settings
  - Logout button available
- [ ] Click logout button
- [ ] Verify: Redirected to login page
- [ ] Try accessing `/affiliate/dashboard` without login
- [ ] Verify: Redirected back to login page

---

## 4. Create and Manage Tracking Links

### Create First Link
- [ ] Login as affiliate (testaff@example.com)
- [ ] Navigate to `/affiliate/links` or click "Links" in sidebar
- [ ] Click "Create New Link" or "Generate Link" button
- [ ] Select target service: "Windows" (or available option)
- [ ] Verify: Form appears with:
  - Service selector
  - Target page preview
  - Code field (auto-generated or editable)
- [ ] Click "Generate" or "Create"
- [ ] Verify: New link appears in list
- [ ] Verify: Link shows:
  - Auto-generated code (alphanumeric)
  - Target service name
  - Full tracking URL
  - Click count: 0
  - Conversion count: 0
  - Active status: Yes/Green

### Copy and Test Link URL
- [ ] Click "Copy URL" button on created link
- [ ] Verify: URL format looks correct
  - Should contain: `?aff=CODE` or `?affiliate_id=CODE` parameter
  - Example: `https://mysite.com/windows?aff=ABC123XYZ`
- [ ] Paste URL in new tab/window
- [ ] Verify: Click counter increments to 1
- [ ] Click link again in different tab
- [ ] Verify: Click counter increments to 2

### Test Custom Code Link
- [ ] Click "Create New Link" again
- [ ] Try to set custom code: `MYCUSTOM01`
- [ ] Verify: Code accepted and link created with custom code
- [ ] Verify: Link URL contains custom code

### Test Duplicate Code Rejection
- [ ] Try to create another link with same code: `MYCUSTOM01`
- [ ] Verify: Error message ("Code already in use")
- [ ] Cannot proceed with duplicate code

### Test Link Management
- [ ] Verify: Can edit link name/description (if feature exists)
- [ ] Verify: Can toggle link active/inactive
- [ ] Toggle link to inactive
- [ ] Verify: Link appears disabled/grayed out
- [ ] Toggle back to active
- [ ] Verify: Link re-enabled

---

## 5. Lead Attribution Through Link

### Submit Lead Through Affiliate Link
- [ ] Get link URL from affiliate dashboard
- [ ] Navigate to that URL in new browser tab (simulating external user)
- [ ] Verify: Page loads with affiliate parameter in URL
- [ ] Fill out lead form with test data:
  - Service: Windows
  - Zip Code: 90210
  - Home Ownership: Yes/Own
  - Timeframe: Within 3 months
  - (Add any other required fields)
- [ ] Submit form
- [ ] Verify: Success message ("Lead submitted")
- [ ] Verify: Redirected to success page

### Verify Click Counter Incremented
- [ ] Go back to affiliate dashboard `/affiliate/links`
- [ ] Check the link's click counter
- [ ] Verify: Counter increased (now shows 1+ from previous tests)

### Verify Lead in Affiliate's Leads List
- [ ] Navigate to `/affiliate/leads`
- [ ] Verify: New lead appears in the list
- [ ] Verify: Lead shows:
  - Service type: Windows
  - Zip code: 90210 (or masked for privacy)
  - Status: PENDING
  - Created date: Today
  - Amount: N/A or not shown yet
- [ ] Verify: NO personal information shown (no phone, email, name)
- [ ] Click on lead to see details
- [ ] Verify: Details are privacy-safe (ID, service, status only)

### Test Multiple Lead Submissions
- [ ] Submit 2-3 more leads through affiliate link
- [ ] Go to `/affiliate/leads`
- [ ] Verify: All leads appear in chronological order
- [ ] Verify: Click counter on link reflects total clicks

---

## 6. Commission Workflow

### Prerequisite: Simulate Lead Being Purchased
For testing commission creation, we need to simulate a lead being sold to a buyer.

**Admin action:**
- [ ] Login as admin
- [ ] Go to `/admin/leads`
- [ ] Find the lead created through affiliate link (zip 90210)
- [ ] Simulate buyer purchase (this might be done through buyer API or manual status update)
- [ ] Change lead status to "SOLD" with winning bid: $100
- [ ] Verify: Lead status updated to SOLD

### Verify Commission Created
- [ ] Login back as affiliate
- [ ] Navigate to `/affiliate/commissions`
- [ ] Verify: New commission appears
- [ ] Verify: Commission shows:
  - Amount: $15 (if default 15% rate) or calculated based on rate
  - Status: PENDING
  - Lead ID: Matches the lead
  - Created date: Today
  - Affiliate rate: 15% (or configured rate)
- [ ] Calculate: Commission = Lead Price × Rate
  - Example: $100 × 0.15 = $15 ✓

### Test Commission Status Transitions
- [ ] Check dashboard statistics
- [ ] Verify: "Pending Commissions" shows the amount
- [ ] Verify: "Available Balance" still shows $0 (not approved yet)

---

## 7. Admin Commission Approval

### View Pending Commissions (Admin)
- [ ] Login as admin
- [ ] Navigate to `/admin/commissions`
- [ ] Verify: Pending commission appears
- [ ] Verify: Shows:
  - Affiliate name: John Affiliate
  - Amount: $15
  - Status: PENDING
  - Lead details
  - Approve/Reject buttons

### Approve Commission
- [ ] Click "Approve" button on the commission
- [ ] Verify: Status changes to "APPROVED"
- [ ] Verify: Success message shown

### Verify Affiliate Balance Updated
- [ ] Login as affiliate
- [ ] Go to dashboard
- [ ] Verify: "Available Balance" now shows $15
- [ ] Verify: "Pending Commissions" shows $0

---

## 8. Withdrawal Request Flow

### Initiate Withdrawal
- [ ] On affiliate dashboard, navigate to `/affiliate/withdrawals`
- [ ] Verify: "Available Balance" displays correctly ($15)
- [ ] Click "Request Withdrawal" or similar button
- [ ] Fill out form:
  - Amount: $15 (full available balance)
  - Method: PayPal (or configured method)
  - PayPal Email: testpaypal@example.com
- [ ] Click "Submit"
- [ ] Verify: Success message ("Withdrawal request submitted")
- [ ] Verify: Withdrawal appears in history with:
  - Amount: $15
  - Status: REQUESTED
  - Method: PayPal
  - Date: Today

### Test Minimum Withdrawal Validation
- [ ] Try to request withdrawal with amount: $25
- [ ] Verify: Error if balance is only $15 ("Insufficient balance")
- [ ] Try to request amount: $5 (below $50 minimum if that's the rule)
- [ ] Verify: Error ("Minimum withdrawal: $50")

### Verify Available Balance Reduced
- [ ] Dashboard now shows:
  - Available Balance: $0 (withdrawn amount reserved)
  - Pending Withdrawal: $15

---

## 9. Admin Withdrawal Processing

### View Withdrawal Request (Admin)
- [ ] Login as admin
- [ ] Navigate to `/admin/withdrawals`
- [ ] Verify: Withdrawal request appears with:
  - Affiliate name: John Affiliate
  - Amount: $15
  - Method: PayPal
  - Status: REQUESTED
  - Process buttons

### Process Withdrawal - Step 1: Start Processing
- [ ] Click "Process" or "Start Processing" button
- [ ] Add optional notes: "Processing to PayPal"
- [ ] Verify: Status changes to "PROCESSING"
- [ ] Verify: Success message shown

### Process Withdrawal - Step 2: Complete
- [ ] Click the withdrawal again
- [ ] Verify: Status is "PROCESSING"
- [ ] Click "Complete" button
- [ ] Add notes: "Sent to PayPal successfully"
- [ ] Verify: Status changes to "COMPLETED"
- [ ] Verify: Timestamp shows processed date
- [ ] Verify: Processed by admin name/ID shown

### Verify Affiliate Balance After Withdrawal
- [ ] Login as affiliate
- [ ] Go to `/affiliate/withdrawals`
- [ ] Verify: Withdrawal shows COMPLETED
- [ ] Dashboard should show:
  - Available Balance: $0
  - No pending withdrawals

---

## 10. Settings Page

### Update Profile
- [ ] Login as affiliate
- [ ] Navigate to `/affiliate/settings`
- [ ] Verify: Form shows current information:
  - First Name: John
  - Last Name: Affiliate
  - Email: testaff@example.com (read-only)
  - Company: (if configured)
  - Phone: (if configured)
- [ ] Change First Name to: "Johnny"
- [ ] Click "Save"
- [ ] Verify: Success message shown
- [ ] Verify: Change persisted in database

### Change Password
- [ ] On settings page, click "Change Password"
- [ ] Fill in form:
  - Current Password: TestPassword123
  - New Password: NewPassword456
  - Confirm Password: NewPassword456
- [ ] Click "Save"
- [ ] Verify: Success message ("Password updated")
- [ ] Logout
- [ ] Try logging in with old password: TestPassword123
- [ ] Verify: Login fails ("Invalid credentials")
- [ ] Login with new password: NewPassword456
- [ ] Verify: Success

---

## 11. Edge Cases & Error Handling

### Test Unauthorized Access
- [ ] Try accessing `/affiliate/dashboard` without login
- [ ] Verify: Redirected to `/affiliate/login`
- [ ] Try accessing `/affiliate/withdrawals` without token
- [ ] Verify: Redirected to login
- [ ] Try accessing another affiliate's data by guessing URL
- [ ] Verify: 403 Forbidden or redirected

### Test Invalid Token
- [ ] Get a valid auth token
- [ ] Modify it slightly (change one character)
- [ ] Use in Authorization header
- [ ] Verify: Request fails (401 Unauthorized)

### Test Suspended Affiliate
- [ ] Admin suspends the affiliate (status → SUSPENDED)
- [ ] Affiliate tries to login
- [ ] Verify: Login fails ("Account suspended")
- [ ] Verify: Dashboard inaccessible

### Test Duplicate Withdrawal Request
- [ ] Request withdrawal for $15 (status: REQUESTED)
- [ ] Try to request another withdrawal
- [ ] Verify: Error ("Pending withdrawal already exists")

### Test Insufficient Balance
- [ ] Available balance: $10
- [ ] Try to withdraw $15
- [ ] Verify: Error ("Insufficient balance. Available: $10.00")

---

## 12. Performance & UI Polish

### Dashboard Performance
- [ ] Dashboard page loads in under 2 seconds
- [ ] Statistics cards render smoothly
- [ ] No layout shift after load

### Leads List Performance
- [ ] With 50+ leads, page loads quickly
- [ ] Pagination works smoothly
- [ ] Filters apply without lag

### Commission Chart
- [ ] Earnings chart renders smoothly
- [ ] Chart animations are smooth
- [ ] Tooltips appear on hover

### Forms
- [ ] Form validation feedback is immediate
- [ ] Submit buttons disable during processing
- [ ] Error messages are clear and actionable

---

## 13. Navigation & Menu

### Sidebar Navigation
- [ ] All menu items clickable
- [ ] Current page highlighted
- [ ] Active page shows indicator
- [ ] Navigation items:
  - [ ] Dashboard
  - [ ] Links
  - [ ] Leads
  - [ ] Commissions
  - [ ] Withdrawals
  - [ ] Settings
  - [ ] Logout

### Header Navigation
- [ ] Affiliate name displayed
- [ ] Logout button available
- [ ] Settings link accessible

---

## 14. Admin Interface

### Admin Affiliates List
- [ ] Navigate to `/admin/affiliates`
- [ ] Verify: All affiliates listed
- [ ] Verify: Can search by email/name
- [ ] Verify: Can filter by status (PENDING, ACTIVE, SUSPENDED)
- [ ] Verify: Pagination works

### Admin Affiliate Detail
- [ ] Click on affiliate in list
- [ ] Verify: Detail page shows:
  - Profile information
  - Commission statistics
  - Links count
  - Total earnings
  - Status management
- [ ] Verify: Can edit affiliate properties
- [ ] Verify: Can change commission rate
- [ ] Verify: Can change status

---

## 15. API Testing (Technical)

### Test Affiliate Signup API
```bash
curl -X POST http://localhost:3000/api/affiliates/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "password": "ApiTest123",
    "firstName": "API",
    "lastName": "Test"
  }'
```
- [ ] Response: 201 Created
- [ ] Response includes affiliate ID
- [ ] Status: PENDING

### Test Affiliate Login API
```bash
curl -X POST http://localhost:3000/api/affiliates/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testaff@example.com",
    "password": "TestPassword123"
  }'
```
- [ ] Response: 200 OK
- [ ] Response includes JWT token
- [ ] Token can be used in Authorization header

### Test Get Affiliate Profile
```bash
curl -X GET http://localhost:3000/api/affiliates/me \
  -H "Authorization: Bearer {token}"
```
- [ ] Response: 200 OK
- [ ] Returns affiliate profile data

### Test Admin Withdrawals API
```bash
curl -X GET http://localhost:3000/api/admin/withdrawals \
  -H "Authorization: Bearer {admin_token}"
```
- [ ] Response: 200 OK
- [ ] Returns withdrawal list with pagination

---

## 16. Database Verification

### Check Affiliate Record
```sql
SELECT id, email, firstName, lastName, status, commissionRate, createdAt
FROM "Affiliate"
WHERE email = 'testaff@example.com';
```
- [ ] Record exists
- [ ] Status correct (PENDING or ACTIVE)
- [ ] Commission rate correct

### Check Link Record
```sql
SELECT id, code, affiliateId, clickCount, active, createdAt
FROM "AffiliateLink"
WHERE affiliateId = '{affiliateId}';
```
- [ ] Link exists
- [ ] Code matches created link
- [ ] Click count incremented

### Check Commission Record
```sql
SELECT id, affiliateId, leadId, amount, status, createdAt
FROM "AffiliateCommission"
WHERE affiliateId = '{affiliateId}';
```
- [ ] Commission exists for sold leads
- [ ] Amount calculated correctly
- [ ] Status reflects approval

### Check Withdrawal Record
```sql
SELECT id, affiliateId, amount, method, status, createdAt
FROM "AffiliateWithdrawal"
WHERE affiliateId = '{affiliateId}';
```
- [ ] Withdrawal request exists
- [ ] Amount and method correct
- [ ] Status transitions tracked

---

## Summary

**Total Test Cases:** 70+

**Test Categories:**
- Affiliate Management: 15 tests
- Lead Attribution: 12 tests
- Commission Management: 12 tests
- Withdrawal Management: 10 tests
- Admin Functions: 12 tests
- Technical/API: 9 tests

**Pass Criteria:**
- All tests marked with [✓]
- No critical errors or failures
- Performance within targets
- Data integrity verified

---

## Notes for Testers

1. **Use test data consistently** - Use the same email/credentials throughout for tracking
2. **Check browser console** - Look for JavaScript errors or warnings
3. **Verify database** - Spot-check database records match UI
4. **Test on multiple browsers** - If possible, test on Chrome, Firefox, Safari
5. **Test on mobile** - Check responsive design on mobile devices
6. **Document failures** - Note any issues with screenshots/steps
7. **Clear browser cache** - Between major test sections, clear cache to avoid stale data

---

**Last Updated:** 2026-01-16
**Affiliate System Version:** 1.0.0
**Test Environment:** Development (http://localhost:3000)
