# 🛠 Freelance Marketplace — Remix IDE Guide

Using **Remix IDE** is often much faster for development and testing because it runs entirely in your browser and includes a built-in blockchain environment.

This guide walks you through the **step-by-step implementation and testing** of the **Freelance Marketplace** smart contract using Remix.

---

## 📌 Step 1: Setup the File

1. Open **Remix IDE** in your browser:
   👉 [https://remix.ethereum.org/](https://remix.ethereum.org/)

2. In the **File Explorers** tab (left sidebar, top icon), click **Create New File**.

3. Name the file:

   ```text
   FreelanceMarketplace.sol
   ```

4. Copy the **entire Solidity code** from `FreelanceMarketplace.sol` and paste it into this file.

---

## ⚙️ Step 2: Compile the Contract

1. Click the **Solidity Compiler** tab (left sidebar, second icon).

2. Set the **Compiler Version** to:

   ```text
   0.8.0
   ```

3. Click **Compile FreelanceMarketplace.sol**.

4. Ensure a **green checkmark** appears on the compiler icon (no errors).

---

## 🚀 Step 3: Deploy the Contract

1. Click the **Deploy & Run Transactions** tab (left sidebar, third icon).

2. Set the following options:

   * **Environment:** `Remix VM (London)` or `Remix VM (Cancun)`
   * **Account:** Default account (each account has ~100 ETH)
   * **Contract:** `FreelanceMarketplace`

3. Click the **Deploy** button.

4. Under **Deployed Contracts**, expand your contract to access its functions.

> ℹ️ Remix provides 10–15 test accounts. You will switch between them to simulate different users.

---

## 🧪 Step 4: Testing Scenario (Role-Playing)

This is a **multi-user system**, so you must switch accounts to act as different roles.

---

### 👨‍⚖️ 1. Register the Arbiter (Admin)

* **Active Account:** 1st account (used during deployment)
* **Action:** Call `registerUser`

```text
_name: "AdminUser"
_roleIndex: 1   // Arbiter
```

* Click **transact**

> ✅ Requirement: *All users (Arbiter, Client, Freelancer) must register*

---

### 👤 2. Register a Client

* **Active Account:** Switch to **2nd account**
* **Action:** Call `registerUser`

```text
_name: "AliceClient"
_roleIndex: 2   // Client
```

* Click **transact**

---

### 👷 3. Register a Freelancer

* **Active Account:** Switch to **3rd account**
* **Action:** Call `registerUser`

```text
_name: "BobWorker"
_roleIndex: 3   // Freelancer
```

* Click **transact**

#### ✅ Verify Registration

* Call `users`
* Paste the **3rd account address**
* Confirm:

```text
reputation: 100
```

---

### 📢 4. Post a Job (Client)

* **Active Account:** Switch back to **2nd account (Client)**
* **Action:** Call `postJob`

```text
_title: "Build Website"
_category: "Dev"
_maxBudget: 2000000000000000000   // 2 ETH (Wei)
_deadline: 1735689600             // Any future timestamp
```

* Click **transact**

---

### 💰 5. Bid on Job (Freelancer)

* **Active Account:** Switch to **3rd account (Freelancer)**
* **Action:** Call `placeBid`

```text
_jobId: 1
_bidAmount: 1000000000000000000   // 1 ETH (Wei)
_proposedTime: "3 Days"
```

* Click **transact**

---

### 🤝 6. Hire Freelancer (Client) — ⚠️ Critical Step

* **Active Account:** Switch to **2nd account (Client)**

#### 💡 Important: Attach Ether Manually

The client **must send the exact bid amount** when hiring.

1. Scroll to the **top** of the **Deploy & Run** panel
2. Locate the **Value** field
3. Enter:

```text
1 Ether
```

4. Call `hireFreelancer` with:

```text
_jobId: 1
_bidIndex: 0
```

5. Click **transact**

✅ **Result:**

* Transaction succeeds
* Client balance decreases by **1 ETH**

---

### ✅ 7. Submit & Approve Work

#### Freelancer

* **Active Account:** 3rd account
* Call:

```text
submitWork(_jobId: 1)
```

#### Client

* **Active Account:** 2nd account
* Call:

```text
approveWork(_jobId: 1)
```

---

### 💰 Final Balance Check

* **Freelancer Balance:** ~`100.99 ETH`

```text
100 ETH  (initial)
+1 ETH   (payment)
-1% fee
```

---

## 🎉 Done!

You have successfully:

* Registered all roles
* Posted a job
* Placed a bid
* Hired a freelancer with escrowed payment
* Submitted and approved work
* Released funds with platform fee deduction

