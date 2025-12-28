let FreelanceMarketplace = artifacts.require("./FreelanceMarketplace.sol");

contract("FreelanceMarketplace", async function (accounts) {
  console.log("Your Available Ganache Accounts: " + accounts);

  let marketplace;
  const arbiter = accounts[0];
  const client = accounts[1];
  const freelancer = accounts[2];

  beforeEach(async function () {
    marketplace = await FreelanceMarketplace.deployed();
  });

  it("should initialize with correct arbiter", async function () {
    const arbiterAddress = await marketplace.arbiter();
    assert.equal(
      arbiterAddress,
      arbiter,
      "Arbiter should be the contract deployer"
    );
  });

  it("should allow user registration as Client", async function () {
    await marketplace.registerUser("Alice Client", 2, { from: client });

    const user = await marketplace.users(client);
    assert.equal(user.name, "Alice Client", "Client name should match");
    assert.equal(user.role, 2, "Role should be Client (2)");
    assert.equal(user.isRegistered, true, "User should be registered");
  });

  it("should allow user registration as Freelancer with 100 reputation", async function () {
    await marketplace.registerUser("Bob Freelancer", 3, { from: freelancer });

    const user = await marketplace.users(freelancer);
    assert.equal(user.name, "Bob Freelancer", "Freelancer name should match");
    assert.equal(user.role, 3, "Role should be Freelancer (3)");
    assert.equal(
      user.reputation,
      100,
      "Freelancer should start with 100 reputation"
    );
    assert.equal(user.isRegistered, true, "User should be registered");
  });

  it("should not allow duplicate registration", async function () {
    try {
      await marketplace.registerUser("Duplicate", 2, { from: client });
      assert.fail("Should not allow duplicate registration");
    } catch (error) {
      assert(
        error.message.includes("User already registered"),
        "Error message should indicate duplicate registration"
      );
    }
  });

  it("should allow Client to post a job", async function () {
    const jobTitle = "Build a Website";
    const category = "Web Development";
    const maxBudget = web3.utils.toWei("1", "ether");
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

    await marketplace.postJob(jobTitle, category, maxBudget, deadline, {
      from: client,
    });

    const jobCounter = await marketplace.jobCounter();
    assert.equal(jobCounter, 1, "Job counter should be 1");

    const job = await marketplace.jobs(1);
    assert.equal(job.title, jobTitle, "Job title should match");
    assert.equal(job.category, category, "Job category should match");
    assert.equal(job.client, client, "Job client should match");
    assert.equal(job.status, 0, "Job status should be Open (0)");
  });

  it("should allow Freelancer to place a bid", async function () {
    const bidAmount = web3.utils.toWei("0.8", "ether");
    const proposedTime = "7 days";

    await marketplace.placeBid(1, bidAmount, proposedTime, {
      from: freelancer,
    });

    // Note: There's no direct getter for bids array, but we can verify through events
    // or test the hiring function in the next test
  });

  it("should allow Client to hire a Freelancer", async function () {
    const bidAmount = web3.utils.toWei("0.8", "ether");

    const balanceBefore = await web3.eth.getBalance(marketplace.address);

    await marketplace.hireFreelancer(1, 0, {
      from: client,
      value: bidAmount,
    });

    const balanceAfter = await web3.eth.getBalance(marketplace.address);
    const job = await marketplace.jobs(1);

    assert.equal(
      job.selectedFreelancer,
      freelancer,
      "Freelancer should be selected"
    );
    assert.equal(job.status, 1, "Job status should be InProgress (1)");
    assert.equal(job.lockedAmount, bidAmount, "Locked amount should match bid");
    assert(balanceAfter > balanceBefore, "Contract balance should increase");
  });

  it("should allow Freelancer to submit work", async function () {
    const result = await marketplace.submitWork(1, { from: freelancer });

    // Check that WorkSubmitted event was emitted
    assert.equal(
      result.logs[0].event,
      "WorkSubmitted",
      "WorkSubmitted event should be emitted"
    );
  });

  it("should allow Client to approve work and pay Freelancer", async function () {
    const freelancerBalanceBefore = BigInt(
      await web3.eth.getBalance(freelancer)
    );

    await marketplace.approveWork(1, { from: client });

    const freelancerBalanceAfter = BigInt(
      await web3.eth.getBalance(freelancer)
    );
    const job = await marketplace.jobs(1);
    const freelancerUser = await marketplace.users(freelancer);

    assert.equal(job.status, 5, "Job status should be Closed (5)");
    assert.equal(
      job.lockedAmount,
      0,
      "Locked amount should be 0 after payment"
    );
    assert.equal(
      freelancerUser.reputation,
      110,
      "Freelancer reputation should increase by 10"
    );
    assert(
      freelancerBalanceAfter > freelancerBalanceBefore,
      "Freelancer balance should increase"
    );
  });
});
