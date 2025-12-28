# Arbiter Setup Guide

## ✅ Fixed: Arbiter Registration

The application now properly detects and allows arbiter registration!

---

## How Arbiter Works

### 1. **Automatic Arbiter Assignment**

When you deploy the FreelanceMarketplace contract, the deployer's address is automatically set as the Arbiter in the smart contract constructor:

```solidity
constructor() {
    arbiter = msg.sender; // Deployer is the Arbiter
}
```

### 2. **Arbiter Detection**

The frontend now:

- ✅ Checks if your MetaMask account matches the arbiter address
- ✅ Shows a special badge: **"⚖️ You are the Arbiter (Platform Owner)"**
- ✅ Adds an "Arbiter (Platform Owner)" option in the registration dropdown
- ✅ Only shows this option to the deployer account

---

## Steps to Register as Arbiter

### Step 1: Identify the Deployer Account

The arbiter must be the account that deployed the contract. This is typically the first account in your Ganache instance.

To find out which account deployed the contract:

```bash
# Check the deployment output or look at the migration transaction
truffle migrate --network development
```

The account shown in the deployment output is the arbiter.

### Step 2: Switch to Deployer Account in MetaMask

1. Open MetaMask
2. Switch to the account that deployed the contract
3. Refresh the page

### Step 3: Register as Arbiter

When you open the application with the deployer account:

1. You'll see: **"⚖️ You are the Arbiter (Platform Owner)"**
2. In the registration form, select **"Arbiter (Platform Owner)"** from the dropdown
3. Enter your name
4. Click **"Register"**
5. Confirm the MetaMask transaction
6. Wait for confirmation
7. Page will reload automatically

### Step 4: Access Arbiter Panel

After successful registration:

- You'll see the **"⚖️ Arbiter Panel"** tab
- You can view disputed jobs
- You can see total platform fees collected
- You can resolve disputes (Refund Client or Pay Freelancer)

---

## Arbiter Capabilities

Once registered as Arbiter, you can:

### 1. **View All Disputes**

- See jobs that have been disputed by clients
- View details of both client and freelancer

### 2. **Resolve Disputes**

Two options:

- **Refund Client**: Returns 100% to client, freelancer loses 20 reputation points
- **Pay Freelancer**: Pays freelancer minus platform fee (1-2%)

### 3. **Monitor Platform Fees**

- View total platform fees collected from completed jobs
- Fees are:
  - **2%** for jobs < 1 ETH
  - **1%** for jobs ≥ 1 ETH

---

## Important Notes

⚠️ **Only ONE account can be the Arbiter** - the deployer's address

⚠️ **Cannot change Arbiter** - The arbiter is set permanently in the constructor

⚠️ **Arbiter cannot be Client or Freelancer** - Once registered as Arbiter, the account is dedicated to that role

✅ **Other accounts** will only see "Client" and "Freelancer" options in registration

---

## Testing Arbiter Functionality

### 1. Register Multiple Users

- Account 1 (Deployer): Register as Arbiter
- Account 2: Register as Client
- Account 3: Register as Freelancer

### 2. Create a Dispute

- Client posts a job
- Freelancer bids
- Client hires freelancer
- Freelancer submits work
- Client disputes the job

### 3. Resolve as Arbiter

- Switch to Account 1 (Arbiter)
- Go to Arbiter Panel
- See the disputed job
- Click "Refund Client" or "Pay Freelancer"
- Verify the resolution

---

## Troubleshooting

### Problem: Arbiter option not showing

**Solution**: Make sure you're using the exact account that deployed the contract

### Problem: "Only deployer can register as Arbiter" error

**Solution**: You're not using the deployer account. Switch to the first account used for deployment.

### Problem: Already registered as Client/Freelancer

**Solution**: Each address can only have one role. Use a different account for the Arbiter.

---

## Quick Reference

| Role | Enum Value | Who Can Register |
|------|-----------|------------------|
| None | 0 | No one (default state) |
| Arbiter | 1 | Only contract deployer |
| Client | 2 | Anyone (except if already registered) |
| Freelancer | 3 | Anyone (except if already registered) |

---

Your Arbiter setup is now complete! 🎉
