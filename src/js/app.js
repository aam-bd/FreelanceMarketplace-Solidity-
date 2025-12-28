App = {
  web3Provider: null,
  contracts: {},
  account: null,
  currentUser: null,
  allJobs: [],

  // Role enum mapping
  Role: {
    None: 0,
    Arbiter: 1,
    Client: 2,
    Freelancer: 3,
  },

  // Job Status enum mapping
  JobStatus: {
    Open: 0,
    InProgress: 1,
    Completed: 2,
    Disputed: 3,
    Resolved: 4,
    Closed: 5,
  },

  init: async function () {
    return await App.initWeb3();
  },

  initWeb3: async function () {
    // Modern dapp browsers
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (error) {
        console.error("User denied account access");
        alert("Please connect your MetaMask wallet to use this application");
        return;
      }
    }
    // Legacy dapp browsers
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider(
        "http://localhost:8545"
      );
    }

    web3 = new Web3(App.web3Provider);

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", function (accounts) {
        location.reload();
      });
    }

    return App.initContract();
  },

  initContract: function () {
    $.getJSON("FreelanceMarketplace.json", function (data) {
      App.contracts.FreelanceMarketplace = TruffleContract(data);
      App.contracts.FreelanceMarketplace.setProvider(App.web3Provider);

      console.log("Contract artifact loaded");
      console.log("Available networks:", Object.keys(data.networks));

      // Listen for contract events
      App.listenForEvents();

      return App.render();
    }).fail(function (error) {
      console.error("Error loading contract artifact:", error);
      alert(
        "Error: Could not load FreelanceMarketplace.json. Please make sure the contract is deployed."
      );
    });
  },

  listenForEvents: function () {
    // Manual refresh mode to prevent duplicates
    // UI updates after each user action (post job, bid, hire, etc.)
    // This approach ensures data consistency without duplicate displays
    console.log("Event listeners initialized (manual refresh mode)");
  },

  render: async function () {
    const loader = $("#loader");
    const content = $("#mainContent");

    loader.show();
    content.addClass("hidden");

    // Check network
    web3.version.getNetwork((err, netId) => {
      if (err) {
        console.error("Error getting network:", err);
      } else {
        console.log("Connected to network ID:", netId);
      }
    });

    // Load account data
    web3.eth.getCoinbase(async function (err, account) {
      if (err === null) {
        App.account = account;
        console.log("Active account:", account);
        $("#accountAddress").html("Your Account: " + account);

        // Check if user is registered
        await App.checkUserRegistration();

        loader.hide();
        content.removeClass("hidden");
      } else {
        console.error("Error getting account:", err);
        alert("Could not get account. Please make sure MetaMask is connected.");
      }
    });
  },

  checkUserRegistration: async function () {
    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();
      const user = await instance.users(App.account);

      console.log("Checking user registration for:", App.account);
      console.log("Raw user data:", user);

      // Check if user data exists and has the expected structure
      if (!user) {
        throw new Error("No user data returned from contract");
      }

      // Handle different possible formats of returned data
      const userName = user[0] || user.name || "";
      const userRole = user[1] || user.role;
      const userReputation = user[3] || user.reputation;
      const isRegistered = user[4] !== undefined ? user[4] : user.isRegistered;

      console.log("Parsed user data:", {
        name: userName,
        role: userRole
          ? typeof userRole === "object"
            ? userRole.toNumber()
            : userRole
          : 0,
        reputation: userReputation
          ? typeof userReputation === "object"
            ? userReputation.toNumber()
            : userReputation
          : 0,
        isRegistered: isRegistered,
      });

      if (isRegistered) {
        App.currentUser = {
          name: userName,
          role:
            typeof userRole === "object"
              ? userRole.toNumber()
              : parseInt(userRole),
          reputation:
            typeof userReputation === "object"
              ? userReputation.toNumber()
              : parseInt(userReputation),
          isRegistered: isRegistered,
        };

        // Show dashboard
        $("#registrationSection").addClass("hidden");
        $("#dashboardSection").removeClass("hidden");

        // Display user info
        App.displayUserInfo();

        // Load jobs
        await App.loadJobs();
      } else {
        // Check if this account is the arbiter
        const arbiterAddress = await instance.arbiter();
        console.log("Arbiter address:", arbiterAddress);
        console.log("Current account:", App.account);

        // Show registration form
        $("#registrationSection").removeClass("hidden");
        $("#dashboardSection").addClass("hidden");

        // If this is the arbiter account, show special message and add arbiter option
        if (arbiterAddress.toLowerCase() === App.account.toLowerCase()) {
          $("#accountDisplay").html(
            "<strong>Account:</strong> " +
              App.account +
              "<br><strong>Status:</strong> Not Registered" +
              '<br><span style="color: #dc3545; font-weight: bold;">⚖️ You are the Arbiter (Platform Owner)</span>'
          );

          // Add Arbiter option to the role dropdown
          if ($("#regRole option[value='1']").length === 0) {
            $("#regRole").append(
              '<option value="1">Arbiter (Platform Owner)</option>'
            );
          }
        } else {
          $("#accountDisplay").html(
            "<strong>Account:</strong> " +
              App.account +
              "<br><strong>Status:</strong> Not Registered"
          );

          // Remove arbiter option if it exists
          $("#regRole option[value='1']").remove();
        }
      }

      // Bind form events
      App.bindEvents();
    } catch (error) {
      console.error("Error checking user registration:", error);
      console.error("Error details:", error.message);

      // Show registration form on error (assume not registered)
      $("#registrationSection").removeClass("hidden");
      $("#dashboardSection").addClass("hidden");

      try {
        // Still try to check if this is the arbiter
        const instance = await App.contracts.FreelanceMarketplace.deployed();
        const arbiterAddress = await instance.arbiter();

        if (arbiterAddress.toLowerCase() === App.account.toLowerCase()) {
          $("#accountDisplay").html(
            "<strong>Account:</strong> " +
              App.account +
              "<br><strong>Status:</strong> Not Registered (Error loading data)" +
              '<br><span style="color: #dc3545; font-weight: bold;">⚖️ You are the Arbiter (Platform Owner)</span>'
          );

          // Add Arbiter option to the role dropdown
          if ($("#regRole option[value='1']").length === 0) {
            $("#regRole").append(
              '<option value="1">Arbiter (Platform Owner)</option>'
            );
          }
        } else {
          $("#accountDisplay").html(
            "<strong>Account:</strong> " +
              App.account +
              "<br><strong>Status:</strong> Not Registered (Error loading data)"
          );
        }
      } catch (arbiterError) {
        console.error("Could not check arbiter status:", arbiterError);
        $("#accountDisplay").html(
          "<strong>Account:</strong> " +
            App.account +
            "<br><strong>Status:</strong> Not Registered (Error loading data)"
        );
      }

      // Bind form events
      App.bindEvents();
    }
  },

  displayUserInfo: function () {
    let roleName = "";
    let roleClass = "";

    // First, hide all role-specific tabs
    $("#clientTab").addClass("hidden");
    $("#freelancerTab").addClass("hidden");
    $("#arbiterTab").addClass("hidden");
    $("#postJobSection").addClass("hidden");

    // Then show only relevant tabs based on role
    switch (App.currentUser.role) {
      case App.Role.Client:
        roleName = "Client";
        roleClass = "role-client";
        $("#clientTab").removeClass("hidden");
        $("#postJobSection").removeClass("hidden");
        break;
      case App.Role.Freelancer:
        roleName = "Freelancer";
        roleClass = "role-freelancer";
        $("#freelancerTab").removeClass("hidden");
        break;
      case App.Role.Arbiter:
        roleName = "Arbiter";
        roleClass = "role-arbiter";
        $("#arbiterTab").removeClass("hidden");
        App.loadPlatformFees();
        break;
    }

    let html =
      "<strong>Account:</strong> " +
      App.account +
      '<span class="role-badge ' +
      roleClass +
      '">' +
      roleName +
      "</span>" +
      "<br><strong>Name:</strong> " +
      App.currentUser.name;

    if (App.currentUser.role === App.Role.Freelancer) {
      html +=
        '<br><strong>Reputation:</strong> <span class="reputation-score">⭐ ' +
        App.currentUser.reputation +
        "</span>";
    }

    $("#accountDisplay").html(html);
  },

  bindEvents: function () {
    $("#registrationForm").off("submit").on("submit", App.handleRegistration);
    $("#postJobForm").off("submit").on("submit", App.handlePostJob);
    $("#filterCategory").off("change").on("change", App.filterAndSortJobs);
    $("#sortJobs").off("change").on("change", App.filterAndSortJobs);
  },

  handleRegistration: async function (event) {
    event.preventDefault();

    const name = $("#regName").val().trim();
    const role = $("#regRole").val();

    if (!name || !role) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      console.log("Registering user:", name, "with role:", role);

      // Send transaction and wait for receipt
      const result = await instance.registerUser(name, role, {
        from: App.account,
      });

      // Transaction is mined
      console.log("Transaction successful!");
      console.log("Transaction hash:", result.tx);
      console.log("Transaction receipt:", result.receipt);

      // Verify the user was registered
      const user = await instance.users(App.account);

      // Handle different possible formats of returned data
      const userName = user[0] || user.name || "";
      const userRole = user[1] || user.role;
      const isRegistered = user[4] !== undefined ? user[4] : user.isRegistered;

      console.log("User after registration:", {
        name: userName,
        role: userRole
          ? typeof userRole === "object"
            ? userRole.toNumber()
            : userRole
          : 0,
        isRegistered: isRegistered,
      });

      if (isRegistered) {
        alert("Registration successful! Reloading page...");

        // Wait a moment for blockchain to fully update, then reload
        setTimeout(() => {
          location.reload();
        }, 1500);
      } else {
        alert(
          "Registration transaction completed but user not found. Please refresh the page manually."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (error.message.includes("User already registered")) {
        alert("You are already registered! Refreshing page...");
        setTimeout(() => {
          location.reload();
        }, 1000);
      } else {
        alert("Registration failed: " + error.message);
      }
    }
  },

  handlePostJob: async function (event) {
    event.preventDefault();

    const title = $("#jobTitle").val().trim();
    const category = $("#jobCategory").val();
    const budget = $("#jobBudget").val();
    const deadline = $("#jobDeadline").val();

    if (!title || !category || !budget || !deadline) {
      alert("Please fill in all fields");
      return;
    }

    try {
      // Convert budget to Wei
      const budgetWei = web3.toWei(budget, "ether");

      // Convert date to Unix timestamp
      const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);

      console.log("Posting job:", {
        title,
        category,
        budget: budget + " ETH",
        budgetWei: budgetWei.toString(),
        deadline: new Date(deadline).toISOString(),
        deadlineTimestamp,
      });

      const instance = await App.contracts.FreelanceMarketplace.deployed();

      const result = await instance.postJob(
        title,
        category,
        budgetWei,
        deadlineTimestamp,
        {
          from: App.account,
        }
      );

      console.log("Job posted! Transaction:", result.tx);

      alert("Job posted successfully!");

      // Reset form
      $("#postJobForm")[0].reset();

      // Reload jobs immediately
      await App.loadJobs();
    } catch (error) {
      console.error("Error posting job:", error);
      alert("Failed to post job: " + error.message);
    }
  },

  loadJobs: async function () {
    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();
      const jobCounter = await instance.jobCounter();

      console.log("Job counter:", jobCounter.toString());

      App.allJobs = [];

      for (let i = 1; i <= jobCounter; i++) {
        const job = await instance.jobs(i);
        console.log(`Loading job ${i}:`, job);

        // Handle different possible formats of returned data
        const jobId = job[0] || job.id;
        const client = job[1] || job.client;
        const title = job[2] || job.title;
        const category = job[3] || job.category;
        const maxBudget = job[4] || job.maxBudget;
        const deadline = job[5] || job.deadline;
        const status = job[6] || job.status;
        const lockedAmount = job[7] || job.lockedAmount;
        const selectedFreelancer = job[8] || job.selectedFreelancer;

        App.allJobs.push({
          id: typeof jobId === "object" ? jobId.toNumber() : parseInt(jobId),
          client: client,
          title: title,
          category: category,
          maxBudget: maxBudget,
          deadline:
            typeof deadline === "object"
              ? deadline.toNumber()
              : parseInt(deadline),
          status:
            typeof status === "object" ? status.toNumber() : parseInt(status),
          lockedAmount: lockedAmount,
          selectedFreelancer: selectedFreelancer,
        });
      }

      console.log("Total jobs loaded:", App.allJobs.length);
      console.log("All jobs:", App.allJobs);

      // Display jobs
      App.filterAndSortJobs();

      // Load role-specific views
      if (App.currentUser && App.currentUser.role === App.Role.Client) {
        App.loadClientJobs();
      } else if (
        App.currentUser &&
        App.currentUser.role === App.Role.Freelancer
      ) {
        App.loadFreelancerJobs();
      } else if (App.currentUser && App.currentUser.role === App.Role.Arbiter) {
        App.loadDisputedJobs();
      }
    } catch (error) {
      console.error("Error loading jobs:", error);
    }
  },

  filterAndSortJobs: function () {
    const filterCategory = $("#filterCategory").val();
    const sortBy = $("#sortJobs").val();

    console.log("Filtering jobs. Total jobs:", App.allJobs.length);

    // Filter jobs
    let filteredJobs = App.allJobs.filter(
      (job) => job.status === App.JobStatus.Open
    );

    console.log("Open jobs:", filteredJobs.length);

    if (filterCategory) {
      filteredJobs = filteredJobs.filter(
        (job) => job.category === filterCategory
      );
      console.log("After category filter:", filteredJobs.length);
    }

    // Sort jobs
    if (sortBy === "budget_desc") {
      filteredJobs.sort((a, b) => b.maxBudget - a.maxBudget);
    } else if (sortBy === "budget_asc") {
      filteredJobs.sort((a, b) => a.maxBudget - b.maxBudget);
    } else if (sortBy === "newest") {
      filteredJobs.sort((a, b) => b.id - a.id);
    }

    console.log("Displaying", filteredJobs.length, "jobs in marketplace");

    // Display jobs
    App.displayJobs(filteredJobs, "#jobListings");
  },

  displayJobs: function (jobs, containerId) {
    const container = $(containerId);
    container.empty();

    if (jobs.length === 0) {
      container.html('<div class="alert alert-info">No jobs found</div>');
      return;
    }

    jobs.forEach((job) => {
      const budgetEth = web3.fromWei(job.maxBudget, "ether");
      const deadline = new Date(job.deadline * 1000).toLocaleDateString();
      const statusText = App.getStatusText(job.status);
      const statusClass = App.getStatusClass(job.status);

      let actionButtons = "";

      // Show bid button for freelancers on open jobs
      if (
        App.currentUser &&
        App.currentUser.role === App.Role.Freelancer &&
        job.status === App.JobStatus.Open
      ) {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="App.showBidForm(${job.id})">
                          📝 Place Bid
                        </button>`;
      }

      // Show view details button for everyone
      const viewDetailsText =
        App.currentUser &&
        App.currentUser.role === App.Role.Client &&
        job.client.toLowerCase() === App.account.toLowerCase()
          ? "View Details & Bids"
          : "View Details";

      actionButtons += `<button class="btn btn-info btn-sm ml-2" onclick="App.showJobDetails(${job.id})">
                         ${viewDetailsText}
                       </button>`;

      const html = `
        <div class="card job-card">
          <div class="card-body">
            <div class="row">
              <div class="col-md-8">
                <h5 class="card-title">${job.title}</h5>
                <p class="card-text">
                  <strong>Category:</strong> ${job.category}<br>
                  <strong>Budget:</strong> ${budgetEth} ETH<br>
                  <strong>Deadline:</strong> ${deadline}
                </p>
              </div>
              <div class="col-md-4 text-right">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="mt-3">
                  ${actionButtons}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.append(html);
    });
  },

  showJobDetails: async function (jobId) {
    const job = App.allJobs.find((j) => j.id === jobId);
    if (!job) return;

    const budgetEth = web3.fromWei(job.maxBudget, "ether");
    const deadline = new Date(job.deadline * 1000).toLocaleDateString();
    const statusText = App.getStatusText(job.status);

    let content = `
      <div class="job-details">
        <p><strong>Job ID:</strong> ${job.id}</p>
        <p><strong>Title:</strong> ${job.title}</p>
        <p><strong>Category:</strong> ${job.category}</p>
        <p><strong>Max Budget:</strong> ${budgetEth} ETH</p>
        <p><strong>Deadline:</strong> ${deadline}</p>
        <p><strong>Status:</strong> ${statusText}</p>
        <p><strong>Client:</strong> ${job.client}</p>
    `;

    if (
      job.selectedFreelancer !== "0x0000000000000000000000000000000000000000"
    ) {
      content += `<p><strong>Selected Freelancer:</strong> ${job.selectedFreelancer}</p>`;

      if (job.lockedAmount > 0) {
        const lockedEth = web3.fromWei(job.lockedAmount, "ether");
        content += `<p><strong>Funds in Escrow:</strong> <span class="escrow-badge">${lockedEth} ETH 🔒</span></p>`;
      }

      // Check if work has been submitted for in-progress jobs
      if (job.status === App.JobStatus.InProgress) {
        const workSubmitted = await App.checkWorkSubmitted(job.id);
        if (workSubmitted) {
          content += `<p><strong>Work Status:</strong> <span style="color: #28a745; font-weight: bold;">✅ Work Submitted - Awaiting Approval</span></p>`;
        } else {
          content += `<p><strong>Work Status:</strong> <span style="color: #ffc107; font-weight: bold;">⏳ Freelancer Working on It</span></p>`;
        }
      }
    }

    content += "</div><hr>";

    // Load and display bids (only for job owner)
    if (App.account.toLowerCase() === job.client.toLowerCase()) {
      const bids = await App.loadBidsForJob(jobId);

      if (bids.length > 0) {
        content += "<h5>📩 Bids Received:</h5>";
        bids.forEach((bid, index) => {
          const bidAmountEth = web3.fromWei(bid.bidAmount, "ether");
          content += `
            <div class="bid-item">
              <strong>Freelancer:</strong> ${bid.freelancer}<br>
              <strong>Bid Amount:</strong> ${bidAmountEth} ETH<br>
              <strong>Proposed Time:</strong> ${bid.proposedTime}<br>
          `;

          // Show hire button if job is still open
          if (job.status === App.JobStatus.Open) {
            content += `
              <button class="btn btn-success btn-sm mt-2" onclick="App.hireFreelancer(${jobId}, ${index})">
                Hire This Freelancer
              </button>
            `;
          }

          content += "</div>";
        });
      } else {
        content += '<p class="text-muted">📭 No bids received yet</p>';
      }
    }

    $("#modalJobTitle").text(job.title);
    $("#modalJobContent").html(content);
    $("#jobDetailsModal").modal("show");
  },

  showBidForm: function (jobId) {
    const job = App.allJobs.find((j) => j.id === jobId);
    if (!job) return;

    const budgetEth = web3.fromWei(job.maxBudget, "ether");

    const content = `
      <h5>Place Your Bid</h5>
      <p><strong>Job:</strong> ${job.title}</p>
      <p><strong>Max Budget:</strong> ${budgetEth} ETH</p>
      <form id="bidForm">
        <div class="form-group">
          <label>Your Bid Amount (ETH) *</label>
          <input type="number" step="0.01" class="form-control" id="bidAmount" 
                 max="${budgetEth}" placeholder="Cannot exceed ${budgetEth} ETH" required>
          <small class="form-text text-muted">Maximum: ${budgetEth} ETH</small>
        </div>
        <div class="form-group">
          <label>Proposed Completion Time *</label>
          <input type="text" class="form-control" id="proposedTime" 
                 placeholder="e.g., 7 days, 2 weeks" required>
        </div>
        <button type="submit" class="btn btn-primary">Submit Bid</button>
      </form>
    `;

    $("#modalJobTitle").text("Place Bid - " + job.title);
    $("#modalJobContent").html(content);
    $("#jobDetailsModal").modal("show");

    $("#bidForm")
      .off("submit")
      .on("submit", function (e) {
        e.preventDefault();
        App.placeBid(jobId);
      });
  },

  placeBid: async function (jobId) {
    const bidAmount = $("#bidAmount").val();
    const proposedTime = $("#proposedTime").val().trim();

    if (!bidAmount || !proposedTime) {
      alert("Please fill in all fields");
      return;
    }

    const job = App.allJobs.find((j) => j.id === jobId);
    const maxBudgetEth = parseFloat(web3.fromWei(job.maxBudget, "ether"));

    if (parseFloat(bidAmount) > maxBudgetEth) {
      alert(`Bid amount cannot exceed the job budget of ${maxBudgetEth} ETH`);
      return;
    }

    try {
      const bidAmountWei = web3.toWei(bidAmount, "ether");
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.placeBid(jobId, bidAmountWei, proposedTime, {
        from: App.account,
      });

      alert("Bid placed successfully!");
      $("#jobDetailsModal").modal("hide");

      setTimeout(() => {
        App.loadJobs();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to place bid: " + error.message);
    }
  },

  loadBidsForJob: async function (jobId) {
    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      // Get BidPlaced events for this job
      const events = await new Promise((resolve, reject) => {
        instance
          .BidPlaced({ jobId: jobId }, { fromBlock: 0, toBlock: "latest" })
          .get((error, logs) => {
            if (error) reject(error);
            else resolve(logs);
          });
      });

      console.log(
        `Loading bids for job ${jobId}. Found ${events.length} bid events`
      );

      // Use a Map to deduplicate bids by freelancer address
      // Keep only the latest bid from each freelancer
      const bidMap = new Map();

      for (let event of events) {
        const freelancerAddress = event.args.freelancer.toLowerCase();
        const bidData = {
          jobId: event.args.jobId.toNumber(),
          freelancer: event.args.freelancer,
          bidAmount: event.args.amount,
          proposedTime: "Contact freelancer", // We can't get this from events easily
          blockNumber: event.blockNumber,
          transactionIndex: event.transactionIndex,
        };

        // If we already have a bid from this freelancer, keep the latest one
        if (
          !bidMap.has(freelancerAddress) ||
          bidMap.get(freelancerAddress).blockNumber < bidData.blockNumber
        ) {
          bidMap.set(freelancerAddress, bidData);
        }
      }

      // Convert map to array
      const bids = Array.from(bidMap.values());

      console.log(`After deduplication: ${bids.length} unique bids`);

      return bids;
    } catch (error) {
      console.error("Error loading bids:", error);
      return [];
    }
  },

  checkWorkSubmitted: async function (jobId) {
    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      // Get WorkSubmitted events for this job
      const events = await new Promise((resolve, reject) => {
        instance
          .WorkSubmitted({ jobId: jobId }, { fromBlock: 0, toBlock: "latest" })
          .get((error, logs) => {
            if (error) reject(error);
            else resolve(logs);
          });
      });

      console.log(
        `Job ${jobId}: Work submitted events found: ${events.length}`
      );

      return events.length > 0;
    } catch (error) {
      console.error("Error checking work submission:", error);
      return false;
    }
  },

  hireFreelancer: async function (jobId, bidIndex) {
    const bids = await App.loadBidsForJob(jobId);
    const bid = bids[bidIndex];

    if (!bid) {
      alert("Bid not found");
      return;
    }

    const bidAmountEth = web3.fromWei(bid.bidAmount, "ether");

    if (
      !confirm(
        `Are you sure you want to hire this freelancer for ${bidAmountEth} ETH?\n\nThis amount will be held in escrow.`
      )
    ) {
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.hireFreelancer(jobId, bidIndex, {
        from: App.account,
        value: bid.bidAmount,
      });

      alert("Freelancer hired successfully! Funds are now in escrow.");
      $("#jobDetailsModal").modal("hide");

      setTimeout(() => {
        App.loadJobs();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to hire freelancer: " + error.message);
    }
  },

  loadClientJobs: async function () {
    console.log("Loading client jobs for:", App.account);
    console.log("Total jobs in system:", App.allJobs.length);

    // Use case-insensitive comparison for Ethereum addresses
    let clientJobs = App.allJobs.filter(
      (job) => job.client.toLowerCase() === App.account.toLowerCase()
    );

    console.log("Client jobs found:", clientJobs.length);

    // Sort jobs: Active jobs first (Open, InProgress, Disputed), then Closed jobs
    clientJobs.sort((a, b) => {
      const statusPriority = {
        [App.JobStatus.InProgress]: 1,
        [App.JobStatus.Disputed]: 2,
        [App.JobStatus.Open]: 3,
        [App.JobStatus.Completed]: 4,
        [App.JobStatus.Resolved]: 5,
        [App.JobStatus.Closed]: 6,
      };

      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // If same status, sort by newest first
      return b.id - a.id;
    });

    const container = $("#clientJobs");
    container.empty();

    if (clientJobs.length === 0) {
      container.html(
        '<div class="alert alert-info">You have not posted any jobs yet</div>'
      );
      return;
    }

    // Check work submission status for each job
    const workSubmissionChecks = await Promise.all(
      clientJobs.map((job) => App.checkWorkSubmitted(job.id))
    );

    clientJobs.forEach((job, index) => {
      const budgetEth = web3.fromWei(job.maxBudget, "ether");
      const statusText = App.getStatusText(job.status);
      const statusClass = App.getStatusClass(job.status);
      const workSubmitted = workSubmissionChecks[index];

      let actionButtons = `<button class="btn btn-info btn-sm" onclick="App.showJobDetails(${job.id})">
                            View Details & Bids
                          </button>`;

      // Show approve/dispute buttons ONLY if work has been submitted
      if (job.status === App.JobStatus.InProgress && workSubmitted) {
        actionButtons += `
          <button class="btn btn-success btn-sm ml-2" onclick="App.approveWork(${job.id})">
            ✅ Approve Work
          </button>
          <button class="btn btn-warning btn-sm ml-2" onclick="App.disputeJob(${job.id})">
            ⚠️ Dispute
          </button>
        `;
      } else if (job.status === App.JobStatus.InProgress && !workSubmitted) {
        actionButtons += `
          <span class="badge badge-info ml-2" style="padding: 8px 12px; font-size: 0.9em;">
            ⏳ Waiting for freelancer to submit work
          </span>
        `;
      }

      let escrowBadge = "";
      if (job.lockedAmount > 0) {
        const lockedEth = web3.fromWei(job.lockedAmount, "ether");
        escrowBadge = `<br><span class="escrow-badge">Funds in Escrow: ${lockedEth} ETH 🔒</span>`;
      }

      // Add 'closed' class for completed/closed jobs
      const closedClass =
        job.status === App.JobStatus.Closed ||
        job.status === App.JobStatus.Completed ||
        job.status === App.JobStatus.Resolved
          ? "closed"
          : "";

      const html = `
        <div class="card job-card ${closedClass}">
          <div class="card-body">
            <div class="row">
              <div class="col-md-8">
                <h5 class="card-title">${job.title}</h5>
                <p class="card-text">
                  <strong>Category:</strong> ${job.category}<br>
                  <strong>Budget:</strong> ${budgetEth} ETH
                  ${escrowBadge}
                </p>
              </div>
              <div class="col-md-4 text-right">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="mt-3">
                  ${actionButtons}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.append(html);
    });
  },

  loadFreelancerJobs: function () {
    let freelancerJobs = App.allJobs.filter(
      (job) => job.selectedFreelancer === App.account
    );

    // Sort jobs: Active jobs first (InProgress, Disputed), then Closed jobs
    freelancerJobs.sort((a, b) => {
      const statusPriority = {
        [App.JobStatus.InProgress]: 1,
        [App.JobStatus.Disputed]: 2,
        [App.JobStatus.Completed]: 3,
        [App.JobStatus.Resolved]: 4,
        [App.JobStatus.Closed]: 5,
      };

      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // If same status, sort by newest first
      return b.id - a.id;
    });

    const container = $("#freelancerJobs");
    container.empty();

    if (freelancerJobs.length === 0) {
      container.html(
        '<div class="alert alert-info">You have not been hired for any jobs yet</div>'
      );
      return;
    }

    freelancerJobs.forEach((job) => {
      const budgetEth = web3.fromWei(job.maxBudget, "ether");
      const statusText = App.getStatusText(job.status);
      const statusClass = App.getStatusClass(job.status);

      let actionButtons = "";

      // Show submit work button for in-progress jobs
      if (job.status === App.JobStatus.InProgress) {
        actionButtons = `
          <button class="btn btn-primary btn-sm" onclick="App.submitWork(${job.id})">
            Submit Work
          </button>
        `;
      }

      let escrowBadge = "";
      if (job.lockedAmount > 0) {
        const lockedEth = web3.fromWei(job.lockedAmount, "ether");
        escrowBadge = `<br><span class="escrow-badge">Your Payment: ${lockedEth} ETH 🔒</span>`;
      }

      // Add 'closed' class for completed/closed jobs
      const closedClass =
        job.status === App.JobStatus.Closed ||
        job.status === App.JobStatus.Completed ||
        job.status === App.JobStatus.Resolved
          ? "closed"
          : "";

      const html = `
        <div class="card job-card ${closedClass}">
          <div class="card-body">
            <div class="row">
              <div class="col-md-8">
                <h5 class="card-title">${job.title}</h5>
                <p class="card-text">
                  <strong>Category:</strong> ${job.category}<br>
                  <strong>Client:</strong> ${job.client}
                  ${escrowBadge}
                </p>
              </div>
              <div class="col-md-4 text-right">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="mt-3">
                  ${actionButtons}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.append(html);
    });
  },

  submitWork: async function (jobId) {
    if (!confirm("Are you sure you want to submit your work for review?")) {
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.submitWork(jobId, { from: App.account });

      alert("Work submitted successfully! Waiting for client approval.");

      setTimeout(() => {
        App.loadJobs();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to submit work: " + error.message);
    }
  },

  approveWork: async function (jobId) {
    if (
      !confirm(
        "Are you sure you want to approve this work? Payment will be released to the freelancer."
      )
    ) {
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.approveWork(jobId, { from: App.account });

      alert("Work approved! Payment has been released to the freelancer.");

      setTimeout(() => {
        App.loadJobs();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to approve work: " + error.message);
    }
  },

  disputeJob: async function (jobId) {
    if (
      !confirm(
        "Are you sure you want to dispute this job? An arbiter will need to resolve it."
      )
    ) {
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.disputeJob(jobId, { from: App.account });

      alert("Job disputed. An arbiter will review and resolve the issue.");

      setTimeout(() => {
        App.loadJobs();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to dispute job: " + error.message);
    }
  },

  loadDisputedJobs: function () {
    const disputedJobs = App.allJobs.filter(
      (job) => job.status === App.JobStatus.Disputed
    );

    const container = $("#disputedJobs");
    container.empty();

    if (disputedJobs.length === 0) {
      container.html(
        '<div class="alert alert-info">No disputed jobs at the moment</div>'
      );
      return;
    }

    disputedJobs.forEach((job) => {
      const lockedEth = web3.fromWei(job.lockedAmount, "ether");

      const html = `
        <div class="card job-card">
          <div class="card-body">
            <h5 class="card-title">${job.title}</h5>
            <p class="card-text">
              <strong>Job ID:</strong> ${job.id}<br>
              <strong>Client:</strong> ${job.client}<br>
              <strong>Freelancer:</strong> ${job.selectedFreelancer}<br>
              <strong>Locked Amount:</strong> ${lockedEth} ETH
            </p>
            <button class="btn btn-danger btn-sm" onclick="App.resolveDispute(${job.id}, false)">
              Refund Client
            </button>
            <button class="btn btn-success btn-sm ml-2" onclick="App.resolveDispute(${job.id}, true)">
              Pay Freelancer
            </button>
          </div>
        </div>
      `;

      container.append(html);
    });
  },

  resolveDispute: async function (jobId, payFreelancer) {
    const action = payFreelancer ? "pay the freelancer" : "refund the client";

    if (!confirm(`Are you sure you want to ${action}?`)) {
      return;
    }

    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();

      await instance.resolveDispute(jobId, payFreelancer, {
        from: App.account,
      });

      alert(
        `Dispute resolved! ${
          payFreelancer
            ? "Freelancer has been paid."
            : "Client has been refunded."
        }`
      );

      setTimeout(() => {
        App.loadJobs();
        App.loadPlatformFees();
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to resolve dispute: " + error.message);
    }
  },

  loadPlatformFees: async function () {
    try {
      const instance = await App.contracts.FreelanceMarketplace.deployed();
      const fees = await instance.platformFeesCollected();
      const feesEth = web3.fromWei(fees, "ether");

      $("#platformFees").text(feesEth);
    } catch (error) {
      console.error("Error loading platform fees:", error);
    }
  },

  getStatusText: function (status) {
    switch (status) {
      case App.JobStatus.Open:
        return "Open";
      case App.JobStatus.InProgress:
        return "In Progress";
      case App.JobStatus.Completed:
        return "Completed";
      case App.JobStatus.Disputed:
        return "Disputed";
      case App.JobStatus.Resolved:
        return "Resolved";
      case App.JobStatus.Closed:
        return "Closed";
      default:
        return "Unknown";
    }
  },

  getStatusClass: function (status) {
    switch (status) {
      case App.JobStatus.Open:
        return "status-open";
      case App.JobStatus.InProgress:
        return "status-inprogress";
      case App.JobStatus.Disputed:
        return "status-disputed";
      case App.JobStatus.Completed:
      case App.JobStatus.Closed:
        return "status-closed";
      default:
        return "";
    }
  },
};

$(function () {
  $(window).on("load", function () {
    App.init();
  });
});
